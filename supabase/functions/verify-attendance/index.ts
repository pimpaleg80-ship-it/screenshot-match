import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  type GeofenceCenter,
  type VerifyAttendancePayload,
  validateAttendanceInput,
  verifyGeofencePolicy,
} from "./verification.ts";

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getCurrentTimeSecondsUtcOrServer(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseShiftTimeSeconds(timeStr: string): number | null {
  const parts = timeStr.split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const [hours = 0, minutes = 0, seconds = 0] = parts;
  return hours * 3600 + minutes * 60 + seconds;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { success: false, error: "Edge Function environment is not configured." },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return jsonResponse(
        { success: false, code: "UNAUTHORIZED", error: "Authentication token is required." },
        401,
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify caller JWT authentically via Supabase Auth
    const authVerifier = anonKey
      ? createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}` } },
        })
      : adminClient;

    const {
      data: { user },
      error: authError,
    } = await authVerifier.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse(
        { success: false, code: "UNAUTHORIZED", error: "Invalid or expired user session." },
        401,
      );
    }

    let rawBody: VerifyAttendancePayload;
    try {
      rawBody = (await req.json()) as VerifyAttendancePayload;
    } catch {
      return jsonResponse(
        { success: false, code: "INVALID_JSON", error: "Malformed JSON request body." },
        400,
      );
    }

    // Always resolve employee & organization server-side from verified user.id
    const { data: employee, error: empError } = await adminClient
      .from("employees")
      .select("id, organization_id, full_name, work_location_id, default_shift_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (empError || !employee) {
      return jsonResponse(
        { success: false, code: "EMPLOYEE_NOT_FOUND", error: "Employee profile not found." },
        403,
      );
    }

    let organizationId: string | null = employee.organization_id;
    if (!organizationId) {
      const { data: membership } = await adminClient
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      organizationId = membership?.organization_id ?? null;
    }

    if (!organizationId) {
      return jsonResponse(
        { success: false, code: "ORG_REQUIRED", error: "Employee organization membership not found." },
        403,
      );
    }

    const validation = validateAttendanceInput(rawBody, Date.now());
    if (!validation.ok) {
      // Log spoof/mock attempts without exposing internals
      if (validation.code === "MOCK_LOCATION_DETECTED") {
        await adminClient.from("geofence_events").insert({
          organization_id: organizationId,
          employee_id: employee.id,
          location_id: employee.work_location_id,
          event_type: "EXIT",
          latitude: typeof rawBody.latitude === "number" ? rawBody.latitude : null,
          longitude: typeof rawBody.longitude === "number" ? rawBody.longitude : null,
          accuracy_meters: typeof rawBody.accuracy === "number" ? rawBody.accuracy : null,
          is_mock: true,
          location_source: typeof rawBody.location_source === "string" ? rawBody.location_source : "gps",
        });
      }
      return jsonResponse(
        { success: false, code: validation.code, error: validation.error },
        validation.status,
      );
    }

    const input = validation.data;

    // Resolve active Main Office / assigned work_locations strictly within employee's organization
    let activeLocation: GeofenceCenter | null = null;

    if (employee.work_location_id) {
      const { data: assignedLoc } = await adminClient
        .from("work_locations")
        .select("id, organization_id, name, latitude, longitude, radius_meters, is_active")
        .eq("id", employee.work_location_id)
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .maybeSingle();
      if (assignedLoc) activeLocation = assignedLoc as GeofenceCenter;
    }

    if (!activeLocation) {
      const { data: assignments } = await adminClient
        .from("employee_location_assignments")
        .select(
          "location_id, is_primary, work_locations!inner(id, organization_id, name, latitude, longitude, radius_meters, is_active)",
        )
        .eq("employee_id", employee.id)
        .order("is_primary", { ascending: false })
        .limit(5);

      const matched = (assignments ?? [])
        .map((row) => (row as { work_locations?: GeofenceCenter }).work_locations)
        .find((wl) => wl && wl.organization_id === organizationId && wl.is_active);
      if (matched) activeLocation = matched;
    }

    if (!activeLocation) {
      const { data: orgLoc } = await adminClient
        .from("work_locations")
        .select("id, organization_id, name, latitude, longitude, radius_meters, is_active")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (orgLoc) activeLocation = orgLoc as GeofenceCenter;
    }

    const todayDate = getCurrentTimeSecondsUtcOrServer();
    const { data: todayAttendance, error: attFetchError } = await adminClient
      .from("attendance")
      .select("id, check_in, check_out")
      .eq("employee_id", employee.id)
      .eq("date", todayDate)
      .maybeSingle();

    if (attFetchError) {
      return jsonResponse(
        { success: false, code: "ATTENDANCE_LOOKUP_FAILED", error: "Failed to check today's attendance state." },
        500,
      );
    }

    const policy = verifyGeofencePolicy({
      input,
      location: activeLocation,
      todayAttendance,
    });

    if (!policy.allowed) {
      if (policy.code === "OUTSIDE_GEOFENCE" && activeLocation) {
        await adminClient.from("geofence_events").insert({
          organization_id: organizationId,
          employee_id: employee.id,
          location_id: activeLocation.id,
          event_type: "EXIT",
          latitude: input.latitude,
          longitude: input.longitude,
          accuracy_meters: input.accuracy,
          is_mock: false,
          location_source: input.locationSource,
        });
      }

      return jsonResponse(
        {
          success: false,
          code: policy.code,
          error: policy.error,
          distance_meters: policy.distanceMeters ?? null,
          allowed_radius: policy.allowedRadius ?? null,
          location_name: activeLocation?.name ?? null,
        },
        policy.status,
      );
    }

    // Bind device record if provided
    let registeredDeviceId: string | null = null;
    if (input.deviceId) {
      const { data: existingDevice } = await adminClient
        .from("registered_devices")
        .select("id")
        .eq("employee_id", employee.id)
        .eq("device_uuid", input.deviceId)
        .maybeSingle();

      if (existingDevice?.id) {
        registeredDeviceId = existingDevice.id;
      } else {
        const { data: insertedDevice } = await adminClient
          .from("registered_devices")
          .insert({
            employee_id: employee.id,
            device_uuid: input.deviceId,
            device_model: "Web/Mobile Client",
          })
          .select("id")
          .maybeSingle();
        registeredDeviceId = insertedDevice?.id ?? null;
      }
    }

    const nowIso = new Date().toISOString();

    if (input.action === "check_in") {
      let attendanceStatus: "present" | "late" = "present";
      const shiftId = employee.default_shift_id;
      if (shiftId) {
        const { data: shift } = await adminClient
          .from("shifts")
          .select("start_time, late_grace_minutes, grace_period_minutes")
          .eq("id", shiftId)
          .eq("organization_id", organizationId)
          .maybeSingle();
        if (shift?.start_time) {
          const shiftSec = parseShiftTimeSeconds(shift.start_time);
          const nowDate = new Date();
          const currentSec =
            nowDate.getUTCHours() * 3600 + nowDate.getUTCMinutes() * 60 + nowDate.getUTCSeconds();
          const graceMin = shift.late_grace_minutes ?? shift.grace_period_minutes ?? 15;
          if (shiftSec !== null && currentSec > shiftSec + graceMin * 60) {
            attendanceStatus = "late";
          }
        }
      }

      let attendanceId: string | null = null;

      if (todayAttendance?.id) {
        const { data: updated, error: updateErr } = await adminClient
          .from("attendance")
          .update({
            check_in: nowIso,
            status: attendanceStatus,
            method: "geofence",
            work_location_id: activeLocation!.id,
            check_in_lat: input.latitude,
            check_in_lon: input.longitude,
            device_id: registeredDeviceId,
            location_source: input.locationSource,
            updated_at: nowIso,
          })
          .eq("id", todayAttendance.id)
          .is("check_in", null)
          .select("id")
          .maybeSingle();

        if (updateErr || !updated) {
          return jsonResponse(
            { success: false, code: "ALREADY_CHECKED_IN", error: "You have already checked in for today." },
            409,
          );
        }
        attendanceId = updated.id;
      } else {
        const { data: inserted, error: insertErr } = await adminClient
          .from("attendance")
          .insert({
            organization_id: organizationId,
            employee_id: employee.id,
            date: todayDate,
            check_in: nowIso,
            status: attendanceStatus,
            method: "geofence",
            work_location_id: activeLocation!.id,
            check_in_lat: input.latitude,
            check_in_lon: input.longitude,
            device_id: registeredDeviceId,
            location_source: input.locationSource,
          })
          .select("id")
          .single();

        if (insertErr) {
          if (insertErr.code === "23505") {
            return jsonResponse(
              { success: false, code: "ALREADY_CHECKED_IN", error: "You have already checked in for today." },
              409,
            );
          }
          return jsonResponse(
            { success: false, code: "ATTENDANCE_WRITE_FAILED", error: insertErr.message },
            500,
          );
        }
        attendanceId = inserted.id;
      }

      await adminClient.from("geofence_events").insert({
        organization_id: organizationId,
        employee_id: employee.id,
        location_id: activeLocation!.id,
        event_type: "ENTER",
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy_meters: input.accuracy,
        is_mock: false,
        location_source: input.locationSource,
      });

      return jsonResponse({
        success: true,
        action: "check_in",
        attendance_id: attendanceId,
        time: nowIso,
        status: attendanceStatus,
        location_name: activeLocation!.name,
        distance_meters: policy.distanceMeters,
        allowed_radius: policy.allowedRadius,
        source: input.locationSource,
      });
    }

    // check_out flow
    const checkInMs = Date.parse(todayAttendance!.check_in!);
    const totalHours = Number.isFinite(checkInMs)
      ? Math.max(0, Math.round(((Date.now() - checkInMs) / 3600000) * 100) / 100)
      : 0;

    const { data: checkedOutRow, error: checkoutErr } = await adminClient
      .from("attendance")
      .update({
        check_out: nowIso,
        check_out_lat: input.latitude,
        check_out_lon: input.longitude,
        total_hours: totalHours,
        working_hours: totalHours,
        location_source: input.locationSource,
        updated_at: nowIso,
      })
      .eq("id", todayAttendance!.id)
      .is("check_out", null)
      .select("id")
      .maybeSingle();

    if (checkoutErr) {
      return jsonResponse(
        { success: false, code: "ATTENDANCE_WRITE_FAILED", error: checkoutErr.message },
        500,
      );
    }

    if (!checkedOutRow) {
      return jsonResponse(
        { success: false, code: "ALREADY_CHECKED_OUT", error: "You have already checked out for today." },
        409,
      );
    }

    await adminClient.from("geofence_events").insert({
      organization_id: organizationId,
      employee_id: employee.id,
      location_id: activeLocation!.id,
      event_type: "EXIT",
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy_meters: input.accuracy,
      is_mock: false,
      location_source: input.locationSource,
    });

    return jsonResponse({
      success: true,
      action: "check_out",
      attendance_id: checkedOutRow.id,
      time: nowIso,
      total_hours: totalHours,
      location_name: activeLocation!.name,
      distance_meters: policy.distanceMeters,
      allowed_radius: policy.allowedRadius,
      source: input.locationSource,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected verification error";
    return jsonResponse({ success: false, code: "INTERNAL_ERROR", error: message }, 500);
  }
});

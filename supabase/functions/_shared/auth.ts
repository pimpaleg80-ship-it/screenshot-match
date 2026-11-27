import { corsHeaders } from "./cors.ts";

export interface AuthOptions {
  allowCron?: boolean;
  requireAdmin?: boolean;
}

export async function requireAuthorizedRequest(
  req: Request,
  supabase: any,
  options: AuthOptions = {},
): Promise<{ ok: true; userId?: string } | { ok: false; response: Response }> {
  const { allowCron = false, requireAdmin = true } = options;
  const cronSecret = Deno.env.get("LOVABLE_CRON_SECRET");
  const authHeader = req.headers.get("authorization") || "";
  const headerCronSecret = req.headers.get("x-cron-secret") || "";

  if (
    allowCron &&
    cronSecret &&
    (authHeader === `Bearer ${cronSecret}` || headerCronSecret === cronSecret)
  ) {
    return { ok: true };
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return { ok: true };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id as string | undefined;
  if (userErr || !userId) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ success: false, error: "Unauthorized: Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  if (!requireAdmin) {
    return { ok: true, userId };
  }

  const [{ data: emp }, { data: roleRow }, { data: memberRow }] = await Promise.all([
    supabase.from("employees").select("is_superadmin").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
    supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const isPrivileged =
    Boolean(emp?.is_superadmin) ||
    roleRow?.role === "admin" ||
    memberRow?.role === "super_admin" ||
    memberRow?.role === "org_admin";

  if (!isPrivileged) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Forbidden: Administrator access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  return { ok: true, userId };
}

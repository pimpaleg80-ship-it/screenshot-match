/** Attendance status + export helpers (pure, isomorphic). */

export type AttendanceStatus = "present" | "late" | "half_day" | "absent";

export const STATUS_LABELS: Record<string, string> = {
  present: "Present",
  late: "Late",
  half_day: "Half-day",
  absent: "Absent",
};

export const STATUS_COLORS: Record<string, string> = {
  present: "bg-success/15 text-success-foreground dark:text-success border-success/30",
  late: "bg-warning/20 text-warning-foreground border-warning/40",
  half_day: "bg-primary/10 text-primary border-primary/30",
  absent: "bg-destructive/10 text-destructive border-destructive/30",
};

/** Local YYYY-MM-DD for a Date. */
export function toDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isWeeklyOff(d: Date, weeklyOffDays: number[]): boolean {
  return weeklyOffDays.includes(d.getDay());
}

/** Hours between two timestamps (or null). */
export function totalHours(checkIn: string | null, checkOut: string | null): number | null {
  if (!checkIn || !checkOut) return null;
  const ms = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  if (ms <= 0) return null;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

export function formatTime(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(d: string | Date): string {
  return new Date(d).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatHours(h: number | null): string {
  if (h === null) return "—";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm === 0 ? `${hh}h` : `${hh}h ${mm}m`;
}

/** CSV export from rows of string cells. */
export function exportCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Print a table (browser print dialog → Save as PDF). */
export function printTable(title: string, headers: string[], rows: (string | number | null)[][]) {
  const esc = (s: unknown) => {
    const el = document.createElement("div");
    el.textContent = s === null || s === undefined ? "" : String(s);
    return el.innerHTML;
  };
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${esc(title)}</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #f4f5fa; }
    </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="meta">Generated ${new Date().toLocaleString()}</div>
    <table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>
    <script>window.onload = () => window.print()</script>
    </body></html>`);
  w.document.close();
}

/** Deterministic 32-bit hash → seeded PRNG (for tests / stable seeds). */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface ShiftConfig {
  id?: string;
  name?: string;
  start_time: string; // "09:00:00"
  end_time: string; // "18:00:00"
  break_duration_minutes?: number | null;
  grace_period_minutes?: number | null;
  early_departure_grace_minutes?: number | null;
  half_day_min_hours?: number | null;
  full_day_min_hours?: number | null;
  is_night_shift?: boolean | null;
}

export interface AttendanceMetricsResult {
  working_hours: number;
  overtime_hours: number;
  is_late: boolean;
  late_minutes: number;
  is_early_departure: boolean;
  early_departure_minutes: number;
  is_half_day: boolean;
  status: AttendanceStatus;
}

/** Parses "HH:mm" or "HH:mm:ss" into total minutes from midnight */
export function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(":");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  return h * 60 + m;
}

/** Computes shift scheduled duration in minutes, accurately supporting overnight shifts */
export function getShiftScheduledMinutes(
  startTimeOrShift: string | ShiftConfig,
  endTime?: string,
  isNightShift?: boolean
): number {
  let start: string;
  let end: string;
  let night = false;

  if (typeof startTimeOrShift === "object" && startTimeOrShift !== null) {
    start = startTimeOrShift.start_time;
    end = startTimeOrShift.end_time;
    night = !!startTimeOrShift.is_night_shift;
  } else {
    start = startTimeOrShift;
    end = endTime || "18:00:00";
    night = !!isNightShift;
  }

  const startMins = timeToMinutes(start);
  const endMins = timeToMinutes(end);
  if (endMins < startMins || night) {
    return (1440 - startMins) + endMins;
  }
  return endMins - startMins;
}

/** Extracts minutes from midnight from an ISO string, Date, or HH:mm string */
export function extractTimeMinutes(timeOrIso: string): number {
  if (!timeOrIso) return 0;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeOrIso)) {
    return timeToMinutes(timeOrIso);
  }
  // Check if string has explicit "T" without timezone suffix, treat as local time
  const match = timeOrIso.match(/T(\d{2}):(\d{2})/);
  if (match && !timeOrIso.endsWith("Z") && !timeOrIso.slice(10).includes("+") && !timeOrIso.slice(10).includes("-")) {
    const h = parseInt(match[1] ?? "0", 10);
    const m = parseInt(match[2] ?? "0", 10);
    return h * 60 + m;
  }
  const d = new Date(timeOrIso);
  if (!isNaN(d.getTime())) {
    return d.getHours() * 60 + d.getMinutes();
  }
  return 0;
}

/** Comprehensive client-side calculation of attendance metrics against shift rules */
export function calculateShiftMetrics(
  checkInIso: string | null,
  checkOutIso: string | null,
  shift?: ShiftConfig | null
): AttendanceMetricsResult {
  const defaultShift: ShiftConfig = {
    start_time: "09:00:00",
    end_time: "18:00:00",
    break_duration_minutes: 60,
    grace_period_minutes: 15,
    early_departure_grace_minutes: 15,
    half_day_min_hours: 4.0,
    full_day_min_hours: 8.0,
    is_night_shift: false,
  };

  const s = shift || defaultShift;
  const graceMins = s.grace_period_minutes ?? 15;
  const earlyGraceMins = s.early_departure_grace_minutes ?? 15;
  const breakMins = s.break_duration_minutes ?? 60;
  const halfDayHrs = s.half_day_min_hours ?? 4.0;

  let is_late = false;
  let late_minutes = 0;
  let is_early_departure = false;
  let early_departure_minutes = 0;
  let working_hours = 0;
  let overtime_hours = 0;
  let is_half_day = false;
  let status: AttendanceStatus = "present";

  const scheduledDurationMins = getShiftScheduledMinutes(s.start_time, s.end_time, !!s.is_night_shift);
  const scheduledNetMins = Math.max(0, scheduledDurationMins - breakMins);

  if (checkInIso) {
    const inMins = extractTimeMinutes(checkInIso);
    const shiftStartMins = timeToMinutes(s.start_time);
    const graceCutoff = shiftStartMins + graceMins;

    if (inMins > graceCutoff) {
      is_late = true;
      late_minutes = inMins - shiftStartMins;
    }
  }

  if (checkInIso && checkOutIso) {
    const inMs = new Date(checkInIso).getTime();
    const outMs = new Date(checkOutIso).getTime();
    const diffMins = Math.max(0, Math.round((outMs - inMs) / 60000));

    // Deduct unpaid break duration if elapsed time exceeds break time
    const netMins = diffMins > breakMins ? diffMins - breakMins : diffMins;
    working_hours = Math.round((netMins / 60) * 100) / 100;

    // Overtime
    if (netMins > scheduledNetMins) {
      overtime_hours = Math.round(((netMins - scheduledNetMins) / 60) * 100) / 100;
    }

    // Early departure check
    const outMins = extractTimeMinutes(checkOutIso);
    const shiftEndMins = timeToMinutes(s.end_time);

    if (outMins < (shiftEndMins - earlyGraceMins)) {
      is_early_departure = true;
      early_departure_minutes = shiftEndMins - outMins;
    }

    if (working_hours < halfDayHrs) {
      is_half_day = true;
      status = "half_day";
    } else if (is_late) {
      status = "late";
    } else {
      status = "present";
    }
  } else if (checkInIso) {
    status = is_late ? "late" : "present";
  }

  return {
    working_hours,
    overtime_hours,
    is_late,
    late_minutes,
    is_early_departure,
    early_departure_minutes,
    is_half_day,
    status,
  };
}

/**
 * Haversine formula to compute distance in meters between two GPS coordinates.
 */
export function calculateGeofenceDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export interface GeofenceZoneItem {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  address?: string | null;
}

/**
 * Checks whether user coordinates fall within any active work location zone.
 */
export function verifyGeofenceLocation(
  userLat: number,
  userLon: number,
  zones: GeofenceZoneItem[]
): { isInside: boolean; nearestZone?: GeofenceZoneItem | undefined; distanceMeters: number } {
  if (!zones || zones.length === 0) {
    return { isInside: true, distanceMeters: 0 };
  }
  let minDistance = Infinity;
  let closestZone: GeofenceZoneItem | undefined;

  for (const zone of zones) {
    if (typeof zone.latitude === "number" && typeof zone.longitude === "number") {
      const dist = calculateGeofenceDistance(userLat, userLon, zone.latitude, zone.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        closestZone = zone;
      }
    }
  }

  const allowedRadius = closestZone?.radius_meters || 100;
  const isInside = closestZone ? minDistance <= allowedRadius : false;

  return {
    isInside,
    nearestZone: closestZone,
    distanceMeters: minDistance === Infinity ? 0 : minDistance,
  };
}

/**
 * Human-readable distance format (e.g. "45m" or "1.2 km").
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

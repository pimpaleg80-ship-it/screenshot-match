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
  const m = String(d.getMonth() + 1).toLocaleString("en-US", { minimumIntegerDigits: 2 });
  const day = String(d.getDate()).toLocaleString("en-US", { minimumIntegerDigits: 2 });
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
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
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

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  CalendarDays,
  Calendar,
  Briefcase,
  CheckCircle2,
  Sparkles,
  Sun,
  Moon,
  ArrowLeftRight,
  ShieldAlert,
  Coffee,
  Hourglass,
  Repeat,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/attendance";
import { ShiftSwapRequestDialog } from "@/components/shifts/ShiftSwapRequestDialog";

interface SelfServiceShiftHolidaysProps {
  shiftId?: string | null | undefined;
  employeeId?: string | null | undefined;
}

interface ShiftData {
  id: string;
  name: string;
  code: string | null;
  start_time: string;
  end_time: string;
  work_days: string[] | null;
  break_duration_minutes?: number;
  grace_period_minutes?: number;
  early_departure_grace_minutes?: number;
  half_day_min_hours?: number;
  full_day_min_hours?: number;
  is_night_shift?: boolean;
  is_rotating?: boolean;
  rotation_pattern?: string | null;
  color?: string | null;
}

interface HolidayItem {
  id: string;
  name: string;
  date: string;
  is_optional: boolean;
}

interface SwapRequestItem {
  id: string;
  swap_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  admin_notes: string | null;
  requested_shift?: {
    name: string;
    code: string | null;
    start_time: string;
    end_time: string;
  } | null;
  target_employee?: {
    full_name: string;
  } | null;
}

export function SelfServiceShiftHolidays({ shiftId, employeeId }: SelfServiceShiftHolidaysProps) {
  const currentYear = new Date().getFullYear();
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);

  // Query Shift Details
  const { data: shift, isLoading: shiftLoading } = useQuery({
    queryKey: ["my-shift-details", shiftId],
    queryFn: async () => {
      if (!shiftId) {
        // Return default general shift
        const { data } = await supabase.from("shifts").select("*").limit(1).maybeSingle();
        return data as ShiftData | null;
      }
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", shiftId)
        .maybeSingle();
      if (error) throw error;
      return data as ShiftData | null;
    },
  });

  // Query Employee's Shift Swap Requests
  const { data: mySwapRequests = [] } = useQuery({
    queryKey: ["my-shift-swap-requests", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("shift_swap_requests")
        .select(`
          id, swap_date, reason, status, created_at, admin_notes,
          requested_shift:shifts!shift_swap_requests_requested_shift_id_fkey(name, code, start_time, end_time),
          target_employee:employees!shift_swap_requests_target_employee_id_fkey(full_name)
        `)
        .eq("requester_employee_id", employeeId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) return [];
      return (data ?? []) as unknown as SwapRequestItem[];
    },
    enabled: !!employeeId,
  });

  // Query Holidays
  const { data: holidays = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ["company-holidays", currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("id, name, date, is_optional")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HolidayItem[];
    },
  });

  function formatShiftTime(timeStr: string): string {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    const h = parseInt(parts[0] ?? "0", 10);
    const m = parts[1] || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const formattedH = h % 12 || 12;
    return `${formattedH}:${m} ${ampm}`;
  }

  function getDaysUntil(dateStr: string): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + "T00:00:00");
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays > 1) return `In ${diffDays} days`;
    return "Past";
  }

  return (
    <div className="space-y-6">
      {/* Shift Information Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> My Assigned Shift Schedule
              </CardTitle>
              <CardDescription className="text-xs">
                Your designated working hours, roster timings, grace rules, and attendance requirements.
              </CardDescription>
            </div>

            {employeeId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSwapDialogOpen(true)}
                className="gap-1.5 text-xs h-9 border-primary/20 text-primary hover:bg-primary/5 self-start sm:self-auto"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Request Shift Swap / Change
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {shiftLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : shift ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3 bg-muted/20 p-4 rounded-lg border">
                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Shift Name & Code
                  </span>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-base text-foreground">{shift.name}</p>
                    {shift.code && (
                      <Badge variant="outline" className="font-mono text-xs">
                        {shift.code}
                      </Badge>
                    )}
                  </div>
                  {shift.is_night_shift && (
                    <Badge variant="secondary" className="gap-1 bg-indigo-500/10 text-indigo-600 border-indigo-200 text-[10px]">
                      <Moon className="h-3 w-3" /> Overnight Shift
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Roster Timings
                  </span>
                  <p className="font-semibold text-sm font-mono text-foreground flex items-center gap-1.5">
                    {shift.is_night_shift ? (
                      <Moon className="h-4 w-4 text-indigo-500" />
                    ) : (
                      <Sun className="h-4 w-4 text-amber-500" />
                    )}
                    {formatShiftTime(shift.start_time)} – {formatShiftTime(shift.end_time)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Break: {shift.break_duration_minutes ?? 60} mins unpaid deduction
                  </p>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    Assigned Working Days
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(shift.work_days || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]).map((day) => (
                      <Badge
                        key={day}
                        variant="secondary"
                        className="text-[11px] font-medium bg-primary/10 text-primary border-primary/20"
                      >
                        {day.slice(0, 3)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shift Compliance & Grace Rules */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg border bg-card space-y-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-500" /> Check-in Grace
                  </span>
                  <p className="text-sm font-semibold">{shift.grace_period_minutes ?? 15} minutes</p>
                  <p className="text-[10px] text-muted-foreground">Late after this buffer</p>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 text-orange-500" /> Early Departure Grace
                  </span>
                  <p className="text-sm font-semibold">{shift.early_departure_grace_minutes ?? 15} minutes</p>
                  <p className="text-[10px] text-muted-foreground">Allowed early departure buffer</p>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <Coffee className="h-3 w-3 text-blue-500" /> Break Allowance
                  </span>
                  <p className="text-sm font-semibold">{shift.break_duration_minutes ?? 60} minutes</p>
                  <p className="text-[10px] text-muted-foreground">Deducted from gross duration</p>
                </div>

                <div className="p-3 rounded-lg border bg-card space-y-0.5">
                  <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                    <Hourglass className="h-3 w-3 text-emerald-500" /> Full Day Threshold
                  </span>
                  <p className="text-sm font-semibold">{shift.full_day_min_hours ?? 8.0} hrs</p>
                  <p className="text-[10px] text-muted-foreground">Half day if &lt; {shift.half_day_min_hours ?? 4.5} hrs</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No specific shift assigned. Operating under General Office Hours (9:00 AM – 6:00 PM).
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Shift Swap Requests Status */}
      {employeeId && mySwapRequests.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" /> My Recent Shift Swap & Change Requests
            </CardTitle>
            <CardDescription className="text-xs">
              Status of your submitted shift change requests and colleague swap applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                    <th className="py-2.5 px-3">Swap Date</th>
                    <th className="py-2.5 px-3">Target Shift / Colleague</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Admin Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mySwapRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-muted/20">
                      <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                        {formatDate(req.swap_date)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {req.requested_shift ? (
                          <span className="font-semibold">{req.requested_shift.name}</span>
                        ) : req.target_employee ? (
                          <span>Swap with {req.target_employee.full_name}</span>
                        ) : (
                          <span className="text-muted-foreground">General Shift</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground truncate max-w-[200px]">
                        {req.reason}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] capitalize ${
                            req.status === "approved"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-200"
                              : req.status === "rejected"
                              ? "bg-rose-500/10 text-rose-600 border-rose-200"
                              : "bg-amber-500/10 text-amber-600 border-amber-200"
                          }`}
                        >
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {req.admin_notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Holidays Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" /> Official Company Holidays ({currentYear})
              </CardTitle>
              <CardDescription className="text-xs">
                Corporate calendar and approved public holidays for {currentYear}.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              {holidays.length} Holidays
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {holidaysLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : holidays.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <Calendar className="mx-auto h-8 w-8 opacity-40 mb-2" />
              No holidays registered for this calendar year.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {holidays.map((h) => {
                const countdown = getDaysUntil(h.date);
                const isPast = countdown === "Past";
                const dateObj = new Date(h.date + "T00:00:00");
                const dayOfWeek = dateObj.toLocaleDateString("en-US", { weekday: "short" });

                return (
                  <div
                    key={h.id}
                    className={`rounded-lg border p-3.5 space-y-2 transition-colors ${
                      isPast ? "bg-muted/10 opacity-70" : "bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {dayOfWeek}, {formatDate(h.date)}
                        </span>
                        <h4 className="font-semibold text-sm text-foreground leading-tight">
                          {h.name}
                        </h4>
                      </div>
                      <Badge
                        variant={isPast ? "outline" : "secondary"}
                        className={`text-[10px] shrink-0 ${
                          countdown === "Today" || countdown === "Tomorrow"
                            ? "bg-emerald-500/10 text-emerald-600 font-bold"
                            : ""
                        }`}
                      >
                        {countdown}
                      </Badge>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t">
                      <span>{h.is_optional ? "Optional Floating Holiday" : "Mandatory Public Holiday"}</span>
                      {h.is_optional ? (
                        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                          Optional
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">
                          Mandatory
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shift Swap Dialog */}
      {employeeId && (
        <ShiftSwapRequestDialog
          open={swapDialogOpen}
          onOpenChange={setSwapDialogOpen}
          employeeId={employeeId}
          currentShiftId={shift?.id}
        />
      )}
    </div>
  );
}

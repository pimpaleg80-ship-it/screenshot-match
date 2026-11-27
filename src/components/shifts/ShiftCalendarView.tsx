import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toDateKey } from "@/lib/attendance";

interface ShiftCalendarViewProps {
  organizationId?: string | null;
}

export function ShiftCalendarView({ organizationId }: ShiftCalendarViewProps) {
  const [selectedDept, setSelectedDept] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate Monday of current target week
  const weekDates = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day; // Monday start
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + weekOffset * 7);

    const dates: Array<{ date: Date; dateStr: string; dayName: string; formatted: string }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push({
        date: d,
        dateStr: toDateKey(d),
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        formatted: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      });
    }
    return dates;
  }, [weekOffset]);

  // Query employees with their assigned shifts
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["shift-calendar-employees", selectedDept],
    queryFn: async () => {
      let q = supabase
        .from("employees")
        .select(`
          id,
          full_name,
          employee_code,
          department_id,
          shift_id,
          departments (name),
          shifts (id, name, code, start_time, end_time, work_days, color, is_night_shift)
        `)
        .eq("status", "active")
        .neq("is_superadmin", true)
        .order("full_name");

      if (selectedDept !== "all") {
        q = q.eq("department_id", selectedDept);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Query departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ["departments-shift-calendar"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name").order("name");
      return data || [];
    },
  });

  const weekRangeLabel = `${weekDates[0]?.formatted} – ${weekDates[6]?.formatted}, ${weekDates[0]?.date.getFullYear()}`;
  const todayKey = toDateKey(new Date());

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" /> Shift Roster Schedule
            </CardTitle>
            <CardDescription className="text-xs">
              Weekly shift allocations, roster timings, and team coverage across departments.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((d: any) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center rounded-lg border bg-card">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWeekOffset(weekOffset - 1)}
                className="h-8 w-8 text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2.5 text-xs font-semibold whitespace-nowrap">{weekRangeLabel}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setWeekOffset(weekOffset + 1)}
                className="h-8 w-8 text-muted-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {weekOffset !== 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset(0)}
                className="h-8 text-xs"
              >
                Current Week
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : employees.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            <Users className="mx-auto h-8 w-8 opacity-40 mb-2" />
            No employees found for the selected department.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                  <th className="py-2.5 px-3 min-w-[180px]">Employee</th>
                  {weekDates.map((day) => {
                    const isToday = day.dateStr === todayKey;
                    return (
                      <th
                        key={day.dateStr}
                        className={`py-2 px-2.5 text-center min-w-[110px] ${
                          isToday ? "bg-primary/10 text-primary font-bold" : ""
                        }`}
                      >
                        <span className="block text-[10px] uppercase tracking-wider">{day.dayName}</span>
                        <span className="text-xs">{day.formatted}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.map((emp: any) => {
                  const shift = emp.shifts;
                  const shiftWorkDays = (shift?.work_days as string[]) || [
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                  ];

                  return (
                    <tr key={emp.id} className="hover:bg-muted/15 transition-colors">
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-foreground text-xs">{emp.full_name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {emp.employee_code} • {emp.departments?.name || "General"}
                        </p>
                      </td>

                      {weekDates.map((day) => {
                        const fullDayName = day.date.toLocaleDateString("en-US", { weekday: "long" });
                        const isWorkingDay = shiftWorkDays.includes(fullDayName);
                        const isToday = day.dateStr === todayKey;

                        return (
                          <td
                            key={day.dateStr}
                            className={`py-2 px-1.5 text-center ${isToday ? "bg-primary/5" : ""}`}
                          >
                            {shift && isWorkingDay ? (
                              <div
                                className="rounded-lg p-1.5 border text-center transition-all shadow-2xs"
                                style={{
                                  backgroundColor: `${shift.color || "#3b82f6"}12`,
                                  borderColor: `${shift.color || "#3b82f6"}35`,
                                }}
                              >
                                <p
                                  className="font-bold text-[11px] leading-tight truncate"
                                  style={{ color: shift.color || "#3b82f6" }}
                                >
                                  {shift.code || shift.name}
                                </p>
                                <span className="font-mono text-[9px] text-muted-foreground block mt-0.5">
                                  {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                </span>
                              </div>
                            ) : (
                              <div className="rounded-lg p-1.5 bg-muted/20 border border-dashed border-border/50 text-[10px] text-muted-foreground">
                                Off Day
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

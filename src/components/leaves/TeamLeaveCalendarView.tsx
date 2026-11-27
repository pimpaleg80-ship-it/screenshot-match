import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Users,
  Building,
  UserCheck,
  Clock,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, toDateKey } from "@/lib/attendance";
import type { LeaveRequest, Holiday, LeaveType } from "@/lib/leave";

interface TeamLeaveCalendarViewProps {
  leaveRequests: LeaveRequest[];
  holidays: Holiday[];
  leaveTypes: LeaveType[];
  weeklyOffDays?: number[];
}

export function TeamLeaveCalendarView({
  leaveRequests,
  holidays,
  leaveTypes,
  weeklyOffDays = [0, 6],
}: TeamLeaveCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedDateKey, setSelectedDateKey] = useState<string>(toDateKey(new Date()));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  function handlePrevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function handleNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  // Extract departments
  const departments = useMemo(() => {
    return Array.from(
      new Set(leaveRequests.map((r) => r.employees?.departments?.name).filter(Boolean))
    ).sort() as string[];
  }, [leaveRequests]);

  // Approved leave requests
  const approvedLeaves = useMemo(() => {
    return leaveRequests.filter((r) => {
      if (r.status !== "approved") return false;
      if (selectedDept !== "all" && r.employees?.departments?.name !== selectedDept) {
        return false;
      }
      return true;
    });
  }, [leaveRequests, selectedDept]);

  // Map leaves by date
  const leavesByDate = useMemo(() => {
    const map: Record<string, LeaveRequest[]> = {};

    approvedLeaves.forEach((req) => {
      const cur = new Date(req.from_date + "T00:00:00");
      const end = new Date(req.to_date + "T00:00:00");

      while (cur <= end) {
        const key = toDateKey(cur);
        if (!map[key]) map[key] = [];
        map[key].push(req);
        cur.setDate(cur.getDate() + 1);
      }
    });

    return map;
  }, [approvedLeaves]);

  // Map holidays by date
  const holidaysByDate = useMemo(() => {
    const map: Record<string, Holiday> = {};
    holidays.forEach((h) => {
      map[h.date] = h;
    });
    return map;
  }, [holidays]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isWeeklyOff: boolean;
      holiday?: Holiday | undefined;
      leaves: LeaveRequest[];
    }> = [];

    // Blank padding before 1st of month
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateStr: "",
        dayNum: 0,
        isCurrentMonth: false,
        isWeeklyOff: false,
        leaves: [],
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dObj = new Date(year, month, d);
      const dateStr = toDateKey(dObj);
      const dayOfWeek = dObj.getDay();

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isWeeklyOff: weeklyOffDays.includes(dayOfWeek),
        holiday: holidaysByDate[dateStr],
        leaves: leavesByDate[dateStr] || [],
      });
    }

    return days;
  }, [year, month, weeklyOffDays, holidaysByDate, leavesByDate]);

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayKey = toDateKey(new Date());

  // Selected date details
  const selectedDateLeaves = leavesByDate[selectedDateKey] || [];
  const selectedDateHoliday = holidaysByDate[selectedDateKey];

  return (
    <div className="space-y-4">
      {/* Calendar Controls & Filter Toolbar */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-bold text-foreground min-w-[150px] text-center">
              {monthName}
            </h3>
            <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentDate(new Date());
                setSelectedDateKey(todayKey);
              }}
              className="text-xs h-8 text-primary"
            >
              Today
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Building className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="w-48 h-8 text-xs">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Roster Grid */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          <div className="grid grid-cols-7 gap-1 text-center font-semibold text-xs text-muted-foreground pb-2 border-b">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          <div className="grid grid-cols-7 gap-1 pt-1">
            {calendarDays.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="min-h-[75px] sm:min-h-[95px] rounded-lg bg-muted/10 opacity-30"
                  />
                );
              }

              const isToday = cell.dateStr === todayKey;
              const isSelected = cell.dateStr === selectedDateKey;

              return (
                <div
                  key={cell.dateStr}
                  onClick={() => setSelectedDateKey(cell.dateStr)}
                  className={`min-h-[75px] sm:min-h-[95px] p-1.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/5"
                      : cell.isWeeklyOff
                      ? "bg-muted/30 border-muted"
                      : "bg-card hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center ${
                        isToday
                          ? "bg-primary text-white"
                          : "text-foreground"
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    {cell.holiday && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[9px] bg-amber-500/10 text-amber-600 gap-0.5"
                        title={cell.holiday.name || cell.holiday.title}
                      >
                        <CalendarIcon className="h-2.5 w-2.5" />
                        <span className="hidden sm:inline truncate max-w-[45px]">
                          {cell.holiday.name || cell.holiday.title}
                        </span>
                      </Badge>
                    )}
                  </div>

                  {/* Leave Items Stack */}
                  <div className="space-y-1 my-1 overflow-hidden">
                    {cell.leaves.slice(0, 2).map((req) => (
                      <div
                        key={req.id}
                        className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${req.leave_types?.color || "#3b82f6"}20`,
                          color: req.leave_types?.color || "#3b82f6",
                          borderLeft: `2px solid ${req.leave_types?.color || "#3b82f6"}`,
                        }}
                        title={`${req.employees?.full_name} (${req.leave_types?.name})`}
                      >
                        {req.employees?.full_name?.split(" ")[0]}
                        {req.half_day && " (0.5)"}
                      </div>
                    ))}
                    {cell.leaves.length > 2 && (
                      <span className="text-[9px] text-muted-foreground font-semibold pl-1 block">
                        +{cell.leaves.length - 2} more
                      </span>
                    )}
                  </div>

                  <div className="h-1" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected Day Leave Inspection Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" /> Daily Workforce Absence Breakdown
              </CardTitle>
              <CardDescription className="text-xs">
                Details for {formatDate(selectedDateKey)}
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {selectedDateLeaves.length} on leave
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {selectedDateHoliday && (
            <div className="mb-3 p-3 rounded-lg border border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 text-xs flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {selectedDateHoliday.name || selectedDateHoliday.title}
                </span>{" "}
                — {selectedDateHoliday.is_optional ? "Optional Floating Holiday" : "Official Public Holiday"}
              </div>
            </div>
          )}

          {selectedDateLeaves.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No employees on leave on this date. Full workforce scheduled.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {selectedDateLeaves.map((req) => (
                <div key={req.id} className="rounded-lg border p-3 bg-muted/20 space-y-1.5 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{req.employees?.full_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {req.employees?.employee_code} • {req.employees?.departments?.name}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{
                        borderColor: req.leave_types?.color || undefined,
                        color: req.leave_types?.color || undefined,
                      }}
                    >
                      {req.leave_types?.name}
                    </Badge>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t">
                    <span>
                      {req.half_day ? "Half-Day" : "Full-Day"} ({req.days}d total)
                    </span>
                    <span className="truncate max-w-[150px] italic">
                      {req.reason || "Planned leave"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

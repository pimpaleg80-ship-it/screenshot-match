import { useState, useMemo } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toDateKey, formatDate } from "@/lib/attendance";

interface AttendanceCalendarViewProps {
  records: Array<{
    date: string;
    status: string;
    is_late?: boolean | null;
    is_early_departure?: boolean | null;
    is_half_day?: boolean | null;
    is_missing_punch?: boolean | null;
    working_hours?: number | null;
  }>;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

export function AttendanceCalendarView({
  records,
  selectedDate,
  onSelectDate,
}: AttendanceCalendarViewProps) {
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  // Month navigation
  function handlePrevMonth() {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  }

  function handleNextMonth() {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  }

  function handleToday() {
    const today = new Date();
    setCurrentMonthDate(today);
    onSelectDate(toDateKey(today));
  }

  // Days in month calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Map records by date key
    const recordsMap: Record<
      string,
      {
        total: number;
        present: number;
        late: number;
        half_day: number;
        early: number;
        missing: number;
      }
    > = {};

    records.forEach((r) => {
      if (!recordsMap[r.date]) {
        recordsMap[r.date] = { total: 0, present: 0, late: 0, half_day: 0, early: 0, missing: 0 };
      }
      const entry = recordsMap[r.date]!;
      entry.total++;
      if (r.status === "present") entry.present++;
      if (r.status === "late" || r.is_late) entry.late++;
      if (r.status === "half_day" || r.is_half_day) entry.half_day++;
      if (r.is_early_departure) entry.early++;
      if (r.is_missing_punch) entry.missing++;
    });

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      data?: (typeof recordsMap)[string] | undefined;
    }> = [];

    // Blank padding before first day
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dateStr: "",
        dayNum: 0,
        isCurrentMonth: false,
      });
    }

    // Actual month days
    for (let d = 1; d <= totalDays; d++) {
      const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({
        dateStr: dStr,
        dayNum: d,
        isCurrentMonth: true,
        data: recordsMap[dStr],
      });
    }

    return days;
  }, [year, month, records]);

  const monthLabel = currentMonthDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const todayKey = toDateKey(new Date());

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-primary" /> Attendance Calendar
            </CardTitle>
            <CardDescription className="text-xs">
              Visual monthly workforce presence, late arrival clusters, and punch density.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleToday} className="h-8 text-xs">
              Today
            </Button>
            <div className="flex items-center rounded-lg border bg-card">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="h-8 w-8 text-muted-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 text-xs font-semibold whitespace-nowrap">{monthLabel}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-8 w-8 text-muted-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground pb-1">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {calendarDays.map((day, idx) => {
            if (!day.isCurrentMonth) {
              return <div key={idx} className="h-16 rounded-lg bg-muted/10 opacity-30" />;
            }

            const isSelected = day.dateStr === selectedDate;
            const isToday = day.dateStr === todayKey;
            const hasData = !!day.data && day.data.total > 0;

            return (
              <button
                key={day.dateStr}
                onClick={() => onSelectDate(day.dateStr)}
                className={`h-16 rounded-lg border p-1.5 text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/30"
                    : "hover:bg-muted/40 bg-card"
                } ${isToday ? "border-amber-400 font-bold" : ""}`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] ${
                      isToday ? "bg-primary text-primary-foreground font-bold" : ""
                    }`}
                  >
                    {day.dayNum}
                  </span>
                  {hasData && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {day.data!.total} logs
                    </span>
                  )}
                </div>

                {hasData ? (
                  <div className="flex flex-wrap gap-1">
                    {day.data!.present > 0 && (
                      <span
                        className="h-2 w-2 rounded-full bg-emerald-500"
                        title={`${day.data!.present} present`}
                      />
                    )}
                    {day.data!.late > 0 && (
                      <span
                        className="h-2 w-2 rounded-full bg-amber-500"
                        title={`${day.data!.late} late`}
                      />
                    )}
                    {day.data!.half_day > 0 && (
                      <span
                        className="h-2 w-2 rounded-full bg-blue-500"
                        title={`${day.data!.half_day} half-day`}
                      />
                    )}
                    {day.data!.early > 0 && (
                      <span
                        className="h-2 w-2 rounded-full bg-orange-500"
                        title={`${day.data!.early} early departures`}
                      />
                    )}
                    {day.data!.missing > 0 && (
                      <span
                        className="h-2 w-2 rounded-full bg-rose-500"
                        title={`${day.data!.missing} missing punches`}
                      />
                    )}
                  </div>
                ) : (
                  <div className="h-2" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>On-Time Present</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>Late Arrival</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span>Half-Day</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            <span>Early Departure</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span>Missing Punch</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

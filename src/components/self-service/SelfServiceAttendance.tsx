import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Hourglass,
  ScanFace,
  Filter,
  PlusCircle,
  Fingerprint,
  Edit,
  Sparkles,
  MapPin,
} from "lucide-react";
import { GeofencePunchModal } from "@/components/attendance/GeofencePunchModal";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  toDateKey,
  formatDate,
  formatTime,
  formatHours,
  totalHours,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/attendance";
import { AttendanceCorrectionRequestDialog } from "@/components/attendance/AttendanceCorrectionRequestDialog";

interface SelfServiceAttendanceProps {
  employeeId: string;
}

interface AttendanceItem {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  method: string | null;
  confidence: number | null;
  note: string | null;
  created_at: string;
  shift_id?: string | null;
  working_hours?: number | null;
  overtime_hours?: number | null;
  is_late?: boolean | null;
  late_minutes?: number | null;
  is_early_departure?: boolean | null;
  early_departure_minutes?: number | null;
  is_half_day?: boolean | null;
  is_missing_punch?: boolean | null;
  shifts?: {
    name: string;
    code: string | null;
  } | null;
}

export function SelfServiceAttendance({ employeeId }: SelfServiceAttendanceProps) {
  const [filterPeriod, setFilterPeriod] = useState<"this_month" | "last_30" | "last_90" | "all">("this_month");
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<{
    id?: string;
    date?: string;
  } | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["my-attendance-records", employeeId, filterPeriod],
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select(`
          id, date, check_in, check_out, status, method, confidence, note, created_at,
          shift_id, working_hours, overtime_hours, is_late, late_minutes,
          is_early_departure, early_departure_minutes, is_half_day, is_missing_punch,
          shifts(name, code)
        `)
        .eq("employee_id", employeeId)
        .order("date", { ascending: false });

      const now = new Date();
      if (filterPeriod === "this_month") {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        q = q.gte("date", toDateKey(firstDay));
      } else if (filterPeriod === "last_30") {
        const past = new Date();
        past.setDate(past.getDate() - 30);
        q = q.gte("date", toDateKey(past));
      } else if (filterPeriod === "last_90") {
        const past = new Date();
        past.setDate(past.getDate() - 90);
        q = q.gte("date", toDateKey(past));
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AttendanceItem[];
    },
    enabled: !!employeeId,
  });

  // Calculate stats
  const stats = useMemo(() => {
    let presentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let totalWorkedHours = 0;
    let totalOvertimeHours = 0;
    let clockedDays = 0;

    records.forEach((r) => {
      if (r.status === "present" && !r.is_late) presentCount++;
      if (r.is_late || r.status === "late") lateCount++;
      if (r.is_half_day || r.status === "half_day") halfDayCount++;

      const hours = r.working_hours != null ? r.working_hours : totalHours(r.check_in, r.check_out);
      if (hours != null && hours > 0) {
        totalWorkedHours += hours;
        clockedDays++;
      }
      if (r.overtime_hours) {
        totalOvertimeHours += r.overtime_hours;
      }
    });

    const totalDays = records.length;
    const onTimeRate = totalDays > 0 ? Math.round(((totalDays - lateCount) / totalDays) * 100) : 100;
    const avgHours = clockedDays > 0 ? (totalWorkedHours / clockedDays).toFixed(1) : "0.0";

    return {
      totalDays,
      presentCount,
      lateCount,
      halfDayCount,
      onTimeRate,
      avgHours,
      totalHoursLogged: totalWorkedHours.toFixed(1),
      totalOvertimeHours: totalOvertimeHours.toFixed(1),
    };
  }, [records]);

  function handleOpenCorrection(r?: AttendanceItem) {
    if (r) {
      setSelectedRecordForCorrection({ id: r.id, date: r.date });
    } else {
      setSelectedRecordForCorrection(null);
    }
    setCorrectionDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Attendance Log & Punctuality</h3>
          <p className="text-xs text-muted-foreground">
            Review your daily punches, shift adherence, overtime, and request corrections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={() => setGeofenceModalOpen(true)}
            size="sm"
            className="gap-1.5 text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            <MapPin className="h-4 w-4" />
            Geofence Clock In / Out
          </Button>

          <Button
            onClick={() => handleOpenCorrection()}
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-9 border-border/40 text-foreground hover:bg-muted/50"
          >
            <PlusCircle className="h-4 w-4" />
            Request Correction
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Days Logged</p>
              <p className="text-2xl font-bold">{stats.totalDays}</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Calendar className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">On-Time Rate</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {stats.onTimeRate}%
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Late Check-Ins</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {stats.lateCount}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Overtime Logged</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.totalOvertimeHours} hrs
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <Hourglass className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance History Table Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> My Attendance History
              </CardTitle>
              <CardDescription className="text-xs">
                Detailed clock-in, clock-out, work duration, shift rules, and biometric verification logs.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select
                value={filterPeriod}
                onValueChange={(val: any) => setFilterPeriod(val)}
              >
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="last_30">Last 30 Days</SelectItem>
                  <SelectItem value="last_90">Last 90 Days</SelectItem>
                  <SelectItem value="all">All Records</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : records.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <ClipboardList className="mx-auto h-8 w-8 opacity-40 mb-2" />
              No attendance logs found for the selected period.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Shift</th>
                    <th className="py-2.5 px-3">Check In</th>
                    <th className="py-2.5 px-3">Check Out</th>
                    <th className="py-2.5 px-3">Duration / OT</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {records.map((r) => {
                    const statusColor = STATUS_COLORS[r.status] || "bg-muted text-muted-foreground";
                    const statusLabel = STATUS_LABELS[r.status] || r.status;
                    const hours = r.working_hours != null ? r.working_hours : totalHours(r.check_in, r.check_out);

                    return (
                      <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 px-3 font-medium whitespace-nowrap">
                          {formatDate(r.date)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {r.shifts ? (
                            <Badge variant="outline" className="text-[10px]">
                              {r.shifts.name}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">General</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {r.check_in ? (
                            <div className="space-y-0.5">
                              <span className="font-mono text-foreground">{formatTime(r.check_in)}</span>
                              {r.is_late && (
                                <div>
                                  <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-300">
                                    Late +{r.late_minutes || 0}m
                                  </Badge>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {r.check_out ? (
                            <div className="space-y-0.5">
                              <span className="font-mono text-foreground">{formatTime(r.check_out)}</span>
                              {r.is_early_departure && (
                                <div>
                                  <Badge variant="outline" className="text-[9px] bg-orange-500/10 text-orange-600 border-orange-300">
                                    Early -{r.early_departure_minutes || 0}m
                                  </Badge>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-rose-500 text-[11px] font-medium">Pending Out</span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <span className="font-medium">{formatHours(hours)}</span>
                            {(r.overtime_hours || 0) > 0 && (
                              <p className="text-[10px] text-emerald-600 font-medium">
                                +{r.overtime_hours}h OT
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {r.method === "geofence" ? (
                            <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/20 text-emerald-600 bg-emerald-500/10">
                              <MapPin className="h-3 w-3" /> Geofence
                            </Badge>
                          ) : r.method === "face" ? (
                            <Badge variant="outline" className="text-[10px] gap-1 border-primary/30 text-primary">
                              <ScanFace className="h-3 w-3" /> Face
                            </Badge>
                          ) : r.method === "device" ? (
                            <Badge variant="outline" className="text-[10px] gap-1 border-blue-400 text-blue-600">
                              <Fingerprint className="h-3 w-3" /> Terminal
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              Manual
                            </Badge>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge variant="secondary" className={`text-[10px] capitalize ${statusColor}`}>
                            {statusLabel}
                          </Badge>
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenCorrection(r)}
                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                            title="Request Correction"
                          >
                            <Edit className="h-3 w-3" />
                            Fix
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Correction Dialog */}
      <AttendanceCorrectionRequestDialog
        open={correctionDialogOpen}
        onOpenChange={setCorrectionDialogOpen}
        employeeId={employeeId}
        defaultDate={selectedRecordForCorrection?.date}
        attendanceId={selectedRecordForCorrection?.id}
      />

      {/* Geofence GPS Attendance Modal */}
      <GeofencePunchModal
        open={geofenceModalOpen}
        onOpenChange={setGeofenceModalOpen}
      />
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  Edit3,
  Trash2,
  Plus,
  CheckCircle2,
  Clock,
  UserX,
  ScanFace,
  FileSpreadsheet,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  Layers,
  Fingerprint,
  CheckCheck,
  CalendarDays,
  Sparkles,
  MapPin,
} from "lucide-react";
import { GeofencePunchModal } from "@/components/attendance/GeofencePunchModal";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  toDateKey,
  formatDate,
  formatTime,
  formatHours,
  totalHours,
  calculateShiftMetrics,
  exportCsv,
  printTable,
  STATUS_COLORS,
  STATUS_LABELS,
  ShiftConfig,
} from "@/lib/attendance";
import { PageContainer, PageHeader, TableContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AttendanceCameraPunchModal } from "@/components/attendance/AttendanceCameraPunchModal";
import { AttendanceCalendarView } from "@/components/attendance/AttendanceCalendarView";
import { AttendanceCorrectionManager } from "@/components/attendance/AttendanceCorrectionManager";

export const Route = createFileRoute("/_authenticated/attendance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Advanced Attendance & Shifts — Flowpeople by Fluxora" },
      { name: "description", content: "Biometric face verification, shift calculation, and attendance audits." },
    ],
  }),
  component: AttendancePage,
});

interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  method: string;
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
  device_id?: string | null;
  check_in_lat?: number | null;
  check_in_lon?: number | null;
  work_location_id?: string | null;
  employees: {
    id: string;
    full_name: string;
    employee_code: string;
    photo_url: string | null;
    department_id?: string | null;
    departments?: { name: string } | null;
  } | null;
  shifts?: {
    id: string;
    name: string;
    code: string | null;
    start_time: string;
    end_time: string;
    break_duration_minutes: number;
    grace_period_minutes: number;
    early_departure_grace_minutes: number;
    half_day_min_hours: number;
    full_day_min_hours: number;
    is_night_shift: boolean;
    color: string | null;
  } | null;
}

function AttendancePage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [activeTab, setActiveTab] = useState<string>("logs");
  const [cameraPunchOpen, setCameraPunchOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [selectedShiftFilter, setSelectedShiftFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("today"); // today, week, month, custom, all
  const [customDate, setCustomDate] = useState(todayKey);

  // Edit record state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editStatus, setEditStatus] = useState("present");
  const [editReason, setEditReason] = useState("");
  const [editShiftId, setEditShiftId] = useState<string>("none");

  // Add manual dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [addDate, setAddDate] = useState(todayKey);
  const [addCheckIn, setAddCheckIn] = useState("09:00");
  const [addCheckOut, setAddCheckOut] = useState("17:00");
  const [addShiftId, setAddShiftId] = useState<string>("none");
  const [addStatus, setAddStatus] = useState("present");
  const [addReason, setAddReason] = useState("");
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);

  // Fetch shifts
  const { data: shifts = [] } = useQuery({
    queryKey: ["all-shifts-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .eq("is_active", true)
        .order("start_time");
      if (error) return [];
      return data ?? [];
    },
  });

  // Fetch employees for filter & dialogs
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list-attendance", session.departmentId],
    queryFn: async () => {
      let q = supabase
        .from("employees")
        .select("id, full_name, employee_code, department_id, departments(name)")
        .eq("status", "active")
        .order("full_name");
      if (session.isManager && session.departmentId) {
        q = q.eq("department_id", session.departmentId);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const departments = Array.from(
    new Set(employees.map((e: any) => e.departments?.name).filter(Boolean))
  ).sort() as string[];

  // Pending Corrections Count
  const { data: pendingCorrectionsCount = 0 } = useQuery({
    queryKey: ["pending-corrections-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("attendance_corrections")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) return 0;
      return count ?? 0;
    },
  });

  // Fetch Attendance Records
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-records", dateFilter, customDate, session.departmentId, session.employeeId],
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select(`
          id, employee_id, date, check_in, check_out, status, method, confidence, note, created_at,
          shift_id, working_hours, overtime_hours, is_late, late_minutes,
          is_early_departure, early_departure_minutes, is_half_day, is_missing_punch, device_id,
          check_in_lat, check_in_lon, work_location_id,
          employees!inner(id, full_name, employee_code, photo_url, department_id, departments(name)),
          shifts(id, name, code, start_time, end_time, break_duration_minutes, grace_period_minutes, early_departure_grace_minutes, half_day_min_hours, full_day_min_hours, is_night_shift, color)
        `)
        .order("date", { ascending: false })
        .order("check_in", { ascending: false });

      if (dateFilter === "today") {
        q = q.eq("date", todayKey);
      } else if (dateFilter === "week") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        q = q.gte("date", toDateKey(d)).lte("date", todayKey);
      } else if (dateFilter === "month") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        q = q.gte("date", toDateKey(d)).lte("date", todayKey);
      } else if (dateFilter === "custom") {
        q = q.eq("date", customDate);
      }

      // Role scoping
      if (!session.isAdmin && !session.isManager && session.employeeId) {
        q = q.eq("employee_id", session.employeeId);
      } else if (session.isManager && session.departmentId) {
        q = q.eq("employees.department_id", session.departmentId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AttendanceRecord[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      supabase.getChannels().forEach((ch) => {
        if (ch.topic.includes("attendance-page-realtime")) {
          supabase.removeChannel(ch);
        }
      });
      const channelName = `attendance-page-realtime-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      channel = supabase.channel(channelName);
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "attendance",
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Realtime attendance subscription error:", err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn("Error removing attendance channel:", e);
        }
      }
    };
  }, [queryClient]);

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = search.toLowerCase();
      const name = r.employees?.full_name?.toLowerCase() || "";
      const code = r.employees?.employee_code?.toLowerCase() || "";
      const dept = r.employees?.departments?.name?.toLowerCase() || "";
      const matchesSearch = !q || name.includes(q) || code.includes(q) || dept.includes(q);

      const matchesDept = selectedDept === "all" || r.employees?.departments?.name === selectedDept;
      const matchesStatus = selectedStatus === "all" || r.status === selectedStatus;
      const matchesMethod = selectedMethod === "all" || r.method === selectedMethod;
      const matchesShift = selectedShiftFilter === "all" || r.shift_id === selectedShiftFilter;

      return matchesSearch && matchesDept && matchesStatus && matchesMethod && matchesShift;
    });
  }, [records, search, selectedDept, selectedStatus, selectedMethod, selectedShiftFilter]);

  // Save Edit Mutation
  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editingRecord) return;
      if (!editReason.trim()) throw new Error("A reason for editing is required");

      const inTs = editCheckIn
        ? new Date(`${editingRecord.date}T${editCheckIn}:00`).toISOString()
        : null;
      const outTs = editCheckOut
        ? new Date(`${editingRecord.date}T${editCheckOut}:00`).toISOString()
        : null;

      // Find shift configuration for metric recalculation
      const shiftObj = shifts.find(
        (s) => s.id === (editShiftId !== "none" ? editShiftId : editingRecord.shift_id)
      );

      let workingHours = totalHours(inTs, outTs);
      let overtimeHours = 0;
      let isLate = false;
      let lateMinutes = 0;
      let isEarly = false;
      let earlyMinutes = 0;
      let isHalfDay = editStatus === "half_day";
      let isMissingPunch = !outTs && !!inTs;
      let resolvedStatus = editStatus;

      if (shiftObj && inTs) {
        const metrics = calculateShiftMetrics(inTs, outTs, shiftObj as unknown as ShiftConfig);
        workingHours = metrics.working_hours;
        overtimeHours = metrics.overtime_hours;
        isLate = metrics.is_late;
        lateMinutes = metrics.late_minutes;
        isEarly = metrics.is_early_departure;
        earlyMinutes = metrics.early_departure_minutes;
        isHalfDay = metrics.is_half_day;
        isMissingPunch = !outTs && !!inTs;
        resolvedStatus = metrics.status;
      }

      const { error } = await supabase
        .from("attendance")
        .update({
          check_in: inTs,
          check_out: outTs,
          shift_id: (editShiftId !== "none" ? editShiftId : editingRecord.shift_id) || null,
          working_hours: workingHours,
          overtime_hours: overtimeHours,
          is_late: isLate,
          late_minutes: lateMinutes,
          is_early_departure: isEarly,
          early_departure_minutes: earlyMinutes,
          is_half_day: isHalfDay,
          is_missing_punch: isMissingPunch,
          status: resolvedStatus as any,
          note: editReason.trim(),
        })
        .eq("id", editingRecord.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance record updated and shift metrics recalculated");
      setEditingRecord(null);
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update record");
    },
  });

  // Add Manual Record Mutation
  const addMutation = useMutation({
    mutationFn: async () => {
      if (!addEmployeeId) throw new Error("Select an employee");
      const inTs = addCheckIn ? new Date(`${addDate}T${addCheckIn}:00`).toISOString() : null;
      const outTs = addCheckOut ? new Date(`${addDate}T${addCheckOut}:00`).toISOString() : null;

      const shiftObj = shifts.find((s) => s.id === addShiftId);

      let workingHours = totalHours(inTs, outTs);
      let overtimeHours = 0;
      let isLate = false;
      let lateMinutes = 0;
      let isEarly = false;
      let earlyMinutes = 0;
      let isHalfDay = addStatus === "half_day";
      let isMissingPunch = !outTs && !!inTs;
      let resolvedStatus = addStatus;

      if (shiftObj && inTs) {
        const metrics = calculateShiftMetrics(inTs, outTs, shiftObj as unknown as ShiftConfig);
        workingHours = metrics.working_hours;
        overtimeHours = metrics.overtime_hours;
        isLate = metrics.is_late;
        lateMinutes = metrics.late_minutes;
        isEarly = metrics.is_early_departure;
        earlyMinutes = metrics.early_departure_minutes;
        isHalfDay = metrics.is_half_day;
        isMissingPunch = !outTs && !!inTs;
        resolvedStatus = metrics.status;
      }

      const { error } = await supabase.from("attendance").upsert(
        {
          employee_id: addEmployeeId,
          date: addDate,
          check_in: inTs,
          check_out: outTs,
          shift_id: addShiftId !== "none" ? addShiftId : null,
          working_hours: workingHours,
          overtime_hours: overtimeHours,
          is_late: isLate,
          late_minutes: lateMinutes,
          is_early_departure: isEarly,
          early_departure_minutes: earlyMinutes,
          is_half_day: isHalfDay,
          is_missing_punch: isMissingPunch,
          status: resolvedStatus as any,
          method: "manual",
          note: addReason.trim() || "Manual HR Entry",
        },
        { onConflict: "employee_id,date" }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manual attendance logged with shift compliance calculated");
      setAddOpen(false);
      setAddEmployeeId("");
      setAddReason("");
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to log manual attendance");
    },
  });

  // Delete Record Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("attendance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Record deleted");
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete record");
    },
  });

  // Open Edit Modal
  function handleOpenEdit(r: AttendanceRecord) {
    setEditingRecord(r);
    const inDate = r.check_in ? new Date(r.check_in) : null;
    const outDate = r.check_out ? new Date(r.check_out) : null;

    setEditCheckIn(
      inDate
        ? `${String(inDate.getHours()).padStart(2, "0")}:${String(inDate.getMinutes()).padStart(2, "0")}`
        : ""
    );
    setEditCheckOut(
      outDate
        ? `${String(outDate.getHours()).padStart(2, "0")}:${String(outDate.getMinutes()).padStart(2, "0")}`
        : ""
    );
    setEditStatus(r.status);
    setEditReason(r.note || "");
    setEditShiftId(r.shift_id || "none");
  }

  // Export handlers
  function handleExportCsv() {
    const headers = [
      "Date",
      "Name",
      "Employee Code",
      "Department",
      "Shift",
      "Check In",
      "Check Out",
      "Working Hours",
      "Overtime Hours",
      "Late Arrival",
      "Early Departure",
      "Status",
      "Method",
      "Confidence",
      "Notes",
    ];

    const rows = filteredRecords.map((r) => [
      r.date,
      r.employees?.full_name || "",
      r.employees?.employee_code || "",
      r.employees?.departments?.name || "",
      r.shifts?.name || "General",
      formatTime(r.check_in),
      formatTime(r.check_out),
      r.working_hours != null ? `${r.working_hours}h` : formatHours(totalHours(r.check_in, r.check_out)),
      r.overtime_hours ? `${r.overtime_hours}h` : "0h",
      r.is_late ? `Yes (${r.late_minutes}m)` : "No",
      r.is_early_departure ? `Yes (${r.early_departure_minutes}m)` : "No",
      STATUS_LABELS[r.status] || r.status,
      r.method,
      r.confidence ? `${Math.round(r.confidence * 100)}%` : "—",
      r.note || "",
    ]);

    exportCsv(`attendance-export-${toDateKey(new Date())}.csv`, headers, rows);
    toast.success("CSV file downloaded");
  }

  function handlePrint() {
    const headers = [
      "Date",
      "Name",
      "Code",
      "Department",
      "Shift",
      "Check In",
      "Check Out",
      "Hours",
      "OT",
      "Status",
      "Method",
    ];

    const rows = filteredRecords.map((r) => [
      r.date,
      r.employees?.full_name || "",
      r.employees?.employee_code || "",
      r.employees?.departments?.name || "",
      r.shifts?.name || "General",
      formatTime(r.check_in),
      formatTime(r.check_out),
      r.working_hours != null ? `${r.working_hours}h` : formatHours(totalHours(r.check_in, r.check_out)),
      r.overtime_hours ? `${r.overtime_hours}h` : "0h",
      STATUS_LABELS[r.status] || r.status,
      r.method,
    ]);

    printTable("Flowpeople Attendance Records", headers, rows);
  }

  // Analytics Metrics
  const total = filteredRecords.length;
  const present = filteredRecords.filter((r) => r.status === "present").length;
  const late = filteredRecords.filter((r) => r.is_late || r.status === "late").length;
  const halfDay = filteredRecords.filter((r) => r.is_half_day || r.status === "half_day").length;
  const missingPunch = filteredRecords.filter((r) => r.is_missing_punch).length;
  const onLeave = filteredRecords.filter((r) => r.status === "on_leave").length;
  const absent = filteredRecords.filter((r) => r.status === "absent").length;

  const totalOvertime = filteredRecords.reduce((acc, r) => acc + (r.overtime_hours || 0), 0);
  const totalWorkedMinutes = filteredRecords.reduce((acc, r) => acc + ((r.working_hours || 0) * 60), 0);
  const avgWorkHours = total > 0 ? (totalWorkedMinutes / 60 / total).toFixed(1) : "0.0";
  const onTimePercentage = total > 0 ? Math.round(((total - late) / total) * 100) : 100;

  // Face vs Terminal vs Manual count
  const facePunchCount = filteredRecords.filter((r) => r.method === "face").length;
  const devicePunchCount = filteredRecords.filter((r) => r.method === "device" || r.method === "fingerprint").length;
  const manualPunchCount = filteredRecords.filter((r) => r.method === "manual").length;

  return (
    <PageContainer maxWidth="wide">
      {/* Top Header */}
      <PageHeader
        breadcrumbs={[{ label: "Attendance Records" }]}
        title="Attendance & Shifts"
        badge={
          <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 gap-1 hidden sm:flex">
            <Sparkles className="h-3 w-3" /> Biometric Sync
          </Badge>
        }
        description="Biometric verification, shift rules, late arrival & overtime tracking, and audit log."
        actions={
          <>
            <Button
              onClick={() => setGeofenceModalOpen(true)}
              className="flex-1 sm:flex-none gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs text-xs h-9"
            >
              <MapPin className="h-4 w-4" />
              GPS Geofence Punch
            </Button>

            <Button
              onClick={() => setCameraPunchOpen(true)}
              variant="outline"
              className="flex-1 sm:flex-none gap-2 text-xs h-9"
            >
              <ScanFace className="h-4 w-4" />
              Face Camera
            </Button>

            {session.isAdmin && (
              <Button
                onClick={() => setAddOpen(true)}
                variant="outline"
                className="flex-1 sm:flex-none gap-2 text-xs h-9"
              >
                <Plus className="h-4 w-4" />
                Manual Punch
              </Button>
            )}

            <Button variant="outline" onClick={handleExportCsv} className="flex-1 sm:flex-none gap-2 text-xs h-9">
              <Download className="h-4 w-4" />
              CSV
            </Button>

            <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none gap-2 text-xs h-9">
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </>
        }
      />

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid grid-cols-4 w-full max-w-xl h-10 p-1 bg-muted/60">
          <TabsTrigger value="logs" className="text-xs gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Attendance Logs
          </TabsTrigger>
          <TabsTrigger value="calendar" className="text-xs gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="corrections" className="text-xs gap-1.5 relative">
            <Clock className="h-3.5 w-3.5" />
            Corrections
            {pendingCorrectionsCount > 0 && (
              <Badge className="ml-1 h-4 px-1.5 text-[10px] bg-rose-500 text-white">
                {pendingCorrectionsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ATTENDANCE LOGS */}
        <TabsContent value="logs" className="space-y-5 mt-0">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
            <Card className="p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Total Logs</p>
              <p className="mt-0.5 text-xl sm:text-2xl font-bold">{total}</p>
            </Card>
            <Card className="p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Present</p>
              <p className="mt-0.5 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">{present}</p>
            </Card>
            <Card className="p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Late Arrivals</p>
              <p className="mt-0.5 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">{late}</p>
            </Card>
            <Card className="p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Half Day</p>
              <p className="mt-0.5 text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">{halfDay}</p>
            </Card>
            <Card className="p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Missing Punch</p>
              <p className="mt-0.5 text-xl sm:text-2xl font-bold text-rose-500">{missingPunch}</p>
            </Card>
            <Card className="p-3 sm:p-4">
              <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Overtime Logged</p>
              <p className="mt-0.5 text-xl sm:text-2xl font-bold text-blue-600">{totalOvertime.toFixed(1)}h</p>
            </Card>
          </div>

          {/* Filter Toolbar */}
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4 shadow-xs">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by employee name, code, department..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                {/* Date Quick Filter */}
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                    <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Past 7 Days</SelectItem>
                    <SelectItem value="month">Past 30 Days</SelectItem>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="custom">Specific Date</SelectItem>
                  </SelectContent>
                </Select>

                {dateFilter === "custom" && (
                  <Input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full sm:w-[150px] h-9 text-xs"
                  />
                )}

                {/* Shift Filter */}
                <Select value={selectedShiftFilter} onValueChange={setSelectedShiftFilter}>
                  <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                    <Clock className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Shift" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Shifts</SelectItem>
                    {shifts.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Department Filter (Admin only) */}
                {session.isAdmin && (
                  <Select value={selectedDept} onValueChange={setSelectedDept}>
                    <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Depts</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Status Filter */}
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="w-full sm:w-[120px] h-9 text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half Day</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>

                {/* Method Filter */}
                <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                  <SelectTrigger className="w-full sm:w-[120px] h-9 text-xs">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="face">Face Scan</SelectItem>
                    <SelectItem value="device">Terminal / Device</SelectItem>
                    <SelectItem value="manual">Manual Entry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Attendance Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/60" />
                  <h3 className="mt-3 text-base font-semibold">No attendance records found</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try selecting a different date range or clearing your filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3.5">Employee</th>
                        <th className="px-4 py-3.5">Assigned Shift</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Check In</th>
                        <th className="px-4 py-3.5">Check Out</th>
                        <th className="px-4 py-3.5">Net Work / OT</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Method</th>
                        {session.isAdmin && <th className="px-4 py-3.5 text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredRecords.map((r) => {
                        const hours = r.working_hours != null ? r.working_hours : totalHours(r.check_in, r.check_out);
                        return (
                          <tr key={r.id} className="transition-colors hover:bg-muted/20">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                {r.employees?.photo_url ? (
                                  <img
                                    src={r.employees.photo_url}
                                    alt={r.employees.full_name}
                                    className="h-9 w-9 rounded-lg object-cover border"
                                  />
                                ) : (
                                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                    {r.employees?.full_name?.slice(0, 2).toUpperCase() || "EM"}
                                  </div>
                                )}
                                <div>
                                  <p className="font-semibold text-foreground">
                                    {r.employees?.full_name || "Unknown"}
                                  </p>
                                  <p className="font-mono text-xs text-muted-foreground">
                                    {r.employees?.employee_code} • {r.employees?.departments?.name || "General"}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* Shift Badge */}
                            <td className="px-4 py-3.5">
                              {r.shifts ? (
                                <div className="space-y-0.5">
                                  <Badge
                                    variant="outline"
                                    className="text-[11px] font-medium"
                                    style={{
                                      borderColor: r.shifts.color || undefined,
                                      color: r.shifts.color || undefined,
                                    }}
                                  >
                                    {r.shifts.name}
                                  </Badge>
                                  <p className="text-[10px] text-muted-foreground font-mono">
                                    {r.shifts.start_time.slice(0, 5)} - {r.shifts.end_time.slice(0, 5)}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">General</span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 font-medium whitespace-nowrap">{formatDate(r.date)}</td>

                            {/* Check In */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="space-y-0.5">
                                <span className="font-mono text-xs text-foreground font-medium">
                                  {formatTime(r.check_in)}
                                </span>
                                {r.is_late && (
                                  <div>
                                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300">
                                      Late +{r.late_minutes || 0}m
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Check Out */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="space-y-0.5">
                                {r.check_out ? (
                                  <span className="font-mono text-xs text-foreground font-medium">
                                    {formatTime(r.check_out)}
                                  </span>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-950/20">
                                    Missing Out
                                  </Badge>
                                )}
                                {r.is_early_departure && (
                                  <div>
                                    <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-600 border-orange-300">
                                      Early -{r.early_departure_minutes || 0}m
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Working Hours & OT */}
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <div className="space-y-0.5">
                                <span className="font-semibold text-xs text-foreground">
                                  {formatHours(hours)}
                                </span>
                                {(r.overtime_hours || 0) > 0 && (
                                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                    +{r.overtime_hours}h OT
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3.5">
                              <Badge
                                variant="outline"
                                className={`capitalize text-[11px] ${STATUS_COLORS[r.status as keyof typeof STATUS_COLORS] || ""}`}
                              >
                                {STATUS_LABELS[r.status] || r.status}
                              </Badge>
                            </td>

                            {/* Method */}
                            <td className="px-4 py-3.5">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                                  {r.method === "geofence" && <MapPin className="h-3.5 w-3.5 text-emerald-600" />}
                                  {r.method === "face" && <ScanFace className="h-3.5 w-3.5 text-primary" />}
                                  {r.method === "device" && <Fingerprint className="h-3.5 w-3.5 text-blue-600" />}
                                  <span>{r.method === "geofence" ? "GPS Geofence" : (r.method || "manual")}</span>
                                </div>
                                {r.check_in_lat != null && (
                                  <span className="text-[10px] text-muted-foreground/75 font-mono block">
                                    {r.check_in_lat.toFixed(4)}, {r.check_in_lon?.toFixed(4)}
                                  </span>
                                )}
                                {r.confidence && r.method !== "geofence" && (
                                  <span className="text-[10px] text-muted-foreground font-mono block">
                                    {Math.round(r.confidence * 100)}% match
                                  </span>
                                )}
                              </div>
                            </td>

                            {session.isAdmin && (
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleOpenEdit(r)}
                                    title="Edit Record"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      if (confirm("Delete this attendance log?")) {
                                        deleteMutation.mutate(r.id);
                                      }
                                    }}
                                    title="Delete Record"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: CALENDAR VIEW */}
        <TabsContent value="calendar" className="mt-0">
          <AttendanceCalendarView
            records={records}
            selectedDate={customDate}
            onSelectDate={(d) => {
              setCustomDate(d);
              setDateFilter("custom");
              setActiveTab("logs");
            }}
          />
        </TabsContent>

        {/* TAB 3: CORRECTION REQUESTS */}
        <TabsContent value="corrections" className="mt-0">
          <AttendanceCorrectionManager />
        </TabsContent>

        {/* TAB 4: ANALYTICS & PUNCTUALITY */}
        <TabsContent value="analytics" className="space-y-6 mt-0">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Overall Punctuality Rate</CardDescription>
                <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {onTimePercentage}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={onTimePercentage} className="h-2" />
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {total - late} of {total} check-ins within scheduled grace period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Total Overtime Hours</CardDescription>
                <CardTitle className="text-2xl font-bold text-blue-600">
                  {totalOvertime.toFixed(1)} hrs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-muted-foreground">
                  Computed beyond scheduled shift duration
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Average Daily Working Hours</CardDescription>
                <CardTitle className="text-2xl font-bold">
                  {avgWorkHours} hrs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-muted-foreground">
                  Net worked hours excluding unpaid break allowance
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">Missing Punches & Discrepancies</CardDescription>
                <CardTitle className="text-2xl font-bold text-rose-500">
                  {missingPunch}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[11px] text-muted-foreground">
                  Open records requiring employee correction or HR audit
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Shift Breakdown Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Shift Attendance Distribution
                </CardTitle>
                <CardDescription className="text-xs">
                  Active punches mapped across configured corporate shifts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {shifts.map((s) => {
                    const shiftPunches = filteredRecords.filter((r) => r.shift_id === s.id).length;
                    const pct = total > 0 ? Math.round((shiftPunches / total) * 100) : 0;
                    return (
                      <div key={s.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})</span>
                          <span className="font-mono text-muted-foreground">{shiftPunches} ({pct}%)</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Verification Methods Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ScanFace className="h-4 w-4 text-primary" /> Punch Method Verification
                </CardTitle>
                <CardDescription className="text-xs">
                  Proportion of biometric face scans vs authorized hardware devices vs manual HR entries
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border p-3 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-2.5">
                      <ScanFace className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-semibold text-xs text-foreground">Facial Biometric Verification</p>
                        <p className="text-[11px] text-muted-foreground">Camera match with liveness detection</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {facePunchCount} logs
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between border p-3 rounded-lg bg-blue-500/5">
                    <div className="flex items-center gap-2.5">
                      <Fingerprint className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-semibold text-xs text-foreground">Authorized Hardware Terminal</p>
                        <p className="text-[11px] text-muted-foreground">Fingerprint / Card reader hardware sync</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {devicePunchCount} logs
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between border p-3 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-2.5">
                      <Edit3 className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-xs text-foreground">Manual HR Adjustments</p>
                        <p className="text-[11px] text-muted-foreground">Admin/Manager audited manual punches</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {manualPunchCount} logs
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Camera Face Punch Modal */}
      <AttendanceCameraPunchModal
        open={cameraPunchOpen}
        onOpenChange={setCameraPunchOpen}
        onPunchSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
        }}
      />

      {/* Manual Entry Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Log Manual Attendance</DialogTitle>
            <DialogDescription>
              Record an attendance check-in for an employee with shift calculation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={addEmployeeId} onValueChange={setAddEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={addShiftId} onValueChange={setAddShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select shift schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General / Unassigned Shift</SelectItem>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Check In Time</Label>
                <Input
                  type="time"
                  value={addCheckIn}
                  onChange={(e) => setAddCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Check Out Time</Label>
                <Input
                  type="time"
                  value={addCheckOut}
                  onChange={(e) => setAddCheckOut(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={addStatus} onValueChange={setAddStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Reason / Note</Label>
              <Input
                placeholder="e.g. Card forgotten, offsite meeting"
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Logging..." : "Save Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Record Dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Edit Attendance Entry</DialogTitle>
            <DialogDescription>
              Modify recorded check-in times for {editingRecord?.employees?.full_name}. Shift metrics will automatically recalculate.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={editShiftId} onValueChange={setEditShiftId}>
                <SelectTrigger>
                  <SelectValue placeholder="Assigned Shift" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General / Unassigned Shift</SelectItem>
                  {shifts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Check In Time</Label>
                <Input
                  type="time"
                  value={editCheckIn}
                  onChange={(e) => setEditCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Check Out Time</Label>
                <Input
                  type="time"
                  value={editCheckOut}
                  onChange={(e) => setEditCheckOut(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Audit Reason (Required)</Label>
              <Input
                placeholder="Why is this record being adjusted?"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRecord(null)}>
              Cancel
            </Button>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
              {editMutation.isPending ? "Updating..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Geofence GPS Punch Modal */}
      <GeofencePunchModal
        open={geofenceModalOpen}
        onOpenChange={setGeofenceModalOpen}
      />
    </PageContainer>
  );
}
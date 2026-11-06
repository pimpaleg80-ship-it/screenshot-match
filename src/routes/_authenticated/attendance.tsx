import { useState, useMemo, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  toDateKey,
  formatDate,
  formatTime,
  formatHours,
  totalHours,
  exportCsv,
  printTable,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/attendance";
import { generateAndBackupPdf } from "@/lib/pdf-backup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_authenticated/attendance")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Attendance Records — Flowpeople by Fluxora" },
      { name: "description", content: "View, audit, edit and export attendance logs." },
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
  employees: {
    id: string;
    full_name: string;
    employee_code: string;
    photo_url: string | null;
    departments?: { name: string } | null;
  } | null;
}

function AttendancePage() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const todayKey = toDateKey(new Date());

  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [dateFilter, setDateFilter] = useState("today"); // today, week, month, all
  const [customDate, setCustomDate] = useState(todayKey);

  // Edit record dialog state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editStatus, setEditStatus] = useState("present");
  const [editReason, setEditReason] = useState("");

  // Add manual dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addEmployeeId, setAddEmployeeId] = useState("");
  const [addDate, setAddDate] = useState(todayKey);
  const [addCheckIn, setAddCheckIn] = useState("09:00");
  const [addCheckOut, setAddCheckOut] = useState("17:00");
  const [addStatus, setAddStatus] = useState("present");
  const [addReason, setAddReason] = useState("");

  // Fetch employees for filter & add dialog
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
    new Set(employees.map((e: any) => e.departments?.name).filter(Boolean)),
  ).sort() as string[];

  // Fetch attendance records
  const { data: records = [], isLoading } = useQuery({
    queryKey: [
      "attendance-records",
      dateFilter,
      customDate,
      session.departmentId,
      session.employeeId,
    ],
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select(
          "id, employee_id, date, check_in, check_out, status, method, confidence, note, created_at, employees!inner(id, full_name, employee_code, photo_url, departments(name))",
        )
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

  // Realtime subscription for live attendance updates
  useEffect(() => {
    const channel = supabase
      .channel("attendance-page-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

      return matchesSearch && matchesDept && matchesStatus && matchesMethod;
    });
  }, [records, search, selectedDept, selectedStatus, selectedMethod]);

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

      const { error } = await supabase
        .from("attendance")
        .update({
          check_in: inTs,
          check_out: outTs,
          status: editStatus as any,
          note: editReason.trim(),
        })
        .eq("id", editingRecord.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance record updated");
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

      const { error } = await supabase.from("attendance").upsert(
        {
          employee_id: addEmployeeId,
          date: addDate,
          check_in: inTs,
          check_out: outTs,
          status: addStatus as any,
          method: "manual",
          note: addReason.trim() || "Manual HR Entry",
        },
        { onConflict: "employee_id,date" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manual attendance logged");
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
        : "",
    );
    setEditCheckOut(
      outDate
        ? `${String(outDate.getHours()).padStart(2, "0")}:${String(outDate.getMinutes()).padStart(2, "0")}`
        : "",
    );
    setEditStatus(r.status);
    setEditReason(r.note || "");
  }

  // Export handlers
  function handleExportCsv() {
    const headers = [
      "Date",
      "Name",
      "Employee Code",
      "Department",
      "Check In",
      "Check Out",
      "Total Hours",
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
      formatTime(r.check_in),
      formatTime(r.check_out),
      formatHours(totalHours(r.check_in, r.check_out)),
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
      "Check In",
      "Check Out",
      "Hours",
      "Status",
      "Method",
    ];

    const rows = filteredRecords.map((r) => [
      r.date,
      r.employees?.full_name || "",
      r.employees?.employee_code || "",
      r.employees?.departments?.name || "",
      formatTime(r.check_in),
      formatTime(r.check_out),
      formatHours(totalHours(r.check_in, r.check_out)),
      STATUS_LABELS[r.status] || r.status,
      r.method,
    ]);

    printTable("Flowpeople Attendance Records", headers, rows);
  }

  // Stats calculation
  const total = filteredRecords.length;
  const present = filteredRecords.filter((r) => r.status === "present").length;
  const late = filteredRecords.filter((r) => r.status === "late").length;
  const onLeave = filteredRecords.filter((r) => r.status === "on_leave").length;
  const absent = filteredRecords.filter((r) => r.status === "absent").length;

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6 p-3 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
            Attendance Logs
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            Audit, verify, and export biometric and manual attendance check-ins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {session.isAdmin && (
            <Button
              onClick={() => setAddOpen(true)}
              className="flex-1 sm:flex-none gap-2 bg-primary text-xs h-9"
            >
              <Plus className="h-4 w-4" />
              Manual Entry
            </Button>
          )}

          {session.isAdmin && (
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/settings" })}
              className="flex-1 sm:flex-none gap-2 text-xs h-9 hover:border-primary/50"
            >
              <Navigation className="h-4 w-4 text-primary" />
              Office Geofences
            </Button>
          )}

          <Button
            variant="outline"
            onClick={handleExportCsv}
            className="flex-1 sm:flex-none gap-2 text-xs h-9"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>

          <Button
            variant="outline"
            onClick={handlePrint}
            className="flex-1 sm:flex-none gap-2 text-xs h-9"
          >
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        <Card className="p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Total Records</p>
          <p className="mt-0.5 text-xl sm:text-2xl font-bold">{total}</p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Present</p>
          <p className="mt-0.5 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {present}
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Late Arrivals</p>
          <p className="mt-0.5 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
            {late}
          </p>
        </Card>
        <Card className="p-3 sm:p-4">
          <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">On Leave</p>
          <p className="mt-0.5 text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
            {onLeave}
          </p>
        </Card>
        <Card className="p-3 sm:p-4 col-span-2 sm:col-span-1">
          <p className="text-[11px] sm:text-xs font-medium text-muted-foreground">Absent</p>
          <p className="mt-0.5 text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
            {absent}
          </p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:p-4 shadow-soft">
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
                <SelectItem value="manual">Manual Entry</SelectItem>
                <SelectItem value="leave">Leave Sync</SelectItem>
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
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
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
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Check In</th>
                    <th className="px-5 py-3.5">Check Out</th>
                    <th className="px-5 py-3.5">Total Duration</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Method</th>
                    {session.isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRecords.map((r) => {
                    const hours = totalHours(r.check_in, r.check_out);
                    return (
                      <tr key={r.id} className="transition-colors hover:bg-muted/20">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                              {r.employees?.full_name?.slice(0, 2).toUpperCase() || "EM"}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">
                                {r.employees?.full_name || "Unknown"}
                              </p>
                              <p className="font-mono text-xs text-muted-foreground">
                                {r.employees?.employee_code} •{" "}
                                {r.employees?.departments?.name || "General"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-medium">{formatDate(r.date)}</td>
                        <td className="px-5 py-3.5 font-mono text-xs">{formatTime(r.check_in)}</td>
                        <td className="px-5 py-3.5 font-mono text-xs">{formatTime(r.check_out)}</td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground">
                          {formatHours(hours)}
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant="outline"
                            className={`capitalize text-[11px] ${STATUS_COLORS[r.status as keyof typeof STATUS_COLORS] || ""}`}
                          >
                            {STATUS_LABELS[r.status] || r.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                            {r.method === "face" && (
                              <ScanFace className="h-3.5 w-3.5 text-primary" />
                            )}
                            <span>{r.method}</span>
                          </div>
                        </td>
                        {session.isAdmin && (
                          <td className="px-5 py-3.5 text-right">
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

      {/* Manual Entry Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Log Manual Attendance</DialogTitle>
            <DialogDescription>
              Record an attendance check-in for an employee manually.
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
              <Label>Date</Label>
              <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
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
              Modify recorded check-in times for {editingRecord?.employees?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
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
    </div>
  );
}

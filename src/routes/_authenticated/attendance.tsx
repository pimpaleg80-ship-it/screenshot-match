import { useState, useMemo } from "react";
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
  head: () => ({
    meta: [
      { title: "Attendance Records — FaceTime Attendance" },
      { name: "description", content: "View, audit, edit and export attendance logs." },
    ],
  }),
  component: AttendancePage,
});

interface AttendanceRecord {
  id: string;
  person_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
  method: string;
  confidence: number | null;
  photo_url: string | null;
  edit_reason: string | null;
  edited_by: string | null;
  people: {
    id: string;
    name: string;
    person_code: string;
    department: string;
    photo_url: string | null;
  } | null;
}

function AttendancePage() {
  const session = useSession();
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
  const [addPersonId, setAddPersonId] = useState("");
  const [addDate, setAddDate] = useState(todayKey);
  const [addCheckIn, setAddCheckIn] = useState("09:00");
  const [addCheckOut, setAddCheckOut] = useState("17:00");
  const [addStatus, setAddStatus] = useState("present");
  const [addReason, setAddReason] = useState("");

  // Fetch people for filter & add dialog
  const { data: people = [] } = useQuery({
    queryKey: ["people-list-attendance", session.department],
    queryFn: async () => {
      let q = supabase.from("people").select("*").eq("active", true).order("name");
      if (session.isManager && session.department) {
        q = q.eq("department", session.department);
      }
      const { data } = await q;
      return data ?? [];
    },
  });

  const departments = Array.from(new Set(people.map((p) => p.department || "General"))).sort();

  // Fetch attendance records
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance-records", dateFilter, customDate, session.department],
    queryFn: async () => {
      let q = supabase
        .from("attendance")
        .select("*, people!inner(*)")
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

      if (session.isManager && session.department) {
        q = q.eq("people.department", session.department);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
  });

  // Filter records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        r.people?.name?.toLowerCase().includes(q) ||
        r.people?.person_code?.toLowerCase().includes(q) ||
        r.people?.department?.toLowerCase().includes(q);

      const matchesDept = selectedDept === "all" || r.people?.department === selectedDept;
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
          status: editStatus,
          edit_reason: editReason.trim(),
          edited_by: session.user?.id ?? null,
          updated_at: new Date().toISOString(),
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
      if (!addPersonId) throw new Error("Select a person");
      const inTs = addCheckIn ? new Date(`${addDate}T${addCheckIn}:00`).toISOString() : null;
      const outTs = addCheckOut ? new Date(`${addDate}T${addCheckOut}:00`).toISOString() : null;

      const { error } = await supabase.from("attendance").upsert(
        {
          person_id: addPersonId,
          date: addDate,
          check_in: inTs,
          check_out: outTs,
          status: addStatus,
          method: "manual",
          edit_reason: addReason.trim() || "Manual entry",
          edited_by: session.user?.id ?? null,
        },
        { onConflict: "person_id,date" },
      );

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Manual attendance logged");
      setAddOpen(false);
      setAddPersonId("");
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
    setEditReason(r.edit_reason || "");
  }

  // Export handlers
  function handleExportCsv() {
    const headers = [
      "Date",
      "Name",
      "Personnel Code",
      "Department",
      "Check In",
      "Check Out",
      "Total Hours",
      "Status",
      "Method",
      "Confidence",
      "Edit Reason",
    ];

    const rows = filteredRecords.map((r) => [
      r.date,
      r.people?.name || "",
      r.people?.person_code || "",
      r.people?.department || "",
      formatTime(r.check_in),
      formatTime(r.check_out),
      formatHours(totalHours(r.check_in, r.check_out)),
      STATUS_LABELS[r.status] || r.status,
      r.method,
      r.confidence ? `${Math.round(r.confidence * 100)}%` : "—",
      r.edit_reason || "",
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
      r.people?.name || "",
      r.people?.person_code || "",
      r.people?.department || "",
      formatTime(r.check_in),
      formatTime(r.check_out),
      formatHours(totalHours(r.check_in, r.check_out)),
      STATUS_LABELS[r.status] || r.status,
      r.method,
    ]);

    printTable("FaceTime Attendance Records", headers, rows);
  }

  async function handleExportPdf() {
    const dateKey = dateFilter === "today" ? todayKey : customDate || todayKey;
    const fileName = `attendance_${dateKey}.pdf`;

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
      r.people?.name || "",
      r.people?.person_code || "",
      r.people?.department || "",
      formatTime(r.check_in),
      formatTime(r.check_out),
      formatHours(totalHours(r.check_in, r.check_out)),
      STATUS_LABELS[r.status] || r.status,
      r.method,
    ]);

    toast.info("Generating PDF and backing up to Google Drive...");
    await generateAndBackupPdf({
      title: "FaceTime Attendance - Daily Attendance Log",
      subtitle: `Date: ${dateKey} • Total Entries: ${rows.length}`,
      fileName,
      fileType: "attendance",
      periodStart: dateKey,
      periodEnd: dateKey,
      headers,
      rows,
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Attendance Records</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete audit trail of biometric check-ins, time cards, and manual entries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf} className="gap-2 text-primary border-primary/30 hover:bg-primary/5">
            <Download className="h-4 w-4" />
            Export PDF & Backup
          </Button>

          <Button variant="outline" size="sm" onClick={handleExportCsv} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Print
          </Button>

          {session.isStaff && (
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="gap-2 bg-primary shadow-glow hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Record
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 card-soft">
        <div className="flex flex-wrap items-center gap-2">
          {/* Date presets */}
          <div className="flex rounded-lg bg-secondary p-1">
            <Button
              size="sm"
              variant={dateFilter === "today" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setDateFilter("today")}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant={dateFilter === "week" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setDateFilter("week")}
            >
              Last 7 Days
            </Button>
            <Button
              size="sm"
              variant={dateFilter === "month" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setDateFilter("month")}
            >
              Last 30 Days
            </Button>
            <Button
              size="sm"
              variant={dateFilter === "custom" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setDateFilter("custom")}
            >
              Custom Date
            </Button>
            <Button
              size="sm"
              variant={dateFilter === "all" ? "default" : "ghost"}
              className="h-7 text-xs px-2.5"
              onClick={() => setDateFilter("all")}
            >
              All Records
            </Button>
          </div>

          {dateFilter === "custom" && (
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>

          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedStatus} onValueChange={setSelectedStatus}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="late">Late</SelectItem>
              <SelectItem value="half_day">Half-day</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedMethod} onValueChange={setSelectedMethod}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              <SelectItem value="face">Face Recognition</SelectItem>
              <SelectItem value="manual">Manual Entry</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Records Table */}
      <Card className="card-soft overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/60" />
              <h3 className="mt-3 text-base font-semibold">No records match criteria</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Try changing your date filter or search query.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Personnel</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Check-In</th>
                    <th className="px-4 py-3">Check-Out</th>
                    <th className="px-4 py-3">Total Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Confidence</th>
                    {session.isStaff && <th className="px-4 py-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRecords.map((r) => {
                    const person = r.people;
                    const hours = totalHours(r.check_in, r.check_out);
                    const initials = (person?.name || "?")
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <tr key={r.id} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3.5 font-medium whitespace-nowrap">
                          {formatDate(r.date)}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            {person?.photo_url ? (
                              <img
                                src={person.photo_url}
                                alt={person.name}
                                className="h-7 w-7 rounded-full object-cover border"
                              />
                            ) : (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                                {initials}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-foreground">{person?.name || "—"}</p>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {person?.person_code}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-muted-foreground">
                          {person?.department || "General"}
                        </td>

                        <td className="px-4 py-3.5 font-mono">{formatTime(r.check_in)}</td>
                        <td className="px-4 py-3.5 font-mono">{formatTime(r.check_out)}</td>

                        <td className="px-4 py-3.5 font-semibold text-foreground">
                          {formatHours(hours)}
                        </td>

                        <td className="px-4 py-3.5">
                          <Badge
                            variant="outline"
                            className={`text-[10px] border px-2 py-0.5 ${
                              STATUS_COLORS[r.status] || ""
                            }`}
                          >
                            {STATUS_LABELS[r.status] || r.status}
                          </Badge>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground capitalize">
                            {r.method === "face" ? (
                              <>
                                <ScanFace className="h-3.5 w-3.5 text-primary" /> Face
                              </>
                            ) : (
                              <>
                                <Edit3 className="h-3.5 w-3.5 text-muted-foreground" /> Manual
                              </>
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-muted-foreground">
                          {r.confidence ? `${Math.round(r.confidence * 100)}%` : "—"}
                        </td>

                        {session.isStaff && (
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleOpenEdit(r)}
                                title="Edit record"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("Delete this attendance record?")) {
                                    deleteMutation.mutate(r.id);
                                  }
                                }}
                                title="Delete record"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

      {/* Edit Record Dialog */}
      {editingRecord && (
        <Dialog open={!!editingRecord} onOpenChange={(open) => !open && setEditingRecord(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Edit Attendance Record</DialogTitle>
              <DialogDescription>
                Modify recorded hours or status. An edit reason is required for compliance.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-xl border bg-muted/30 p-3 text-xs space-y-1">
                <p>
                  <strong>Personnel:</strong> {editingRecord.people?.name} (
                  {editingRecord.people?.person_code})
                </p>
                <p>
                  <strong>Date:</strong> {formatDate(editingRecord.date)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Check-In Time</Label>
                  <Input
                    type="time"
                    value={editCheckIn}
                    onChange={(e) => setEditCheckIn(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Check-Out Time</Label>
                  <Input
                    type="time"
                    value={editCheckOut}
                    onChange={(e) => setEditCheckOut(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half-day</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Reason for Modification *</Label>
                <Input
                  placeholder="e.g. Employee forgot badge, manager approved adjustment"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingRecord(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => editMutation.mutate()}
                disabled={editMutation.isPending || !editReason.trim()}
              >
                {editMutation.isPending ? "Saving..." : "Update Record"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Record Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Attendance Entry</DialogTitle>
            <DialogDescription>
              Create a manual attendance record for an employee.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Personnel *</Label>
              <Select value={addPersonId} onValueChange={setAddPersonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person..." />
                </SelectTrigger>
                <SelectContent>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.person_code}) — {p.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={addStatus} onValueChange={setAddStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="half_day">Half-day</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Check-In</Label>
                <Input
                  type="time"
                  value={addCheckIn}
                  onChange={(e) => setAddCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Check-Out</Label>
                <Input
                  type="time"
                  value={addCheckOut}
                  onChange={(e) => setAddCheckOut(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Reason / Note</Label>
              <Input
                placeholder="e.g. On-site visit, approved time adjustment"
                value={addReason}
                onChange={(e) => setAddReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={addMutation.isPending || !addPersonId}
            >
              {addMutation.isPending ? "Saving..." : "Create Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


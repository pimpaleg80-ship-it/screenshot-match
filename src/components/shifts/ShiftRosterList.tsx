import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  PlusCircle,
  Moon,
  Sun,
  Sunset,
  Sunrise,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  Calendar,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getShiftScheduledMinutes } from "@/lib/attendance";

interface ShiftItem {
  id: string;
  name: string;
  code: string | null;
  start_time: string;
  end_time: string;
  work_days: string[] | null;
  break_duration_minutes?: number | null;
  grace_period_minutes?: number | null;
  early_departure_grace_minutes?: number | null;
  half_day_min_hours?: number | null;
  full_day_min_hours?: number | null;
  is_night_shift?: boolean | null;
  is_rotating?: boolean | null;
  color?: string | null;
  is_active?: boolean | null;
}

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface ShiftRosterListProps {
  onAssignShift?: (shift: ShiftItem) => void;
}

export function ShiftRosterList({ onAssignShift }: ShiftRosterListProps) {
  const session = useSession();
  const queryClient = useQueryClient();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ShiftItem | null>(null);
  const [deletingShift, setDeletingShift] = useState<ShiftItem | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [breakMins, setBreakMins] = useState(60);
  const [graceMins, setGraceMins] = useState(15);
  const [earlyGraceMins, setEarlyGraceMins] = useState(15);
  const [halfDayHrs, setHalfDayHrs] = useState(4.0);
  const [fullDayHrs, setFullDayHrs] = useState(8.0);
  const [selectedDays, setSelectedDays] = useState<string[]>([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
  ]);
  const [color, setColor] = useState("#3b82f6");

  // Query shifts
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["shifts-list-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShiftItem[];
    },
  });

  // Query counts of employees per shift
  const { data: employeeShiftCounts = {} } = useQuery({
    queryKey: ["employee-shift-counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("shift_id")
        .eq("status", "active")
        .neq("is_superadmin", true);

      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        if (row.shift_id) {
          counts[row.shift_id] = (counts[row.shift_id] || 0) + 1;
        }
      });
      return counts;
    },
  });

  // Delete shift mutation
  const deleteShiftMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Shift deleted successfully");
      setDeletingShift(null);
      queryClient.invalidateQueries({ queryKey: ["shifts-list-all"] });
      queryClient.invalidateQueries({ queryKey: ["employee-shift-counts"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete shift");
    },
  });

  // Detect overnight automatically
  const isNightShift = startTime > endTime;

  function resetForm() {
    setName("");
    setCode("");
    setStartTime("09:00");
    setEndTime("18:00");
    setBreakMins(60);
    setGraceMins(15);
    setEarlyGraceMins(15);
    setHalfDayHrs(4.0);
    setFullDayHrs(8.0);
    setSelectedDays(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    setColor("#3b82f6");
    setEditingShift(null);
  }

  function handleOpenEdit(shift: ShiftItem) {
    setEditingShift(shift);
    setName(shift.name);
    setCode(shift.code || "");
    setStartTime(shift.start_time.slice(0, 5));
    setEndTime(shift.end_time.slice(0, 5));
    setBreakMins(shift.break_duration_minutes ?? 60);
    setGraceMins(shift.grace_period_minutes ?? 15);
    setEarlyGraceMins(shift.early_departure_grace_minutes ?? 15);
    setHalfDayHrs(Number(shift.half_day_min_hours) || 4.0);
    setFullDayHrs(Number(shift.full_day_min_hours) || 8.0);
    setSelectedDays(shift.work_days || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
    setColor(shift.color || "#3b82f6");
    setCreateModalOpen(true);
  }

  const saveShiftMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Shift name is required");
      if (!startTime || !endTime) throw new Error("Start and End times are required");
      if (selectedDays.length === 0) throw new Error("Select at least one working day");

      const payload = {
        name: name.trim(),
        code: code.trim() || `SH-${name.slice(0, 3).toUpperCase()}`,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        break_duration_minutes: breakMins,
        grace_period_minutes: graceMins,
        early_departure_grace_minutes: earlyGraceMins,
        half_day_min_hours: halfDayHrs,
        full_day_min_hours: fullDayHrs,
        is_night_shift: isNightShift,
        work_days: selectedDays,
        color,
        is_active: true,
      };

      if (editingShift) {
        const { error } = await supabase
          .from("shifts")
          .update(payload)
          .eq("id", editingShift.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shifts").insert({
          ...payload,
          organization_id: session.organizationId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingShift ? "Shift updated successfully" : "New shift created successfully");
      setCreateModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["shifts-list-all"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save shift");
    },
  });

  function formatTimeDisplay(t: string): string {
    const parts = t.split(":");
    const h = parseInt(parts[0] ?? "0", 10);
    const m = parts[1] || "00";
    const ampm = h >= 12 ? "PM" : "AM";
    const formattedH = h % 12 || 12;
    return `${formattedH}:${m} ${ampm}`;
  }

  function getShiftIcon(shift: ShiftItem) {
    if (shift.is_night_shift) return <Moon className="h-4 w-4 text-pink-500" />;
    const h = parseInt(shift.start_time.split(":")[0] ?? "9", 10);
    if (h < 9) return <Sunrise className="h-4 w-4 text-cyan-500" />;
    if (h >= 14) return <Sunset className="h-4 w-4 text-purple-500" />;
    return <Sun className="h-4 w-4 text-amber-500" />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold">Configured Work Shifts</h2>
          <p className="text-xs text-muted-foreground">
            Define daily rosters, break policies, late grace limits, and overnight schedules.
          </p>
        </div>
        {session.isAdmin && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setCreateModalOpen(true);
            }}
            className="gap-1.5 text-xs h-8"
          >
            <PlusCircle className="h-3.5 w-3.5" />
            Create Custom Shift
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {shifts.map((shift) => {
            const scheduledMins = getShiftScheduledMinutes(shift.start_time, shift.end_time, !!shift.is_night_shift);
            const scheduledHours = (scheduledMins / 60).toFixed(1);
            const netWorkingHours = Math.max(0, (scheduledMins - (shift.break_duration_minutes ?? 60)) / 60).toFixed(1);
            const empCount = employeeShiftCounts[shift.id] || 0;

            return (
              <div
                key={shift.id}
                className="rounded-lg border p-4 space-y-3 bg-card hover:border-primary/50 transition-all flex flex-col justify-between shadow-xs"
                style={{ borderTopColor: shift.color || "#3b82f6", borderTopWidth: "4px" }}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                        {getShiftIcon(shift)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm leading-tight text-foreground">{shift.name}</h4>
                        <span className="font-mono text-[11px] text-muted-foreground">{shift.code}</span>
                      </div>
                    </div>

                    {shift.is_night_shift && (
                      <Badge className="bg-pink-500/10 text-pink-600 text-[10px] border-pink-200">
                        Overnight
                      </Badge>
                    )}
                  </div>

                  {/* Timing Box */}
                  <div className="rounded-lg bg-muted/30 p-2.5 font-mono text-xs space-y-1">
                    <div className="flex justify-between font-bold text-foreground">
                      <span>{formatTimeDisplay(shift.start_time)}</span>
                      <span>→</span>
                      <span>{formatTimeDisplay(shift.end_time)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5">
                      <span>Span: {scheduledHours} hrs</span>
                      <span>Net Work: {netWorkingHours} hrs</span>
                    </div>
                  </div>

                  {/* Rules Pill Strip */}
                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Break Duration:</span>
                      <span className="font-medium text-foreground">{shift.break_duration_minutes ?? 60} mins</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Check-In Grace:</span>
                      <span className="font-medium text-foreground">{shift.grace_period_minutes ?? 15} mins</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Early Leave Grace:</span>
                      <span className="font-medium text-foreground">{shift.early_departure_grace_minutes ?? 15} mins</span>
                    </div>
                  </div>

                  {/* Work days tags */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(shift.work_days || ALL_DAYS.slice(0, 5)).map((d) => (
                      <span
                        key={d}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground"
                      >
                        {d.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                    <Users className="h-3 w-3" />
                    <span>{empCount} assigned</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {session.isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(shift)}
                          title="Edit shift settings"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingShift(shift)}
                          title="Delete shift"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {onAssignShift && session.isStaff && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => onAssignShift(shift)}
                      >
                        Assign
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Custom Shift Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {editingShift ? "Edit Work Shift" : "Create Custom Work Shift"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure timings, break durations, grace limits, and overnight rules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Shift Name</Label>
                <Input
                  placeholder="Enter shift name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Shift Code</Label>
                <Input
                  placeholder="Enter shift code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Overnight notification */}
            {isNightShift && (
              <div className="rounded-lg bg-pink-500/10 text-pink-800 dark:text-pink-300 p-2 text-xs flex items-center gap-2 border border-pink-200 dark:border-pink-800">
                <Moon className="h-4 w-4 shrink-0 text-pink-600" />
                <span>
                  <strong>Overnight Shift Detected:</strong> Shifts ending after midnight are automatically supported with cross-midnight hours and early departure rules.
                </span>
              </div>
            )}

            {/* Breaks & Grace Limits */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Break (Minutes)</Label>
                <Input
                  type="number"
                  value={breakMins}
                  onChange={(e) => setBreakMins(parseInt(e.target.value, 10) || 0)}
                  className="h-8 text-xs font-mono"
                  min="0"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Late Grace (Mins)</Label>
                <Input
                  type="number"
                  value={graceMins}
                  onChange={(e) => setGraceMins(parseInt(e.target.value, 10) || 0)}
                  className="h-8 text-xs font-mono"
                  min="0"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Early Leave Grace</Label>
                <Input
                  type="number"
                  value={earlyGraceMins}
                  onChange={(e) => setEarlyGraceMins(parseInt(e.target.value, 10) || 0)}
                  className="h-8 text-xs font-mono"
                  min="0"
                />
              </div>
            </div>

            {/* Thresholds */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Min Hours for Half-Day</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={halfDayHrs}
                  onChange={(e) => setHalfDayHrs(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Min Hours for Full Day</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={fullDayHrs}
                  onChange={(e) => setFullDayHrs(parseFloat(e.target.value) || 0)}
                  className="h-8 text-xs font-mono"
                />
              </div>
            </div>

            {/* Working Days Checkboxes */}
            <div className="space-y-1.5">
              <Label className="text-xs">Working Days</Label>
              <div className="flex flex-wrap gap-2 pt-1">
                {ALL_DAYS.map((day) => {
                  const isChecked = selectedDays.includes(day);
                  return (
                    <label
                      key={day}
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition-colors ${
                        isChecked ? "bg-primary text-primary-foreground font-semibold" : "bg-card hover:bg-muted"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDays([...selectedDays, day]);
                          } else {
                            setSelectedDays(selectedDays.filter((d) => d !== day));
                          }
                        }}
                        className="hidden"
                      />
                      <span>{day.slice(0, 3)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveShiftMutation.mutate()}
              disabled={saveShiftMutation.isPending || !name.trim() || selectedDays.length === 0}
              className="gap-1.5 text-xs h-8"
            >
              {saveShiftMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {editingShift ? "Update Shift" : "Save Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingShift} onOpenChange={(open) => !open && setDeletingShift(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete Shift
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to delete{" "}
              <strong>{deletingShift?.name}</strong>?{" "}
              {(employeeShiftCounts[deletingShift?.id ?? ""] || 0) > 0 && (
                <span className="text-destructive font-medium">
                  {employeeShiftCounts[deletingShift?.id ?? ""]} employee(s) are currently assigned to this shift and will be unlinked.{" "}
                </span>
              )}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingShift(null)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deletingShift && deleteShiftMutation.mutate(deletingShift.id)}
              disabled={deleteShiftMutation.isPending}
              className="gap-1.5 text-xs h-8"
            >
              {deleteShiftMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Delete Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

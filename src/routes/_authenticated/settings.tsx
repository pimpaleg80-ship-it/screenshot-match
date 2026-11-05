import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Building,
  Clock,
  ScanFace,
  Calendar,
  Shield,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { formatDate } from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — FaceTime Attendance" },
      { name: "description", content: "Configure organizational shifts, facial recognition parameters, and holidays." },
    ],
  }),
  component: SettingsPage,
});

const DAYS = [
  { id: 0, label: "Sunday" },
  { id: 1, label: "Monday" },
  { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" },
  { id: 4, label: "Thursday" },
  { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
];

function SettingsPage() {
  const session = useSession();
  const queryClient = useQueryClient();

  // Settings form state
  const [orgName, setOrgName] = useState("My Organization");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("17:00");
  const [lateGraceMinutes, setLateGraceMinutes] = useState(10);
  const [halfDayHours, setHalfDayHours] = useState(4);
  const [weeklyOffDays, setWeeklyOffDays] = useState<number[]>([0, 6]);
  const [faceThreshold, setFaceThreshold] = useState(0.5);
  const [duplicateScanMinutes, setDuplicateScanMinutes] = useState(5);
  const [storePhotos, setStorePhotos] = useState(false);
  const [dataRetentionDays, setDataRetentionDays] = useState(365);

  // Holiday Modal state
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayTitle, setNewHolidayTitle] = useState("");

  // Role Assignment Modal state
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState("");
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<"admin" | "manager" | "kiosk">("manager");

  // Fetch Settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).single();
      if (error) throw error;
      return data;
    },
  });

  // Populate form on load
  useEffect(() => {
    if (settingsData) {
      setOrgName(settingsData.org_name);
      setWorkStart(settingsData.work_start);
      setWorkEnd(settingsData.work_end);
      setLateGraceMinutes(settingsData.late_grace_minutes);
      setHalfDayHours(Number(settingsData.half_day_hours));
      setWeeklyOffDays(settingsData.weekly_off_days || [0, 6]);
      setFaceThreshold(Number(settingsData.face_match_threshold));
      setDuplicateScanMinutes(settingsData.duplicate_scan_minutes);
      setStorePhotos(settingsData.store_photos);
      setDataRetentionDays(settingsData.data_retention_days);
    }
  }, [settingsData]);

  // Fetch Holidays
  const { data: holidays = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ["holidays-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch Users & Roles
  const { data: userProfiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["user-profiles-and-roles"],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase.from("profiles").select("*");
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase.from("user_roles").select("*");
      if (rErr) throw rErr;

      const roleMap: Record<string, string[]> = {};
      for (const r of roles ?? []) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id]!.push(r.role);
      }

      return (profiles ?? []).map((p) => ({
        ...p,
        roles: roleMap[p.id] || [],
      }));
    },
  });

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("settings")
        .update({
          org_name: orgName.trim(),
          work_start: workStart,
          work_end: workEnd,
          late_grace_minutes: Number(lateGraceMinutes),
          half_day_hours: Number(halfDayHours),
          weekly_off_days: weeklyOffDays,
          face_match_threshold: Number(faceThreshold),
          duplicate_scan_minutes: Number(duplicateScanMinutes),
          store_photos: storePhotos,
          data_retention_days: Number(dataRetentionDays),
          updated_at: new Date().toISOString(),
        })
        .eq("id", 1);

      if (error) throw error;

      // Log audit
      await supabase.from("audit_logs").insert({
        user_id: session.user?.id ?? null,
        action: "update_settings",
        details: { org_name: orgName, updated_by: session.user?.email },
      });
    },
    onSuccess: () => {
      toast.success("Settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save settings");
    },
  });

  // Add Holiday Mutation
  const addHolidayMutation = useMutation({
    mutationFn: async () => {
      if (!newHolidayDate || !newHolidayTitle.trim()) {
        throw new Error("Date and title are required");
      }
      const { error } = await supabase.from("holidays").insert({
        date: newHolidayDate,
        title: newHolidayTitle.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Holiday added");
      setHolidayOpen(false);
      setNewHolidayDate("");
      setNewHolidayTitle("");
      queryClient.invalidateQueries({ queryKey: ["holidays-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add holiday");
    },
  });

  // Delete Holiday Mutation
  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holidays").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Holiday removed");
      queryClient.invalidateQueries({ queryKey: ["holidays-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete holiday");
    },
  });

  // Assign Role Mutation
  const assignRoleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserForRole) throw new Error("Select a user");
      const { error } = await supabase.from("user_roles").insert({
        user_id: selectedUserForRole,
        role: selectedRoleToAssign,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role assigned successfully");
      setRoleModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["user-profiles-and-roles"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to assign role");
    },
  });

  // Remove Role Mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role removed");
      queryClient.invalidateQueries({ queryKey: ["user-profiles-and-roles"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove role");
    },
  });

  function toggleDay(dayId: number) {
    if (weeklyOffDays.includes(dayId)) {
      setWeeklyOffDays(weeklyOffDays.filter((d) => d !== dayId));
    } else {
      setWeeklyOffDays([...weeklyOffDays, dayId].sort());
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">System Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure working hours, face-matching precision, holidays, and administrative access.
          </p>
        </div>

        {session.isAdmin && (
          <Button
            onClick={() => saveSettingsMutation.mutate()}
            disabled={saveSettingsMutation.isPending}
            className="gap-2 bg-primary shadow-glow hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {settingsLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card 1: Shift & Work Schedule */}
          <Card className="card-soft">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">Shift Timings & Punctuality</CardTitle>
              </div>
              <CardDescription>
                Define operational shift hours and late grace tolerances.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Organization Name</Label>
                  <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>

                <div className="space-y-1.5">
                  <Label>Late Grace Period (Minutes)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    value={lateGraceMinutes}
                    onChange={(e) => setLateGraceMinutes(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Check-ins after shift start + grace will be marked "Late".
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Shift Start Time</Label>
                  <Input
                    type="time"
                    value={workStart}
                    onChange={(e) => setWorkStart(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Shift End Time</Label>
                  <Input
                    type="time"
                    value={workEnd}
                    onChange={(e) => setWorkEnd(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Half-Day Threshold (Hours)</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min={1}
                    max={12}
                    value={halfDayHours}
                    onChange={(e) => setHalfDayHours(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Label className="text-xs font-semibold">Weekly Off Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => {
                    const isChecked = weeklyOffDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDay(d.id)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                          isChecked
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Biometric AI Parameters */}
          <Card className="card-soft">
            <CardHeader>
              <div className="flex items-center gap-2">
                <ScanFace className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Face Recognition & Kiosk Configuration
                </CardTitle>
              </div>
              <CardDescription>
                Tune biometric verification sensitivity, duplicate rejection, and privacy.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Face Match Threshold ({faceThreshold})</Label>
                    <span className="text-xs font-mono text-muted-foreground">
                      {faceThreshold <= 0.45 ? "Strict" : faceThreshold <= 0.55 ? "Balanced" : "Lenient"}
                    </span>
                  </div>
                  <Input
                    type="range"
                    min="0.30"
                    max="0.70"
                    step="0.02"
                    value={faceThreshold}
                    onChange={(e) => setFaceThreshold(parseFloat(e.target.value))}
                    className="cursor-pointer"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Euclidean distance limit for matching. Standard recommendation: 0.50.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label>Duplicate Scan Cooldown (Minutes)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={duplicateScanMinutes}
                    onChange={(e) => setDuplicateScanMinutes(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Prevents multiple rapid check-in logs when standing in front of kiosk.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <Label>Store Live Kiosk Capture Thumbnails</Label>
                  <p className="text-xs text-muted-foreground">
                    Save a low-resolution capture thumbnail with each attendance record.
                  </p>
                </div>
                <Switch checked={storePhotos} onCheckedChange={setStorePhotos} />
              </div>
            </CardContent>
          </Card>

          {/* Card 3: Holidays Calendar */}
          <Card className="card-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">Official Holidays</CardTitle>
                </div>
                <CardDescription>
                  Scheduled organization holidays exempt from absenteeism.
                </CardDescription>
              </div>

              {session.isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setHolidayOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Holiday
                </Button>
              )}
            </CardHeader>

            <CardContent>
              {holidaysLoading ? (
                <Skeleton className="h-24 w-full rounded-xl" />
              ) : holidays.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No holidays added yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {holidays.map((h) => (
                    <div key={h.id} className="flex items-center justify-between py-2.5 text-xs">
                      <div>
                        <span className="font-semibold text-foreground">{h.title}</span>
                        <span className="ml-2 text-muted-foreground font-mono">
                          {formatDate(h.date)}
                        </span>
                      </div>
                      {session.isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteHolidayMutation.mutate(h.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 4: User Roles & Permissions */}
          {session.isAdmin && (
            <Card className="card-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-semibold">User Role Access</CardTitle>
                  </div>
                  <CardDescription>
                    Assign Admin, Manager, and Kiosk terminal roles to authenticated accounts.
                  </CardDescription>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRoleModalOpen(true)}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Assign Role
                </Button>
              </CardHeader>

              <CardContent>
                {profilesLoading ? (
                  <Skeleton className="h-24 w-full rounded-xl" />
                ) : userProfiles.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">No accounts found.</p>
                ) : (
                  <div className="divide-y divide-border/60">
                    {userProfiles.map((user) => (
                      <div
                        key={user.id}
                        className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between text-xs"
                      >
                        <div>
                          <p className="font-semibold text-foreground">
                            {user.full_name || "Account"} ({user.email || "No email"})
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            Dept: {user.department || "General"}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          {user.roles.length === 0 ? (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              No Role
                            </Badge>
                          ) : (
                            user.roles.map((r) => (
                              <Badge
                                key={r}
                                variant="secondary"
                                className="gap-1 text-[10px] uppercase font-semibold"
                              >
                                {r}
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeRoleMutation.mutate({ userId: user.id, role: r })
                                  }
                                  className="ml-1 text-muted-foreground hover:text-destructive"
                                >
                                  ×
                                </button>
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Add Public Holiday</DialogTitle>
            <DialogDescription>Schedule non-working organization holidays.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={newHolidayDate}
                onChange={(e) => setNewHolidayDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Holiday Title</Label>
              <Input
                placeholder="e.g. Founders Day"
                value={newHolidayTitle}
                onChange={(e) => setNewHolidayTitle(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHolidayOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => addHolidayMutation.mutate()}
              disabled={addHolidayMutation.isPending || !newHolidayDate || !newHolidayTitle.trim()}
            >
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Role Dialog */}
      <Dialog open={roleModalOpen} onOpenChange={setRoleModalOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Assign Role</DialogTitle>
            <DialogDescription>Grant administrative or kiosk privileges.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>User Account</Label>
              <Select value={selectedUserForRole} onValueChange={setSelectedUserForRole}>
                <SelectTrigger className="text-xs">
                  <SelectValue placeholder="Select user..." />
                </SelectTrigger>
                <SelectContent>
                  {userProfiles.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={selectedRoleToAssign}
                onValueChange={(v) => setSelectedRoleToAssign(v as any)}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Full Control)</SelectItem>
                  <SelectItem value="manager">Manager (Department Records)</SelectItem>
                  <SelectItem value="kiosk">Kiosk (Terminal Mode Only)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => assignRoleMutation.mutate()}
              disabled={assignRoleMutation.isPending || !selectedUserForRole}
            >
              Assign Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

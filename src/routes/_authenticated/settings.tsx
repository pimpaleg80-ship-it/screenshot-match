import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  HardDrive,
  CloudUpload,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  FileText,
  Lock,
  RefreshCw,
  Loader2,
  MapPin,
  Navigation,
  Compass,
} from "lucide-react";
import { getCurrentDevicePosition } from "@/lib/geofence";
import { AdminLocationStudio } from "@/components/admin/location-studio";
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
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings — Flowpeople by Fluxora" },
      {
        name: "description",
        content:
          "Configure organization profile, biometric verification parameters, holidays, and Google Drive cloud backups.",
      },
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
  const navigate = useNavigate();
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

  // Drive state
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveBackingUp, setDriveBackingUp] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Holiday Modal state
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayTitle, setNewHolidayTitle] = useState("");

  // Role Assignment Modal state
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [selectedUserForRole, setSelectedUserForRole] = useState("");
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState<
    "admin" | "manager" | "employee"
  >("manager");

  // Handle OAuth redirect url query params
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const driveConnected = url.searchParams.get("drive_connected");
    const driveEmail = url.searchParams.get("drive_email");
    const driveError = url.searchParams.get("drive_error");

    if (driveConnected === "true") {
      toast.success("Google Drive connected successfully!", {
        description: driveEmail ? `Linked to ${driveEmail}` : "Backups will sync automatically.",
      });
      url.searchParams.delete("drive_connected");
      url.searchParams.delete("drive_email");
      window.history.replaceState({}, document.title, url.pathname);
      queryClient.invalidateQueries({ queryKey: ["google-drive-status"] });
    } else if (driveError) {
      toast.error("Google Drive connection failed", {
        description: decodeURIComponent(driveError),
      });
      url.searchParams.delete("drive_error");
      window.history.replaceState({}, document.title, url.pathname);
    }
  }, [queryClient]);

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
      setOrgName(
        (settingsData as any).org_name || session.organizationName || "Fluxora Technologies",
      );
      setWorkStart(settingsData.work_start || "09:00:00");
      setWorkEnd(settingsData.work_end || "18:00:00");
      setLateGraceMinutes(settingsData.late_grace_minutes ?? 15);
      setHalfDayHours(Number((settingsData as any).half_day_hours || 4));
      setWeeklyOffDays(settingsData.weekly_off_days || [0, 6]);
      setFaceThreshold(Number(settingsData.face_match_threshold ?? 0.45));
      setDuplicateScanMinutes(settingsData.duplicate_scan_minutes ?? 2);
      setStorePhotos(settingsData.store_capture_photos ?? false);
      setDataRetentionDays(settingsData.retention_days ?? 90);
    }
  }, [settingsData, session.organizationName]);

  // Fetch Google Drive Status
  const { data: driveStatus, isLoading: driveStatusLoading } = useQuery({
    queryKey: ["google-drive-status"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-drive-status");
        if (error) {
          // Fallback to direct table check
          const { data: conn } = await supabase.from("drive_connection").select("*").maybeSingle();
          return conn
            ? {
              connected: true,
              email: conn.google_email,
              auto_backup_on_pdf: conn.auto_backup_on_pdf,
              daily_backup_enabled: conn.daily_backup,
            }
            : { connected: false };
        }
        return data;
      } catch {
        const { data: conn } = await supabase.from("drive_connection").select("*").maybeSingle();
        return conn
          ? {
            connected: true,
            email: conn.google_email,
            auto_backup_on_pdf: conn.auto_backup_on_pdf,
            daily_backup_enabled: conn.daily_backup,
          }
          : { connected: false };
      }
    },
  });

  // Fetch Backup History
  const { data: backupHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["google-drive-backups-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drive_backups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

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
      const { data: emps, error: pErr } = await supabase
        .from("employees")
        .select("id, user_id, full_name, email, department_id, departments(name)")
        .not("user_id", "is", null);
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase.from("user_roles").select("*");
      if (rErr) throw rErr;

      const roleMap: Record<string, string[]> = {};
      for (const r of roles ?? []) {
        if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
        roleMap[r.user_id]!.push(r.role);
      }

      return (emps ?? []).map((e: any) => ({
        id: e.user_id as string,
        full_name: e.full_name,
        email: e.email,
        department: e.departments?.name || "General",
        roles: roleMap[e.user_id] || [],
      }));
    },
  });

  // Save Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("settings")
        .update({
          work_start: workStart,
          work_end: workEnd,
          late_grace_minutes: Number(lateGraceMinutes),
          weekly_off_days: weeklyOffDays,
          face_match_threshold: Number(faceThreshold),
          store_capture_photos: storePhotos,
          retention_days: Number(dataRetentionDays),
        })
        .eq("id", 1);

      if (error) throw error;

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

  // Drive Connect Action
  async function handleConnectDrive() {
    try {
      setDriveConnecting(true);
      const { data, error } = await supabase.functions.invoke("google-drive-auth-start", {
        headers: { Accept: "application/json" },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No authorization URL returned");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate Google Drive authentication");
      setDriveConnecting(false);
    }
  }

  // Drive Disconnect Action
  async function handleDisconnectDrive() {
    if (
      !confirm(
        "Are you sure you want to disconnect Google Drive backup? Automatic cloud sync will be paused.",
      )
    ) {
      return;
    }
    try {
      const { error } = await supabase.functions.invoke("google-drive-status", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      toast.success("Google Drive disconnected");
      queryClient.invalidateQueries({ queryKey: ["google-drive-status"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect Google Drive");
    }
  }

  // Trigger Manual Backup Now
  async function handleBackupNow() {
    try {
      setDriveBackingUp(true);
      toast.info("Starting instant daily attendance backup...");
      const { data, error } = await supabase.functions.invoke("google-drive-daily-backup");
      if (error) throw error;

      if (data?.success) {
        toast.success(`Backup completed: ${data.file_name}`, {
          description: "Saved in FaceAttendance Backups on Google Drive",
        });
      } else {
        toast.error(data?.error || "Backup failed");
      }
      queryClient.invalidateQueries({ queryKey: ["google-drive-backups-history"] });
      queryClient.invalidateQueries({ queryKey: ["google-drive-status"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger instant backup");
    } finally {
      setDriveBackingUp(false);
    }
  }

  // Retry Failed Backup
  async function handleRetryBackup(backupId: string) {
    try {
      setRetryingId(backupId);
      toast.info("Retrying backup to Google Drive...");
      const { data, error } = await supabase.functions.invoke("google-drive-daily-backup");
      if (error) throw error;

      toast.success("Retry completed successfully");
      queryClient.invalidateQueries({ queryKey: ["google-drive-backups-history"] });
    } catch (err: any) {
      toast.error(err.message || "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  // Toggle Drive Setting
  async function handleToggleDriveSetting(
    key: "auto_backup_on_pdf" | "daily_backup_enabled",
    value: boolean,
  ) {
    try {
      await supabase.functions.invoke("google-drive-status", {
        body: { action: "update_settings", [key]: value },
      });
      queryClient.invalidateQueries({ queryKey: ["google-drive-status"] });
      toast.success("Drive preference updated");
    } catch {
      toast.error("Failed to update setting");
    }
  }

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

  const isDriveConnected = driveStatus?.connected === true;
  const isDriveRevoked = driveStatus?.revoked === true;

  if (!session.loading && !session.isAdmin) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-3" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          System and organizational configuration is restricted strictly to administrators.
        </p>
        <Button className="mt-4" onClick={() => navigate({ to: "/dashboard" })}>
          Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8 p-3 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
            System Settings
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            Configure working hours, face-matching precision, Google Drive backups, and holidays.
          </p>
        </div>

        {session.isAdmin && (
          <Button
            onClick={() => saveSettingsMutation.mutate()}
            disabled={saveSettingsMutation.isPending}
            className="w-full sm:w-auto gap-2 bg-primary shadow-glow hover:bg-primary/90 text-xs h-9"
          >
            <Save className="h-4 w-4" />
            {saveSettingsMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {/* Revoked Token Warning Banner */}
      {isDriveRevoked && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 sm:p-4 text-xs text-destructive">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Google Drive Connection Revoked</p>
              <p className="text-muted-foreground">
                Your authorization was revoked or expired in Google Security settings. Reconnect to
                resume backups.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleConnectDrive}
            className="gap-1.5 w-full sm:w-auto shrink-0 text-xs h-8"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reconnect Drive
          </Button>
        </div>
      )}

      {settingsLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card 1: Organization & Work Schedule */}
          <Card className="card-soft">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Organization & Work Schedule
                </CardTitle>
              </div>
              <CardDescription>
                Configure organization profile and active operating schedule.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="max-w-md space-y-1.5">
                <Label>Organization Name</Label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
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
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${isChecked
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

          {/* Card: Work Locations & Geofence Boundaries (Interactive Studio) */}
          <Card id="geofence" className="card-soft overflow-hidden scroll-mt-20">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Admin Location Studio & GPS Geofence Perimeters
                </CardTitle>
              </div>
              <CardDescription>
                Configure office GPS coordinates, adjust circular geofence perimeters, capture live on-site coordinates, and assign employee work locations.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 sm:p-6">
              <AdminLocationStudio />
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
                      {faceThreshold <= 0.45
                        ? "Strict"
                        : faceThreshold <= 0.55
                          ? "Balanced"
                          : "Lenient"}
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
                    Verification precision threshold. Standard recommendation: 0.50.
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

          {/* Card 3: Google Drive Cloud Backup (NEW) */}
          <Card className="card-soft border-primary/20">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Google Drive Cloud Backup
                  </CardTitle>
                  {isDriveConnected ? (
                    <Badge
                      variant="outline"
                      className="border-success/30 bg-success/10 text-success text-[10px] gap-1"
                    >
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-muted text-muted-foreground text-[10px]"
                    >
                      Not Connected
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">
                  Automatic cloud archive for all generated PDF attendance records and reports.
                </CardDescription>
              </div>

              {session.isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  {isDriveConnected ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBackupNow}
                        disabled={driveBackingUp}
                        className="gap-1.5 text-xs"
                      >
                        {driveBackingUp ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CloudUpload className="h-3.5 w-3.5" />
                        )}
                        Back up now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDisconnectDrive}
                        className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={handleConnectDrive}
                      disabled={driveConnecting}
                      className="gap-2 bg-primary shadow-glow hover:bg-primary/90 text-xs"
                    >
                      {driveConnecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <HardDrive className="h-3.5 w-3.5" />
                      )}
                      Connect Google Drive
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Connection Status Details */}
              {isDriveConnected && (
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Connected Google Account</p>
                      <p className="font-semibold text-foreground mt-0.5">
                        {driveStatus?.email || "Connected"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Last Cloud Backup</p>
                      <p className="font-semibold text-foreground mt-0.5">
                        {driveStatus?.last_backup_at
                          ? new Date(driveStatus.last_backup_at).toLocaleString()
                          : "No backups performed yet"}
                      </p>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="space-y-3 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs">Auto backup on PDF generation</Label>
                        <p className="text-[11px] text-muted-foreground">
                          Automatically upload attendance or report PDFs to Drive right when
                          exported.
                        </p>
                      </div>
                      <Switch
                        checked={driveStatus?.auto_backup_on_pdf ?? true}
                        onCheckedChange={(val) =>
                          handleToggleDriveSetting("auto_backup_on_pdf", val)
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-xs">
                          Daily automated attendance backup (11:30 PM)
                        </Label>
                        <p className="text-[11px] text-muted-foreground">
                          Automated daily end-of-day backup of the entire day's attendance ledger.
                        </p>
                      </div>
                      <Switch
                        checked={driveStatus?.daily_backup_enabled ?? true}
                        onCheckedChange={(val) =>
                          handleToggleDriveSetting("daily_backup_enabled", val)
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Security Privacy Notice */}
              <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
                <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p>
                  <strong>Security & Privacy:</strong> Attendance and report PDFs contain personal
                  personnel data. The application uses restricted secure cloud permissions (can only
                  access files it creates). Please ensure your Google Drive folder remains private
                  and is not shared publicly.
                </p>
              </div>

              {/* Backup History Table */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Google Drive Backup History
                  </h4>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Folder: Flowpeople Cloud Backups / YYYY / MM
                  </span>
                </div>

                {historyLoading ? (
                  <Skeleton className="h-32 w-full rounded-xl" />
                ) : backupHistory.length === 0 ? (
                  <div className="rounded-xl border border-dashed py-8 text-center text-xs text-muted-foreground">
                    <CloudUpload className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                    No backups uploaded yet. Connect Drive or click "Back up now".
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[500px] text-left text-xs">
                      <thead className="bg-muted/40 font-semibold text-muted-foreground border-b">
                        <tr>
                          <th className="px-4 py-2.5">File Name</th>
                          <th className="px-3 py-2.5">Type</th>
                          <th className="px-3 py-2.5">Date</th>
                          <th className="px-3 py-2.5">Status</th>
                          <th className="px-3 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {backupHistory.map((item) => (
                          <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="truncate max-w-[200px]">{item.file_name}</span>
                            </td>
                            <td className="px-3 py-2.5 capitalize text-muted-foreground">
                              {item.file_type}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {item.created_at
                                ? new Date(item.created_at).toLocaleDateString()
                                : "--"}
                            </td>
                            <td className="px-3 py-2.5">
                              {item.status === "success" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-success/30 bg-success/10 text-success"
                                >
                                  Success
                                </Badge>
                              )}
                              {item.status === "pending" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-warning/30 bg-warning/10 text-warning-foreground"
                                >
                                  Pending
                                </Badge>
                              )}
                              {item.status === "failed" && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] border-destructive/30 bg-destructive/10 text-destructive"
                                  title={item.error_message || "Upload failed"}
                                >
                                  Failed
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              {item.drive_link && item.status === "success" && (
                                <a
                                  href={item.drive_link}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                                >
                                  Open in Drive <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {item.status === "failed" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] gap-1 text-primary"
                                  onClick={() => handleRetryBackup(item.id)}
                                  disabled={retryingId === item.id}
                                >
                                  {retryingId === item.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                  Retry
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card 4: Holidays Calendar */}
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
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No holidays added yet.
                </p>
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

          {/* Card 5: User Roles & Permissions */}
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
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    No accounts found.
                  </p>
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
        <DialogContent className="w-[95vw] sm:max-w-xs max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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

          <DialogFooter className="gap-2 sm:justify-end">
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
        <DialogContent className="w-[95vw] sm:max-w-xs max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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
                  <SelectItem value="employee">Employee (Personal Portal)</SelectItem>
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

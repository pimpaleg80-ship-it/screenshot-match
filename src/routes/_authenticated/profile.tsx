import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  ShieldCheck,
  ScanFace,
  Save,
  Camera,
  CheckCircle2,
  AlertCircle,
  Palmtree,
  UserCheck,
  Lock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My Profile — Flowpeople by Fluxora" },
      { name: "description", content: "View and manage your employee profile and account." },
    ],
  }),
  component: ProfilePage,
});

interface EmployeeDetail {
  id: string;
  user_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  joining_date: string | null;
  status: string;
  photo_url: string | null;
  department_id: string | null;
  manager_id: string | null;
  departments?: { name: string } | null;
  manager?: { full_name: string } | null;
}

interface LeaveBalanceRow {
  leave_type_id: string;
  total: number;
  used: number;
  remaining?: number | null;
  leave_types?: { name: string; color: string | null } | null;
}

function ProfilePage() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [phone, setPhone] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      setPasswordLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Login password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  }

  // Fetch full employee details including department and manager
  const { data: employee, isLoading: empLoading } = useQuery({
    queryKey: ["my-employee-profile", session.user?.id],
    queryFn: async () => {
      if (!session.user?.id) return null;
      const { data, error } = await supabase
        .from("employees")
        .select(
          `
          id,
          user_id,
          employee_code,
          full_name,
          email,
          phone,
          designation,
          joining_date,
          status,
          photo_url,
          department_id,
          manager_id,
          departments(name),
          manager:employees!employees_manager_id_fkey(full_name)
        `,
        )
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) throw error;
      return data as unknown as EmployeeDetail | null;
    },
    enabled: !!session.user?.id,
  });

  // Query Face Descriptor enrollment status
  const { data: faceData, isLoading: faceLoading } = useQuery({
    queryKey: ["my-face-status", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return null;
      const { data, error } = await supabase
        .from("face_data")
        .select("id, enrolled_at, consent")
        .eq("employee_id", employee.id)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Query Leave Balances
  const { data: balances = [] } = useQuery({
    queryKey: ["my-leave-balances", employee?.id],
    queryFn: async () => {
      if (!employee?.id) return [];
      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from("leave_balances")
        .select("leave_type_id, total, used, remaining, leave_types(name, color)")
        .eq("employee_id", employee.id)
        .eq("year", currentYear);
      if (error) {
        console.error("Failed to query profile leave balances:", error);
        return [];
      }
      return (data ?? []) as unknown as LeaveBalanceRow[];
    },
    enabled: !!employee?.id,
  });

  useEffect(() => {
    if (employee?.phone) {
      setPhone(employee.phone);
    }
  }, [employee?.phone]);

  const updatePhoneMutation = useMutation({
    mutationFn: async () => {
      if (!employee?.id) throw new Error("No employee record");
      const { error } = await supabase
        .from("employees")
        .update({ phone: phone.trim() || null })
        .eq("id", employee.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Phone number updated");
      queryClient.invalidateQueries({ queryKey: ["my-employee-profile"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update phone");
    },
  });

  async function handleAvatarUpload(file: File) {
    if (!employee?.id || !session.user?.id) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${session.user.id}/avatar_${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(uploadData.path);

      const { error: updateErr } = await supabase
        .from("employees")
        .update({ photo_url: urlData.publicUrl })
        .eq("id", employee.id);

      if (updateErr) throw updateErr;

      toast.success("Profile photo updated");
      queryClient.invalidateQueries({ queryKey: ["my-employee-profile"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  }

  const initials = (employee?.full_name || session.fullName || "User")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6 p-3 sm:p-6 md:p-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
          View your employment details, update your contact info, and inspect leave allocations.
        </p>
      </div>

      {empLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Left Column: Avatar & Basic Info */}
          <Card className="md:col-span-1">
            <CardContent className="flex flex-col items-center p-6 text-center">
              <div className="relative group">
                {employee?.photo_url ? (
                  <img
                    src={employee.photo_url}
                    alt={employee.full_name}
                    className="h-28 w-28 rounded-full object-cover border-2 border-primary/20 shadow-md"
                  />
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-md">
                    {initials}
                  </div>
                )}

                <label
                  htmlFor="avatar-input"
                  className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform hover:scale-110"
                  title="Upload profile photo"
                >
                  <Camera className="h-4 w-4" />
                  <input
                    id="avatar-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                    }}
                  />
                </label>
              </div>

              <h2 className="mt-4 text-lg font-bold">{employee?.full_name || session.fullName}</h2>
              <p className="text-xs text-muted-foreground">{employee?.designation || "Employee"}</p>

              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                <Badge variant="outline" className="text-xs">
                  {employee?.employee_code || "EMP"}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs"
                >
                  Active Staff
                </Badge>
              </div>

              {/* Biometric Status */}
              <div className="mt-6 w-full rounded-xl border p-3 text-left">
                <div className="flex items-center gap-2">
                  <ScanFace className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">Face Biometric Status</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span>Recognition Data</span>
                  {faceData ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Enrolled
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-amber-600 dark:text-amber-400 text-[10px] gap-1"
                    >
                      <AlertCircle className="h-3 w-3" /> Not Enrolled
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Detailed Employment Specs & Update */}
          <div className="space-y-6 md:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Employment Information</CardTitle>
                <CardDescription>
                  Official corporate placement details maintained by HR.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Department</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{employee?.departments?.name || "General"}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Designation</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>{employee?.designation || "Staff Member"}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Reporting Manager</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                      <span>{employee?.manager?.full_name || "Executive Team"}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Joining Date</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{employee?.joining_date || "2026-01-01"}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Official Email</Label>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{employee?.email || session.user?.email}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone-input" className="text-xs text-muted-foreground">
                        Phone Contact
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="phone-input"
                          placeholder="+91 98765 43210"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="h-8 text-xs"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-xs"
                          onClick={() => updatePhoneMutation.mutate()}
                          disabled={updatePhoneMutation.isPending}
                        >
                          <Save className="h-3 w-3" />
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leave Balances Summary */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">
                      Leave Balances ({new Date().getFullYear()})
                    </CardTitle>
                    <CardDescription>
                      Available annual paid quota and utilized days.
                    </CardDescription>
                  </div>
                  <Palmtree className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {balances.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No active leave balances allocated for this calendar year.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {balances.map((b) => {
                      const total = Number(b.total || 0);
                      const used = Number(b.used || 0);
                      const available = Number(b.remaining ?? Math.max(0, total - used));
                      const pct = Math.round((used / (total || 1)) * 100);
                      return (
                        <div key={b.leave_type_id} className="rounded-xl border p-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold">{b.leave_types?.name || "Leave"}</span>
                            <span className="text-muted-foreground">
                              <span className="font-bold text-foreground">{available}</span> /{" "}
                              {total} left
                            </span>
                          </div>
                          <Progress value={used} max={total} className="h-1.5" />
                          <div className="text-[10px] text-muted-foreground">
                            {used} days used ({pct}%)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Security & Password */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Account Security & Password</CardTitle>
                    <CardDescription>Update your personal account login password.</CardDescription>
                  </div>
                  <Lock className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">New Password</Label>
                      <Input
                        type="password"
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Confirm New Password</Label>
                      <Input
                        type="password"
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-9 text-xs"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={passwordLoading || !newPassword || !confirmPassword}
                      className="gap-1.5"
                    >
                      {passwordLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Update Password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

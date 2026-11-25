import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Calendar,
  Camera,
  Save,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MapPin,
  HeartPulse,
  Clock,
  Shield,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export interface EmployeeProfileData {
  id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  personal_email?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  marital_status?: string | null;
  blood_group?: string | null;
  nationality?: string | null;
  current_address?: string | null;
  permanent_address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  designation: string | null;
  joining_date: string | null;
  employment_type?: string | null;
  work_location?: string | null;
  notice_period_days?: number | null;
  status: string;
  photo_url: string | null;
  department_id: string | null;
  manager_id: string | null;
  shift_id?: string | null;
  departments?: { name: string } | null;
  manager?: { full_name: string } | null;
  shifts?: { name: string; start_time: string; end_time: string; work_days: string[] | null } | null;
}

interface SelfServiceProfileProps {
  employee: EmployeeProfileData;
  faceEnrolled: boolean;
  userId: string;
}

export function SelfServiceProfile({ employee, faceEnrolled, userId }: SelfServiceProfileProps) {
  const queryClient = useQueryClient();

  // Permitted personal details state
  const [phone, setPhone] = useState(employee.phone || "");
  const [personalEmail, setPersonalEmail] = useState(employee.personal_email || "");
  const [currentAddress, setCurrentAddress] = useState(employee.current_address || "");
  const [permanentAddress, setPermanentAddress] = useState(employee.permanent_address || "");
  const [emergencyName, setEmergencyName] = useState(employee.emergency_contact_name || "");
  const [emergencyPhone, setEmergencyPhone] = useState(employee.emergency_contact_phone || "");
  const [emergencyRelation, setEmergencyRelation] = useState(employee.emergency_contact_relation || "");

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setPhone(employee.phone || "");
    setPersonalEmail(employee.personal_email || "");
    setCurrentAddress(employee.current_address || "");
    setPermanentAddress(employee.permanent_address || "");
    setEmergencyName(employee.emergency_contact_name || "");
    setEmergencyPhone(employee.emergency_contact_phone || "");
    setEmergencyRelation(employee.emergency_contact_relation || "");
  }, [employee]);

  // Update Permitted Details Mutation
  const updateDetailsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("employees")
        .update({
          phone: phone.trim() || null,
          personal_email: personalEmail.trim() || null,
          current_address: currentAddress.trim() || null,
          permanent_address: permanentAddress.trim() || null,
          emergency_contact_name: emergencyName.trim() || null,
          emergency_contact_phone: emergencyPhone.trim() || null,
          emergency_contact_relation: emergencyRelation.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employee.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Personal details updated successfully");
      queryClient.invalidateQueries({ queryKey: ["my-employee-profile"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update personal details");
    },
  });

  // Avatar Upload
  async function handleAvatarUpload(file: File) {
    if (!employee.id || !userId) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar_${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(uploadData.path);

      const { error: updateErr } = await supabase
        .from("employees")
        .update({ photo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
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

  // Password Change
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

  const initials = employee.full_name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* Top Banner Profile Summary */}
      <Card className="overflow-hidden border bg-card border border-border">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group shrink-0">
                {employee.photo_url ? (
                  <img
                    src={employee.photo_url}
                    alt={employee.full_name}
                    className="h-20 w-20 rounded-lg object-cover border-2 border-primary/20 shadow-md"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground shadow-md">
                    {initials}
                  </div>
                )}
                <label
                  htmlFor="avatar-upload-input"
                  className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow transition hover:scale-110"
                  title="Upload new photo"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <input
                    id="avatar-upload-input"
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

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight">{employee.full_name}</h2>
                  <Badge variant="outline" className="font-mono text-xs">
                    {employee.employee_code}
                  </Badge>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs border-emerald-200 dark:border-emerald-800">
                    Active Staff
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {employee.designation || "Staff Member"} • {employee.departments?.name || "General"}
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {employee.email}
                  </span>
                  {employee.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      {employee.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Status Pill */}
            <div className="flex flex-col gap-2 rounded-lg border border-border/40 bg-background/80 p-3 sm:w-56 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" /> Attendance Mode
                </span>
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] gap-1">
                  <CheckCircle2 className="h-3 w-3" /> GPS Geofence
                </Badge>
              </div>
              <div className="flex items-center justify-between pt-1 border-t">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" /> Shift Schedule
                </span>
                <span className="font-medium truncate max-w-[110px]" title={employee.shifts?.name || "General"}>
                  {employee.shifts?.name || "Standard (9-6)"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Official Employment Records (Read-Only) */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Official Employment Info
              </CardTitle>
              <CardDescription className="text-xs">
                Managed and verified by Organization HR.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div>
                <Label className="text-muted-foreground text-[11px]">Employee Code</Label>
                <p className="font-semibold text-sm font-mono mt-0.5">{employee.employee_code}</p>
              </div>

              <div>
                <Label className="text-muted-foreground text-[11px]">Department</Label>
                <div className="flex items-center gap-1.5 mt-0.5 font-medium text-sm">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{employee.departments?.name || "General"}</span>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground text-[11px]">Designation</Label>
                <p className="font-medium text-sm mt-0.5">{employee.designation || "Staff Member"}</p>
              </div>

              <div>
                <Label className="text-muted-foreground text-[11px]">Reporting Manager</Label>
                <p className="font-medium text-sm mt-0.5">{employee.manager?.full_name || "Executive Team"}</p>
              </div>

              <div>
                <Label className="text-muted-foreground text-[11px]">Joining Date</Label>
                <div className="flex items-center gap-1.5 mt-0.5 font-medium text-sm">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{employee.joining_date || "2026-01-01"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div>
                  <Label className="text-muted-foreground text-[11px]">Employment Type</Label>
                  <p className="capitalize font-medium mt-0.5">{employee.employment_type?.replace("_", " ") || "Full Time"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-[11px]">Work Location</Label>
                  <p className="capitalize font-medium mt-0.5">{employee.work_location || "Onsite"}</p>
                </div>
              </div>

              {employee.notice_period_days !== undefined && (
                <div className="pt-2 border-t flex justify-between items-center">
                  <Label className="text-muted-foreground text-[11px]">Notice Period</Label>
                  <Badge variant="secondary" className="text-xs">
                    {employee.notice_period_days ?? 30} days
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Security Card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" /> Login Credentials
              </CardTitle>
              <CardDescription className="text-xs">
                Update your private account access password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">New Password</Label>
                  <Input
                    type="password"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-8 text-xs"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={passwordLoading || !newPassword || !confirmPassword}
                  className="w-full gap-1.5 text-xs h-8"
                >
                  {passwordLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save New Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Editable Permitted Personal Details */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Permitted Personal Details
                  </CardTitle>
                  <CardDescription className="text-xs">
                    You can directly update your personal contact info, residential address, and emergency details.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => updateDetailsMutation.mutate()}
                  disabled={updateDetailsMutation.isPending}
                  className="gap-1.5 text-xs h-8"
                >
                  {updateDetailsMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Changes
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Contact Channels
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Mobile Phone</Label>
                    <Input
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Personal Email</Label>
                    <Input
                      type="email"
                      placeholder="alex.personal@gmail.com"
                      value={personalEmail}
                      onChange={(e) => setPersonalEmail(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Address Details */}
              <div className="space-y-3 pt-3 border-t">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Residential Address
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Current Residence Address</Label>
                    <Input
                      placeholder="Apartment, Street, City, State, PIN"
                      value={currentAddress}
                      onChange={(e) => setCurrentAddress(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Permanent Address</Label>
                    <Input
                      placeholder="Permanent family residence address"
                      value={permanentAddress}
                      onChange={(e) => setPermanentAddress(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="space-y-3 pt-3 border-t">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <HeartPulse className="h-3.5 w-3.5 text-rose-500" /> Emergency Contact
                </h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Contact Person Name</Label>
                    <Input
                      placeholder="e.g. Sarah Doe"
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Contact Phone Number</Label>
                    <Input
                      placeholder="+91 98765 00000"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Relationship</Label>
                    <Input
                      placeholder="Spouse / Parent / Sibling"
                      value={emergencyRelation}
                      onChange={(e) => setEmergencyRelation(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Non-editable Personal Metrics */}
              <div className="space-y-3 pt-3 border-t">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileCheck className="h-3.5 w-3.5" /> Identity & Demographics
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg text-xs">
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Gender</span>
                    <span className="font-medium capitalize">{employee.gender || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Date of Birth</span>
                    <span className="font-medium">{employee.date_of_birth || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Blood Group</span>
                    <span className="font-medium">{employee.blood_group || "Not specified"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Marital Status</span>
                    <span className="font-medium capitalize">{employee.marital_status || "Not specified"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

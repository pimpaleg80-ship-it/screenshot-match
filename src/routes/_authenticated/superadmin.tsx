import { useState, useMemo } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  ShieldCheck,
  Loader2,
  Key,
  UserPlus,
  Users,
  UserCheck,
  Crown,
  Lock,
  RefreshCw,
  Sparkles,
  Terminal,
  Activity,
  Database,
  CheckCircle2,
  XCircle,
  Sliders,
  HardDrive,
  FileText,
  ArrowLeft,
  MoreVertical,
  Edit3,
  Trash2,
  Search,
  Filter,
  Eye,
  EyeOff,
  Cpu,
  Fingerprint,
  Radio,
  Send,
  Building2,
  Briefcase,
  AlertTriangle,
  Clock,
  Check,
  LogOut,
  ExternalLink,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { toDateKey, formatTime, formatDate } from "@/lib/attendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/superadmin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "System Administration — Console" },
      { name: "description", content: "High-privilege system administration and role management." },
    ],
  }),
  component: SuperadminPage,
});

interface SystemUserRow {
  employee_id: string;
  user_id: string | null;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  designation: string | null;
  department_id: string | null;
  department_name: string;
  is_superadmin: boolean;
  status: "active" | "inactive";
  photo_url: string | null;
  roles: string[];
  hasFaceEnrolled: boolean;
  created_at: string;
}

function SuperadminPage() {
  const session = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Loading skeleton while session loads
  if (session.loading) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If user is not admin, deny access with generic access restricted screen (no superadmin leaks)
  if (!session.isAdmin && !session.isSuperadmin) {
    return (
      <div className="flex min-h-[85vh] flex-col items-center justify-center p-6 text-center bg-neutral-950 text-white">
        <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-500 shadow-2xl">
          <ShieldAlert className="h-12 w-12 animate-pulse" />
          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold text-white">
            403
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
          Access Restricted
        </h1>
        <p className="mt-2 max-w-md text-sm text-neutral-400">
          You do not have permission to access this internal console.
        </p>
        <div className="mt-6 flex gap-3">
          <Button
            onClick={() => navigate({ to: "/dashboard" })}
            className="gap-2 bg-neutral-800 text-white hover:bg-neutral-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Dashboard
          </Button>
          <Button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            variant="outline"
            className="gap-2 border-white/20 text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Switch Account
          </Button>
        </div>
      </div>
    );
  }

  // Active view tab
  const [activeTab, setActiveTab] = useState("provisioning");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Superadmin Credential Challenge Gate
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("superadmin_unlocked") === "true";
    }
    return false;
  });
  const [gateEmail, setGateEmail] = useState(() => session.user?.email || "");
  const [gatePassword, setGatePassword] = useState("");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState("");

  async function handleUnlockGate(e: React.FormEvent) {
    e.preventDefault();
    if (!gateEmail.trim() || !gatePassword) {
      setGateError("Please enter both email and password.");
      return;
    }

    try {
      setGateLoading(true);
      setGateError("");

      const { data, error } = await supabase.auth.signInWithPassword({
        email: gateEmail.trim().toLowerCase(),
        password: gatePassword,
      });

      if (error) {
        setGateError("Invalid credentials. Access denied.");
        setGateLoading(false);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setGateError("Authentication failed: No user identity found.");
        setGateLoading(false);
        return;
      }

      const { data: emp, error: empErr } = await supabase
        .from("employees")
        .select("is_superadmin" as any)
        .eq("user_id", userId)
        .maybeSingle();

      if (empErr || !(emp as any)?.is_superadmin) {
        setGateError("Access Denied: The provided credentials do not have Superadmin privileges.");
        setGateLoading(false);
        return;
      }

      sessionStorage.setItem("superadmin_unlocked", "true");
      setIsUnlocked(true);
      toast.success("Superadmin verified. Root console unlocked.");
    } catch (err: any) {
      setGateError(err.message || "An unexpected error occurred during verification.");
    } finally {
      setGateLoading(false);
    }
  }

  // Provisioning Modal State
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("Welcome@2026");
  const [formRole, setFormRole] = useState<"employee" | "manager" | "admin" | "superadmin">("employee");
  const [formDept, setFormDept] = useState<string>("");
  const [formDesignation, setFormDesignation] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Password reset modal state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<SystemUserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Organization Management State
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgLegalName, setNewOrgLegalName] = useState("");
  const [newOrgTier, setNewOrgTier] = useState<"starter" | "pro" | "enterprise">("starter");
  const [newOrgMaxEmployees, setNewOrgMaxEmployees] = useState(50);

  // Fetch Organizations
  const { data: organizationsList = [], isLoading: orgsLoading } = useQuery({
    queryKey: ["superadmin-organizations-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: async () => {
      if (!newOrgSlug.trim() || !newOrgName.trim()) {
        throw new Error("Slug and organization name are required");
      }
      const { error } = await supabase.from("organizations").insert({
        slug: newOrgSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        name: newOrgName.trim(),
        legal_name: newOrgLegalName.trim() || null,
        plan_tier: newOrgTier,
        max_employees: Number(newOrgMaxEmployees) || 50,
        gps_retention_days: 90,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organization created successfully!");
      setNewOrgOpen(false);
      setNewOrgSlug("");
      setNewOrgName("");
      setNewOrgLegalName("");
      setNewOrgTier("starter");
      setNewOrgMaxEmployees(50);
      queryClient.invalidateQueries({ queryKey: ["superadmin-organizations-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create organization");
    },
  });

  const toggleOrgActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("organizations").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organization status updated");
      queryClient.invalidateQueries({ queryKey: ["superadmin-organizations-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update organization status");
    },
  });

  // 1. Fetch all system departments
  const { data: departments = [] } = useQuery({
    queryKey: ["superadmin-departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // 2. Fetch all system users & employees matrix
  const {
    data: allUsers = [],
    isLoading: usersLoading,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["superadmin-all-users"],
    queryFn: async () => {
      // Query employees with joined departments and is_superadmin
      const { data: emps, error: empErr } = await supabase
        .from("employees")
        .select(`
          id,
          user_id,
          employee_code,
          full_name,
          email,
          phone,
          designation,
          department_id,
          is_superadmin,
          status,
          photo_url,
          created_at,
          departments (name)
        `)
        .order("created_at", { ascending: false });

      if (empErr) throw empErr;

      // Query user roles
      const { data: rolesData, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesErr) throw rolesErr;

      // Query face data to know who is enrolled
      const { data: faceRows } = await supabase.from("face_data").select("employee_id");
      const enrolledEmpIds = new Set((faceRows ?? []).map((f) => f.employee_id));

      const roleMap = new Map<string, string[]>();
      for (const r of rolesData ?? []) {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      }

      const rows: SystemUserRow[] = (emps ?? []).map((e: any) => {
        const assignedRoles = e.user_id ? roleMap.get(e.user_id) || ["employee"] : ["employee"];
        return {
          employee_id: e.id,
          user_id: e.user_id,
          employee_code: e.employee_code,
          full_name: e.full_name,
          email: e.email,
          phone: e.phone,
          designation: e.designation,
          department_id: e.department_id,
          department_name: e.departments?.name || "General",
          is_superadmin: Boolean(e.is_superadmin),
          status: e.status || "active",
          photo_url: e.photo_url,
          roles: assignedRoles,
          hasFaceEnrolled: enrolledEmpIds.has(e.id),
          created_at: e.created_at,
        };
      });

      return rows;
    },
  });

  // 3. Fetch System Settings
  const { data: systemSettings, refetch: refetchSettings } = useQuery({
    queryKey: ["superadmin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Settings form local state
  const [settingsStart, setSettingsStart] = useState("09:30");
  const [settingsEnd, setSettingsEnd] = useState("18:30");
  const [settingsGrace, setSettingsGrace] = useState(15);
  const [settingsCooldown, setSettingsCooldown] = useState(3);
  const [settingsThreshold, setSettingsThreshold] = useState(0.48);
  const [settingsApproval, setSettingsApproval] = useState("manager_then_admin");

  // Sync settings when fetched
  useMemo(() => {
    if (systemSettings) {
      setSettingsStart(systemSettings.work_start?.slice(0, 5) || "09:30");
      setSettingsEnd(systemSettings.work_end?.slice(0, 5) || "18:30");
      setSettingsGrace(Number(systemSettings.late_grace_minutes ?? 15));
      setSettingsCooldown(Number(systemSettings.duplicate_scan_minutes ?? 3));
      setSettingsThreshold(Number(systemSettings.face_match_threshold ?? 0.48));
      setSettingsApproval(systemSettings.approval_flow || "manager_then_admin");
    }
  }, [systemSettings]);

  // 4. Fetch Audit Logs
  const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["superadmin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Provision User Mutation
  const provisionMutation = useMutation({
    mutationFn: async () => {
      if (!formName.trim() || !formEmail.trim()) {
        throw new Error("Full name and email are required");
      }

      const { data, error } = await supabase.rpc("superadmin_provision_user", {
        p_email: formEmail.trim().toLowerCase(),
        p_password: formPassword.trim() || "Welcome@2026",
        p_full_name: formName.trim(),
        p_role: formRole,
        p_department_id: formDept || null,
        p_designation:
          formDesignation.trim() ||
          (formRole === "superadmin"
            ? "Root Super Administrator"
            : formRole === "admin"
              ? "System Administrator"
              : formRole === "manager"
                ? "Team Manager"
                : "Staff Member"),
        p_phone: formPhone.trim() || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      toast.success(
        res?.action === "created"
          ? `Successfully provisioned ${formRole.toUpperCase()} account for ${formName}`
          : `Updated account details and role for ${formName}`
      );
      setProvisionModalOpen(false);
      setFormName("");
      setFormEmail("");
      setFormPassword("Welcome@2026");
      setFormDesignation("");
      setFormPhone("");
      queryClient.invalidateQueries({ queryKey: ["superadmin-all-users"] });
      queryClient.invalidateQueries({ queryKey: ["people-list"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to provision user");
    },
  });

  // Change Role Mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { data, error } = await supabase.rpc("superadmin_set_user_role", {
        p_target_user_id: userId,
        p_new_role: newRole,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Role upgraded to ${vars.newRole.toUpperCase()}`);
      queryClient.invalidateQueries({ queryKey: ["superadmin-all-users"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update role");
    },
  });

  // Toggle Superadmin Flag Mutation
  const toggleSuperadminMutation = useMutation({
    mutationFn: async ({ employeeId, userId, isSuper }: { employeeId: string; userId: string | null; isSuper: boolean }) => {
      const { error: empErr } = await supabase
        .from("employees")
        .update({ is_superadmin: isSuper })
        .eq("id", employeeId);
      if (empErr) throw empErr;

      if (isSuper && userId) {
        await supabase.rpc("superadmin_set_user_role", {
          p_target_user_id: userId,
          p_new_role: "admin",
        });
      }
    },
    onSuccess: (_, vars) => {
      toast.success(vars.isSuper ? "User elevated to ROOT SUPERADMIN" : "Superadmin privileges revoked");
      queryClient.invalidateQueries({ queryKey: ["superadmin-all-users"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update superadmin status");
    },
  });

  // Toggle User Active Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, active }: { userId: string; active: boolean }) => {
      const { data, error } = await supabase.rpc("superadmin_toggle_user_status", {
        p_target_user_id: userId,
        p_active: active,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(`User marked as ${vars.active ? "ACTIVE" : "SUSPENDED"}`);
      queryClient.invalidateQueries({ queryKey: ["superadmin-all-users"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update status");
    },
  });

  // Save System Settings Mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("settings")
        .update({
          work_start: settingsStart + ":00",
          work_end: settingsEnd + ":00",
          late_grace_minutes: Number(settingsGrace),
          duplicate_scan_minutes: Number(settingsCooldown),
          face_match_threshold: Number(settingsThreshold),
          approval_flow: settingsApproval,
        })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("System parameters saved successfully");
      queryClient.invalidateQueries({ queryKey: ["superadmin-settings"] });
      queryClient.invalidateQueries({ queryKey: ["kiosk-settings"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update settings");
    },
  });

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const matchesSearch =
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.employee_code.toLowerCase().includes(search.toLowerCase()) ||
        u.department_name.toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "superadmin" && u.is_superadmin) ||
        (roleFilter === "admin" && u.roles.includes("admin")) ||
        (roleFilter === "manager" && u.roles.includes("manager")) ||
        (roleFilter === "employee" && !u.roles.includes("admin") && !u.roles.includes("manager"));

      return matchesSearch && matchesRole;
    });
  }, [allUsers, search, roleFilter]);

  // Executive KPI summary calculations
  const totalUsers = allUsers.length;
  const superadminCount = allUsers.filter((u) => u.is_superadmin).length;
  const adminCount = allUsers.filter((u) => u.roles.includes("admin")).length;
  const managerCount = allUsers.filter((u) => u.roles.includes("manager")).length;
  const employeeCount = allUsers.filter(
    (u) => !u.roles.includes("admin") && !u.roles.includes("manager")
  ).length;
  const enrolledFaces = allUsers.filter((u) => u.hasFaceEnrolled).length;
  const faceCoveragePct = totalUsers > 0 ? Math.round((enrolledFaces / totalUsers) * 100) : 0;

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  if (!isUnlocked) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-3 sm:p-4 bg-neutral-950 text-neutral-100">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900/95 p-5 sm:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-rose-600 text-white shadow-glow mb-2">
              <Lock className="h-8 w-8 text-amber-300" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Superadmin Verification
            </h1>
            <p className="text-xs text-neutral-400">
              High-privilege console. Enter superadmin credentials to authenticate and open.
            </p>
          </div>

          <form onSubmit={handleUnlockGate} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <Label className="text-xs text-neutral-300">Superadmin Work Email</Label>
              <Input
                type="email"
                placeholder="superadmin@example.com"
                value={gateEmail}
                onChange={(e) => {
                  setGateEmail(e.target.value);
                  setGateError("");
                }}
                className="bg-neutral-800/80 border-white/15 text-white placeholder:text-neutral-500"
                required
              />
            </div>

            <div className="space-y-1.5 text-left">
              <Label className="text-xs text-neutral-300">Superadmin Password</Label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={gatePassword}
                onChange={(e) => {
                  setGatePassword(e.target.value);
                  setGateError("");
                }}
                className="bg-neutral-800/80 border-white/15 text-white placeholder:text-neutral-500"
                required
              />
            </div>

            {gateError && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-400 font-medium">
                {gateError}
              </div>
            )}

            <Button
              type="submit"
              disabled={gateLoading}
              className="w-full gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold shadow-lg"
            >
              {gateLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying Credentials...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4" />
                  Authenticate & Open Console
                </>
              )}
            </Button>
          </form>

          <div className="pt-2 border-t border-white/10 flex justify-between items-center text-xs text-neutral-400">
            <button
              type="button"
              onClick={() => navigate({ to: "/dashboard" })}
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Dashboard
            </button>
            <span className="text-[11px] text-neutral-500">Encrypted Root Gateway</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-3 sm:p-6 md:p-8 space-y-6 sm:space-y-8 select-none">
      {/* Top Root Command Header */}
      <header className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/60 p-4 sm:p-6 backdrop-blur-xl shadow-2xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-rose-600 text-white shadow-glow">
            <Crown className="h-6 w-6 sm:h-7 sm:w-7 text-amber-300" />
            <div className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 sm:h-4 sm:w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-black" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white truncate">
                SUPERADMIN CONSOLE
              </h1>
              <Badge className="bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[10px] font-black tracking-wider uppercase px-2 py-0.5 border-0 shrink-0">
                ROOT SYSTEM
              </Badge>
            </div>
            <p className="text-xs text-white/60 mt-0.5 flex flex-wrap items-center gap-2">
              <span className="font-mono text-emerald-400 flex items-center gap-1 font-semibold">
                <Radio className="h-3 w-3 animate-pulse" /> CONNECTED
              </span>
              <span>•</span>
              <span className="text-white/80 font-mono truncate max-w-[200px] sm:max-w-none">
                Operator: <strong className="text-white">{session.fullName || session.user?.email}</strong>
              </span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline text-white/50">High-Availability Cloud Cluster</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              sessionStorage.removeItem("superadmin_unlocked");
              setIsUnlocked(false);
              setGatePassword("");
              toast.info("Superadmin console locked");
            }}
            className="flex-1 sm:flex-none border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 gap-1.5 text-xs h-9"
          >
            <Lock className="h-3.5 w-3.5" />
            Lock Console
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchUsers();
              refetchSettings();
              toast.info("System data synchronized");
            }}
            className="flex-1 sm:flex-none border-white/20 bg-white/5 text-white hover:bg-white/15 gap-1.5 text-xs h-9"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync System
          </Button>

          <Button
            onClick={() => setProvisionModalOpen(true)}
            className="w-full sm:w-auto gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-xs shadow-glow h-9"
          >
            <UserPlus className="h-4 w-4" />
            Add User / Admin / Manager
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/dashboard" })}
            className="flex-1 sm:flex-none border-white/20 bg-white/5 text-white hover:bg-white/15 text-xs gap-1.5 h-9"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Dashboard
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs gap-1.5 h-9"
            title="Sign out of Superadmin session"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* KPI Telemetry Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Users & Admins */}
        <Card className="border-white/10 bg-neutral-900/70 backdrop-blur text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Total Accounts
            </CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold">{totalUsers}</div>
            <div className="text-[11px] text-white/60 mt-1 flex items-center gap-2">
              <span className="text-rose-400 font-semibold">{adminCount} Admins</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">{managerCount} Managers</span>
            </div>
          </CardContent>
        </Card>

        {/* Biometric Adoption */}
        <Card className="border-white/10 bg-neutral-900/70 backdrop-blur text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Biometric Coverage
            </CardTitle>
            <Fingerprint className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-400">{faceCoveragePct}%</div>
            <Progress value={faceCoveragePct} className="h-1.5 mt-2 bg-white/10" />
            <p className="text-[11px] text-white/60 mt-1.5">
              {enrolledFaces} of {totalUsers} enrolled with biometric face profiles
            </p>
          </CardContent>
        </Card>

        {/* System Work Shift & Cooldown */}
        <Card className="border-white/10 bg-neutral-900/70 backdrop-blur text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Work Shift & Buffer
            </CardTitle>
            <Clock className="h-4 w-4 text-indigo-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono tracking-tight">
              {settingsStart} — {settingsEnd}
            </div>
            <p className="text-[11px] text-white/60 mt-1">
              Grace: <strong className="text-white">{settingsGrace}m</strong> • Cooldown:{" "}
              <strong className="text-emerald-400">{settingsCooldown}m</strong>
            </p>
          </CardContent>
        </Card>

        {/* Access Gateway & Route */}
        <Card className="border-white/10 bg-neutral-900/70 backdrop-blur text-white shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Console Security
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400 font-mono">PROTECTED</div>
            <p className="text-[11px] text-white/60 mt-1">
              URL: <span className="text-white font-mono">/superadmin</span> (Hidden)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Workspace */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-neutral-900 border border-white/10 p-1 text-xs w-full justify-start overflow-x-auto h-auto flex flex-nowrap sm:flex-wrap gap-1">
          <TabsTrigger
            value="organizations"
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 py-2 px-3 text-xs"
          >
            <Building2 className="h-3.5 w-3.5" />
            Organizations & Tenants
          </TabsTrigger>
          <TabsTrigger
            value="provisioning"
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 py-2 px-3 text-xs"
          >
            <Users className="h-3.5 w-3.5" />
            Personnel & Roles Studio
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 py-2 px-3 text-xs"
          >
            <Sliders className="h-3.5 w-3.5" />
            Global System Config
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground shrink-0 py-2 px-3 text-xs"
          >
            <Terminal className="h-3.5 w-3.5" />
            Security Audit Logs
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            TAB: MULTI-TENANT ORGANIZATIONS & SAAS MANAGEMENT
        ========================================================================= */}
        <TabsContent value="organizations" className="space-y-4">
          <Card className="border-white/10 bg-neutral-900/70 backdrop-blur text-white">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Multi-Tenant Organizations & Subscriptions
                </CardTitle>
                <CardDescription className="text-xs text-white/60">
                  Provision client organizations, manage subscription tiers, employee quotas, and data retention rules.
                </CardDescription>
              </div>

              <Button
                onClick={() => setNewOrgOpen(true)}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-9"
              >
                <Plus className="h-4 w-4" />
                Register New Organization
              </Button>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-5">
              {/* Quick Tenant Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-white/10 bg-black/40">
                  <span className="text-[11px] text-white/60">Total Tenants</span>
                  <div className="text-xl font-bold font-mono text-white mt-1">{organizationsList.length}</div>
                </div>
                <div className="p-3.5 rounded-xl border border-white/10 bg-black/40">
                  <span className="text-[11px] text-white/60">Active Status</span>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {organizationsList.filter((o) => o.is_active).length}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-white/10 bg-black/40">
                  <span className="text-[11px] text-white/60">Enterprise Tier</span>
                  <div className="text-xl font-bold font-mono text-amber-400 mt-1">
                    {organizationsList.filter((o) => o.plan_tier === "enterprise").length}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl border border-white/10 bg-black/40">
                  <span className="text-[11px] text-white/60">Total Capacity</span>
                  <div className="text-xl font-bold font-mono text-blue-400 mt-1">
                    {organizationsList.reduce((acc, o) => acc + (o.max_employees || 0), 0)} Seats
                  </div>
                </div>
              </div>

              {/* Organizations Table */}
              <div className="rounded-xl border border-white/10 overflow-hidden bg-black/30">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-left text-xs">
                    <thead className="bg-white/5 border-b border-white/10 text-white/60 uppercase font-mono text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Organization / Legal Name</th>
                        <th className="py-3 px-4">Slug Identifier</th>
                        <th className="py-3 px-4">Plan Tier</th>
                        <th className="py-3 px-4">Employee Capacity</th>
                        <th className="py-3 px-4">GPS Retention</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono text-xs text-white/90">
                      {orgsLoading ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-white/50">
                            Loading organization tenants...
                          </td>
                        </tr>
                      ) : organizationsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-white/50">
                            No organizations found. Register your first tenant above.
                          </td>
                        </tr>
                      ) : (
                        organizationsList.map((org) => (
                          <tr key={org.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4">
                              <div className="font-sans font-semibold text-white">{org.name}</div>
                              {org.legal_name && (
                                <div className="text-[10px] text-white/50 font-normal">{org.legal_name}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-primary font-mono">{org.slug}</td>
                            <td className="py-3 px-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase font-bold ${
                                  org.plan_tier === "enterprise"
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                    : org.plan_tier === "pro"
                                    ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                                    : "bg-neutral-500/20 text-neutral-300 border-neutral-500/40"
                                }`}
                              >
                                {org.plan_tier}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">{org.max_employees} employees</td>
                            <td className="py-3 px-4">{org.gps_retention_days} days rolling</td>
                            <td className="py-3 px-4">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  org.is_active
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                    : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                }`}
                              >
                                {org.is_active ? "Active" : "Suspended"}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  toggleOrgActiveMutation.mutate({
                                    id: org.id,
                                    is_active: !org.is_active,
                                  })
                                }
                                disabled={toggleOrgActiveMutation.isPending}
                                className="h-7 text-[11px] border border-white/10 hover:bg-white/10"
                              >
                                {org.is_active ? "Suspend" : "Activate"}
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            TAB 1: USER & ROLE PROVISIONING STUDIO
        ========================================================================= */}
        <TabsContent value="provisioning" className="space-y-4">
          <Card className="border-white/10 bg-neutral-900/70 backdrop-blur text-white">
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-400" />
                  Personnel Roster & Role Matrix
                </CardTitle>
                <CardDescription className="text-xs text-white/60">
                  Provision new employee, manager, or admin accounts with instant login credentials and access levels.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <Button
                  size="sm"
                  onClick={() => setProvisionModalOpen(true)}
                  className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs gap-1.5 shadow-glow h-9"
                >
                  <UserPlus className="h-4 w-4" />
                  Add Person / Admin
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              {/* Search & Filters */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-white/40" />
                  <Input
                    placeholder="Search by name, employee code, department, email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-neutral-800 border-white/10 text-white placeholder:text-white/40 text-xs h-9"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-full sm:w-[150px] bg-neutral-800 border-white/10 text-white text-xs h-9">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-white/10 text-white text-xs">
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="superadmin">Superadmins</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                      <SelectItem value="manager">Managers</SelectItem>
                      <SelectItem value="employee">Employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Roster Table */}
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/40">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-b border-white/10 bg-neutral-900/80 text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Personnel</th>
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Department & Role</th>
                      <th className="py-3 px-4">Biometrics</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-white/40">
                          Loading personnel roster...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-white/40">
                          No users matching search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isMainAdmin = u.roles.includes("admin");
                        const isManager = u.roles.includes("manager");
                        const currentRoleLabel = isMainAdmin
                          ? "admin"
                          : isManager
                            ? "manager"
                            : "employee";

                        return (
                          <tr key={u.employee_id} className="hover:bg-white/[0.02] transition-colors">
                            {/* Personnel Identity */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold text-xs uppercase ${
                                    u.is_superadmin
                                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-glow"
                                      : isMainAdmin
                                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                        : isManager
                                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                  }`}
                                >
                                  {u.full_name
                                    .split(" ")
                                    .map((p) => p[0])
                                    .slice(0, 2)
                                    .join("")}
                                </div>
                                <div>
                                  <div className="font-semibold text-white flex items-center gap-1.5">
                                    <span>{u.full_name}</span>
                                    {u.is_superadmin ? (
                                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-black uppercase px-1 py-0 gap-1">
                                        <Crown className="h-2.5 w-2.5 text-amber-300 inline" />
                                        ROOT
                                      </Badge>
                                    ) : isMainAdmin ? (
                                      <Crown className="h-3 w-3 text-rose-400 inline" />
                                    ) : null}
                                  </div>
                                  <div className="text-[11px] text-white/50">{u.email}</div>
                                </div>
                              </div>
                            </td>

                            {/* Code */}
                            <td className="py-3.5 px-4 font-mono text-white/80 font-medium">
                              {u.employee_code}
                            </td>

                            {/* Department & Role */}
                            <td className="py-3.5 px-4">
                              <div className="font-medium text-white/90">{u.department_name}</div>
                              <div className="mt-1 flex items-center gap-1.5">
                                {u.roles.map((r) => (
                                  <Badge
                                    key={r}
                                    variant="outline"
                                    className={`text-[9px] uppercase font-bold px-1.5 py-0 ${
                                      r === "admin"
                                        ? "border-rose-500/40 text-rose-400 bg-rose-500/10"
                                        : r === "manager"
                                          ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                                          : "border-blue-500/40 text-blue-400 bg-blue-500/10"
                                    }`}
                                  >
                                    {r}
                                  </Badge>
                                ))}
                              </div>
                            </td>

                            {/* Face Biometrics */}
                            <td className="py-3.5 px-4">
                              {u.hasFaceEnrolled ? (
                                <Badge className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] gap-1 px-2">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Enrolled
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-white/10 text-white/40 text-[10px] gap-1 px-2"
                                >
                                  <XCircle className="h-3 w-3" />
                                  Pending
                                </Badge>
                              )}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  u.status === "active"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-rose-500/10 text-rose-400"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    u.status === "active" ? "bg-emerald-400" : "bg-rose-400"
                                  }`}
                                />
                                {u.status.toUpperCase()}
                              </span>
                            </td>

                            {/* Actions Dropdown */}
                            <td className="py-3.5 px-4 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-white/70 hover:bg-white/10"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="bg-neutral-900 border-white/10 text-white text-xs w-52"
                                >
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setResetTargetUser(u);
                                      setNewPassword("");
                                      setResetModalOpen(true);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Key className="h-3.5 w-3.5 text-amber-400" />
                                    Reset Password
                                  </DropdownMenuItem>

                                  <DropdownMenuSeparator className="bg-white/10" />

                                  {/* Change Role Options */}
                                  <div className="px-2 py-1 text-[10px] font-semibold text-white/40 uppercase">
                                    Promote / Change Role
                                  </div>

                                  {/* Toggle Root Superadmin */}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      toggleSuperadminMutation.mutate({
                                        employeeId: u.employee_id,
                                        userId: u.user_id,
                                        isSuper: !u.is_superadmin,
                                      });
                                    }}
                                    className="gap-2 cursor-pointer text-amber-300"
                                  >
                                    <Crown className="h-3.5 w-3.5" />
                                    {u.is_superadmin ? "Revoke Superadmin" : "Make Root Superadmin"}
                                  </DropdownMenuItem>

                                  {currentRoleLabel !== "admin" && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        if (u.user_id) {
                                          changeRoleMutation.mutate({
                                            userId: u.user_id,
                                            newRole: "admin",
                                          });
                                        } else {
                                          toast.error("User has no auth account yet");
                                        }
                                      }}
                                      className="gap-2 cursor-pointer text-rose-400"
                                    >
                                      <Shield className="h-3.5 w-3.5" />
                                      Promote to Admin
                                    </DropdownMenuItem>
                                  )}

                                  {currentRoleLabel !== "manager" && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        if (u.user_id) {
                                          changeRoleMutation.mutate({
                                            userId: u.user_id,
                                            newRole: "manager",
                                          });
                                        } else {
                                          toast.error("User has no auth account yet");
                                        }
                                      }}
                                      className="gap-2 cursor-pointer text-amber-400"
                                    >
                                      <Briefcase className="h-3.5 w-3.5" />
                                      Make Manager
                                    </DropdownMenuItem>
                                  )}

                                  {currentRoleLabel !== "employee" && (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        if (u.user_id) {
                                          changeRoleMutation.mutate({
                                            userId: u.user_id,
                                            newRole: "employee",
                                          });
                                        } else {
                                          toast.error("User has no auth account yet");
                                        }
                                      }}
                                      className="gap-2 cursor-pointer text-blue-400"
                                    >
                                      <UserCheck className="h-3.5 w-3.5" />
                                      Set as Employee
                                    </DropdownMenuItem>
                                  )}

                                  <DropdownMenuSeparator className="bg-white/10" />

                                  {/* Deactivate / Reactivate */}
                                  <DropdownMenuItem
                                    onClick={() => {
                                      if (u.user_id) {
                                        toggleStatusMutation.mutate({
                                          userId: u.user_id,
                                          active: u.status !== "active",
                                        });
                                      }
                                    }}
                                    className={`gap-2 cursor-pointer ${
                                      u.status === "active" ? "text-rose-400" : "text-emerald-400"
                                    }`}
                                  >
                                    <ShieldAlert className="h-3.5 w-3.5" />
                                    {u.status === "active" ? "Suspend Account" : "Reactivate Account"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            TAB 2: GLOBAL SYSTEM PARAMETERS
        ========================================================================= */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="border-white/10 bg-neutral-900/70 backdrop-blur text-white">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Sliders className="h-5 w-5 text-indigo-400" />
                Root System Parameters & Attendance Rules
              </CardTitle>
              <CardDescription className="text-xs text-white/60">
                Configure corporate work hours, grace periods, biometric threshold, and leave approval workflows.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Work Shift Hours */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/80">Shift Start Time (24h)</Label>
                  <Input
                    type="time"
                    value={settingsStart}
                    onChange={(e) => setSettingsStart(e.target.value)}
                    className="bg-neutral-800 border-white/10 text-white font-mono"
                  />
                  <p className="text-[11px] text-white/40">
                    Scans after this time + grace are marked LATE.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-white/80">Shift End Time (24h)</Label>
                  <Input
                    type="time"
                    value={settingsEnd}
                    onChange={(e) => setSettingsEnd(e.target.value)}
                    className="bg-neutral-800 border-white/10 text-white font-mono"
                  />
                  <p className="text-[11px] text-white/40">
                    Default checkout threshold for day shift.
                  </p>
                </div>

                {/* Late Grace Period */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/80">Late Grace Period (Minutes)</Label>
                  <Input
                    type="number"
                    value={settingsGrace}
                    onChange={(e) => setSettingsGrace(Number(e.target.value))}
                    min={0}
                    max={120}
                    className="bg-neutral-800 border-white/10 text-white font-mono"
                  />
                  <p className="text-[11px] text-white/40">
                    Employees arriving within grace period remain marked PRESENT.
                  </p>
                </div>

                {/* Anti Double-Scan Cooldown */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/80">
                    Anti-Double-Scan Cooldown (Minutes):{" "}
                    <strong className="text-emerald-400 font-mono">{settingsCooldown}m</strong>
                  </Label>
                  <Input
                    type="number"
                    value={settingsCooldown}
                    onChange={(e) => setSettingsCooldown(Number(e.target.value))}
                    min={1}
                    max={15}
                    className="bg-neutral-800 border-white/10 text-white font-mono"
                  />
                  <p className="text-[11px] text-white/40">
                    Minimum interval required before checking out after check-in.
                  </p>
                </div>

                {/* Face Match Sensitivity */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/80">
                    Face Euclidean Match Distance:{" "}
                    <strong className="text-emerald-400 font-mono">{settingsThreshold}</strong>
                  </Label>
                  <Input
                    type="number"
                    step={0.01}
                    value={settingsThreshold}
                    onChange={(e) => setSettingsThreshold(Number(e.target.value))}
                    min={0.3}
                    max={0.65}
                    className="bg-neutral-800 border-white/10 text-white font-mono"
                  />
                  <p className="text-[11px] text-white/40">
                    Recommended: 0.45 - 0.48. Lower is stricter, higher is faster.
                  </p>
                </div>

                {/* Approval Flow */}
                <div className="space-y-2">
                  <Label className="text-xs text-white/80">Leave Approval Workflow</Label>
                  <Select value={settingsApproval} onValueChange={setSettingsApproval}>
                    <SelectTrigger className="bg-neutral-800 border-white/10 text-white text-xs">
                      <SelectValue placeholder="Approval Flow" />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-900 border-white/10 text-white text-xs">
                      <SelectItem value="manager_then_admin">
                        Two-tier: Manager Approval $\rightarrow$ Admin Final Approval
                      </SelectItem>
                      <SelectItem value="admin_only">
                        Direct: Admin Immediate Final Approval
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-white/10">
                <Button
                  onClick={() => saveSettingsMutation.mutate()}
                  disabled={saveSettingsMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-glow"
                >
                  {saveSettingsMutation.isPending ? "Saving Parameters..." : "Save Root Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =========================================================================
            TAB 3: SECURITY AUDIT LOGS
        ========================================================================= */}
        <TabsContent value="audit" className="space-y-4">
          <Card className="border-white/10 bg-neutral-900/70 backdrop-blur text-white">
            <CardHeader className="border-b border-white/10 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Terminal className="h-5 w-5 text-rose-400" />
                Real-Time Security & System Audit Trail
              </CardTitle>
              <CardDescription className="text-xs text-white/60">
                Immutable ledger of administrative actions, role assignments, user creations, and authentication events.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-5">
              <div className="space-y-2">
                {logsLoading ? (
                  <p className="text-center py-8 text-white/40">Loading audit ledger...</p>
                ) : auditLogs.length === 0 ? (
                  <p className="text-center py-8 text-white/40">No audit logs recorded yet.</p>
                ) : (
                  auditLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-white/5 bg-black/40 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] uppercase border-rose-500/30 text-rose-400 bg-rose-500/10"
                        >
                          {log.action}
                        </Badge>
                        <span className="font-mono text-white/80">
                          {log.user_email ? (
                            <span className="text-amber-400 font-semibold mr-2">{log.user_email}:</span>
                          ) : null}
                          {log.details ? JSON.stringify(log.details) : "—"}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-white/40">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* =========================================================================
          PROVISION USER MODAL (EMPLOYEE / MANAGER / ADMIN / SUPERADMIN)
      ========================================================================= */}
      <Dialog open={provisionModalOpen} onOpenChange={setProvisionModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-neutral-900 text-white border-white/10 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold">
              <UserPlus className="h-5 w-5 text-emerald-400" />
              Provision New User Account
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Create an employee, manager, admin, or superadmin account with automatic authentication and role linkage.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Role Selection Cards */}
            <div className="space-y-1.5">
              <Label className="text-xs text-white/80">Account Clearance Role</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setFormRole("employee")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                    formRole === "employee"
                      ? "border-blue-500 bg-blue-500/20 text-white shadow-sm"
                      : "border-white/10 bg-neutral-800 text-white/60 hover:text-white"
                  }`}
                >
                  <UserCheck className="h-4 w-4 mb-1 text-blue-400" />
                  <span className="font-bold text-[11px] sm:text-[10px]">Employee</span>
                  <span className="text-[9px] sm:text-[8px] text-white/40 mt-0.5">Staff</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormRole("manager")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                    formRole === "manager"
                      ? "border-amber-500 bg-amber-500/20 text-white shadow-sm"
                      : "border-white/10 bg-neutral-800 text-white/60 hover:text-white"
                  }`}
                >
                  <Briefcase className="h-4 w-4 mb-1 text-amber-400" />
                  <span className="font-bold text-[11px] sm:text-[10px]">Manager</span>
                  <span className="text-[9px] sm:text-[8px] text-white/40 mt-0.5">Team Lead</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormRole("admin")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                    formRole === "admin"
                      ? "border-rose-500 bg-rose-500/20 text-white shadow-sm"
                      : "border-white/10 bg-neutral-800 text-white/60 hover:text-white"
                  }`}
                >
                  <Shield className="h-4 w-4 mb-1 text-rose-400" />
                  <span className="font-bold text-[11px] sm:text-[10px]">Admin</span>
                  <span className="text-[9px] sm:text-[8px] text-white/40 mt-0.5">Operations</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFormRole("superadmin")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                    formRole === "superadmin"
                      ? "border-amber-400 bg-amber-500/20 text-amber-200 shadow-glow"
                      : "border-white/10 bg-neutral-800 text-white/60 hover:text-white"
                  }`}
                >
                  <Crown className="h-4 w-4 mb-1 text-amber-300" />
                  <span className="font-bold text-[11px] sm:text-[10px]">Superadmin</span>
                  <span className="text-[9px] sm:text-[8px] text-white/40 mt-0.5">Root Console</span>
                </button>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs text-white/80">Full Name *</Label>
              <Input
                placeholder="e.g. Vikram Sharma"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="bg-neutral-800 border-white/10 text-white text-xs"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <Label className="text-xs text-white/80">Email Address (Login ID) *</Label>
              <Input
                type="email"
                placeholder="e.g. vikram@company.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="bg-neutral-800 border-white/10 text-white text-xs"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-white/80">Initial Password *</Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-primary hover:underline"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Minimum 6 characters"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                className="bg-neutral-800 border-white/10 text-white text-xs font-mono"
              />
            </div>

            {/* Department & Designation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-white/80">Department</Label>
                <Select value={formDept} onValueChange={setFormDept}>
                  <SelectTrigger className="bg-neutral-800 border-white/10 text-white text-xs">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-white/10 text-white text-xs">
                    {departments.map((d: any) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-white/80">Designation</Label>
                <Input
                  placeholder="e.g. Lead Engineer"
                  value={formDesignation}
                  onChange={(e) => setFormDesignation(e.target.value)}
                  className="bg-neutral-800 border-white/10 text-white text-xs"
                />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1">
              <Label className="text-xs text-white/80">Phone Number (Optional)</Label>
              <Input
                placeholder="e.g. +91 98765 43210"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="bg-neutral-800 border-white/10 text-white text-xs"
              />
            </div>
          </div>

          <DialogFooter className="border-t border-white/10 pt-3 flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProvisionModalOpen(false)}
              className="border-white/20 text-white hover:bg-white/10 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => provisionMutation.mutate()}
              disabled={provisionMutation.isPending || !formName.trim() || !formEmail.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs shadow-glow"
            >
              {provisionMutation.isPending ? "Creating Account..." : `Create ${formRole.toUpperCase()} Account`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          REGISTER NEW TENANT ORGANIZATION MODAL
      ========================================================================= */}
      <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-neutral-900 text-white border-white/10 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building2 className="h-5 w-5 text-primary" />
              Register New Organization Tenant
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Provision an isolated organization with its own departments, employees, and geofence locations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs text-white/80">Organization Slug Identifier *</Label>
              <Input
                placeholder="e.g. acme-tech"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className="bg-neutral-800 border-white/10 text-white font-mono text-xs"
              />
              <p className="text-[10px] text-white/50">Unique URL-friendly slug across the SaaS cluster.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-white/80">Display Name *</Label>
              <Input
                placeholder="e.g. Acme Technologies"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="bg-neutral-800 border-white/10 text-white text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-white/80">Legal Entity Name</Label>
              <Input
                placeholder="e.g. Acme Technologies Pvt. Ltd."
                value={newOrgLegalName}
                onChange={(e) => setNewOrgLegalName(e.target.value)}
                className="bg-neutral-800 border-white/10 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-white/80">Subscription Tier</Label>
                <select
                  value={newOrgTier}
                  onChange={(e) => setNewOrgTier(e.target.value as "starter" | "pro" | "enterprise")}
                  className="w-full h-9 rounded-md bg-neutral-800 border border-white/10 text-white px-2 text-xs"
                >
                  <option value="starter">Starter (50 Seats)</option>
                  <option value="pro">Pro (200 Seats)</option>
                  <option value="enterprise">Enterprise (Unlimited)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-white/80">Max Employees Quota</Label>
                <Input
                  type="number"
                  min={5}
                  max={5000}
                  value={newOrgMaxEmployees}
                  onChange={(e) => setNewOrgMaxEmployees(parseInt(e.target.value) || 50)}
                  className="bg-neutral-800 border-white/10 text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewOrgOpen(false)}
              disabled={createOrgMutation.isPending}
              className="border-white/20 text-white hover:bg-white/10 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createOrgMutation.mutate()}
              disabled={createOrgMutation.isPending || !newOrgSlug.trim() || !newOrgName.trim()}
              className="bg-primary text-primary-foreground text-xs gap-1.5"
            >
              {createOrgMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Provision Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          PASSWORD RESET MODAL
      ========================================================================= */}
      <Dialog open={resetModalOpen} onOpenChange={setResetModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-sm max-h-[90vh] overflow-y-auto bg-neutral-900 text-white border-white/10 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Key className="h-4 w-4 text-amber-400" />
              Reset User Password
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Set a new login password for {resetTargetUser?.full_name} ({resetTargetUser?.email}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs text-white/80">New Password</Label>
              <Input
                type="text"
                placeholder="Enter at least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="bg-neutral-800 border-white/10 text-white font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetModalOpen(false)}
              className="border-white/20 text-white hover:bg-white/10 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={newPassword.length < 6}
              onClick={async () => {
                if (!resetTargetUser) return;
                try {
                  const { error } = await supabase.rpc("superadmin_provision_user", {
                    p_email: resetTargetUser.email,
                    p_password: newPassword,
                    p_full_name: resetTargetUser.full_name,
                    p_role: resetTargetUser.roles.includes("admin") ? "admin" : resetTargetUser.roles.includes("manager") ? "manager" : "employee",
                  });
                  if (error) throw error;
                  toast.success(`Password successfully updated for ${resetTargetUser.full_name}`);
                  setResetModalOpen(false);
                } catch (e: any) {
                  toast.error(e.message || "Failed to update password");
                }
              }}
              className="bg-primary text-primary-foreground text-xs"
            >
              Apply New Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* =========================================================================
          REGISTER NEW TENANT ORGANIZATION MODAL
      ========================================================================= */}
      <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto bg-neutral-900 text-white border-white/10 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building2 className="h-5 w-5 text-primary" />
              Register New Organization Tenant
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              Provision an isolated organization with its own departments, employees, and geofence locations.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs text-white/80">Organization Slug Identifier *</Label>
              <Input
                placeholder="e.g. acme-tech"
                value={newOrgSlug}
                onChange={(e) => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                className="bg-neutral-800 border-white/10 text-white font-mono text-xs"
              />
              <p className="text-[10px] text-white/50">Unique URL-friendly slug across the SaaS cluster.</p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-white/80">Display Name *</Label>
              <Input
                placeholder="e.g. Acme Technologies"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="bg-neutral-800 border-white/10 text-white text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-white/80">Legal Entity Name</Label>
              <Input
                placeholder="e.g. Acme Technologies Pvt. Ltd."
                value={newOrgLegalName}
                onChange={(e) => setNewOrgLegalName(e.target.value)}
                className="bg-neutral-800 border-white/10 text-white text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-white/80">Subscription Tier</Label>
                <select
                  value={newOrgTier}
                  onChange={(e) => setNewOrgTier(e.target.value as "starter" | "pro" | "enterprise")}
                  className="w-full h-9 rounded-md bg-neutral-800 border border-white/10 text-white px-2 text-xs"
                >
                  <option value="starter">Starter (50 Seats)</option>
                  <option value="pro">Pro (200 Seats)</option>
                  <option value="enterprise">Enterprise (Unlimited)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-white/80">Max Employees Quota</Label>
                <Input
                  type="number"
                  min={5}
                  max={5000}
                  value={newOrgMaxEmployees}
                  onChange={(e) => setNewOrgMaxEmployees(parseInt(e.target.value) || 50)}
                  className="bg-neutral-800 border-white/10 text-white font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewOrgOpen(false)}
              disabled={createOrgMutation.isPending}
              className="border-white/20 text-white hover:bg-white/10 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createOrgMutation.mutate()}
              disabled={createOrgMutation.isPending || !newOrgSlug.trim() || !newOrgName.trim()}
              className="bg-primary text-primary-foreground text-xs gap-1.5"
            >
              {createOrgMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Provision Organization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

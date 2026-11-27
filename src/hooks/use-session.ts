import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AppSession {
  session: Session | null;
  user: User | null;
  organizationId: string;
  organizationName: string | null;
  orgRole: string | null;
  workLocationId: string | null;
  roles: string[];
  fullName: string;
  departmentId: string | null;
  departmentName: string | null;
  department: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  designation: string | null;
  isSuperadmin: boolean;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isStaff: boolean;
  isKiosk: boolean;
  hasAccess: boolean;
}

interface UserProfile {
  userId: string;
  organizationId: string;
  organizationName: string | null;
  orgRole: string | null;
  workLocationId: string | null;
  roles: string[];
  fullName: string;
  departmentId: string | null;
  departmentName: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  designation: string | null;
  isSuperadmin: boolean;
}

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// Module-level cache to eliminate lag and redundant network waterfall across components
let globalSession: Session | null = null;
let globalProfile: UserProfile | null = null;
let profileInFlight: Promise<UserProfile | null> | null = null;

async function fetchUserProfile(
  userId: string,
  email?: string,
  userMetaName?: string,
): Promise<UserProfile | null> {
  if (globalProfile && globalProfile.userId === userId) {
    return globalProfile;
  }
  if (profileInFlight) {
    return profileInFlight;
  }

  profileInFlight = (async () => {
    try {
      const [empRes, rolesRes, orgMemRes] = await Promise.all([
        supabase
          .from("employees")
          .select(
            "id, full_name, department_id, employee_code, designation, is_superadmin, organization_id, work_location_id, departments(name)",
          )
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase
          .from("organization_members")
          .select("organization_id, role, organizations(name)")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      const emp = empRes.data as {
        id: string;
        full_name: string;
        department_id: string | null;
        employee_code: string;
        designation: string | null;
        is_superadmin?: boolean | null;
        organization_id?: string | null;
        work_location_id?: string | null;
        departments: { name: string } | null;
      } | null;

      const userRoles = (rolesRes.data ?? []).map((r) => r.role);
      const orgMem = orgMemRes.data as {
        organization_id: string;
        role: string;
        organizations: { name: string } | null;
      } | null;

      const orgId = orgMem?.organization_id || emp?.organization_id || DEFAULT_ORG_ID;
      const orgName = orgMem?.organizations?.name || "Fluxora Technologies";
      const orgRole = orgMem?.role || null;
      const isSuper = !!emp?.is_superadmin || orgRole === "super_admin";

      const profile: UserProfile = {
        userId,
        organizationId: orgId,
        organizationName: orgName,
        orgRole,
        workLocationId: emp?.work_location_id ?? null,
        roles: userRoles,
        fullName: emp?.full_name || userMetaName || email || "User",
        departmentId: emp?.department_id ?? null,
        departmentName: emp?.departments?.name ?? null,
        employeeId: emp?.id ?? null,
        employeeCode: emp?.employee_code ?? null,
        designation: emp?.designation ?? null,
        isSuperadmin: isSuper,
      };

      globalProfile = profile;
      return profile;
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      return null;
    } finally {
      profileInFlight = null;
    }
  })();

  return profileInFlight;
}

/** Client-side session + role state with fast in-memory caching */
export function useSession(): AppSession {
  const [session, setSession] = useState<Session | null>(() => globalSession);
  const [profile, setProfile] = useState<UserProfile | null>(() => globalProfile);
  const [loading, setLoading] = useState<boolean>(() => !globalProfile && !globalSession);

  useEffect(() => {
    let cancelled = false;

    // Fast session retrieval
    if (!globalSession) {
      supabase.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        globalSession = data.session;
        setSession(data.session);

        if (!data.session) {
          globalProfile = null;
          setProfile(null);
          setLoading(false);
        } else {
          const user = data.session.user;
          fetchUserProfile(user.id, user.email, user.user_metadata?.["name"]).then((prof) => {
            if (cancelled) return;
            if (prof) setProfile(prof);
            setLoading(false);
          });
        }
      });
    } else if (!globalProfile && globalSession.user) {
      const user = globalSession.user;
      fetchUserProfile(user.id, user.email, user.user_metadata?.["name"]).then((prof) => {
        if (cancelled) return;
        if (prof) setProfile(prof);
        setLoading(false);
      });
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      globalSession = s;
      setSession(s);

      if (!s) {
        globalProfile = null;
        setProfile(null);
        setLoading(false);
      } else {
        const user = s.user;
        if (event === "USER_UPDATED" || !globalProfile || globalProfile.userId !== user.id) {
          globalProfile = null;
          fetchUserProfile(user.id, user.email, user.user_metadata?.["name"]).then((prof) => {
            if (cancelled) return;
            if (prof) setProfile(prof);
            setLoading(false);
          });
        }
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const roles = profile?.roles ?? [];
  const orgRole = profile?.orgRole ?? null;
  const isSuperadmin = !!profile?.isSuperadmin || orgRole === "super_admin";
  const isAdmin = isSuperadmin || roles.includes("admin") || orgRole === "org_admin";
  const isManager = !isAdmin && (roles.includes("manager") || orgRole === "hr_manager");
  const isEmployee = !isAdmin && !isManager;
  const isStaff = isAdmin || isManager;
  const isKiosk = roles.includes("kiosk");
  const hasAccess = !!session?.user && (roles.length > 0 || isEmployee || !!orgRole);

  return {
    session,
    user: session?.user ?? null,
    organizationId: profile?.organizationId || DEFAULT_ORG_ID,
    organizationName: profile?.organizationName ?? null,
    orgRole,
    workLocationId: profile?.workLocationId ?? null,
    roles,
    fullName: profile?.fullName ?? "",
    departmentId: profile?.departmentId ?? null,
    departmentName: profile?.departmentName ?? null,
    department: profile?.departmentName ?? null,
    employeeId: profile?.employeeId ?? null,
    employeeCode: profile?.employeeCode ?? null,
    designation: profile?.designation ?? null,
    isSuperadmin,
    loading: loading && !profile,
    isAdmin,
    isManager,
    isEmployee,
    isStaff,
    isKiosk,
    hasAccess,
  };
}

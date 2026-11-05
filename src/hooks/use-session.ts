import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AppSession {
  session: Session | null;
  user: User | null;
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
  roles: string[];
  fullName: string;
  departmentId: string | null;
  departmentName: string | null;
  employeeId: string | null;
  employeeCode: string | null;
  designation: string | null;
  isSuperadmin: boolean;
}

// Module-level cache to eliminate lag and redundant network waterfall across components
let globalSession: Session | null = null;
let globalProfile: UserProfile | null = null;
let profileInFlight: Promise<UserProfile | null> | null = null;

async function fetchUserProfile(userId: string, email?: string, userMetaName?: string): Promise<UserProfile | null> {
  if (globalProfile && globalProfile.userId === userId) {
    return globalProfile;
  }
  if (profileInFlight) {
    return profileInFlight;
  }

  profileInFlight = (async () => {
    try {
      const [empRes, rolesRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, full_name, department_id, employee_code, designation, is_superadmin, departments(name)")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);

      const emp = empRes.data as {
        id: string;
        full_name: string;
        department_id: string | null;
        employee_code: string;
        designation: string | null;
        is_superadmin?: boolean | null;
        departments: { name: string } | null;
      } | null;

      const userRoles = (rolesRes.data ?? []).map((r) => r.role);

      const profile: UserProfile = {
        userId,
        roles: userRoles,
        fullName: emp?.full_name || userMetaName || email || "User",
        departmentId: emp?.department_id ?? null,
        departmentName: emp?.departments?.name ?? null,
        employeeId: emp?.id ?? null,
        employeeCode: emp?.employee_code ?? null,
        designation: emp?.designation ?? null,
        isSuperadmin: !!emp?.is_superadmin,
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

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      globalSession = s;
      setSession(s);

      if (!s) {
        globalProfile = null;
        setProfile(null);
        setLoading(false);
      } else {
        const user = s.user;
        if (!globalProfile || globalProfile.userId !== user.id) {
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
  const isAdmin = roles.includes("admin");
  const isSuperadmin = !!profile?.isSuperadmin;
  const isManager = roles.includes("manager");
  const isEmployee = roles.includes("employee") || (!isAdmin && !isManager);
  const isStaff = isAdmin || isManager;
  const isKiosk = roles.includes("kiosk");
  const hasAccess = !!session?.user && (roles.length > 0 || isEmployee);

  return {
    session,
    user: session?.user ?? null,
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

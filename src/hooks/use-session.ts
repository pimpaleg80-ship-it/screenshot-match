import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface AppSession {
  session: Session | null;
  user: User | null;
  roles: string[];
  fullName: string;
  department: string | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isKiosk: boolean;
  isStaff: boolean; // admin or manager
}

/** Client-side session + role state. Route protection lives in _authenticated. */
export function useSession(): AppSession {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) {
        setRoles([]);
        setFullName("");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("full_name, department").eq("id", userId).single(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (cancelled) return;
      setFullName(profileRes.data?.full_name ?? "");
      setDepartment(profileRes.data?.department ?? null);
      setRoles((rolesRes.data ?? []).map((r) => r.role));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    session,
    user: session?.user ?? null,
    roles,
    fullName,
    department,
    loading,
    isAdmin: roles.includes("admin"),
    isManager: roles.includes("manager"),
    isKiosk: roles.includes("kiosk"),
    isStaff: roles.includes("admin") || roles.includes("manager"),
  };
}

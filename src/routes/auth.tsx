import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HeroPanel, SignInPanel, type SignInValues } from "@/components/auth/signin";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user) {
      const redirectParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : null;

      if (redirectParam) {
        throw redirect({ to: redirectParam as any });
      }
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Sign in — Flowpeople by Fluxora" },
      { name: "description", content: "Sign in to your Flowpeople enterprise workspace." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  async function handleSignIn({ email, password }: SignInValues) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });
    if (error) {
      if (/confirm/i.test(error.message)) {
        throw new Error("Please confirm your email first — check your inbox.");
      }
      throw new Error(error.message);
    }

    const redirectParam = new URLSearchParams(window.location.search).get("redirect");

    // Check clearance tier — wrapped defensively so a schema-cache hiccup
    // never blocks the user from accessing their workspace.
    const userId = data.user?.id;
    let isSuper = false;
    if (userId) {
      try {
        const [{ data: emp }, { data: orgMem }] = await Promise.all([
          supabase
            .from("employees")
            .select("is_superadmin" as any)
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("organization_members")
            .select("role")
            .eq("user_id", userId)
            .eq("status", "active")
            .maybeSingle(),
        ]);
        isSuper = !!(emp as any)?.is_superadmin || orgMem?.role === "super_admin";
      } catch {
        // Schema cache may be temporarily stale — default to normal dashboard.
        isSuper = false;
      }
    }

    toast.success("Signed in successfully");

    if (redirectParam) {
      if (redirectParam === "/superadmin" && !isSuper) {
        navigate({ to: "/dashboard" });
      } else {
        navigate({ to: redirectParam as any });
      }
    } else if (isSuper) {
      navigate({ to: "/superadmin" });
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  return (
    <div className="flex min-h-screen bg-white font-sans text-ink antialiased">
      <HeroPanel />
      <SignInPanel onSubmit={handleSignIn} />
    </div>
  );
}

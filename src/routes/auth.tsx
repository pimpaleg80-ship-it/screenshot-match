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

    // Check clearance tier
    const userId = data.user?.id;
    let isAdmin = false;
    let isSuper = false;
    if (userId) {
      const [{ data: roles }, { data: emp }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase
          .from("employees")
          .select("is_superadmin" as any)
          .eq("user_id", userId)
          .maybeSingle(),
      ]);
      isAdmin = roles?.some((r) => r.role === "admin") ?? false;
      isSuper = !!(emp as any)?.is_superadmin;
    }

    toast.success("Signed in successfully");

    if (redirectParam) {
      if (redirectParam === "/superadmin" && !isSuper && !isAdmin) {
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

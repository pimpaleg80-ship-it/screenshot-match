import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-3 sm:px-4 py-8 sm:py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[880px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2.5 text-center px-2">
          <BrandLogo variant="stacked" size="xl" />
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xs sm:max-w-none">
            Biometric workforce & attendance suite for modern enterprises
          </p>
        </div>

        <SignInCard />

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Protected by enterprise-grade security and encrypted access controls.
        </p>
      </div>
    </div>
  );
}

function SignInCard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      if (/confirm/i.test(error.message)) {
        toast.error("Please confirm your email first — check your inbox.");
      } else {
        toast.error(error.message);
      }
      return;
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
    <Card className="card-soft">
      <CardHeader className="pb-3">
        <CardTitle>Enterprise Sign In</CardTitle>
        <CardDescription>Sign in with your work email and password.</CardDescription>
      </CardHeader>

      <form onSubmit={handleSignIn}>
        <CardContent className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="signin-email">Work Email</Label>
            <Input
              id="signin-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="signin-password">Password</Label>
              <a href="/reset-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </a>
            </div>
            <Input
              id="signin-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3">
          <Button type="submit" className="w-full font-semibold" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            B2B enterprise account. Employee logins are provisioned by your system administrator.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

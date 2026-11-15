import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ScanFace,
  MapPin,
  CalendarCheck,
  Cloud,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  Building2,
  Users,
  Clock,
  ExternalLink,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flowpeople by Fluxora — Biometric Attendance & Workforce HRMS" },
      {
        name: "description",
        content:
          "Enterprise facial biometric attendance, exact GPS geofencing, shift and leave management, and automated Google Drive cloud archiving.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { session, user } = useSession();
  const isLoggedIn = !!(session?.user || user);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary">
      {/* 1. Navbar */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-90">
            <BrandLogo variant="horizontal" size="sm" />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors cursor-pointer">
              Features
            </a>
            <a href="#geofence" className="hover:text-foreground transition-colors cursor-pointer">
              Geofencing
            </a>
            <a href="#cloud-backup" className="hover:text-foreground transition-colors cursor-pointer">
              Cloud Backup
            </a>
            <a href="#security" className="hover:text-foreground transition-colors cursor-pointer">
              Security
            </a>
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </nav>

          {/* Right Action */}
          <div className="flex items-center gap-2 sm:gap-3">
            {isLoggedIn ? (
              <Link to="/dashboard">
                <Button size="sm" className="gap-1.5 shadow-sm font-medium">
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/kiosk">
                  <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-xs">
                    Kiosk Mode
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="gap-1.5 shadow-sm font-medium">
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-border/40">
        {/* Soft background ambient gradient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[900px] rounded-full bg-gradient-to-b from-primary/15 via-primary/5 to-transparent blur-3xl opacity-75"
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-semibold text-primary mb-6 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Biometric Workforce &amp; Attendance Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15] max-w-4xl mx-auto">
            Smart Face Biometrics &amp; Geofenced Attendance
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-sm sm:text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Eliminate buddy punching and time theft with sub-second facial verification, workplace GPS geofencing, real-time shift workflows, and automated Google Drive cloud archiving.
          </p>

          {/* Hero CTAs */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={isLoggedIn ? "/dashboard" : "/auth"} className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto gap-2 text-sm font-semibold h-11 px-6 shadow-md hover:shadow-lg transition-all">
                {isLoggedIn ? "Open Dashboard" : "Sign In to Workspace"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/kiosk" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto gap-2 text-sm h-11 px-5">
                <ScanFace className="h-4 w-4 text-primary" />
                Launch Kiosk Mode
              </Button>
            </Link>
          </div>

          {/* Interactive Live Verification Simulation Card */}
          <div className="mt-14 max-w-xl mx-auto">
            <div className="rounded-2xl border border-border/80 bg-card/95 p-4 sm:p-5 shadow-xl shadow-primary/5 backdrop-blur-sm text-left">
              <div className="flex items-center justify-between border-b pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                    Live Check-in Event
                  </span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">Today • Just now</span>
              </div>

              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-[#06B6D4] flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                  SJ
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm truncate">Sarah Jenkins</div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">EMP-1042 • Engineering</div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Face Match</div>
                      <div className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                        <ScanFace className="h-3.5 w-3.5 text-primary" />
                        99.4% Match (0.2s)
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2 border border-border/40">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Geofence</div>
                      <div className="font-semibold text-foreground mt-0.5 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                        HQ Office (15m radius)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Core Features Grid */}
      <section id="features" className="py-16 sm:py-24 max-w-6xl mx-auto px-4 sm:px-6 w-full">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
            Engineered for Modern Enterprise
          </h2>
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Comprehensive Attendance &amp; Workforce Controls
          </h3>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Everything your HR and operations teams need to verify shifts, eliminate attendance fraud, and automate compliance records.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Feature 1 */}
          <Card className="border-border/70 hover:border-primary/40 transition-all hover:shadow-md bg-card">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ScanFace className="h-5 w-5" />
              </div>
              <h4 className="font-semibold text-base">Facial Recognition</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sub-second 1:N matching running in client-side WebAssembly models. Converts faces into 128-dimensional mathematical vector descriptors without retaining raw photos.
              </p>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card className="border-border/70 hover:border-primary/40 transition-all hover:shadow-md bg-card">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <MapPin className="h-5 w-5" />
              </div>
              <h4 className="font-semibold text-base">Exact GPS Geofencing</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Define designated workplace coordinates and permitted radius fences. Prevents remote check-ins and guarantees personnel are physically on-site.
              </p>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card className="border-border/70 hover:border-primary/40 transition-all hover:shadow-md bg-card">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <h4 className="font-semibold text-base">Leaves &amp; Approvals</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Streamlined multi-tier leave pipelines, dynamic quota balances (Annual, Sick, Casual), company holidays, and manager approval queues.
              </p>
            </CardContent>
          </Card>

          {/* Feature 4 */}
          <Card className="border-border/70 hover:border-primary/40 transition-all hover:shadow-md bg-card">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="h-10 w-10 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Cloud className="h-5 w-5" />
              </div>
              <h4 className="font-semibold text-base">Google Drive Cloud Sync</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Automated 11:30 PM daily attendance PDF backups and monthly payroll ledgers archived directly to your organization&apos;s Google Drive folder.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 4. Geofencing & Cloud Archiving Spotlight */}
      <section id="geofence" className="py-16 bg-muted/30 border-y border-border/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
                <MapPin className="h-3.5 w-3.5" />
                Precise Location Guard
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Zero-Trust Workplace Perimeter Verification
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every check-in and check-out is mathematically validated against your company&apos;s configured office boundaries. Coordinates outside the permitted radius are flagged or rejected with detailed audit timestamps.
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Configurable branch locations and radius tolerances (10m – 500m)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>High-accuracy native device GPS &amp; IP boundary fallback</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>Immutable audit logs tracking location drift and spoof attempts</span>
                </li>
              </ul>
            </div>

            <div id="cloud-backup" className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base">Google Drive Cloud Archiving</h4>
                  <div className="text-xs text-muted-foreground">Automatic, encrypted daily sync</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your enterprise retains full custody of attendance documents. Connect once with Google OAuth, and Flowpeople automatically generates clean PDF archives into a dedicated folder on your Google Drive.
              </p>
              <div className="p-3 rounded-xl bg-muted/50 border text-xs space-y-1.5 font-mono">
                <div className="text-[11px] text-muted-foreground">📁 FaceAttendance Backups</div>
                <div className="pl-4 text-[11px] text-muted-foreground">└── 📁 Attendance / 2026 / 11</div>
                <div className="pl-8 text-[11px] text-primary font-semibold">└── 📄 attendance_2026-11-15.pdf</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Security & Compliance Banner */}
      <section id="security" className="py-16 max-w-5xl mx-auto px-4 sm:px-6 w-full text-center sm:text-left">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" />
              Enterprise Privacy &amp; Security
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight">
              Strict Data Governance &amp; Biometric Protection
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              We adhere to the Google API Limited Use policy. Data is encrypted in transit (TLS 1.3) and at rest (AES-256), protected by PostgreSQL Row-Level Security, and isolated per organization tenant.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Link to="/privacy-policy">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                Privacy Policy
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
            <Link to="/terms">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                Terms of Service
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Ready to Get Started Bottom CTA */}
      <section className="py-16 sm:py-20 border-t bg-background text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Modernize Your Enterprise Workforce Today
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-lg mx-auto">
            Experience reliable biometric verification, fraud-proof geofencing, and automated reporting.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to={isLoggedIn ? "/dashboard" : "/auth"}>
              <Button size="lg" className="gap-2 font-semibold shadow-md">
                {isLoggedIn ? "Open Dashboard" : "Sign In to Flowpeople"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Minimalist Clean Footer */}
      <footer className="border-t bg-card/50 py-10 text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <BrandLogo variant="horizontal" size="sm" />
            <span className="hidden sm:inline text-muted-foreground/40">|</span>
            <span className="text-[11px]">
              Biometric Workforce &amp; Attendance Platform by Fluxora
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
            <Link to="/privacy-policy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">
              Terms &amp; Conditions
            </Link>
            <a
              href="mailto:hqfluxora@gmail.com"
              className="hover:text-foreground transition-colors text-primary font-medium"
            >
              Contact: hqfluxora@gmail.com
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 mt-6 pt-6 border-t border-border/30 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground/70">
          <p>© {new Date().getFullYear()} Fluxora. All rights reserved.</p>
          <p>Protected by enterprise multi-tenant security &amp; biometric encryption.</p>
        </div>
      </footer>
    </div>
  );
}

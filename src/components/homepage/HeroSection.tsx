import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ScanFace } from "lucide-react";
import { AttendancePreview } from "./AttendancePreview";
import { useSession } from "@/hooks/use-session";

export function HeroSection() {
  const { session, user } = useSession();
  const isLoggedIn = !!(session?.user || user);

  return (
    <section className="border-b border-slate-200 bg-[#F8FAFF]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 py-14 sm:py-20 lg:grid-cols-[1.12fr_.88fr] lg:gap-12 lg:py-28">
          {/* Left Column */}
          <div className="min-w-0">
            <p
              className="animate-fade-up flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[.14em] text-indigo-700"
              style={{ animationDelay: "40ms" }}
            >
              <span className="h-px w-8 bg-indigo-600" />
              Biometric Workforce &amp; Attendance Platform
            </p>

            <h1
              className="animate-fade-up mt-6 text-[2.6rem] font-extrabold leading-[1.02] tracking-[-0.035em] text-slate-900 sm:text-6xl lg:text-[4rem]"
              style={{ animationDelay: "120ms" }}
            >
              Smart Face Biometrics &amp; Geofenced Attendance
            </h1>

            <p
              className="animate-fade-up mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-slate-600"
              style={{ animationDelay: "200ms" }}
            >
              Eliminate buddy punching and time theft with sub-second facial verification, workplace GPS geofencing, real-time shift workflows, and automated Google Drive cloud archiving.
            </p>

            <div
              className="animate-fade-up mt-9 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "280ms" }}
            >
              <Link
                to={isLoggedIn ? "/dashboard" : "/auth"}
                className="group inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
              >
                {isLoggedIn ? "Open Dashboard" : "Sign In to Workspace"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                to="/kiosk"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:border-slate-900 hover:bg-slate-50"
              >
                <ScanFace className="h-4 w-4 text-indigo-600" />
                Launch Kiosk Mode
              </Link>
            </div>
          </div>

          {/* Right Column: Attendance Preview */}
          <AttendancePreview />
        </div>
      </div>
    </section>
  );
}

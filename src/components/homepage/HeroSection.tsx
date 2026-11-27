import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  MapPin,
} from "lucide-react";
import { useSession } from "@/hooks/use-session";

type FenceMode = "inside" | "outside";

export function HeroSection() {
  const { session, user } = useSession();
  const isLoggedIn = !!(session?.user || user);
  const [fenceMode, setFenceMode] = useState<FenceMode>("inside");
  const isInside = fenceMode === "inside";

  return (
    <section className="relative overflow-hidden border-b border-[#E5EAF4] bg-[#F7F9FE]">
      {/* Restraint top light wash for depth without floating blobs */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_45%_at_50%_-10%,rgba(49,94,251,0.07),transparent)]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-12 lg:gap-12 lg:py-24">
          {/* Left Column: Value Proposition & Primary Actions */}
          <div className="min-w-0 lg:col-span-6">
            <p
              className="fp-fade-up font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#315EFB]"
              style={{ animationDelay: "40ms" }}
            >
              Geofenced Workforce &amp; HRMS
            </p>

            <h1
              className="fp-fade-up fp-display mt-3.5 text-[2.35rem] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#172554] sm:text-5xl lg:text-[3.35rem]"
              style={{ animationDelay: "90ms" }}
            >
              Exact GPS Geofenced{" "}
              <span className="bg-linear-to-r from-[#315EFB] to-[#5946F6] bg-clip-text text-transparent">
                Attendance &amp; HR Suite
              </span>
            </h1>

            <p
              className="fp-fade-up mt-5 max-w-xl text-base leading-relaxed text-[#64748B] sm:text-[1.0625rem]"
              style={{ animationDelay: "140ms" }}
            >
              Set office GPS boundaries, verify employee check-ins on-site in real time, manage multi-tier leave approvals, and back up daily attendance PDFs to Google Drive.
            </p>

            <div
              className="fp-fade-up mt-8 flex flex-wrap items-center gap-3"
              style={{ animationDelay: "190ms" }}
            >
              <Link
                to={isLoggedIn ? "/dashboard" : "/auth"}
                className="group inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#315EFB] px-6 py-3.5 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:bg-[#254EDB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315EFB] focus-visible:ring-offset-2"
              >
                {isLoggedIn ? "Open Dashboard" : "Sign In to Workspace"}
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>

              <a
                href="#geofencing"
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E5EAF4] bg-white px-6 py-3.5 text-sm font-semibold text-[#172554] shadow-xs transition-colors duration-200 hover:border-[#315EFB]/45 hover:bg-[#F7F9FE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315EFB] focus-visible:ring-offset-2"
              >
                Explore Geofencing
              </a>
            </div>

            {/* Scannable Plain-English Highlights */}
            <div
              className="fp-fade-up mt-9 flex flex-wrap items-center gap-x-6 gap-y-2.5 border-t border-[#E5EAF4] pt-6 text-xs font-medium text-[#172554]"
              style={{ animationDelay: "240ms" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#12A879]" aria-hidden="true" />
                10m – 500m GPS perimeters
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#12A879]" aria-hidden="true" />
                Role-scoped access control
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#12A879]" aria-hidden="true" />
                Automated 11:30 PM Drive PDF sync
              </span>
            </div>
          </div>

          {/* Right Column: Interactive Geofence Perimeter Check-In Demo */}
          <div className="fp-fade-up min-w-0 lg:col-span-6" style={{ animationDelay: "160ms" }}>
            <div className="fp-panel-shadow overflow-hidden rounded-2xl border border-[#E5EAF4] bg-white">
              {/* Top Panel Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5EAF4] px-5 py-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EDEBFF] text-[#315EFB]">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#172554]">
                      Perimeter Check-In Guard
                    </p>
                    <p className="font-mono text-[11px] text-[#64748B]">
                      HQ Office · 15m allowed radius
                    </p>
                  </div>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
                    isInside
                      ? "border-[#12A879]/30 bg-[#12A879]/10 text-[#0F8C65]"
                      : "border-[#E05252]/30 bg-[#E05252]/10 text-[#C43C3C]"
                  }`}
                >
                  {isInside ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#12A879]" aria-hidden="true" />
                      Perimeter Verified
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5 text-[#E05252]" aria-hidden="true" />
                      Outside Fence
                    </>
                  )}
                </span>
              </div>

              <div className="p-5 sm:p-6">
                {/* Interactive Simulation Toggle */}
                <div
                  role="group"
                  aria-label="Simulate employee location relative to office geofence"
                  className="grid grid-cols-2 gap-1.5 rounded-xl border border-[#E5EAF4] bg-[#F7F9FE] p-1"
                >
                  <button
                    type="button"
                    aria-pressed={isInside}
                    onClick={() => setFenceMode("inside")}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                      isInside
                        ? "bg-white text-[#172554] shadow-xs"
                        : "text-[#64748B] hover:text-[#172554]"
                    }`}
                  >
                    Inside Boundary (12m)
                  </button>
                  <button
                    type="button"
                    aria-pressed={!isInside}
                    onClick={() => setFenceMode("outside")}
                    className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 ${
                      !isInside
                        ? "bg-white text-[#172554] shadow-xs"
                        : "text-[#64748B] hover:text-[#172554]"
                    }`}
                  >
                    Outside Fence (240m)
                  </button>
                </div>

                {/* Perimeter Verification State */}
                <div className="mt-4 flex flex-col gap-4 rounded-xl border border-[#E5EAF4] bg-[#F7F9FE] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border border-dashed border-[#315EFB]/50 bg-white">
                      <span
                        aria-hidden="true"
                        className="absolute inset-2 rounded-full border border-[#315EFB]/20"
                      />
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#315EFB] text-white shadow-xs">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <span
                        aria-hidden="true"
                        className={`absolute h-3 w-3 rounded-full border-2 border-white shadow-xs transition-all duration-300 ${
                          isInside
                            ? "right-3 top-3.5 bg-[#12A879]"
                            : "-right-1 -top-1 bg-[#E05252]"
                        }`}
                      />
                    </div>

                    <div className="min-w-0">
                      <p className="font-mono text-[11px] uppercase tracking-wider text-[#64748B]">
                        Distance check
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-[#172554]">
                        {isInside
                          ? "12m inside approved zone"
                          : "240m away from office"}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[#64748B]">
                        {isInside
                          ? "Device coordinates match site perimeter. Check-in is enabled."
                          : "Off-site punch is locked automatically outside the boundary."}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <Link
                      to={isLoggedIn ? "/attendance" : "/auth"}
                      className={`inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors duration-200 sm:w-auto ${
                        isInside
                          ? "bg-[#12A879] text-white shadow-xs hover:bg-[#0F9268]"
                          : "border border-[#E05252]/35 bg-[#E05252]/10 text-[#C43C3C] hover:bg-[#E05252]/15"
                      }`}
                    >
                      {isInside ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Check-In Ready
                        </>
                      ) : (
                        <>
                          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                          Check-In Locked
                        </>
                      )}
                    </Link>
                  </div>
                </div>
              </div>

              {/* Clean Rule Spec Footer (Replaces Redundant Mini-Cards) */}
              <dl className="grid grid-cols-3 divide-x divide-[#E5EAF4] border-t border-[#E5EAF4] bg-[#F7F9FE]/60 text-xs">
                <div className="px-4 py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
                    Fence Rule
                  </dt>
                  <dd className="mt-0.5 font-semibold text-[#172554]">
                    On-site GPS
                  </dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
                    Payroll Sync
                  </dt>
                  <dd className="mt-0.5 font-semibold text-[#172554]">
                    Attendance-linked
                  </dd>
                </div>
                <div className="px-4 py-3">
                  <dt className="font-mono text-[10px] uppercase tracking-wider text-[#64748B]">
                    Cloud Archive
                  </dt>
                  <dd className="mt-0.5 font-semibold text-[#172554]">
                    Drive PDF daily
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

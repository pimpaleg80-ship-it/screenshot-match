import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export function CTASection() {
  const { session, user } = useSession();
  const isLoggedIn = !!(session?.user || user);

  return (
    <section className="bg-linear-to-r from-[#315EFB] via-[#4651F8] to-[#5946F6]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-14 sm:py-20 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="fp-display text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.45rem]">
              Modernize Your Enterprise Workforce Today
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#EDEBFF]">
              Experience coordinate-accurate geofencing, auto location sync, and automated HR reporting.
            </p>
          </div>

          <Link
            to={isLoggedIn ? "/dashboard" : "/auth"}
            className="group inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 self-start rounded-xl bg-white px-7 py-4 text-sm font-semibold text-[#172554] shadow-sm transition-all duration-200 hover:bg-[#F7F9FE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#315EFB] md:self-auto"
          >
            {isLoggedIn ? "Open Dashboard" : "Sign In to Flowpeople"}
            <ArrowRight className="h-4 w-4 text-[#315EFB] transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

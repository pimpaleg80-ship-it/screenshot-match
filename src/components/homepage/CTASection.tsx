import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useSession } from "@/hooks/use-session";

export function CTASection() {
  const { session, user } = useSession();
  const isLoggedIn = !!(session?.user || user);

  return (
    <section className="bg-indigo-600">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 py-16 sm:py-20 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white sm:text-[2.6rem]">
              Modernize Your Enterprise Workforce Today
            </h2>
            <p className="mt-4 text-base leading-relaxed text-indigo-100">
              Experience reliable biometric verification, fraud-proof geofencing, and automated reporting.
            </p>
          </div>

          <Link
            to={isLoggedIn ? "/dashboard" : "/auth"}
            className="group inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-white px-7 py-4 text-sm font-semibold text-indigo-700 shadow-md transition-colors hover:bg-indigo-50 md:self-auto"
          >
            {isLoggedIn ? "Open Dashboard" : "Sign In to Flowpeople"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}

import React from "react";
import { Link } from "@tanstack/react-router";
import { FlowPeopleLogo } from "./FlowPeopleLogo";

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Row: Brand & Main Navigation */}
        <div className="flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <FlowPeopleLogo />
            <span className="hidden h-5 w-px bg-slate-200 sm:block" />
            <p className="text-xs text-slate-500">
              Biometric Workforce &amp; Attendance Platform by Fluxora
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link
              to="/privacy-policy"
              className="text-slate-600 transition-colors hover:text-indigo-600"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-slate-600 transition-colors hover:text-indigo-600"
            >
              Terms &amp; Conditions
            </Link>
            <a
              href="mailto:hqfluxora@gmail.com"
              className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
            >
              Contact: hqfluxora@gmail.com
            </a>
          </div>
        </div>

        {/* Bottom Row: Copyright & Security Note */}
        <div className="flex flex-col gap-2 border-t border-slate-100 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Fluxora. All rights reserved.</p>
          <p>Protected by enterprise multi-tenant security &amp; biometric encryption.</p>
        </div>
      </div>
    </footer>
  );
}

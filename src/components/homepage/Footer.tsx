import React from "react";
import { Link } from "@tanstack/react-router";
import { FlowPeopleLogo } from "./FlowPeopleLogo";

export function Footer() {
  return (
    <footer className="border-t border-[#E5EAF4] bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Row: Brand & Main Navigation */}
        <div className="flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <FlowPeopleLogo />
            <span className="hidden h-5 w-px bg-[#E5EAF4] sm:block" />
            <p className="text-xs text-[#64748B]">
              Geofenced Workforce &amp; HRMS Platform by Fluxora
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link
              to="/privacy-policy"
              className="text-[#64748B] transition-colors hover:text-[#315EFB]"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-[#64748B] transition-colors hover:text-[#315EFB]"
            >
              Terms &amp; Conditions
            </Link>
            <a
              href="mailto:hqfluxora@gmail.com"
              className="font-semibold text-[#315EFB] transition-colors hover:text-[#5946F6]"
            >
              Contact: hqfluxora@gmail.com
            </a>
          </div>
        </div>

        {/* Bottom Row: Copyright & Security Note */}
        <div className="flex flex-col gap-2 border-t border-[#E5EAF4] py-6 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Fluxora. All rights reserved.</p>
          <p>Protected by enterprise multi-tenant security &amp; RLS encryption.</p>
        </div>
      </div>
    </footer>
  );
}

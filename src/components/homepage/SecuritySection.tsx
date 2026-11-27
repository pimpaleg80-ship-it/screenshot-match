import React from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

export function SecuritySection() {
  return (
    <section id="security" className="bg-white scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 py-16 sm:py-24 lg:grid-cols-[5fr_7fr] lg:gap-16">
          {/* Left Column */}
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[.14em] text-[#315EFB]">
              Enterprise privacy &amp; security
            </p>

            <h2 className="fp-display mt-3 text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-[#172554] sm:text-[2.45rem]">
              Strict Data Governance &amp; Tenant Protection
            </h2>

            <p className="mt-5 max-w-md text-base leading-relaxed text-[#64748B]">
              We adhere to the Google API Limited Use policy. Data is encrypted in transit (TLS 1.3) and at rest (AES-256), protected by PostgreSQL Row-Level Security, and isolated per organization tenant.
            </p>
          </div>

          {/* Right Column: Technical Specs & Links */}
          <div className="min-w-0">
            <dl className="divide-y divide-[#E5EAF4] border-y border-[#E5EAF4] text-[15px]">
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-[#64748B]">In transit</dt>
                <dd className="font-semibold text-[#172554]">TLS 1.3</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-[#64748B]">At rest</dt>
                <dd className="font-semibold text-[#172554]">AES-256</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-[#64748B]">Database</dt>
                <dd className="font-semibold text-[#172554]">PostgreSQL Row-Level Security</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-[#64748B]">Tenancy</dt>
                <dd className="font-semibold text-[#172554]">Isolated per organization tenant</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-[#64748B]">Google data</dt>
                <dd className="font-semibold text-[#172554]">Google API Limited Use policy</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-[#172554]">
              <Link
                to="/privacy-policy"
                className="inline-flex cursor-pointer items-center gap-1.5 underline decoration-[#EDEBFF] underline-offset-[5px] decoration-2 transition-colors hover:text-[#315EFB] hover:decoration-[#315EFB]"
              >
                Privacy Policy
                <ExternalLink className="h-4 w-4 text-[#315EFB]" />
              </Link>

              <Link
                to="/terms"
                className="inline-flex cursor-pointer items-center gap-1.5 underline decoration-[#EDEBFF] underline-offset-[5px] decoration-2 transition-colors hover:text-[#315EFB] hover:decoration-[#315EFB]"
              >
                Terms of Service
                <ExternalLink className="h-4 w-4 text-[#315EFB]" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

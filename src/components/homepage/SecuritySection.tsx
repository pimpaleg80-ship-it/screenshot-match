import React from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, ExternalLink } from "lucide-react";

export function SecuritySection() {
  return (
    <section id="security" className="border-t border-slate-200 bg-[#F8FAFF] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[5fr_7fr] lg:gap-20">
          {/* Left Column */}
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[.14em] text-indigo-700">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              Enterprise Privacy &amp; Security
            </p>

            <h2 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 sm:text-[2.6rem]">
              Strict Data Governance &amp; Tenant Protection
            </h2>

            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
              We adhere to the Google API Limited Use policy. Data is encrypted in transit (TLS 1.3) and at rest (AES-256), protected by PostgreSQL Row-Level Security, and isolated per organization tenant.
            </p>
          </div>

          {/* Right Column: Technical Specs & Links */}
          <div className="min-w-0">
            <dl className="divide-y divide-slate-200 border-y border-slate-200 text-[15px]">
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-slate-500">In transit</dt>
                <dd className="font-medium text-slate-900">TLS 1.3</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-slate-500">At rest</dt>
                <dd className="font-medium text-slate-900">AES-256</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-slate-500">Database</dt>
                <dd className="font-medium text-slate-900">PostgreSQL Row-Level Security</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-slate-500">Tenancy</dt>
                <dd className="font-medium text-slate-900">Isolated per organization tenant</dd>
              </div>
              <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                <dt className="font-mono text-xs uppercase tracking-wider text-slate-500">Google data</dt>
                <dd className="font-medium text-slate-900">Google API Limited Use policy</dd>
              </div>
            </dl>

            <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm font-semibold text-slate-900">
              <Link
                to="/privacy-policy"
                className="inline-flex items-center gap-1.5 underline decoration-[#C7D2FE] underline-offset-[5px] decoration-2 transition-colors hover:decoration-indigo-600"
              >
                Privacy Policy
                <ExternalLink className="h-4 w-4 text-indigo-600" />
              </Link>

              <Link
                to="/terms"
                className="inline-flex items-center gap-1.5 underline decoration-[#C7D2FE] underline-offset-[5px] decoration-2 transition-colors hover:decoration-indigo-600"
              >
                Terms of Service
                <ExternalLink className="h-4 w-4 text-indigo-600" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

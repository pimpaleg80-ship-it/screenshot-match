import React from "react";
import { Check } from "lucide-react";
import { GeofenceDiagram } from "./GeofenceDiagram";

export function GeofencingSection() {
  return (
    <section id="geofencing" className="border-b border-[#E5EAF4] bg-white scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
          {/* Left Column */}
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold uppercase tracking-[.14em] text-[#315EFB]">
              Precise location guard
            </p>

            <h2 className="fp-display mt-3 text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-[#172554] sm:text-[2.45rem]">
              Zero-Trust Workplace Perimeter Verification
            </h2>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-[#64748B]">
              Every check-in and check-out is mathematically validated against your company&apos;s configured office boundaries. Coordinates outside the permitted radius are flagged or rejected with detailed audit timestamps.
            </p>

            <ul className="mt-8 max-w-lg divide-y divide-[#E5EAF4] border-y border-[#E5EAF4] text-[15px] text-[#172554]">
              <li className="flex items-start gap-3 py-3.5">
                <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#12A879]" />
                <span>Configurable branch locations and radius tolerances (10m – 500m)</span>
              </li>
              <li className="flex items-start gap-3 py-3.5">
                <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#12A879]" />
                <span>High-accuracy native device GPS &amp; IP boundary fallback</span>
              </li>
              <li className="flex items-start gap-3 py-3.5">
                <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#12A879]" />
                <span>Immutable audit logs tracking location drift and spoof attempts</span>
              </li>
            </ul>
          </div>

          {/* Right Column */}
          <GeofenceDiagram />
        </div>
      </div>
    </section>
  );
}

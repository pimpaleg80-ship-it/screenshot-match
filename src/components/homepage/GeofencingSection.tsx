import React from "react";
import { MapPin, Check } from "lucide-react";
import { GeofenceDiagram } from "./GeofenceDiagram";

export function GeofencingSection() {
  return (
    <section id="geofencing" className="border-y border-slate-200 bg-[#F1F5FD] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2 lg:gap-20">
          {/* Left Column */}
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-[.14em] text-indigo-700">
              <MapPin className="h-4 w-4 text-indigo-600" />
              Precise Location Guard
            </p>

            <h2 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 sm:text-[2.6rem]">
              Zero-Trust Workplace Perimeter Verification
            </h2>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
              Every check-in and check-out is mathematically validated against your company&apos;s configured office boundaries. Coordinates outside the permitted radius are flagged or rejected with detailed audit timestamps.
            </p>

            <ul className="mt-8 max-w-lg divide-y divide-slate-200 border-y border-slate-200 text-[15px] text-slate-700">
              <li className="flex items-start gap-3 py-3.5">
                <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-indigo-600" />
                <span>Configurable branch locations and radius tolerances (10m – 500m)</span>
              </li>
              <li className="flex items-start gap-3 py-3.5">
                <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-indigo-600" />
                <span>High-accuracy native device GPS &amp; IP boundary fallback</span>
              </li>
              <li className="flex items-start gap-3 py-3.5">
                <Check className="mt-0.5 h-[18px] w-[18px] shrink-0 text-indigo-600" />
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

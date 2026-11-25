import React from "react";
import { Navigation, MapPin, CalendarCheck, Cloud } from "lucide-react";

export function FeaturesSection() {
  return (
    <section id="features" className="border-b border-slate-200 bg-[#F8FAFF] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 py-20 sm:py-28 lg:grid-cols-[5fr_7fr] lg:gap-20">
          {/* Left Column (Sticky on large screens) */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="font-mono text-xs font-medium uppercase tracking-[.14em] text-indigo-700">
              Engineered for modern enterprise
            </p>
            <h2 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 sm:text-[2.6rem]">
              Comprehensive Attendance &amp; Workforce Controls
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-600">
              Everything your HR and operations teams need to verify shifts, eliminate attendance fraud, and automate compliance records.
            </p>
          </div>

          {/* Right Column (Editorial list with hairline dividers) */}
          <div className="min-w-0 border-b border-slate-200">
            {/* Feature 1 */}
            <article className="group grid gap-3 border-t border-slate-200 py-7 sm:grid-cols-[12rem_1fr] sm:gap-8 transition-colors">
              <div>
                <h3 className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
                  <Navigation className="h-5 w-5 text-slate-400 transition-colors group-hover:text-indigo-600" />
                  Auto Location Sync
                </h3>
                <p className="mt-1.5 font-mono text-[11px] text-slate-500">Live GPS lock</p>
              </div>
              <p className="text-[15px] leading-relaxed text-slate-600">
                Continuously synchronizes employee coordinates against your configured Main Office latitude and longitude, unlocking Check-In exclusively inside the approved perimeter.
              </p>
            </article>

            {/* Feature 2 */}
            <article className="group grid gap-3 border-t border-slate-200 py-7 sm:grid-cols-[12rem_1fr] sm:gap-8 transition-colors">
              <div>
                <h3 className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
                  <MapPin className="h-5 w-5 text-slate-400 transition-colors group-hover:text-indigo-600" />
                  Exact GPS Geofencing
                </h3>
                <p className="mt-1.5 font-mono text-[11px] text-slate-500">10m – 500m radius</p>
              </div>
              <p className="text-[15px] leading-relaxed text-slate-600">
                Define designated workplace coordinates and permitted radius fences. Prevents remote check-ins and guarantees personnel are physically on-site.
              </p>
            </article>

            {/* Feature 3 */}
            <article className="group grid gap-3 border-t border-slate-200 py-7 sm:grid-cols-[12rem_1fr] sm:gap-8 transition-colors">
              <div>
                <h3 className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
                  <CalendarCheck className="h-5 w-5 text-slate-400 transition-colors group-hover:text-indigo-600" />
                  Leaves &amp; Approvals
                </h3>
                <p className="mt-1.5 font-mono text-[11px] text-slate-500">Annual • Sick • Casual</p>
              </div>
              <p className="text-[15px] leading-relaxed text-slate-600">
                Streamlined multi-tier leave pipelines, dynamic quota balances (Annual, Sick, Casual), company holidays, and manager approval queues.
              </p>
            </article>

            {/* Feature 4 */}
            <article className="group grid gap-3 border-t border-slate-200 py-7 sm:grid-cols-[12rem_1fr] sm:gap-8 transition-colors">
              <div>
                <h3 className="flex items-center gap-2.5 text-base font-semibold text-slate-900">
                  <Cloud className="h-5 w-5 text-slate-400 transition-colors group-hover:text-indigo-600" />
                  Google Drive Cloud Sync
                </h3>
                <p className="mt-1.5 font-mono text-[11px] text-slate-500">Daily 11:30 PM</p>
              </div>
              <p className="text-[15px] leading-relaxed text-slate-600">
                Automated 11:30 PM daily attendance PDF backups and monthly payroll ledgers archived directly to your organization&apos;s Google Drive folder.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

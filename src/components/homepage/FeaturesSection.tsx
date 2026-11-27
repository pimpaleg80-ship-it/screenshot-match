import React from "react";
import { Navigation, MapPin, CalendarCheck, Cloud } from "lucide-react";

export function FeaturesSection() {
  const features = [
    {
      icon: Navigation,
      title: "Automatic Location Checks",
      meta: "Live GPS check",
      description:
        "Verifies an employee's device coordinates against your Main Office boundary before unlocking Check-In.",
    },
    {
      icon: MapPin,
      title: "Custom Branch Perimeters",
      meta: "10m – 500m radius",
      description:
        "Set separate coordinates and allowed distance radii for each office so off-site punches are blocked cleanly.",
    },
    {
      icon: CalendarCheck,
      title: "Leaves & Manager Approvals",
      meta: "Role-scoped queues",
      description:
        "Track leave quotas, company holiday calendars, manager review queues, and full HR sign-off history in one place.",
    },
    {
      icon: Cloud,
      title: "Google Drive PDF Backups",
      meta: "Daily 11:30 PM",
      description:
        "Exports daily attendance sheets and monthly payroll ledgers directly into your organization's own Drive folder.",
    },
  ];

  return (
    <section id="features" className="border-b border-[#E5EAF4] bg-[#F7F9FE] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 py-16 sm:py-24 lg:grid-cols-12 lg:gap-14">
          {/* Left Column (Sticky on large screens) */}
          <div className="lg:sticky lg:top-28 lg:col-span-5 lg:self-start">
            <p className="font-mono text-xs font-semibold uppercase tracking-[.14em] text-[#315EFB]">
              Core platform
            </p>
            <h2 className="fp-display mt-3 text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-[#172554] sm:text-[2.45rem]">
              Attendance &amp; Workforce Controls Without the Clutter
            </h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[#64748B]">
              Built for HR, managers, and staff to verify on-site shifts, handle approvals, and keep audit records organized automatically.
            </p>
          </div>

          {/* Right Column: Structured Editorial Specification Matrix */}
          <div className="min-w-0 lg:col-span-7">
            <div className="grid divide-y divide-[#E5EAF4] overflow-hidden rounded-2xl border border-[#E5EAF4] bg-white sm:grid-cols-2 sm:divide-y-0">
              {features.map((item, idx) => (
                <article
                  key={item.title}
                  className={`p-6 sm:p-7 ${
                    idx >= 2 ? "sm:border-t sm:border-[#E5EAF4]" : ""
                  } ${idx % 2 === 1 ? "sm:border-l sm:border-[#E5EAF4]" : ""}`}
                >
                  <div className="flex items-center gap-2 font-mono text-[11px] font-medium text-[#64748B]">
                    <item.icon className="h-4 w-4 text-[#315EFB]" aria-hidden="true" />
                    <span>{item.meta}</span>
                  </div>
                  <h3 className="fp-display mt-3.5 text-[1.0625rem] font-bold text-[#172554]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748B]">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

import React from "react";
import { Cloud, Folder, FileText } from "lucide-react";

export function CloudBackupSection() {
  return (
    <section id="cloud-backup" className="border-b border-[#E5EAF4] bg-[#F7F9FE] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
          {/* Left Column: File Tree Visual Card */}
          <div className="fp-panel-shadow order-2 min-w-0 overflow-hidden rounded-2xl border border-[#E5EAF4] bg-white lg:order-1">
            <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF4] px-4 py-3 text-xs">
              <span className="flex items-center gap-2 font-semibold text-[#172554]">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#EDEBFF] text-[#315EFB]">
                  <Cloud className="h-3.5 w-3.5" />
                </span>
                Google Drive
              </span>
              <span className="font-mono text-[11px] text-[#64748B]">encrypted • daily</span>
            </div>

            <div className="overflow-x-auto p-5 font-mono text-[13px] text-[#64748B]">
              <div className="flex items-center gap-2 whitespace-nowrap text-[#172554]">
                <Folder className="h-4 w-4 text-[#5946F6]" />
                FaceAttendance Backups
              </div>
              <div className="mt-2 flex items-center gap-2 whitespace-nowrap pl-3">
                <span className="text-[#CBD5E1]">└─</span>
                <Folder className="h-4 w-4 text-[#64748B]" />
                Attendance / 2026 / 11
              </div>
              <div className="mt-2 flex items-center gap-2 whitespace-nowrap pl-10">
                <span className="text-[#CBD5E1]">└─</span>
                <FileText className="h-4 w-4 text-[#315EFB]" />
                <span className="font-medium text-[#315EFB]">attendance_2026-11-15.pdf</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#E5EAF4] bg-[#F7F9FE] px-4 py-3">
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#0F8C65]">
                <span className="h-2 w-2 rounded-full bg-[#12A879]" aria-hidden="true" />
                Last nightly snapshot saved
              </div>
              <span className="font-mono text-[11px] text-[#64748B]">Next sync 11:30 PM</span>
            </div>
          </div>

          {/* Right Column: Copy & Details */}
          <div className="order-1 min-w-0 lg:order-2">
            <p className="font-mono text-xs font-semibold uppercase tracking-[.14em] text-[#315EFB]">
              Automatic, encrypted daily sync
            </p>

            <h2 className="fp-display mt-3 text-3xl font-extrabold leading-[1.1] tracking-[-0.03em] text-[#172554] sm:text-[2.45rem]">
              Google Drive Cloud Archiving
            </h2>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-[#64748B]">
              Your enterprise retains full custody of attendance documents. Connect once with Google OAuth, and Flowpeople automatically generates clean PDF archives into a dedicated folder on your Google Drive.
            </p>

            <dl className="mt-8 max-w-lg divide-y divide-[#E5EAF4] border-y border-[#E5EAF4] text-[15px]">
              <div className="flex items-baseline justify-between gap-6 py-3.5">
                <dt className="font-medium text-[#172554]">Attendance PDF</dt>
                <dd className="font-mono text-xs text-[#64748B]">Daily • 11:30 PM</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 py-3.5">
                <dt className="font-medium text-[#172554]">Payroll ledger</dt>
                <dd className="font-mono text-xs text-[#64748B]">Monthly</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

import React from "react";
import { Cloud, Folder, FileText } from "lucide-react";

export function CloudBackupSection() {
  return (
    <section id="cloud-backup" className="border-b border-slate-200 bg-[#F8FAFF] scroll-mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2 lg:gap-20">
          {/* Left Column: File Tree Visual Card */}
          <div className="order-2 min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel lg:order-1">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 text-xs">
              <span className="flex items-center gap-2 font-semibold text-slate-800">
                <Cloud className="h-4 w-4 text-indigo-600" />
                Google Drive
              </span>
              <span className="font-mono text-[11px] text-slate-500">encrypted • daily</span>
            </div>

            <div className="overflow-x-auto p-5 font-mono text-[13px] text-slate-600">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <Folder className="h-4 w-4 text-slate-400" />
                FaceAttendance Backups
              </div>
              <div className="mt-2 flex items-center gap-2 whitespace-nowrap pl-3">
                <span className="text-slate-300">└─</span>
                <Folder className="h-4 w-4 text-slate-400" />
                Attendance / 2026 / 11
              </div>
              <div className="mt-2 flex items-center gap-2 whitespace-nowrap pl-10">
                <span className="text-slate-300">└─</span>
                <FileText className="h-4 w-4 text-indigo-600" />
                <span className="font-medium text-indigo-700">attendance_2026-11-15.pdf</span>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
                <div className="animate-bar-sync h-full w-full rounded-full bg-indigo-600" />
              </div>
              <span className="font-mono text-[11px] text-slate-500">Next sync 11:30 PM</span>
            </div>
          </div>

          {/* Right Column: Copy & Details */}
          <div className="order-1 min-w-0 lg:order-2">
            <p className="font-mono text-xs font-medium uppercase tracking-[.14em] text-indigo-700">
              Automatic, encrypted daily sync
            </p>

            <h2 className="mt-4 text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-900 sm:text-[2.6rem]">
              Google Drive Cloud Archiving
            </h2>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">
              Your enterprise retains full custody of attendance documents. Connect once with Google OAuth, and Flowpeople automatically generates clean PDF archives into a dedicated folder on your Google Drive.
            </p>

            <dl className="mt-8 max-w-lg divide-y divide-slate-200 border-y border-slate-200 text-[15px]">
              <div className="flex items-baseline justify-between gap-6 py-3.5">
                <dt className="font-medium text-slate-900">Attendance PDF</dt>
                <dd className="font-mono text-xs text-slate-500">Daily • 11:30 PM</dd>
              </div>
              <div className="flex items-baseline justify-between gap-6 py-3.5">
                <dt className="font-medium text-slate-900">Payroll ledger</dt>
                <dd className="font-mono text-xs text-slate-500">Monthly</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}

import React, { useState, useEffect } from "react";
import { CheckCircle2, ScanFace, MapPin } from "lucide-react";

export function AttendancePreview() {
  const [scanState, setScanState] = useState<"ok" | "scan">("ok");
  const [matchScore, setMatchScore] = useState<string>("99.4");

  useEffect(() => {
    // Check for reduced motion preference
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    let intervalId: any;
    let animFrameId: number;

    const playCycle = () => {
      setScanState("scan");
      setMatchScore("0.0");

      const scanTimeout = setTimeout(() => {
        const start = performance.now();
        const duration = 1100;

        const step = (now: number) => {
          const progress = Math.min(1, (now - start) / duration);
          // Cubic ease-out
          const eased = 1 - Math.pow(1 - progress, 3);
          const currentVal = (99.4 * eased).toFixed(1);
          setMatchScore(currentVal);

          if (progress < 1) {
            animFrameId = requestAnimationFrame(step);
          } else {
            setScanState("ok");
          }
        };

        animFrameId = requestAnimationFrame(step);
      }, 1300);

      return () => clearTimeout(scanTimeout);
    };

    // Initial delay then recurring 8s cycle
    const initialTimer = setTimeout(() => {
      playCycle();
      intervalId = setInterval(playCycle, 8500);
    }, 4500);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalId);
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, []);

  return (
    <div
      className="animate-fade-up w-full min-w-0 max-w-[34rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel lg:justify-self-end"
      style={{ animationDelay: "220ms" }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3.5 text-xs">
        <span className="flex items-center gap-2 font-semibold uppercase tracking-wide text-slate-700">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live check-in event
        </span>
        <span className="font-mono text-slate-500">Today • Just now</span>
      </div>

      {/* Active Card */}
      <div className="relative px-5 py-5 overflow-hidden">
        {/* Animated Scanning Bar */}
        {scanState === "scan" && (
          <span className="animate-scanbar absolute inset-x-0 top-0 h-0.5 bg-indigo-600" />
        )}

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-sm">
            SJ
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">Sarah Jenkins</p>
            <p className="truncate font-mono text-xs text-slate-500">EMP-1042 • Engineering</p>
          </div>

          {scanState === "ok" ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
              Matching...
            </span>
          )}
        </div>

        {/* Dynamic Metrics */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Face match
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <ScanFace className="h-4 w-4 shrink-0 text-indigo-600" />
              <span className="tabular-nums font-mono">{matchScore}% Match (0.2s)</span>
            </p>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-slate-500">
              Geofence
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <MapPin className="h-4 w-4 shrink-0 text-indigo-600" />
              <span className="truncate">HQ Office (15m radius)</span>
            </p>
          </div>
        </div>
      </div>

      {/* Attendance History List */}
      <ul className="divide-y divide-slate-100 border-t border-slate-200 text-sm">
        <li className="flex items-center gap-3 px-5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
            PN
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">Priya Nair</span>
            <span className="block truncate font-mono text-[11px] text-slate-500">
              99.1% • HQ Office • 6m
            </span>
          </span>
          <span className="font-mono text-[11px] text-slate-500">08:58</span>
          <span className="w-[5.5rem] rounded-md bg-emerald-50 px-2 py-0.5 text-center text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            Verified
          </span>
        </li>

        <li className="flex items-center gap-3 px-5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
            MC
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">Marcus Chen</span>
            <span className="block truncate font-mono text-[11px] text-slate-500">
              98.7% • HQ Office • 9m
            </span>
          </span>
          <span className="font-mono text-[11px] text-slate-500">08:55</span>
          <span className="w-[5.5rem] rounded-md bg-emerald-50 px-2 py-0.5 text-center text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
            Verified
          </span>
        </li>

        <li className="flex items-center gap-3 px-5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
            TR
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">Tom Reyes</span>
            <span className="block truncate font-mono text-[11px] text-slate-500">
              97.9% • 240m from HQ Office
            </span>
          </span>
          <span className="font-mono text-[11px] text-slate-500">08:51</span>
          <span className="w-[5.5rem] rounded-md bg-rose-50 px-2 py-0.5 text-center text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
            Outside fence
          </span>
        </li>
      </ul>

      {/* Footer */}
      <p className="border-t border-slate-200 bg-slate-50 px-5 py-2.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
        Sample data
      </p>
    </div>
  );
}

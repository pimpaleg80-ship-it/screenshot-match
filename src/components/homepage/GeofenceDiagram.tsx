import React from "react";

export function GeofenceDiagram() {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-panel">
      {/* Schematic Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 font-mono text-[11px] text-slate-500">
        <span className="font-medium uppercase tracking-wider text-slate-700">
          HQ Office • fence 15m
        </span>
        <span>Schematic, not to scale</span>
      </div>

      {/* Responsive SVG Graphic */}
      <svg
        viewBox="0 0 520 340"
        className="block w-full h-auto select-none"
        role="img"
        aria-label="Schematic of a 15 metre fence around the HQ office. A check-in 12 metres from the centre is accepted. A check-in 240 metres away is rejected."
      >
        <defs>
          <pattern id="geofence-grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M26 0H0V26" fill="none" stroke="#E2E8F0" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width="520" height="340" fill="#FFFFFF" />
        <rect width="520" height="340" fill="url(#geofence-grid)" />

        {/* Outer dashed radar guide */}
        <circle cx="290" cy="175" r="122" fill="none" stroke="#CBD5E1" strokeDasharray="2 6" />

        {/* 15m Geofence Perimeter */}
        <circle
          cx="290"
          cy="175"
          r="64"
          fill="#4F46E5"
          fillOpacity=".07"
          stroke="#4F46E5"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />

        {/* Pulsing Animated Radar Wave Ring */}
        <circle
          className="animate-svg-ring"
          cx="290"
          cy="175"
          r="64"
          fill="none"
          stroke="#6366F1"
          strokeWidth="1.5"
        />

        {/* Distance connection lines */}
        <line x1="290" y1="175" x2="92" y2="76" stroke="#CBD5E1" strokeDasharray="4 4" />
        <line x1="290" y1="175" x2="330" y2="143" stroke="#4F46E5" strokeWidth="1.25" />

        {/* Center HQ Office Landmark */}
        <rect x="285" y="170" width="10" height="10" fill="#4F46E5" />
        <text
          x="290"
          y="266"
          textAnchor="middle"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
          fontSize="11"
          fontWeight="600"
          fill="#4338CA"
        >
          HQ OFFICE • 15m radius
        </text>

        {/* Accepted Check-in Point */}
        <circle cx="330" cy="143" r="5.5" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
        <text
          x="342"
          y="139"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
          fontSize="11"
          fontWeight="600"
          fill="#047857"
        >
          EMP-1042 • 12m
        </text>
        <text
          x="342"
          y="153"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
          fontSize="10"
          fill="#64748B"
        >
          accepted
        </text>

        {/* Rejected Check-in Point (Outside Fence) */}
        <circle cx="92" cy="76" r="5.5" fill="#F43F5E" stroke="#FFFFFF" strokeWidth="2" />
        <text
          x="106"
          y="72"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
          fontSize="11"
          fontWeight="600"
          fill="#BE123C"
        >
          EMP-0615 • 240m
        </text>
        <text
          x="106"
          y="86"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
          fontSize="10"
          fill="#64748B"
        >
          rejected, outside fence
        </text>
      </svg>
    </div>
  );
}

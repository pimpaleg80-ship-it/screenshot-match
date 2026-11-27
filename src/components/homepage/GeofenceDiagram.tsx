import React from "react";

export function GeofenceDiagram() {
  return (
    <div className="fp-panel-shadow min-w-0 overflow-hidden rounded-2xl border border-[#E5EAF4] bg-white">
      {/* Schematic Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF4] bg-[#F7F9FE] px-4 py-3 font-mono text-[11px] text-[#64748B]">
        <span className="font-semibold uppercase tracking-wider text-[#172554]">
          HQ Office • 15m perimeter
        </span>
        <span>Schematic diagram</span>
      </div>

      {/* Responsive SVG Graphic */}
      <svg
        viewBox="0 0 520 340"
        className="block h-auto w-full select-none"
        role="img"
        aria-label="Schematic of a 15 metre fence around the HQ office. A check-in 12 metres from the centre is accepted. A check-in 240 metres away is rejected."
      >
        <defs>
          <pattern id="geofence-grid" width="26" height="26" patternUnits="userSpaceOnUse">
            <path d="M26 0H0V26" fill="none" stroke="#E5EAF4" strokeWidth="1" />
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
          fill="#315EFB"
          fillOpacity=".07"
          stroke="#315EFB"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />

        {/* Static Inner Boundary Reference Circle */}
        <circle
          cx="290"
          cy="175"
          r="38"
          fill="none"
          stroke="#5946F6"
          strokeOpacity=".25"
          strokeWidth="1"
          strokeDasharray="3 4"
        />

        {/* Distance connection lines */}
        <line x1="290" y1="175" x2="92" y2="76" stroke="#CBD5E1" strokeDasharray="4 4" />
        <line x1="290" y1="175" x2="330" y2="143" stroke="#315EFB" strokeWidth="1.25" />

        {/* Center HQ Office Landmark */}
        <rect x="285" y="170" width="10" height="10" rx="2" fill="#315EFB" />
        <text
          x="290"
          y="266"
          textAnchor="middle"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
          fontSize="11"
          fontWeight="600"
          fill="#172554"
        >
          HQ OFFICE • 15m radius
        </text>

        {/* Accepted Check-in Point */}
        <circle cx="330" cy="143" r="5.5" fill="#12A879" stroke="#FFFFFF" strokeWidth="2" />
        <text
          x="342"
          y="139"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
          fontSize="11"
          fontWeight="600"
          fill="#0F8C65"
        >
          Inside • 12m
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
        <circle cx="92" cy="76" r="5.5" fill="#E05252" stroke="#FFFFFF" strokeWidth="2" />
        <text
          x="106"
          y="72"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, monospace"
          fontSize="11"
          fontWeight="600"
          fill="#C43C3C"
        >
          Outside • 240m
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

      {/* Bottom Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E5EAF4] bg-[#F7F9FE] px-4 py-2.5 text-[11px] text-[#64748B]">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#12A879]" aria-hidden="true" />
          <span>Verified inside radius</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#E05252]" aria-hidden="true" />
          <span>Blocked outside fence</span>
        </div>
      </div>
    </div>
  );
}

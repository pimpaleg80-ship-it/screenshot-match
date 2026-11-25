import React from "react";
import { Link } from "@tanstack/react-router";

interface FlowPeopleLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  to?: string;
}

export function FlowPeopleLogo({ className = "", size = "md", to = "/" }: FlowPeopleLogoProps) {
  const iconSizeClass = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const titleClass =
    size === "sm"
      ? "text-base font-extrabold tracking-tight"
      : size === "lg"
        ? "text-xl font-extrabold tracking-tight"
        : "text-[1.05rem] font-extrabold tracking-tight";
  const subtitleClass =
    size === "sm"
      ? "mt-0.5 text-[9px] font-semibold uppercase tracking-[.22em] text-slate-500"
      : "mt-1 text-[10px] font-semibold uppercase tracking-[.22em] text-slate-500";

  const content = (
    <div className={`flex shrink-0 items-center gap-3 ${className}`}>
      <svg className={`${iconSizeClass} shrink-0`} viewBox="0 0 90 90" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="flowpeople-lg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="90" y2="90">
            <stop offset="0" stopColor="#5249E6" />
            <stop offset="1" stopColor="#1BB8D5" />
          </linearGradient>
        </defs>
        <rect width="90" height="90" rx="22" fill="url(#flowpeople-lg)" />
        <g fill="#ffffff">
          <path d="M28.4 28C28.4 24.4 30.8 22.4 35 22.4C47.5 22.7 57.5 26 62.2 31.2C64.4 33.8 63.4 37.4 60.4 37.5C57.2 37.5 55 34.2 51.5 34.2L37.4 34.2L37.4 62.4A4.5 4.5 0 0 1 28.4 62.4Z" />
          <rect x="33" y="43" width="21" height="8.9" rx="4.45" />
          <circle cx="63.7" cy="47.4" r="4.9" />
        </g>
      </svg>
      <span className="leading-none select-none">
        <span className={`block ${titleClass}`}>
          <span className="text-slate-900">Flow</span>
          <span className="text-indigo-600">people</span>
        </span>
        <span className={`block ${subtitleClass}`}>by Fluxora</span>
      </span>
    </div>
  );

  return to ? (
    <Link to={to} className="cursor-pointer transition-opacity hover:opacity-95" aria-label="Flowpeople by Fluxora">
      {content}
    </Link>
  ) : (
    content
  );
}

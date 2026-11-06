import React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  variant?: "horizontal" | "stacked" | "icon" | "wordmark";
  size?: "sm" | "md" | "lg" | "xl";
  showSubtitle?: boolean;
}

export function BrandLogo({
  className,
  variant = "horizontal",
  size = "md",
  showSubtitle = true,
}: BrandLogoProps) {
  // Dimensions - scaled up by ~25-30% for improved prominence and clarity
  const iconSizes = {
    sm: "h-9 w-9 rounded-xl",
    md: "h-11 w-11 rounded-xl",
    lg: "h-14 w-14 rounded-2xl",
    xl: "h-16 w-16 sm:h-18 sm:w-18 rounded-2xl",
  };

  const textSizes = {
    sm: "text-[17px] sm:text-lg tracking-tight",
    md: "text-xl sm:text-[22px] tracking-tight",
    lg: "text-2xl sm:text-[26px] tracking-tight",
    xl: "text-3xl sm:text-4xl tracking-tight",
  };

  const subtitleSizes = {
    sm: "text-[9.5px] sm:text-[10px] tracking-[0.24em]",
    md: "text-[11px] sm:text-[11.5px] tracking-[0.25em]",
    lg: "text-[12px] sm:text-[13px] tracking-[0.27em]",
    xl: "text-[13px] sm:text-[14px] tracking-[0.28em]",
  };

  const IconSymbol = (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center bg-gradient-to-br from-[#4F46E5] to-[#06B6D4] shadow-sm shadow-[#4F46E5]/20",
        iconSizes[size],
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full p-1.5"
      >
        {/* Main Vertical Stem */}
        <path
          d="M 28 26 C 28 22.5 30.5 20 34 20 C 37.5 20 40 22.5 40 26 L 40 74 C 40 77.5 37.5 80 34 80 C 30.5 80 28 77.5 28 74 Z"
          fill="#FFFFFF"
        />
        {/* Top Wave Arm */}
        <path
          d="M 34 20 C 46 20 54 22 64 26 C 68 27.6 72 30 74 34 C 75.5 37 72.5 40 69 39 C 64 37.5 58 35 48 35 L 34 35 Z"
          fill="#FFFFFF"
        />
        {/* Middle Arm */}
        <path
          d="M 34 47 C 42 47 50 47 56 47 C 59.5 47 62 49.5 62 53 C 62 56.5 59.5 59 56 59 C 50 59 42 59 34 59 Z"
          fill="#FFFFFF"
        />
        {/* Person Dot */}
        <circle cx="75" cy="53" r="6.5" fill="#FFFFFF" />
      </svg>
    </div>
  );

  if (variant === "icon") {
    return <div className={cn("inline-flex items-center", className)}>{IconSymbol}</div>;
  }

  if (variant === "wordmark") {
    return (
      <div className={cn("flex flex-col leading-none", className)}>
        <span className={cn("font-extrabold", textSizes[size])}>
          <span className="text-foreground">Flow</span>
          <span className="text-[#4F46E5] dark:text-[#818CF8]">people</span>
        </span>
        {showSubtitle && (
          <span
            className={cn("font-bold uppercase text-muted-foreground mt-0.5", subtitleSizes[size])}
          >
            BY FLUXORA
          </span>
        )}
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col items-center text-center gap-2", className)}>
        {IconSymbol}
        <div className="flex flex-col leading-tight">
          <span className={cn("font-extrabold", textSizes[size])}>
            <span className="text-foreground">Flow</span>
            <span className="text-[#4F46E5] dark:text-[#818CF8]">people</span>
          </span>
          {showSubtitle && (
            <span
              className={cn(
                "font-bold uppercase text-muted-foreground mt-0.5",
                subtitleSizes[size],
              )}
            >
              BY FLUXORA
            </span>
          )}
        </div>
      </div>
    );
  }

  // Default: "horizontal"
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      {IconSymbol}
      <div className="flex flex-col leading-tight">
        <span className={cn("font-extrabold", textSizes[size])}>
          <span className="text-foreground">Flow</span>
          <span className="text-[#4F46E5] dark:text-[#818CF8]">people</span>
        </span>
        {showSubtitle && (
          <span
            className={cn("font-bold uppercase text-muted-foreground mt-0.5", subtitleSizes[size])}
          >
            BY FLUXORA
          </span>
        )}
      </div>
    </div>
  );
}

import React from "react";
import { cn } from "@/lib/utils";

export interface MetricItem {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

interface MetricStripProps {
  metrics: MetricItem[];
  className?: string;
}

export function MetricStrip({ metrics, className }: MetricStripProps) {
  const variantText = {
    default: "text-foreground",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-rose-600 dark:text-rose-400",
    info: "text-blue-600 dark:text-blue-400",
  };

  const variantBg = {
    default: "bg-muted/40 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  return (
    <div
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4",
        className
      )}
    >
      {metrics.map((m, idx) => {
        const Icon = m.icon;
        const colorClass = variantText[m.variant || "default"];
        const iconBg = variantBg[m.variant || "default"];

        return (
          <div
            key={idx}
            className="group relative bg-card rounded-xl p-4 sm:p-5 shadow-xs hover:shadow-sm transition-all duration-200 border border-border/40 hover:border-border/70 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span className="font-medium truncate">{m.label}</span>
              {Icon && (
                <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg transition-colors shrink-0 ml-2", iconBg)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
            <div>
              <div className={cn("text-2xl sm:text-3xl font-bold tracking-tight font-mono", colorClass)}>
                {m.value}
              </div>
              {m.subtext && (
                <div className="text-[11px] text-muted-foreground mt-1 truncate">
                  {m.subtext}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

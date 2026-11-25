import React from "react";
import { cn } from "@/lib/utils";

export type StatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "purple";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: StatusVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({
  variant = "neutral",
  children,
  dot = true,
  className,
  ...props
}: StatusBadgeProps) {
  const styles: Record<StatusVariant, { badge: string; dot: string }> = {
    success: {
      badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/15",
      dot: "bg-emerald-500",
    },
    warning: {
      badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/15",
      dot: "bg-amber-500",
    },
    danger: {
      badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/15",
      dot: "bg-rose-500",
    },
    info: {
      badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/15",
      dot: "bg-blue-500",
    },
    purple: {
      badge: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/15",
      dot: "bg-purple-500",
    },
    neutral: {
      badge: "bg-muted/70 text-muted-foreground border border-border/30",
      dot: "bg-muted-foreground/60",
    },
  };

  const current = styles[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium leading-none shrink-0 transition-colors shadow-2xs",
        current.badge,
        className
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", current.dot)} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Helper to map standard HR statuses into semantic StatusBadge
 */
export function renderHrStatus(status?: string | null) {
  if (!status) return <StatusBadge variant="neutral">None</StatusBadge>;

  const s = status.toLowerCase();
  if (["present", "active", "approved", "paid", "completed", "hired", "verified"].includes(s)) {
    return <StatusBadge variant="success">{status.toUpperCase()}</StatusBadge>;
  }
  if (["late", "pending", "in_progress", "in progress", "probation", "review"].includes(s)) {
    return <StatusBadge variant="warning">{status.replace(/_/g, " ").toUpperCase()}</StatusBadge>;
  }
  if (["absent", "rejected", "inactive", "suspended", "terminated", "expired"].includes(s)) {
    return <StatusBadge variant="danger">{status.toUpperCase()}</StatusBadge>;
  }
  if (["on_leave", "on leave", "half_day", "half day", "draft", "scheduled", "interview"].includes(s)) {
    return <StatusBadge variant="info">{status.replace(/_/g, " ").toUpperCase()}</StatusBadge>;
  }
  if (["locked", "offered", "finalized"].includes(s)) {
    return <StatusBadge variant="purple">{status.toUpperCase()}</StatusBadge>;
  }

  return <StatusBadge variant="neutral">{status.toUpperCase()}</StatusBadge>;
}

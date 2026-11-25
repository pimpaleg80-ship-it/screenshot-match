import React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  borderBottom?: boolean;
}

export function PageHeader({
  breadcrumbs,
  title,
  description,
  badge,
  actions,
  children,
  className,
  borderBottom = false,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "space-y-3",
        borderBottom && "border-b border-border pb-5",
        className
      )}
    >
      {/* Optional Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
          <Link
            to="/dashboard"
            className="hover:text-foreground transition-colors font-medium"
          >
            FlowPeople
          </Link>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              {crumb.href ? (
                <Link
                  to={crumb.href}
                  className="hover:text-foreground transition-colors font-medium truncate max-w-[150px] sm:max-w-none"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-semibold truncate max-w-[150px] sm:max-w-none">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Title & Actions Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-tight">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground max-w-3xl leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:self-center shrink-0">
            {actions}
          </div>
        )}
      </div>

      {/* Tabs or sub-header content */}
      {children && <div className="pt-2">{children}</div>}
    </div>
  );
}

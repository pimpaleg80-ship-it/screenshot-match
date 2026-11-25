import React from "react";
import { cn } from "@/lib/utils";

interface TableContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  pagination?: React.ReactNode;
  className?: string;
}

export function TableContainer({
  children,
  pagination,
  className,
  ...props
}: TableContainerProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-card overflow-hidden shadow-xs transition-shadow hover:shadow-sm",
        className
      )}
      {...props}
    >
      <div className="overflow-x-auto">{children}</div>
      {pagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-5 py-3 border-t border-border/30 bg-muted/10 text-xs text-muted-foreground">
          {pagination}
        </div>
      )}
    </div>
  );
}

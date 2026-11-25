import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface FilterToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchQuery?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  leftFilters?: React.ReactNode;
  rightActions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function FilterToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search records...",
  leftFilters,
  rightActions,
  children,
  className,
  ...props
}: FilterToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1",
        className
      )}
      {...props}
    >
      {/* Search and Left Filters */}
      <div className="flex flex-1 flex-wrap items-center gap-2.5 min-w-0">
        {onSearchChange !== undefined && (
          <div className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-8.5 pr-8 h-9 text-xs rounded-lg bg-muted/30 hover:bg-muted/50 focus:bg-background border border-border/35 focus-visible:ring-1 focus-visible:ring-primary/40 shadow-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {leftFilters}
      </div>

      {/* Right Actions & View Switchers */}
      {(rightActions || children) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:self-auto self-start">
          {rightActions}
          {children}
        </div>
      )}
    </div>
  );
}

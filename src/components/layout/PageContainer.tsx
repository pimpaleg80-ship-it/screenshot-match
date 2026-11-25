import React from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxWidth?: "default" | "narrow" | "wide" | "full";
  className?: string;
}

export function PageContainer({
  children,
  maxWidth = "default",
  className,
  ...props
}: PageContainerProps) {
  const maxClass = {
    narrow: "max-w-4xl",
    default: "max-w-7xl",
    wide: "max-w-[1440px]",
    full: "max-w-full",
  }[maxWidth];

  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-6 animate-in fade-in duration-150",
        maxClass,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

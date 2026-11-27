import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  variant?: "ghost" | "outline";
}

export function ThemeToggle({ className, showLabel = false, variant = "ghost" }: ThemeToggleProps) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    setMounted(true);

    // Keep multiple ThemeToggle buttons on the same page in sync
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("fta-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={showLabel ? "sm" : "icon"}
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={cn(showLabel && "gap-1.5 text-xs h-9", className)}
    >
      {mounted && dark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      {showLabel && <span>{mounted && dark ? "Dark" : "Light"} Mode</span>}
    </Button>
  );
}

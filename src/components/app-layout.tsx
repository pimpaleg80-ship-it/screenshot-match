import { Link, Outlet, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ScanFace,
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  ScanLine,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "kiosk"] },
  { to: "/people", label: "People", icon: Users, roles: ["admin", "manager"] },
  { to: "/kiosk", label: "Kiosk", icon: ScanLine, roles: ["admin", "kiosk"] },
  { to: "/attendance", label: "Records", icon: ClipboardList, roles: ["admin", "manager"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["admin", "manager"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
] as const;

export function AppLayout() {
  const session = useSession();
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Full-bleed kiosk mode: no sidebar / bottom nav.
  if (pathname === "/kiosk") {
    return <Outlet />;
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
    router.invalidate();
  }

  const items = NAV.filter((n) => (session.roles as string[]).some((r) => n.roles.includes(r)));
  const initials = (session.fullName || session.user?.email || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ScanFace className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold">FaceTime</p>
            <p className="text-xs text-muted-foreground">Attendance</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                pathname.startsWith(item.to) &&
                  "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft",
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-xl bg-sidebar-accent/60 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{session.fullName || "Account"}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {(session.roles[0] as string) || ""}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScanFace className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold">FaceTime Attendance</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 pb-24 md:pb-0">
          {session.loading ? (
            <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-8">
              <Skeleton className="h-8 w-56" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-72 rounded-2xl" />
            </div>
          ) : !session.isStaff && !session.isKiosk ? (
            <div className="mx-auto max-w-md p-8 text-center">
              <h1 className="text-xl font-semibold">No access yet</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your account ({session.user?.email}) doesn't have an assigned role. Ask an admin to
                add you in Settings → Roles.
              </p>
              <Button className="mt-4" onClick={handleSignOut} variant="outline">
                Sign out
              </Button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-background/95 py-1.5 backdrop-blur md:hidden">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-muted-foreground",
                pathname.startsWith(item.to) && "bg-accent text-accent-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

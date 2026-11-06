import { useState, useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ScanFace,
  LayoutDashboard,
  Users,
  ClipboardList,
  CalendarRange,
  CalendarDays,
  Megaphone,
  FileText,
  BarChart3,
  Settings,
  LogOut,
  ScanLine,
  User,
  Shield,
  Briefcase,
  UserCheck,
  Menu,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function AppLayout() {
  const session = useSession();
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Auto-close mobile drawer when navigating
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

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

  // Build role-specific navigation items
  let navItems: NavItem[] = [];

  if (session.isAdmin) {
    navItems = [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/people", label: "Employees", icon: Users },
      { to: "/enroll", label: "Face Enrollment", icon: ScanFace },
      { to: "/attendance", label: "Records", icon: ClipboardList },
      { to: "/leaves", label: "Leave Requests", icon: CalendarRange },
      { to: "/holidays", label: "Holidays", icon: CalendarDays },
      { to: "/announcements", label: "Announcements", icon: Megaphone },
      { to: "/documents", label: "Documents", icon: FileText },
      { to: "/reports", label: "Reports", icon: BarChart3 },
      { to: "/kiosk", label: "Face Kiosk", icon: ScanLine },
      { to: "/settings", label: "Settings & Geofencing", icon: Settings },
    ];
  } else if (session.isManager) {
    navItems = [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/people", label: "My Team", icon: Users },
      { to: "/enroll", label: "Face Enrollment", icon: ScanFace },
      { to: "/attendance", label: "Team Records", icon: ClipboardList },
      { to: "/leaves", label: "Leave Inbox", icon: CalendarRange },
      { to: "/holidays", label: "Holidays", icon: CalendarDays },
      { to: "/announcements", label: "Announcements", icon: Megaphone },
      { to: "/documents", label: "Documents", icon: FileText },
      { to: "/reports", label: "Reports", icon: BarChart3 },
      { to: "/kiosk", label: "Face Kiosk", icon: ScanLine },
    ];
  } else {
    // Employee
    navItems = [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/announcements", label: "Announcements", icon: Megaphone },
      { to: "/leaves", label: "Apply Leave", icon: CalendarRange },
      { to: "/holidays", label: "Holidays", icon: CalendarDays },
      { to: "/documents", label: "Documents", icon: FileText },
      { to: "/reports", label: "My Report", icon: BarChart3 },
      { to: "/profile", label: "Settings & Profile", icon: Settings },
    ];
  }

  const roleLabel = session.isAdmin ? "Admin" : session.isManager ? "Manager" : "Employee";
  const roleColor = session.isAdmin
    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800"
    : session.isManager
      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800";

  const RoleIcon = session.isAdmin ? Shield : session.isManager ? Briefcase : UserCheck;

  const initials = (session.fullName || session.user?.email || "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Primary items for mobile bottom nav (max 5)
  const mobileItems = navItems.slice(0, 5);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <BrandLogo variant="horizontal" size="sm" />
          <ThemeToggle />
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs bg-muted/40">
            <div className="flex items-center gap-1.5 font-medium">
              <RoleIcon className="h-3.5 w-3.5" />
              <span>Portal</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[11px] font-semibold uppercase tracking-wider py-0 px-2",
                roleColor,
              )}
            >
              {roleLabel}
            </Badge>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                pathname.startsWith(item.to) &&
                "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft font-semibold",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1 truncate">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-2 rounded-xl bg-sidebar-accent/60 px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-semibold">{session.fullName || "Account"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {session.employeeCode ? `${session.employeeCode} • ` : ""}
                {session.departmentName || session.designation || roleLabel}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/90 px-3 sm:px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
              className="h-10 w-10 text-foreground"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <BrandLogo variant="horizontal" size="sm" showSubtitle={false} />
            <Badge variant="outline" className={cn("text-[10px] ml-0.5 py-0 px-1.5", roleColor)}>
              {roleLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="h-10 w-10"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile Slide-in Drawer Sheet */}
        <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-xs p-0 flex flex-col justify-between">
            <div>
              <SheetHeader className="p-4 border-b text-left">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex items-center justify-between">
                  <BrandLogo variant="horizontal" size="sm" />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between rounded-lg border px-2.5 py-1.5 text-xs bg-muted/40">
                    <div className="flex items-center gap-1.5 font-medium">
                      <RoleIcon className="h-3.5 w-3.5" />
                      <span>Portal Mode</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wider py-0 px-2",
                        roleColor,
                      )}
                    >
                      {roleLabel}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>

              {/* Full navigation links list inside slide-in drawer */}
              <nav className="space-y-1 overflow-y-auto p-3 max-h-[calc(100vh-210px)]">
                {navItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground min-h-[44px]",
                      pathname.startsWith(item.to) &&
                      "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft font-semibold",
                    )}
                  >
                    <item.icon className="h-4.5 w-4.5 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>

            {/* Drawer User Card & Sign Out */}
            <div className="border-t p-3 bg-muted/20">
              <div className="flex items-center gap-2 rounded-xl bg-sidebar-accent/60 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {initials}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold">{session.fullName || "Account"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {session.employeeCode ? `${session.employeeCode} • ` : ""}
                    {session.departmentName || session.designation || roleLabel}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="h-9 w-9"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <main className="flex-1 pb-24 md:pb-6">
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
          ) : !session.user ? (
            <div className="mx-auto max-w-md p-8 text-center">
              <h1 className="text-xl font-semibold">Sign in required</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Please sign in to access the portal.
              </p>
              <Button className="mt-4" onClick={() => navigate({ to: "/auth" })}>
                Go to Sign In
              </Button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-background/95 py-1.5 backdrop-blur md:hidden">
          {mobileItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium text-muted-foreground",
                pathname.startsWith(item.to) && "bg-accent text-accent-foreground font-semibold",
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

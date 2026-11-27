import { useState, useEffect, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
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
  Shield,
  Briefcase,
  UserCheck,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Clock,
  Target,
  LifeBuoy,
  Receipt,
  Calculator,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationCenterBell } from "@/components/notifications/NotificationCenterBell";
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

interface NavGroup {
  title: string;
  items: NavItem[];
}

export function AppLayout() {
  const session = useSession();
  const pathname = useLocation({ select: (l) => l.pathname });
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem("fp-sidebar-hidden") === "true";
    } catch {
      return false;
    }
  });

  function toggleSidebar() {
    setSidebarHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("fp-sidebar-hidden", String(next));
      } catch {
        // ignore storage restrictions
      }
      return next;
    });
  }

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    try {
      sessionStorage.removeItem("superadmin_unlocked");
    } catch {
      // ignore storage errors
    }
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
    router.invalidate();
  }

  // Structured, semantic navigation groups
  const navGroups: NavGroup[] = useMemo(() => {
    if (session.isAdmin) {
      return [
        {
          title: "Overview",
          items: [
            { to: "/dashboard", label: "HR Dashboard", icon: LayoutDashboard },
            { to: "/profile", label: "My Self-Service", icon: UserCheck },
          ],
        },
        {
          title: "Workforce",
          items: [
            { to: "/people", label: "Employees Directory", icon: Users },
            { to: "/recruitment", label: "Recruitment Pipeline", icon: Briefcase },
          ],
        },
        {
          title: "Time & Attendance",
          items: [
            { to: "/attendance", label: "Geofence Attendance", icon: ClipboardList },
            { to: "/shifts", label: "Shift Roster", icon: Clock },
            { to: "/leaves", label: "Leave Requests", icon: CalendarRange },
            { to: "/holidays", label: "Holiday Calendar", icon: CalendarDays },
          ],
        },
        {
          title: "Finance & Operations",
          items: [
            { to: "/payroll", label: "Payroll Processing", icon: Calculator },
            { to: "/expenses", label: "Expense Claims", icon: Receipt },
            { to: "/helpdesk", label: "HR Helpdesk", icon: LifeBuoy },
          ],
        },
        {
          title: "Talent & Growth",
          items: [
            { to: "/performance", label: "Performance & Reviews", icon: Target },
            { to: "/announcements", label: "Announcements & Polls", icon: Megaphone },
            { to: "/documents", label: "Document Vault", icon: FileText },
            { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
            { to: "/settings", label: "Organization Settings", icon: Settings },
          ],
        },
      ];
    }

    if (session.isManager) {
      return [
        {
          title: "Overview",
          items: [
            { to: "/dashboard", label: "Team Dashboard", icon: LayoutDashboard },
            { to: "/profile", label: "Self-Service", icon: UserCheck },
          ],
        },
        {
          title: "My Team",
          items: [
            { to: "/people", label: "Team Members", icon: Users },
            { to: "/attendance", label: "Team Attendance", icon: ClipboardList },
            { to: "/shifts", label: "Shift Assignments", icon: Clock },
            { to: "/leaves", label: "Leave Approvals", icon: CalendarRange },
            { to: "/performance", label: "Performance Reviews", icon: Target },
            { to: "/recruitment", label: "Hiring Pipeline", icon: Briefcase },
          ],
        },
        {
          title: "Operations",
          items: [
            { to: "/expenses", label: "Team Expenses", icon: Receipt },
            { to: "/helpdesk", label: "Support Tickets", icon: LifeBuoy },
            { to: "/announcements", label: "Announcements", icon: Megaphone },
            { to: "/documents", label: "Documents", icon: FileText },
            { to: "/reports", label: "Team Analytics", icon: BarChart3 },
          ],
        },
      ];
    }

    // Employee role
    return [
      {
        title: "Personal Portal",
        items: [
          { to: "/dashboard", label: "My Dashboard", icon: LayoutDashboard },
          { to: "/profile", label: "Profile & Documents", icon: UserCheck },
          { to: "/leaves", label: "Apply Leave", icon: CalendarRange },
          { to: "/attendance", label: "My Attendance", icon: ClipboardList },
          { to: "/holidays", label: "Company Holidays", icon: CalendarDays },
        ],
      },
      {
        title: "Work & Finances",
        items: [
          { to: "/payroll", label: "My Payslips", icon: Calculator },
          { to: "/expenses", label: "Expense Claims", icon: Receipt },
          { to: "/helpdesk", label: "Submit HR Ticket", icon: LifeBuoy },
          { to: "/performance", label: "Goals & Appraisal", icon: Target },
          { to: "/announcements", label: "News & Polls", icon: Megaphone },
          { to: "/documents", label: "Policies & Forms", icon: FileText },
        ],
      },
    ];
  }, [session.isAdmin, session.isManager]);

  // Flattened items for mobile bottom bar
  const mobilePrimaryItems = useMemo(() => {
    return [
      { to: "/dashboard", label: "Home", icon: LayoutDashboard },
      { to: "/attendance", label: "Attendance", icon: ClipboardList },
      { to: "/leaves", label: "Leaves", icon: CalendarRange },
      session.isAdmin || session.isManager
        ? { to: "/people", label: "People", icon: Users }
        : { to: "/payroll", label: "Payslips", icon: Calculator },
      { to: "/profile", label: "Profile", icon: UserCheck },
    ];
  }, [session.isAdmin, session.isManager]);

  const roleLabel = session.isSuperadmin
    ? "Superadmin"
    : session.isAdmin
      ? "HR Admin"
      : session.isManager
        ? "Manager"
        : "Employee";
  const initials = (session.fullName || session.user?.email || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // Active page title calculation
  const currentTitle = useMemo(() => {
    for (const group of navGroups) {
      for (const item of group.items) {
        if (pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to))) {
          return item.label;
        }
      }
    }
    if (pathname === "/superadmin") return "Superadmin Console";
    if (pathname === "/settings") return "Organization Settings";
    return "Dashboard";
  }, [navGroups, pathname]);

  // Full-bleed kiosk mode
  if (pathname === "/kiosk") {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar: Clean, bezel-less modern design */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border/50 bg-sidebar",
          !sidebarHidden && "md:flex"
        )}
      >
        {/* Brand header */}
        <div className="flex h-14 items-center px-4 border-b border-border/25">
          <BrandLogo variant="horizontal" size="sm" />
        </div>

        {/* User Identity Snippet */}
        <div className="px-3 py-2.5 border-b border-border/25 bg-muted/15">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-semibold text-primary-foreground shadow-xs">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-medium text-foreground">{session.fullName || "User"}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium truncate">
                  {session.employeeCode || roleLabel}
                </span>
                {session.isSuperadmin && (
                  <span className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    ROOT
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                {group.title}
              </div>
              {group.items.map((item) => {
                const isActive = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                    <span className="flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Superadmin Console link for authorized roots */}
          {session.isSuperadmin && (
            <div className="pt-2 border-t border-border/25">
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                System Administration
              </div>
              <Link
                to="/superadmin"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                  pathname === "/superadmin"
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Shield className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="flex-1 truncate">Superadmin Control</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-mono font-bold">SEC</span>
              </Link>
            </div>
          )}
        </nav>

        {/* Sign Out Footer */}
        <div className="border-t border-border/40 p-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 font-normal rounded-lg"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign out</span>
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header Bar for Desktop & Mobile */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/50 bg-background/95 px-4 sm:px-6 backdrop-blur-sm">
          {/* Mobile hamburger & brand */}
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open menu"
              className="h-8 w-8 text-foreground"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <BrandLogo variant="horizontal" size="sm" showSubtitle={false} />
          </div>

          {/* Desktop Sidebar Toggle, Breadcrumbs & Status */}
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
              title={sidebarHidden ? "Show sidebar" : "Hide sidebar"}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {sidebarHidden ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
            <Link to="/dashboard" className="font-medium text-muted-foreground/70 hover:text-foreground transition-colors">
              FlowPeople
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="font-semibold text-foreground">{currentTitle}</span>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 border-r border-border/30 pr-3">
              <span className="text-[11px] font-medium text-muted-foreground">
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <Badge variant="outline" className="text-[10px] font-medium py-0 px-1.5 border-border/40 text-muted-foreground">
                {roleLabel}
              </Badge>
            </div>
            <NotificationCenterBell />
            <ThemeToggle />
            {sidebarHidden && (
              <div className="hidden md:block">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSignOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Slide-in Drawer Sheet */}
        <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <SheetContent side="left" className="w-[85vw] max-w-xs p-0 flex flex-col justify-between border-r border-border">
            <div className="flex flex-col h-full">
              <SheetHeader className="p-4 border-b border-border text-left">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex items-center justify-between">
                  <BrandLogo variant="horizontal" size="sm" />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{session.fullName || "User"}</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {roleLabel}
                  </Badge>
                </div>
              </SheetHeader>

              {/* Categorized drawer navigation */}
              <nav className="flex-1 space-y-4 overflow-y-auto p-3">
                {navGroups.map((group) => (
                  <div key={group.title} className="space-y-0.5">
                    <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      {group.title}
                    </div>
                    {group.items.map((item) => {
                      const isActive = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileDrawerOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors min-h-[40px]",
                            isActive
                              ? "bg-accent text-accent-foreground font-semibold"
                              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Drawer footer */}
              <div className="border-t border-border p-3 bg-muted/20">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-destructive h-9"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign out</span>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Page Content Viewport */}
        <main className="flex-1 pb-20 md:pb-8">
          {session.loading ? (
            <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
              <Skeleton className="h-7 w-48 rounded" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-64 rounded-lg" />
            </div>
          ) : !session.user ? (
            <div className="mx-auto max-w-md p-8 text-center">
              <h1 className="text-lg font-semibold text-foreground">Sign in required</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Please sign in to access your organization portal.
              </p>
              <Button className="mt-4" size="sm" onClick={() => navigate({ to: "/auth" })}>
                Go to Sign In
              </Button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (5 Primary Destinations) */}
        <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border/50 bg-background/95 py-1.5 backdrop-blur-sm md:hidden">
          {mobilePrimaryItems.map((item) => {
            const isActive = pathname === item.to || (item.to !== "/dashboard" && pathname.startsWith(item.to));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-w-[56px] flex-col items-center gap-0.5 rounded px-2 py-1 text-[10px] font-medium transition-colors",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="truncate max-w-[60px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

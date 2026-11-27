import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Filter,
  Inbox,
  Settings2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  runDailyAutomationChecks,
  getNotificationTypeMeta,
  getPriorityBadgeClass,
  NotificationItem,
} from "@/lib/notifications";
import { formatDate } from "@/lib/attendance";

interface NotificationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  organizationId?: string | null;
  isAdmin?: boolean;
  isManager?: boolean;
  onOpenPreferences: () => void;
}

export function NotificationDrawer({
  open,
  onOpenChange,
  userId,
  organizationId,
  isAdmin,
  isManager,
  onOpenPreferences,
}: NotificationDrawerProps) {
  const queryClient = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [isAutomating, setIsAutomating] = useState(false);

  // Notifications query
  const {
    data: notifications = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["user-notifications", userId, unreadOnly, typeFilter],
    queryFn: () => fetchUserNotifications(userId, unreadOnly, typeFilter),
    enabled: open && !!userId,
  });

  // Realtime subscription is centralized in NotificationCenterBell (prevents duplicate channels and race conditions)

  // Mark single as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-count", userId] });
    },
  });

  // Mark all as read mutation
  const markAllMutation = useMutation({
    mutationFn: () => markAllNotificationsAsRead(userId),
    onSuccess: () => {
      toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["user-notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-count", userId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to mark notifications as read");
    },
  });

  // Trigger daily automation checks
  async function handleRunAutomation() {
    if (!organizationId) {
      toast.error("Organization ID required for automation checks");
      return;
    }
    setIsAutomating(true);
    try {
      const res = await runDailyAutomationChecks(organizationId);
      toast.success("Daily automation completed", {
        description: `Checked document expiry and interview reminders.`,
      });
      queryClient.invalidateQueries({ queryKey: ["user-notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["unread-count", userId] });
    } catch (err: any) {
      toast.error(err.message || "Automation run failed");
    } finally {
      setIsAutomating(false);
    }
  }

  function formatTime(dateStr: string): string {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return formatDate(dateStr.split("T")[0] || dateStr);
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col justify-between">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b">
          <SheetHeader className="text-left space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" /> Notifications
                </SheetTitle>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Notification Preferences"
                  onClick={onOpenPreferences}
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  title="Refresh"
                  onClick={() => refetch()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              Real-time work notifications, approval workflows, and automated reminders.
            </SheetDescription>
          </SheetHeader>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 pt-3">
            <Button
              variant={unreadOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setUnreadOnly(!unreadOnly)}
              className="h-7 text-[11px] gap-1 px-2.5"
            >
              <Filter className="h-3 w-3" />
              {unreadOnly ? "Unread" : "All"}
            </Button>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="h-7 text-[11px] flex-1">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="leave">Leaves</SelectItem>
                <SelectItem value="attendance">Attendance</SelectItem>
                <SelectItem value="shift">Shifts</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="ticket">HR Tickets</SelectItem>
                <SelectItem value="document_expiry">Doc Expiry</SelectItem>
                <SelectItem value="interview">Recruitment</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="payroll">Payroll</SelectItem>
                <SelectItem value="announcement">Announcements</SelectItem>
              </SelectContent>
            </Select>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="h-7 text-[11px] gap-1 px-2"
                title="Mark all as read"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all
              </Button>
            )}
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto divide-y">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center h-full">
              <Inbox className="h-10 w-10 opacity-30 mb-2" />
              <p className="font-semibold text-foreground text-sm">Inbox Zero</p>
              <p className="mt-1 max-w-[200px]">
                {unreadOnly
                  ? "You have caught up with all your unread notifications."
                  : "No notifications matching your filter."}
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const meta = getNotificationTypeMeta(item.type);
              const priorityClass = getPriorityBadgeClass(item.priority);
              const isUrgent = item.priority === "urgent";

              return (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors flex items-start gap-3 ${
                    item.is_read ? "bg-card hover:bg-muted/10" : "bg-primary/5 hover:bg-primary/10"
                  }`}
                >
                  {/* Indicator */}
                  <div className="pt-0.5 shrink-0">
                    {!item.is_read ? (
                      <span className="block h-2 w-2 rounded-full bg-primary" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-medium ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </Badge>

                      {isUrgent && (
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${priorityClass}`}>
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> Urgent
                        </Badge>
                      )}

                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {formatTime(item.created_at)}
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-foreground leading-snug">
                      {item.title}
                    </h4>

                    {item.message && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.message}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {item.link ? (
                        <a
                          href={item.link}
                          onClick={() => {
                            if (!item.is_read) markReadMutation.mutate(item.id);
                            onOpenChange(false);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          View Details <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : meta.defaultLink ? (
                        <a
                          href={meta.defaultLink}
                          onClick={() => {
                            if (!item.is_read) markReadMutation.mutate(item.id);
                            onOpenChange(false);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  {!item.is_read && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                      title="Mark as read"
                      onClick={() => markReadMutation.mutate(item.id)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer with Automation Trigger */}
        {(isAdmin || isManager) && (
          <div className="p-3 border-t bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Bell className="h-3.5 w-3.5 text-amber-500" />
              Automated Reminders Check
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={isAutomating}
              onClick={handleRunAutomation}
              className="h-7 text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
            >
              <RefreshCw className={`h-3 w-3 ${isAutomating ? "animate-spin" : ""}`} />
              {isAutomating ? "Running..." : "Run Checks"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

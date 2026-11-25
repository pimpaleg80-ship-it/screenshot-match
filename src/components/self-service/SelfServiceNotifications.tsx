import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  CheckCheck,
  Inbox,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/attendance";

interface SelfServiceNotificationsProps {
  userId: string;
}

interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export function SelfServiceNotifications({ userId }: SelfServiceNotificationsProps) {
  const queryClient = useQueryClient();
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);

  // Query notifications
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["my-notifications", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as NotificationItem[];
    },
    enabled: !!userId,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const displayedNotifications = filterUnreadOnly
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  // Mark single as read
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["my-notifications"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to mark as read");
    },
  });

  function formatTimeAgo(dateStr: string): string {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return "Just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return formatDate(dateStr.split("T")[0] || dateStr);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" /> Notifications & Alerts
                </CardTitle>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                In-app updates regarding leave decisions, ticket resolutions, expense approvals, and announcements.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={filterUnreadOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterUnreadOnly(!filterUnreadOnly)}
                className="h-8 text-xs gap-1"
              >
                <Filter className="h-3 w-3" />
                {filterUnreadOnly ? "Showing Unread" : "Filter Unread"}
              </Button>

              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="h-8 text-xs gap-1"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark All Read
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : displayedNotifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              <Inbox className="mx-auto h-8 w-8 opacity-40 mb-2" />
              <p className="font-semibold text-foreground text-sm">Inbox Zero</p>
              <p className="mt-1">
                {filterUnreadOnly
                  ? "You have no unread notifications right now."
                  : "You're all caught up! No notifications yet."}
              </p>
            </div>
          ) : (
            <div className="divide-y rounded-lg border">
              {displayedNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 transition-colors flex items-start justify-between gap-3 ${
                    n.is_read ? "bg-card hover:bg-muted/10" : "bg-primary/5 hover:bg-primary/10"
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!n.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                      <h4 className="text-xs font-semibold text-foreground leading-tight">
                        {n.title}
                      </h4>
                    </div>
                    {n.message && (
                      <p className="text-xs text-muted-foreground leading-normal pl-4">
                        {n.message}
                      </p>
                    )}
                    <span className="text-[11px] text-muted-foreground block pl-4 pt-0.5">
                      {formatTimeAgo(n.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {n.link && (
                      <a
                        href={n.link}
                        className="text-primary hover:underline text-xs flex items-center gap-1 p-1 rounded hover:bg-primary/10"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {!n.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Mark as read"
                        onClick={() => markReadMutation.mutate(n.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

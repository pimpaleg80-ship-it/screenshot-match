import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer";
import { NotificationPreferencesModal } from "@/components/notifications/NotificationPreferencesModal";
import { useSession } from "@/hooks/use-session";
import { toast } from "sonner";

export function NotificationCenterBell() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const userId = session.user?.id || "";

  // Query unread notifications count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!userId,
    refetchInterval: 30000, // Background poll fallback every 30s
  });

  // Realtime subscription for notifications & unread count
  useEffect(() => {
    if (!userId) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      // Remove any leftover channels with matching prefix to prevent duplicate subscribe collisions
      supabase.getChannels().forEach((ch) => {
        if (ch.topic.includes("realtime-notifications") || ch.topic.includes("realtime-bell")) {
          supabase.removeChannel(ch);
        }
      });

      const channelName = `realtime-bell-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      channel = supabase.channel(channelName);
      channel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            queryClient.invalidateQueries({ queryKey: ["unread-count", userId] });
            queryClient.invalidateQueries({ queryKey: ["user-notifications", userId] });
            if (payload.eventType === "INSERT") {
              const newNotif = payload.new as any;
              toast.info(newNotif.title || "New Notification", {
                description: newNotif.message || undefined,
              });
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn("Realtime bell subscription error:", err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          console.warn("Error removing bell channel:", e);
        }
      }
    };
  }, [userId, queryClient]);

  if (!userId) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setDrawerOpen(true)}
        className="relative h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground"
        aria-label="View notifications"
        title="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm animate-in zoom-in-50">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      <NotificationDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        userId={userId}
        organizationId={session.organizationId}
        isAdmin={session.isAdmin}
        isManager={session.isManager}
        onOpenPreferences={() => {
          setDrawerOpen(false);
          setPrefsOpen(true);
        }}
      />

      <NotificationPreferencesModal
        open={prefsOpen}
        onOpenChange={setPrefsOpen}
        userId={userId}
        organizationId={session.organizationId}
      />
    </>
  );
}

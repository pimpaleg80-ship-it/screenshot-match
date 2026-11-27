import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Mail,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Clock,
  Receipt,
  LifeBuoy,
  FileText,
  Briefcase,
  Target,
  Calculator,
  Megaphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  fetchNotificationPreferences,
  saveNotificationPreferences,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "@/lib/notifications";

interface NotificationPreferencesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  organizationId?: string | null;
}

export function NotificationPreferencesModal({
  open,
  onOpenChange,
  userId,
  organizationId,
}: NotificationPreferencesModalProps) {
  const queryClient = useQueryClient();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences", userId, organizationId],
    queryFn: () => fetchNotificationPreferences(userId, organizationId),
    enabled: open && !!userId,
  });

  const [formState, setFormState] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    user_id: userId,
    organization_id: organizationId || null,
  });

  useEffect(() => {
    if (preferences) {
      setFormState(preferences);
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: (updated: NotificationPreferences) => saveNotificationPreferences(updated),
    onSuccess: () => {
      toast.success("Notification preferences updated successfully");
      queryClient.invalidateQueries({ queryKey: ["notification-preferences", userId] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save preferences");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (formState.whatsapp_enabled && formState.whatsapp_number) {
      // Basic validation for phone number
      const cleaned = formState.whatsapp_number.replace(/\s+/g, "");
      if (cleaned.length < 8) {
        toast.error("Please enter a valid phone number with country code");
        return;
      }
    }
    saveMutation.mutate(formState);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Bell className="h-4 w-4 text-primary" />
            Notification & Delivery Preferences
          </DialogTitle>
          <DialogDescription className="text-xs">
            Configure how and when FlowPeople sends you important work alerts, reminders, and updates.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
            Loading preferences...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 pt-2">
            {/* Delivery Channels */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Delivery Channels
              </h4>

              <div className="rounded-lg border p-3.5 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <Bell className="h-3.5 w-3.5 text-primary" /> In-App Notifications
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Display notifications in the FlowPeople bell drawer and top header.
                    </p>
                  </div>
                  <Switch
                    checked={formState.in_app_enabled}
                    onCheckedChange={(checked) =>
                      setFormState((prev) => ({ ...prev, in_app_enabled: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-blue-500" /> Email Notifications
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Receive transaction receipts, monthly payslip links, and approval emails.
                    </p>
                  </div>
                  <Switch
                    checked={formState.email_enabled}
                    onCheckedChange={(checked) =>
                      setFormState((prev) => ({ ...prev, email_enabled: checked }))
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-medium flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-500" /> WhatsApp Notifications
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Instant mobile alerts for urgent approvals and shift announcements.
                      </p>
                    </div>
                    <Switch
                      checked={formState.whatsapp_enabled}
                      onCheckedChange={(checked) =>
                        setFormState((prev) => ({ ...prev, whatsapp_enabled: checked }))
                      }
                    />
                  </div>

                  {formState.whatsapp_enabled && (
                    <div className="pt-2 pl-6">
                      <Label className="text-[11px] text-muted-foreground block mb-1">
                        WhatsApp Number (with country code)
                      </Label>
                      <Input
                        type="tel"
                        placeholder="Enter phone number with country code"
                        value={formState.whatsapp_number || ""}
                        onChange={(e) =>
                          setFormState((prev) => ({ ...prev, whatsapp_number: e.target.value }))
                        }
                        className="h-8 text-xs max-w-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Granular Event Toggles */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Alert Topics & Automation Triggers
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Leave */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    <span>Leave applications & approvals</span>
                  </div>
                  <Switch
                    checked={formState.notify_leave}
                    onCheckedChange={(val) => setFormState((p) => ({ ...p, notify_leave: val }))}
                  />
                </div>

                {/* Attendance */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Attendance & late arrivals</span>
                  </div>
                  <Switch
                    checked={formState.notify_attendance}
                    onCheckedChange={(val) => setFormState((p) => ({ ...p, notify_attendance: val }))}
                  />
                </div>

                {/* Shift */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 text-cyan-500 shrink-0" />
                    <span>Shift roster assignments</span>
                  </div>
                  <Switch
                    checked={formState.notify_shift}
                    onCheckedChange={(val) => setFormState((p) => ({ ...p, notify_shift: val }))}
                  />
                </div>

                {/* Expenses */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>Expense claim reimbursements</span>
                  </div>
                  <Switch
                    checked={formState.notify_expense}
                    onCheckedChange={(val) => setFormState((p) => ({ ...p, notify_expense: val }))}
                  />
                </div>

                {/* Tickets */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center gap-2">
                    <LifeBuoy className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                    <span>HR support ticket updates</span>
                  </div>
                  <Switch
                    checked={formState.notify_ticket}
                    onCheckedChange={(val) => setFormState((p) => ({ ...p, notify_ticket: val }))}
                  />
                </div>

                {/* Document Expiry */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    <span>Document expiry reminders</span>
                  </div>
                  <Switch
                    checked={formState.notify_document_expiry}
                    onCheckedChange={(val) =>
                      setFormState((p) => ({ ...p, notify_document_expiry: val }))
                    }
                  />
                </div>

                {/* Recruitment */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                    <span>Interview schedule reminders</span>
                  </div>
                  <Switch
                    checked={formState.notify_interview}
                    onCheckedChange={(val) => setFormState((p) => ({ ...p, notify_interview: val }))}
                  />
                </div>

                {/* Performance */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center gap-2">
                    <Target className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                    <span>Performance review cycles</span>
                  </div>
                  <Switch
                    checked={formState.notify_performance}
                    onCheckedChange={(val) => setFormState((p) => ({ ...p, notify_performance: val }))}
                  />
                </div>

                {/* Payroll */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span>Payroll published alerts</span>
                  </div>
                  <Switch
                    checked={formState.notify_payroll}
                    onCheckedChange={(val) => setFormState((p) => ({ ...p, notify_payroll: val }))}
                  />
                </div>

                {/* Announcement */}
                <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs sm:col-span-2">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                    <span>Company news & announcements</span>
                  </div>
                  <Switch
                    checked={formState.notify_announcement}
                    onCheckedChange={(val) =>
                      setFormState((p) => ({ ...p, notify_announcement: val }))
                    }
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saveMutation.isPending}
                className="h-8 text-xs gap-1.5"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Saving..." : "Save Preferences"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

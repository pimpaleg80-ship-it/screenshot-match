import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LifeBuoy,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/attendance";
import { STATUS_CONFIG, PRIORITY_CONFIG } from "@/lib/helpdesk";
import { CreateTicketDialog } from "@/components/helpdesk/CreateTicketDialog";
import { TicketConversationDrawer } from "@/components/helpdesk/TicketConversationDrawer";

interface SelfServiceHrTicketsProps {
  employeeId: string;
}

interface HrTicketItem {
  id: string;
  ticket_number: string;
  employee_id: string;
  subject: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  description: string;
  status: "open" | "assigned" | "in_progress" | "resolved" | "closed";
  resolution_notes: string | null;
  created_at: string;
}

export function SelfServiceHrTickets({ employeeId }: SelfServiceHrTicketsProps) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Query my HR tickets
  const {
    data: tickets = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["my-hr-tickets", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_tickets")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as HrTicketItem[];
    },
    enabled: !!employeeId,
  });

  // Calculate ticket counts
  const stats = useMemo(() => {
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;

    tickets.forEach((t) => {
      if (t.status === "open") openCount++;
      if (t.status === "assigned" || t.status === "in_progress") inProgressCount++;
      if (t.status === "resolved" || t.status === "closed") resolvedCount++;
    });

    return {
      openCount,
      inProgressCount,
      resolvedCount,
      total: tickets.length,
    };
  }, [tickets]);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Open Tickets</p>
              <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
                {stats.openCount}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
              <LifeBuoy className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">In Progress</p>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {stats.inProgressCount}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground font-medium">Resolved & Closed</p>
              <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                {stats.resolvedCount}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-primary" /> My HR Support Tickets
              </CardTitle>
              <CardDescription className="text-xs">
                Raise queries, request assistance, and communicate with HR personnel in real-time.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="gap-1.5 text-xs h-8 shadow-sm font-medium"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Raise HR Ticket</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              <HelpCircle className="mx-auto h-8 w-8 opacity-40 mb-2" />
              No support tickets raised yet. Click "Raise HR Ticket" if you need assistance.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left font-medium text-muted-foreground">
                    <th className="py-2.5 px-3">Ticket #</th>
                    <th className="py-2.5 px-3">Subject & Details</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Raised On</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tickets.map((t) => {
                    const statusConfig = STATUS_CONFIG[t.status] || {
                      label: t.status,
                      badgeClass: "bg-muted text-muted-foreground",
                    };
                    const priorityConfig = PRIORITY_CONFIG[t.priority] || {
                      label: t.priority,
                      badgeClass: "bg-muted text-muted-foreground",
                    };

                    return (
                      <tr
                        key={t.id}
                        onClick={() => setSelectedTicketId(t.id)}
                        className="hover:bg-muted/20 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap text-primary">
                          {t.ticket_number}
                        </td>
                        <td className="py-2.5 px-3 max-w-sm">
                          <p className="font-semibold text-foreground">{t.subject}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {t.description}
                          </p>
                          {t.resolution_notes && (
                            <div className="mt-1 rounded bg-emerald-500/10 p-1.5 text-[10px] text-emerald-800 dark:text-emerald-300 border border-emerald-200">
                              <span className="font-semibold">Resolution: </span>
                              {t.resolution_notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                          {t.category}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge variant="outline" className={`text-[10px] ${priorityConfig.badgeClass}`}>
                            {priorityConfig.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(t.created_at.split("T")[0] || t.created_at)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <Badge variant="outline" className={`text-[10px] ${statusConfig.badgeClass}`}>
                            {statusConfig.label}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 hover:text-primary"
                            onClick={() => setSelectedTicketId(t.id)}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Thread</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        employeeId={employeeId}
        onSuccess={() => refetch()}
      />

      {/* Ticket Conversation Drawer */}
      <TicketConversationDrawer
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedTicketId(null);
        }}
        onUpdated={() => refetch()}
      />
    </div>
  );
}

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  AlertTriangle,
  ChevronRight,
  ArrowUpDown,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HrTicket,
  TicketStatus,
  TicketPriority,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  TICKET_CATEGORIES,
} from "@/lib/helpdesk";
import { formatDate } from "@/lib/attendance";
import { CreateTicketDialog } from "./CreateTicketDialog";
import { TicketConversationDrawer } from "./TicketConversationDrawer";

export function HelpdeskDashboard() {
  const session = useSession();
  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Fetch Tickets
  const {
    data: tickets = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["hr-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_tickets")
        .select(`
          *,
          employee:employees!hr_tickets_employee_id_fkey(
            id,
            full_name,
            email,
            department:departments(id, name)
          ),
          assigned_employee:employees!hr_tickets_assigned_employee_id_fkey(
            id,
            full_name,
            email
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as HrTicket[];
    },
  });

  // Calculate KPIs
  const stats = useMemo(() => {
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let urgentCount = 0;

    tickets.forEach((t) => {
      if (t.status === "open") openCount++;
      if (t.status === "assigned" || t.status === "in_progress") inProgressCount++;
      if (t.status === "resolved" || t.status === "closed") resolvedCount++;
      if (t.priority === "urgent" && t.status !== "closed" && t.status !== "resolved") {
        urgentCount++;
      }
    });

    return {
      total: tickets.length,
      openCount,
      inProgressCount,
      resolvedCount,
      urgentCount,
    };
  }, [tickets]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSubject = t.subject.toLowerCase().includes(query);
        const matchesNumber = t.ticket_number.toLowerCase().includes(query);
        const matchesReporter = t.employee?.full_name?.toLowerCase().includes(query);
        const matchesCategory = t.category.toLowerCase().includes(query);
        if (!matchesSubject && !matchesNumber && !matchesReporter && !matchesCategory) {
          return false;
        }
      }

      return true;
    });
  }, [tickets, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <LifeBuoy className="w-7 h-7 text-primary" />
            <span>HR Helpdesk & Support</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage attendance complaints, leave queries, payroll issues, and employee service requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            onClick={() => setCreateModalOpen(true)}
            size="sm"
            className="h-9 gap-1.5 font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Raise Ticket</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Tickets
            </CardTitle>
            <FolderOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono">{stats.total}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">All tracked HR requests</p>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Open / Needs Action
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {stats.openCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting initial review</p>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              In Progress
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {stats.inProgressCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Assigned & under resolution</p>
          </CardContent>
        </Card>

        <Card className="bg-card border shadow-sm">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Urgent Attention
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {stats.urgentCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Critical blockers open</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="bg-card border shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ticket #, subject, or reporter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Category: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Category: All</SelectItem>
              {TICKET_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Priority: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Priority: All</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tickets List Table */}
      <Card className="bg-card border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/60 text-muted-foreground font-semibold border-b">
              <tr>
                <th className="p-3 pl-4">Ticket</th>
                <th className="p-3">Subject & Category</th>
                <th className="p-3">Reporter</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Status</th>
                <th className="p-3">Assigned To</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right pr-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="w-4 h-4 animate-spin text-primary" />
                      <span>Loading support tickets...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-muted-foreground">
                    <LifeBuoy className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-semibold text-foreground text-sm">No support tickets found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {searchQuery || statusFilter !== "all"
                        ? "Try clearing or relaxing your search filters."
                        : "No support tickets have been submitted yet."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTickets.map((t) => {
                  const statusConf = STATUS_CONFIG[t.status];
                  const priorityConf = PRIORITY_CONFIG[t.priority];

                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTicketId(t.id)}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="p-3 pl-4 font-mono font-bold text-primary">
                        {t.ticket_number}
                      </td>
                      <td className="p-3 max-w-[280px]">
                        <div className="font-semibold text-foreground truncate">{t.subject}</div>
                        <div className="text-[11px] text-muted-foreground">{t.category}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-foreground">
                          {t.employee?.full_name || "Employee"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {t.employee?.department?.name || "General"}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={priorityConf?.badgeClass}>
                          {priorityConf?.label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={statusConf?.badgeClass}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusConf?.dotClass}`} />
                          {statusConf?.label}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {t.assigned_employee ? (
                          <div className="flex items-center gap-1.5 text-foreground font-medium">
                            <User className="w-3.5 h-3.5 text-primary" />
                            <span>{t.assigned_employee.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(t.created_at)}
                      </td>
                      <td className="p-3 text-right pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicketId(t.id);
                          }}
                        >
                          <span>View</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {/* Ticket Conversation Drawer */}
      <TicketConversationDrawer
        ticketId={selectedTicketId}
        open={!!selectedTicketId}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelectedTicketId(null);
        }}
      />
    </div>
  );
}

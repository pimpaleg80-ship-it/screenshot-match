import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LifeBuoy,
  Send,
  Lock,
  MessageSquare,
  History,
  Paperclip,
  CheckCircle2,
  Clock,
  User,
  Shield,
  Download,
  AlertCircle,
  Loader2,
  X,
  UserCheck,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HrTicket,
  HrTicketComment,
  HrTicketHistory,
  TicketStatus,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  getAttachmentSignedUrl,
  formatTicketFileSize,
} from "@/lib/helpdesk";
import { formatDate } from "@/lib/attendance";

interface TicketConversationDrawerProps {
  ticketId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function TicketConversationDrawer({
  ticketId,
  open,
  onOpenChange,
  onUpdated,
}: TicketConversationDrawerProps) {
  const session = useSession();
  const queryClient = useQueryClient();
  const isHRorAdmin = session.isAdmin || session.isSuperadmin;
  const isManager = session.isManager || isHRorAdmin;

  const [activeTab, setActiveTab] = useState<"conversation" | "history">("conversation");
  const [replyMessage, setReplyMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Resolution modal state
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");

  // Assign agent modal state
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  // 1. Fetch Ticket Details
  const { data: ticket, isLoading: ticketLoading } = useQuery({
    queryKey: ["hr-ticket-detail", ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
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
        .eq("id", ticketId)
        .single();

      if (error) throw error;
      return data as unknown as HrTicket;
    },
    enabled: open && !!ticketId,
  });

  // 2. Fetch Comments
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ["hr-ticket-comments", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("hr_ticket_comments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as HrTicketComment[];
    },
    enabled: open && !!ticketId && activeTab === "conversation",
  });

  // 3. Fetch History Audit Logs
  const { data: historyLogs = [], isLoading: historyLoading } = useQuery({
    queryKey: ["hr-ticket-history", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("hr_ticket_history")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as HrTicketHistory[];
    },
    enabled: open && !!ticketId && activeTab === "history",
  });

  // 4. Fetch list of potential assignees (HR / Admins / Managers)
  const { data: agents = [] } = useQuery({
    queryKey: ["hr-agents-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, user_id, full_name, email, designation")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: open && isManager,
  });

  // Post Comment Mutation
  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!ticketId || !replyMessage.trim()) return;

      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentSize: number | null = null;

      if (replyFile) {
        setIsUploading(true);
        attachmentName = replyFile.name;
        attachmentSize = replyFile.size;
        const fileExt = replyFile.name.split(".").pop();
        const path = `comments/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("helpdesk-attachments")
          .upload(path, replyFile);

        if (!uploadErr && uploadData) {
          attachmentUrl = uploadData.path;
        } else {
          // Fallback
          const { data: docData } = await supabase.storage
            .from("documents")
            .upload(`helpdesk_comment/${Date.now()}_${replyFile.name}`, replyFile);
          attachmentUrl = docData?.path || null;
        }
      }

      const { data, error } = await supabase.rpc("add_hr_ticket_comment", {
        p_ticket_id: ticketId,
        p_message: replyMessage.trim(),
        p_is_internal: isInternalNote,
        p_attachment_url: attachmentUrl,
        p_attachment_name: attachmentName,
        p_attachment_size: attachmentSize,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(isInternalNote ? "Internal note added" : "Reply sent");
      setReplyMessage("");
      setIsInternalNote(false);
      setReplyFile(null);
      queryClient.invalidateQueries({ queryKey: ["hr-ticket-comments", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["hr-ticket-detail", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["hr-tickets"] });
      if (onUpdated) onUpdated();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to post message");
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // Update Status / Assignment Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      status,
      assignedUserId,
      assignedEmpId,
      notes,
    }: {
      status: TicketStatus;
      assignedUserId?: string | null | undefined;
      assignedEmpId?: string | null | undefined;
      notes?: string | null | undefined;
    }) => {
      if (!ticketId) return;

      const { data, error } = await supabase.rpc("update_hr_ticket_status", {
        p_ticket_id: ticketId,
        p_status: status,
        p_assigned_to: assignedUserId || null,
        p_assigned_employee_id: assignedEmpId || null,
        p_resolution_notes: notes || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      toast.success(`Ticket status updated to ${STATUS_CONFIG[vars.status].label}`);
      setResolveDialogOpen(false);
      setAssignDialogOpen(false);
      setResolutionNotes("");
      queryClient.invalidateQueries({ queryKey: ["hr-ticket-detail", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["hr-ticket-history", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["hr-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-tickets"] });
      if (onUpdated) onUpdated();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update ticket status");
    },
  });

  const handleDownloadAttachment = async (path: string, fileName?: string | null) => {
    try {
      const signedUrl = await getAttachmentSignedUrl(path);
      if (signedUrl) {
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      toast.error("Unable to load attachment link: " + e.message);
    }
  };

  const statusConfig = ticket ? STATUS_CONFIG[ticket.status] : null;
  const priorityConfig = ticket ? PRIORITY_CONFIG[ticket.priority] : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col h-full bg-background">
          {ticketLoading || !ticket ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading support ticket details...</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-5 border-b bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {ticket.ticket_number}
                    </span>
                    <Badge variant="outline" className={statusConfig?.badgeClass}>
                      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${statusConfig?.dotClass}`} />
                      {statusConfig?.label}
                    </Badge>
                    <Badge variant="outline" className={priorityConfig?.badgeClass}>
                      {priorityConfig?.label} Priority
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(ticket.created_at)}
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-foreground leading-snug">{ticket.subject}</h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span>
                      Category: <strong className="text-foreground">{ticket.category}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Raised by:{" "}
                      <strong className="text-foreground">
                        {ticket.employee?.full_name || "Employee"}
                      </strong>{" "}
                      ({ticket.employee?.department?.name || "General"})
                    </span>
                    {ticket.assigned_employee && (
                      <>
                        <span>•</span>
                        <span>
                          Assigned to:{" "}
                          <strong className="text-foreground">{ticket.assigned_employee.full_name}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Workflow Actions Bar (for HR / Managers) */}
                {isManager && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions:
                    </span>

                    {/* Assign Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setAssignDialogOpen(true)}
                    >
                      <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{ticket.assigned_employee ? "Reassign" : "Assign Agent"}</span>
                    </Button>

                    {/* In Progress */}
                    {ticket.status !== "in_progress" && ticket.status !== "resolved" && ticket.status !== "closed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            status: "in_progress",
                            assignedUserId: ticket.assigned_to,
                            assignedEmpId: ticket.assigned_employee_id,
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Mark In Progress</span>
                      </Button>
                    )}

                    {/* Resolve Button */}
                    {ticket.status !== "resolved" && ticket.status !== "closed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => setResolveDialogOpen(true)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolve Ticket</span>
                      </Button>
                    )}

                    {/* Close Button */}
                    {ticket.status !== "closed" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          updateStatusMutation.mutate({
                            status: "closed",
                          })
                        }
                        disabled={updateStatusMutation.isPending}
                      >
                        <span>Close</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Main Content: Description & Tabs */}
              <div className="flex-1 overflow-y-auto flex flex-col">
                {/* Initial Description Card */}
                <div className="p-4 border-b bg-card space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" />
                      <span>{ticket.employee?.full_name || "Employee"} (Initial Report)</span>
                    </span>
                    <span>{new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed bg-muted/30 p-3 rounded-lg border">
                    {ticket.description}
                  </p>

                  {/* Initial Attachment if present */}
                  {ticket.attachment_url && (
                    <div className="mt-2 flex items-center justify-between bg-muted/40 p-2.5 rounded-lg border text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <Paperclip className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-medium truncate">
                          {ticket.attachment_name || "Attached File"}
                        </span>
                        {ticket.attachment_size && (
                          <span className="text-muted-foreground text-[11px]">
                            ({formatTicketFileSize(ticket.attachment_size)})
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() =>
                          handleDownloadAttachment(ticket.attachment_url!, ticket.attachment_name)
                        }
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>View / Download</span>
                      </Button>
                    </div>
                  )}

                  {/* Resolution Notes Banner */}
                  {ticket.resolution_notes && (
                    <div className="mt-3 p-3 rounded-lg border border-emerald-200 bg-emerald-500/10 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Resolution Details</span>
                      </div>
                      <p className="text-emerald-900 dark:text-emerald-200 whitespace-pre-line">
                        {ticket.resolution_notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Tabs: Conversation & Activity History */}
                <Tabs
                  value={activeTab}
                  onValueChange={(val) => setActiveTab(val as "conversation" | "history")}
                  className="flex-1 flex flex-col"
                >
                  <div className="px-4 border-b bg-muted/10">
                    <TabsList className="h-10 bg-transparent border-none p-0 gap-4">
                      <TabsTrigger
                        value="conversation"
                        className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-semibold"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-1.5" />
                        <span>Conversation ({comments.length})</span>
                      </TabsTrigger>
                      <TabsTrigger
                        value="history"
                        className="data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-xs font-semibold"
                      >
                        <History className="w-3.5 h-3.5 mr-1.5" />
                        <span>Audit Timeline</span>
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* TAB 1: CONVERSATION */}
                  <TabsContent value="conversation" className="flex-1 flex flex-col p-4 space-y-3 m-0">
                    <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                      {commentsLoading ? (
                        <div className="flex items-center justify-center p-6">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : comments.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground italic">
                          No messages in this ticket yet. Write a message below to start the thread.
                        </div>
                      ) : (
                        comments.map((c) => (
                          <div
                            key={c.id}
                            className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                              c.is_internal
                                ? "bg-amber-500/10 border-amber-300 dark:border-amber-800"
                                : c.author_role === "Employee"
                                ? "bg-card border-border ml-2"
                                : "bg-primary/5 border-primary/20 mr-2"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {c.is_internal && (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-300 text-[10px] py-0 px-1.5 gap-1 font-semibold"
                                  >
                                    <Lock className="w-2.5 h-2.5" />
                                    <span>Internal Note</span>
                                  </Badge>
                                )}
                                <span className="font-bold text-foreground">
                                  {c.author_name || "Staff Member"}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  ({c.author_role || "Support"})
                                </span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(c.created_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <p className="whitespace-pre-line leading-relaxed text-foreground">
                              {c.message}
                            </p>

                            {/* Comment Attachment */}
                            {c.attachment_url && (
                              <div className="mt-1.5 flex items-center justify-between bg-background/80 p-2 rounded border text-[11px]">
                                <div className="flex items-center gap-1.5 truncate">
                                  <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span className="truncate font-medium">
                                    {c.attachment_name || "Attachment"}
                                  </span>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[11px] hover:text-primary gap-1"
                                  onClick={() =>
                                    handleDownloadAttachment(c.attachment_url!, c.attachment_name)
                                  }
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Open</span>
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Reply / Comment Input Form */}
                    {ticket.status !== "closed" ? (
                      <div className="pt-2 border-t space-y-2 bg-background">
                        {isManager && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="internal-note"
                              checked={isInternalNote}
                              onCheckedChange={(checked) => setIsInternalNote(!!checked)}
                            />
                            <Label
                              htmlFor="internal-note"
                              className="text-xs font-semibold text-amber-700 dark:text-amber-400 cursor-pointer flex items-center gap-1"
                            >
                              <Lock className="w-3 h-3" />
                              <span>Internal HR Note (Hidden from employee)</span>
                            </Label>
                          </div>
                        )}

                        <div className="relative">
                          <Textarea
                            placeholder={
                              isInternalNote
                                ? "Write an internal note for HR/Management only..."
                                : "Write a response to the employee..."
                            }
                            rows={3}
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            className="text-xs resize-none pr-12"
                          />
                        </div>

                        {/* File attached preview */}
                        {replyFile && (
                          <div className="flex items-center justify-between bg-muted/40 p-1.5 px-2.5 rounded border text-xs">
                            <div className="flex items-center gap-1.5 truncate">
                              <Paperclip className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="truncate">{replyFile.name}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 hover:text-rose-500"
                              onClick={() => setReplyFile(null)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <label className="cursor-pointer">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                              <Paperclip className="w-3.5 h-3.5" />
                              <span>{replyFile ? "Change file" : "Attach file"}</span>
                            </span>
                            <input
                              type="file"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) setReplyFile(e.target.files[0]);
                              }}
                            />
                          </label>

                          <Button
                            size="sm"
                            onClick={() => addCommentMutation.mutate()}
                            disabled={!replyMessage.trim() || addCommentMutation.isPending || isUploading}
                            className="h-8 gap-1.5 text-xs"
                          >
                            {(addCommentMutation.isPending || isUploading) ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>{isInternalNote ? "Post Note" : "Send Reply"}</span>
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-muted/40 rounded-lg text-center text-xs text-muted-foreground border">
                        This support ticket is closed. Reopen or raise a new ticket for new queries.
                      </div>
                    )}
                  </TabsContent>

                  {/* TAB 2: AUDIT HISTORY TIMELINE */}
                  <TabsContent value="history" className="flex-1 p-4 space-y-3 m-0 overflow-y-auto">
                    {historyLoading ? (
                      <div className="flex items-center justify-center p-6">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : historyLogs.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground italic">
                        No audit history recorded.
                      </div>
                    ) : (
                      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                        {historyLogs.map((log) => (
                          <div key={log.id} className="relative space-y-1">
                            <div className="absolute -left-6 top-0.5 w-3.5 h-3.5 rounded-full bg-primary/20 border-2 border-primary" />
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold capitalize text-foreground">
                                {log.action.replace("_", " ")}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(log.created_at).toLocaleString([], {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {log.notes && (
                              <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border">
                                {log.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* RESOLVE TICKET MODAL */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Resolve Support Ticket</span>
            </DialogTitle>
            <DialogDescription>
              Provide resolution notes explaining how the issue was addressed or resolved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="res-notes" className="text-xs font-semibold">
              Resolution Notes <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="res-notes"
              rows={4}
              placeholder="Enter resolution details"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResolveDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!resolutionNotes.trim() || updateStatusMutation.isPending}
              onClick={() =>
                updateStatusMutation.mutate({
                  status: "resolved",
                  notes: resolutionNotes.trim(),
                  assignedUserId: ticket?.assigned_to ?? null,
                  assignedEmpId: ticket?.assigned_employee_id ?? null,
                })
              }
              className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
            >
              {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Mark as Resolved</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ASSIGN AGENT MODAL */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              <span>Assign Support Agent</span>
            </DialogTitle>
            <DialogDescription>
              Select an HR or management team member to handle this ticket.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label className="text-xs font-semibold">Select Staff Member</Label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Choose staff member" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.full_name} ({agent.designation || agent.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!selectedAgentId || updateStatusMutation.isPending}
              onClick={() => {
                const targetAgent = agents.find((a) => a.id === selectedAgentId);
                updateStatusMutation.mutate({
                  status: ticket?.status === "open" ? "assigned" : ticket?.status || "assigned",
                  assignedEmpId: selectedAgentId,
                  assignedUserId: targetAgent?.user_id || null,
                  notes: `Ticket assigned to ${targetAgent?.full_name}`,
                });
              }}
              className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"
            >
              {updateStatusMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Confirm Assignment</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

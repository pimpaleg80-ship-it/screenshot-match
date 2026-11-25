import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Eye, Users, Clock } from "lucide-react";
import { Announcement } from "@/lib/engagement";

interface AnnouncementReadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: Announcement | null;
  organizationId: string;
}

export function AnnouncementReadDialog({
  open,
  onOpenChange,
  announcement,
  organizationId,
}: AnnouncementReadDialogProps) {
  // Fetch read receipts for this announcement
  const { data: reads = [], isLoading } = useQuery({
    queryKey: ["announcement-reads", announcement?.id],
    queryFn: async () => {
      if (!announcement?.id) return [];
      const { data, error } = await supabase
        .from("announcement_reads")
        .select(`
          id,
          read_at,
          employee:employees!announcement_reads_employee_id_fkey(
            id,
            full_name,
            employee_code,
            designation,
            department:departments(name)
          )
        `)
        .eq("announcement_id", announcement.id)
        .order("read_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!announcement?.id && open,
  });

  // Fetch total target employees count in org (or target department)
  const { data: targetTotal = 0 } = useQuery({
    queryKey: [
      "announcement-target-total",
      organizationId,
      announcement?.target,
      announcement?.target_department_id,
    ],
    queryFn: async () => {
      let query = supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active");

      if (announcement?.target === "department" && announcement.target_department_id) {
        query = query.eq("department_id", announcement.target_department_id);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: !!organizationId && !!announcement?.id && open,
  });

  const readCount = reads.length;
  const readPct = targetTotal > 0 ? Math.min(100, Math.round((readCount / targetTotal) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Announcement Readership Analytics
          </DialogTitle>
          <DialogDescription>
            Audit who has viewed and acknowledged this circular in your organization.
          </DialogDescription>
        </DialogHeader>

        {announcement && (
          <div className="space-y-5 py-2">
            {/* Announcement Info Box */}
            <div className="p-3.5 rounded-lg border bg-muted/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs capitalize">
                  {announcement.category.replace("_", " ")}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(announcement.created_at).toLocaleDateString()}
                </span>
              </div>
              <h4 className="font-semibold text-sm text-foreground">{announcement.title}</h4>
              <p className="text-xs text-muted-foreground">
                Target: {announcement.target === "department" ? `Department (${announcement.department?.name || "Specified"})` : "Entire Organization"}
              </p>
            </div>

            {/* Read Stats Gauge */}
            <div className="p-4 rounded-lg border bg-card space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-foreground">Readership Progress</span>
                </div>
                <div className="text-xs font-semibold text-primary">
                  {readCount} / {targetTotal} ({readPct}%)
                </div>
              </div>
              <Progress value={readPct} className="h-2.5" />
              <p className="text-[11px] text-muted-foreground">
                {targetTotal - readCount > 0
                  ? `${targetTotal - readCount} employees in the target audience have not yet opened this announcement.`
                  : "All target employees have viewed this announcement."}
              </p>
            </div>

            {/* Readers List */}
            <div className="space-y-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Read Receipts ({readCount})
              </h5>

              {isLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Loading readership logs...
                </div>
              ) : reads.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg border-dashed">
                  No read receipts logged yet.
                </div>
              ) : (
                <div className="divide-y border rounded-lg max-h-60 overflow-y-auto">
                  {reads.map((r: any) => {
                    const emp = r.employee;
                    return (
                      <div
                        key={r.id}
                        className="p-3 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors"
                      >
                        <div>
                          <div className="font-medium text-foreground">
                            {emp?.full_name || "Unknown Employee"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {emp?.employee_code} • {emp?.designation || "Employee"} • {emp?.department?.name || "General"}
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-muted-foreground">
                          {new Date(r.read_at).toLocaleString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Megaphone,
  Pin,
  Calendar,
  Building2,
  FileText,
  AlertCircle,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import {
  Announcement,
  AnnouncementCategory,
  AnnouncementPriority,
  ANNOUNCEMENT_CATEGORY_CONFIG,
  ANNOUNCEMENT_PRIORITY_CONFIG,
} from "@/lib/engagement";

interface AnnouncementManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  userId: string;
  announcement?: Announcement | null;
}

export function AnnouncementManagementModal({
  open,
  onOpenChange,
  organizationId,
  userId,
  announcement,
}: AnnouncementManagementModalProps) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("announcement");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [target, setTarget] = useState<"all" | "department">("all");
  const [targetDepartmentId, setTargetDepartmentId] = useState<string>("");
  const [pinned, setPinned] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  // Query departments
  const { data: departments = [] } = useQuery({
    queryKey: ["org-departments-for-announcements", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (announcement) {
      setTitle(announcement.title);
      setSummary(announcement.summary || "");
      setMessage(announcement.message);
      setCategory(announcement.category);
      setPriority(announcement.priority);
      setTarget(announcement.target === "department" ? "department" : "all");
      setTargetDepartmentId(announcement.target_department_id || "");
      setPinned(announcement.pinned);
      setAttachmentUrl(announcement.attachment_url || "");
      setExpiresAt(announcement.expires_at ? announcement.expires_at.slice(0, 10) : "");
    } else {
      setTitle("");
      setSummary("");
      setMessage("");
      setCategory("announcement");
      setPriority("normal");
      setTarget("all");
      setTargetDepartmentId("");
      setPinned(false);
      setAttachmentUrl("");
      setExpiresAt("");
    }
  }, [announcement, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Title is required.");
      if (!message.trim()) throw new Error("Announcement content is required.");
      if (target === "department" && !targetDepartmentId) {
        throw new Error("Please select a target department.");
      }

      const payload = {
        organization_id: organizationId,
        title: title.trim(),
        summary: summary.trim() || null,
        message: message.trim(),
        category,
        priority,
        target,
        target_department_id: target === "department" ? targetDepartmentId : null,
        pinned,
        attachment_url: attachmentUrl.trim() || null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        created_by: userId,
      };

      if (announcement?.id) {
        const { error } = await supabase
          .from("announcements")
          .update(payload)
          .eq("id", announcement.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("announcements").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcements-engagement"] });
      queryClient.invalidateQueries({ queryKey: ["announcements-list"] });
      toast.success(
        announcement?.id
          ? "Announcement updated successfully."
          : "Announcement published successfully."
      );
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to save announcement.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {announcement?.id ? "Edit Notice / News" : "Broadcast Announcement / News"}
          </DialogTitle>
          <DialogDescription>
            Publish company announcements, internal news circulars, or policy changes to all or targeted departments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title *</Label>
            <Input
              id="ann-title"
              placeholder="Enter announcement title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-category">Category</Label>
              <Select
                value={category}
                onValueChange={(val) => setCategory(val as AnnouncementCategory)}
              >
                <SelectTrigger id="ann-category">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANNOUNCEMENT_CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ann-priority">Priority</Label>
              <Select
                value={priority}
                onValueChange={(val) => setPriority(val as AnnouncementPriority)}
              >
                <SelectTrigger id="ann-priority">
                  <SelectValue placeholder="Select Priority" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANNOUNCEMENT_PRIORITY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Target Audience */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-target">Target Audience</Label>
              <Select
                value={target}
                onValueChange={(val: any) => setTarget(val)}
              >
                <SelectTrigger id="ann-target">
                  <SelectValue placeholder="Select Audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Organization-Wide (All Employees)</SelectItem>
                  <SelectItem value="department">Department-Specific</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {target === "department" && (
              <div className="space-y-1.5">
                <Label htmlFor="ann-dept">Target Department *</Label>
                <Select
                  value={targetDepartmentId}
                  onValueChange={setTargetDepartmentId}
                >
                  <SelectTrigger id="ann-dept">
                    <SelectValue placeholder="Choose Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept: any) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Summary / Excerpt */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-summary">Summary / Teaser (Optional)</Label>
            <Input
              id="ann-summary"
              placeholder="Brief 1-line overview displayed on cards and previews"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>

          {/* Full Message */}
          <div className="space-y-1.5">
            <Label htmlFor="ann-message">Detailed Content *</Label>
            <Textarea
              id="ann-message"
              rows={5}
              placeholder="Provide full announcement details, instructions, agendas, or policy notes..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          {/* Attachment URL & Expiry Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-attachment" className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                Attachment / Link URL (Optional)
              </Label>
              <Input
                id="ann-attachment"
                placeholder="https://drive.google.com/... or media link"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ann-expires" className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Expiry Date (Optional)
              </Label>
              <Input
                id="ann-expires"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          {/* Pin toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/40">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Pin className="h-4 w-4 text-amber-500" /> Pin Notice to Top
              </Label>
              <p className="text-xs text-muted-foreground">
                Pinned items stay anchored at the top of the employee announcement feed.
              </p>
            </div>
            <Switch checked={pinned} onCheckedChange={setPinned} />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="gap-1.5"
          >
            {saveMutation.isPending ? "Publishing..." : announcement?.id ? "Update Notice" : "Publish Announcement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

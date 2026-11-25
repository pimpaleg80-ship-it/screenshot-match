import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Upload, Paperclip, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TICKET_CATEGORIES, TicketPriority } from "@/lib/helpdesk";

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string;
  onSuccess?: () => void;
}

export function CreateTicketDialog({
  open,
  onOpenChange,
  employeeId,
  onSuccess,
}: CreateTicketDialogProps) {
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<string>(TICKET_CATEGORIES[0]);
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setSubject("");
    setCategory(TICKET_CATEGORIES[0]);
    setPriority("medium");
    setDescription("");
    setFile(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!subject.trim()) throw new Error("Please enter a ticket subject");
      if (!description.trim()) throw new Error("Please provide a description of your issue");

      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      let attachmentSize: number | null = null;

      if (file) {
        setIsUploading(true);
        attachmentName = file.name;
        attachmentSize = file.size;
        const fileExt = file.name.split(".").pop();
        const path = `tickets/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from("helpdesk-attachments")
          .upload(path, file);

        if (uploadErr) {
          console.warn("Storage upload warning, fallback to documents:", uploadErr.message);
          // Try upload to documents bucket as fallback if configured
          const { data: docUpload, error: docErr } = await supabase.storage
            .from("documents")
            .upload(`helpdesk/${Date.now()}_${file.name}`, file);
          if (docErr) throw new Error("Failed to upload attachment: " + docErr.message);
          attachmentUrl = docUpload?.path || null;
        } else {
          attachmentUrl = uploadData?.path || null;
        }
      }

      // Call transactional RPC
      const { data, error } = await supabase.rpc("create_hr_ticket", {
        p_subject: subject.trim(),
        p_category: category,
        p_priority: priority,
        p_description: description.trim(),
        p_employee_id: employeeId || null,
        p_attachment_url: attachmentUrl,
        p_attachment_name: attachmentName,
        p_attachment_size: attachmentSize,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Support ticket created successfully");
      resetForm();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["hr-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["my-hr-tickets"] });
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create support ticket");
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            <span>Raise Support Ticket</span>
          </DialogTitle>
          <DialogDescription>
            Submit an attendance complaint, leave query, payroll issue, or general HR request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject" className="text-xs font-semibold">
              Subject <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="ticket-subject"
              placeholder="e.g., Punch missing for Nov 20, or salary tax deduction clarification"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Category & Priority Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Priority</Label>
              <Select
                value={priority}
                onValueChange={(val) => setPriority(val as TicketPriority)}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Standard query)</SelectItem>
                  <SelectItem value="medium">Medium (Requires attention)</SelectItem>
                  <SelectItem value="high">High (Impacting work/pay)</SelectItem>
                  <SelectItem value="urgent">Urgent (Immediate blocker)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ticket-desc" className="text-xs font-semibold">
              Detailed Description <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="ticket-desc"
              rows={4}
              placeholder="Provide exact dates, transaction details, or circumstances to help HR resolve quickly..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm resize-none"
            />
          </div>

          {/* Attachment Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Attachment (Optional)</Label>
            <div className="rounded-lg border border-dashed p-3 bg-muted/20 text-center hover:bg-muted/40 transition-colors">
              {file ? (
                <div className="flex items-center justify-between bg-card p-2 rounded border text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip className="h-4 w-4 text-primary shrink-0" />
                    <span className="truncate font-medium">{file.name}</span>
                    <span className="text-muted-foreground text-[11px]">
                      ({Math.round(file.size / 1024)} KB)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:text-rose-500"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-1" />
                  <span className="text-xs text-primary font-medium hover:underline">
                    Click to attach document, screenshot, or receipt
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    PDF, PNG, JPG, or DOCX (Max 15MB)
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setFile(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending || isUploading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || isUploading || !subject.trim() || !description.trim()}
            className="gap-2"
          >
            {(createMutation.isPending || isUploading) && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            <span>Submit Ticket</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

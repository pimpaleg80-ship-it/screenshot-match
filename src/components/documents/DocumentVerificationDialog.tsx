import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  FileCheck2,
  FileX2,
  CheckCircle2,
  AlertTriangle,
  User,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DocumentItem, getExpiryStatus } from "@/lib/documents";
import { formatDate } from "@/lib/attendance";

interface DocumentVerificationDialogProps {
  document: DocumentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onPreviewClick?: (doc: DocumentItem) => void;
}

export function DocumentVerificationDialog({
  document,
  open,
  onOpenChange,
  onSuccess,
  onPreviewClick,
}: DocumentVerificationDialogProps) {
  const [decision, setDecision] = useState<"verified" | "rejected">("verified");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!document) return null;

  const expiryInfo = getExpiryStatus(document.expiry_date);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (decision === "rejected" && !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejecting this document");
      return;
    }

    setIsSubmitting(true);
    try {
      // Call RPC function or fallback update
      const { data: userAuth } = await supabase.auth.getUser();
      const currentUserId = userAuth?.user?.id;

      const { error } = await supabase
        .from("documents")
        .update({
          verification_status: decision,
          verified_by: currentUserId ?? null,
          verified_at: new Date().toISOString(),
          rejection_reason: decision === "rejected" ? rejectionReason.trim() : null,
        })
        .eq("id", document.id);

      if (error) throw error;

      toast.success(
        decision === "verified"
          ? "Document successfully verified"
          : "Document marked as rejected"
      );
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Verification error:", err);
      toast.error(err.message || "Failed to update verification status");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-primary" />
            <span>Document Verification</span>
          </DialogTitle>
          <DialogDescription>
            Review and certify employee submitted documentation.
          </DialogDescription>
        </DialogHeader>

        {/* Document Brief */}
        <div className="bg-muted/40 rounded-lg p-3.5 border space-y-2 text-xs">
          <div className="flex items-start justify-between gap-2">
            <span className="font-semibold text-foreground text-sm">
              {document.title}
            </span>
            <Badge variant="outline" className="text-[10px]">
              {document.category}
            </Badge>
          </div>

          {document.employees && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="w-3.5 h-3.5 text-foreground" />
              <span className="font-medium text-foreground">
                {document.employees.full_name}
              </span>
              <span>({document.employees.employee_code})</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1 text-muted-foreground border-t border-border/60">
            {document.issue_date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Issued: {formatDate(document.issue_date)}</span>
              </div>
            )}
            {document.expiry_date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Expires: {formatDate(document.expiry_date)}</span>
              </div>
            )}
            {expiryInfo.status !== "no_expiry" && (
              <Badge variant="outline" className={expiryInfo.colorClass + " text-[10px]"}>
                {expiryInfo.label}
              </Badge>
            )}
          </div>

          {onPreviewClick && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="p-0 h-auto text-xs text-primary gap-1 pt-1"
              onClick={() => {
                onOpenChange(false);
                onPreviewClick(document);
              }}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Document Preview
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Decision Buttons */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verification Action
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setDecision("verified")}
                className={`p-3 rounded-lg border text-left transition flex flex-col gap-1.5 ${
                  decision === "verified"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/30"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Verify & Approve</span>
                </div>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Document is authentic and valid.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDecision("rejected")}
                className={`p-3 rounded-lg border text-left transition flex flex-col gap-1.5 ${
                  decision === "rejected"
                    ? "border-rose-500 bg-rose-500/10 text-rose-800 dark:text-rose-300 ring-2 ring-rose-500/30"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <FileX2 className="w-4 h-4 text-rose-600" />
                  <span>Reject</span>
                </div>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  Illegible, expired, or incorrect document.
                </span>
              </button>
            </div>
          </div>

          {/* Rejection Reason textarea if rejected */}
          {decision === "rejected" && (
            <div className="space-y-1.5">
              <Label htmlFor="rejection-reason" className="text-rose-600 dark:text-rose-400">
                Reason for Rejection *
              </Label>
              <Textarea
                id="rejection-reason"
                rows={3}
                placeholder="Explain why this document was rejected"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
              />
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className={
                decision === "rejected"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {isSubmitting
                ? "Processing..."
                : decision === "verified"
                ? "Confirm Verification"
                : "Submit Rejection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

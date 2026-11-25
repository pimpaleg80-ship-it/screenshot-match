import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  ExternalLink,
  FileText,
  FileCheck2,
  Calendar,
  User,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Building2,
  Info,
} from "lucide-react";
import {
  DocumentItem,
  getExpiryStatus,
  getVerificationStatusBadge,
  getSecureDocumentUrl,
  formatFileSize,
  isPreviewableFile,
  getFileExtension,
} from "@/lib/documents";
import { formatDate } from "@/lib/attendance";

interface DocumentPreviewModalProps {
  document: DocumentItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerifyClick?: (doc: DocumentItem) => void;
  canVerify?: boolean;
}

export function DocumentPreviewModal({
  document,
  open,
  onOpenChange,
  onVerifyClick,
  canVerify = false,
}: DocumentPreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string>("");
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);

  useEffect(() => {
    if (!open || !document) {
      setSignedUrl("");
      setZoomLevel(100);
      setRotation(0);
      return;
    }

    let active = true;
    const fetchUrl = async () => {
      setLoadingUrl(true);
      try {
        const url = await getSecureDocumentUrl(
          document.file_url || document.drive_link || ""
        );
        if (active) {
          setSignedUrl(url);
        }
      } catch (err) {
        console.error("Failed to generate secure URL:", err);
      } finally {
        if (active) {
          setLoadingUrl(false);
        }
      }
    };

    fetchUrl();
    return () => {
      active = false;
    };
  }, [open, document]);

  if (!document) return null;

  const expiryInfo = getExpiryStatus(document.expiry_date);
  const verifyInfo = getVerificationStatusBadge(document.verification_status);
  const fileExt = getFileExtension(document.file_name || document.file_url || "");
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(fileExt);
  const isPdf = fileExt === "pdf" || document.mime_type?.includes("pdf");

  const handleDownload = () => {
    if (!signedUrl) return;
    const a = window.document.createElement("a");
    a.href = signedUrl;
    a.download = document.file_name || document.title || "document";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border shadow-2xl">
        {/* Header Bar */}
        <DialogHeader className="p-4 sm:p-5 border-b bg-card/60 space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold leading-tight flex items-center gap-2">
                  <span>{document.title}</span>
                  {document.is_confidential && (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-xs">
                      Confidential
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                  <span>{document.category || "General"}</span>
                  {document.file_size && (
                    <>
                      <span>•</span>
                      <span>{formatFileSize(document.file_size)}</span>
                    </>
                  )}
                  {document.version && (
                    <>
                      <span>•</span>
                      <span>v{document.version}.0</span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className={verifyInfo.colorClass}>
                {verifyInfo.label}
              </Badge>
              {expiryInfo.status !== "no_expiry" && (
                <Badge variant="outline" className={expiryInfo.colorClass}>
                  {expiryInfo.label}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content Body: Preview Area */}
        <div className="flex-1 overflow-auto bg-muted/30 p-4 flex flex-col items-center justify-center min-h-[360px] max-h-[58vh]">
          {loadingUrl ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8">
              <Skeleton className="w-full h-72 rounded-lg" />
              <p className="text-xs text-muted-foreground animate-pulse">
                Generating secure temporary access token...
              </p>
            </div>
          ) : !signedUrl ? (
            <div className="text-center p-8 max-w-md space-y-3">
              <ShieldAlert className="w-12 h-12 text-muted-foreground mx-auto" />
              <h4 className="font-semibold text-foreground">File unavailable</h4>
              <p className="text-sm text-muted-foreground">
                The document file could not be retrieved from secure storage or no file is attached.
              </p>
            </div>
          ) : isPdf ? (
            <div className="w-full h-full min-h-[480px]">
              <iframe
                src={`${signedUrl}#toolbar=1`}
                title={document.title}
                className="w-full h-[52vh] rounded-lg border bg-white shadow-sm"
              />
            </div>
          ) : isImage ? (
            <div className="w-full h-full flex flex-col items-center justify-center relative group">
              <div className="overflow-auto max-h-[52vh] max-w-full rounded-lg border bg-card p-2 shadow-sm flex items-center justify-center">
                <img
                  src={signedUrl}
                  alt={document.title}
                  style={{
                    transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                    transition: "transform 0.2s ease-out",
                  }}
                  className="max-h-[46vh] max-w-full object-contain select-none"
                />
              </div>

              {/* Image Controls toolbar */}
              <div className="mt-2 flex items-center gap-1 bg-background/90 backdrop-blur border rounded-lg px-2 py-1 shadow-sm text-xs">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setZoomLevel((z) => Math.max(z - 25, 50))}
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <span className="px-2 font-mono text-[11px] min-w-10 text-center">
                  {zoomLevel}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setZoomLevel((z) => Math.min(z + 25, 200))}
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <div className="w-px h-4 bg-border mx-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  title="Rotate"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            /* Non-previewable file (Word, Excel, Zip, etc.) */
            <div className="text-center p-8 max-w-md bg-card rounded-lg border shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-foreground text-base">
                  {document.file_name || document.title}
                </h4>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
                  {fileExt.toUpperCase()} FILE • {formatFileSize(document.file_size)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This file format cannot be rendered directly in the browser preview. Download the file or open it in your desktop application.
                </p>
              </div>
              <Button onClick={handleDownload} className="w-full gap-2">
                <Download className="w-4 h-4" />
                Download File
              </Button>
            </div>
          )}
        </div>

        {/* Rejection notice if rejected */}
        {document.verification_status === "rejected" && document.rejection_reason && (
          <div className="bg-rose-500/10 border-y border-rose-500/20 px-5 py-2.5 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Rejection Note: </span>
              {document.rejection_reason}
            </div>
          </div>
        )}

        {/* Footer with Metadata & Actions */}
        <div className="p-4 sm:p-5 border-t bg-card/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {document.employees && (
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  {document.employees.full_name} ({document.employees.employee_code})
                </span>
                {document.employees.departments?.name && (
                  <span className="text-muted-foreground">
                    • {document.employees.departments.name}
                  </span>
                )}
              </div>
            )}
            {document.issue_date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Issued: {formatDate(document.issue_date)}</span>
              </div>
            )}
            {document.expiry_date && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Expires: {formatDate(document.expiry_date)}</span>
              </div>
            )}
            <div>
              Uploaded: {formatDate(document.created_at)}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {canVerify && onVerifyClick && document.verification_status !== "verified" && (
              <Button
                variant="outline"
                className="gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                onClick={() => {
                  onOpenChange(false);
                  onVerifyClick(document);
                }}
              >
                <FileCheck2 className="w-4 h-4" />
                Verify / Review
              </Button>
            )}

            {document.drive_link && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => window.open(document.drive_link!, "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Drive Link
              </Button>
            )}

            {signedUrl && (
              <Button size="sm" onClick={handleDownload} className="gap-1.5">
                <Download className="w-3.5 h-3.5" />
                Download
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

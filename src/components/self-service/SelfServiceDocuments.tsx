import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Download,
  Search,
  Filter,
  Eye,
  PlusCircle,
  FileCheck,
  Shield,
  Loader2,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/attendance";
import {
  DocumentItem,
  getExpiryStatus,
  getVerificationStatusBadge,
  formatFileSize,
  getSecureDocumentUrl,
} from "@/lib/documents";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";

interface SelfServiceDocumentsProps {
  employeeId: string;
}

export function SelfServiceDocuments({ employeeId }: SelfServiceDocumentsProps) {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "personal" | "company">("all");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Preview modal
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Query documents: both personal (employee_id = employeeId) and company-wide (employee_id IS NULL or is_company_policy = true)
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["my-documents-portal", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          employees:employee_id (
            id,
            full_name,
            employee_code
          )
        `)
        .or(`employee_id.eq.${employeeId},employee_id.is.null,is_company_policy.eq.true`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DocumentItem[];
    },
    enabled: !!employeeId,
  });

  // Filtered documents
  const filteredDocs = documents.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      d.title.toLowerCase().includes(q) ||
      (d.category && d.category.toLowerCase().includes(q)) ||
      (d.description && d.description.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    if (filterType === "personal") return d.employee_id === employeeId;
    if (filterType === "company") return !d.employee_id || d.is_company_policy;
    return true;
  });

  const handleDownload = async (doc: DocumentItem) => {
    try {
      const url = await getSecureDocumentUrl(doc.file_url || doc.drive_link || "");
      if (!url) {
        toast.error("Download link unavailable");
        return;
      }
      const a = window.document.createElement("a");
      a.href = url;
      a.download = doc.file_name || doc.title || "document";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
    } catch (err: any) {
      toast.error(err.message || "Failed to download document");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Document Repository
              </CardTitle>
              <CardDescription className="text-xs">
                Access official company policies, appointment letters, and personal employment records.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setUploadModalOpen(true)}
              className="gap-1.5 text-xs h-8"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Upload Document
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search documents by title or category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1.5">
              <Button
                variant={filterType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("all")}
                className="text-xs h-8 px-2.5"
              >
                All ({documents.length})
              </Button>
              <Button
                variant={filterType === "personal" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("personal")}
                className="text-xs h-8 px-2.5"
              >
                My Documents ({documents.filter((d) => d.employee_id === employeeId).length})
              </Button>
              <Button
                variant={filterType === "company" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("company")}
                className="text-xs h-8 px-2.5"
              >
                Company Policies ({documents.filter((d) => !d.employee_id || d.is_company_policy).length})
              </Button>
            </div>
          </div>

          {/* Documents Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12 border rounded-lg border-dashed space-y-2">
              <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold">No documents found</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No matching company policies or personal records are currently on file.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredDocs.map((doc) => {
                const isPersonal = doc.employee_id === employeeId;
                const verify = getVerificationStatusBadge(doc.verification_status);
                const expiry = getExpiryStatus(doc.expiry_date);

                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-lg border bg-card hover:border-primary/40 transition flex flex-col justify-between space-y-3 group"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {doc.category || (isPersonal ? "Personal" : "Policy")}
                        </span>
                        <div className="flex items-center gap-1">
                          {isPersonal ? (
                            <Badge variant="outline" className={verify.colorClass + " text-[10px]"}>
                              {verify.label}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                              Company
                            </Badge>
                          )}
                        </div>
                      </div>

                      <h4 className="font-semibold text-sm text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {doc.title}
                      </h4>

                      {doc.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {doc.description}
                        </p>
                      )}

                      {/* Expiry / Verification notice */}
                      {doc.expiry_date && (
                        <div className="pt-1">
                          <Badge variant="outline" className={expiry.colorClass + " text-[10px]"}>
                            {expiry.label}
                          </Badge>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{formatDate(doc.created_at)}</span>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => {
                            setPreviewDoc(doc);
                            setPreviewOpen(true);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleDownload(doc)}
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <DocumentUploadDialog
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        fixedEmployeeId={employeeId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["my-documents-portal"] });
        }}
      />

      {/* Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}

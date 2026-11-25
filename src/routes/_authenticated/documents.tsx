import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  FolderOpen,
  Search,
  Filter,
  Eye,
  FileCheck2,
  ShieldAlert,
  Calendar,
  User,
  Building2,
  ExternalLink,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { PageContainer, PageHeader, TableContainer } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DocumentItem,
  getExpiryStatus,
  getVerificationStatusBadge,
  formatFileSize,
  getSecureDocumentUrl,
} from "@/lib/documents";
import { formatDate } from "@/lib/attendance";
import { DocumentPreviewModal } from "@/components/documents/DocumentPreviewModal";
import { DocumentUploadDialog } from "@/components/documents/DocumentUploadDialog";
import { DocumentVerificationDialog } from "@/components/documents/DocumentVerificationDialog";
import { DocumentExpiryLedger } from "@/components/documents/DocumentExpiryLedger";

export const Route = createFileRoute("/_authenticated/documents")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Document Management — Flowpeople" },
      {
        name: "description",
        content:
          "Corporate policies, employee identity documents, certificates, contracts, and expiry tracking.",
      },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"corporate" | "employee_docs" | "expiry_tracker">("corporate");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");

  // Modals state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<"corporate" | "employee">("corporate");
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [verifyDoc, setVerifyDoc] = useState<DocumentItem | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const isAdminOrHR =
    session.isAdmin ||
    session.isSuperadmin ||
    session.roles.includes("admin") ||
    session.roles.includes("hr");

  // Fetch all accessible documents
  const {
    data: documents = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["all-documents-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select(`
          *,
          employees:employee_id (
            id,
            full_name,
            employee_code,
            department_id,
            departments:department_id (
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as unknown as DocumentItem[];
    },
  });

  // Separate documents into corporate vs employee documents
  const corporateDocs = documents.filter(
    (d) => d.is_company_policy || (!d.employee_id && d.category !== "ID_DOC")
  );

  const employeeDocs = documents.filter(
    (d) => Boolean(d.employee_id) || (!d.is_company_policy && d.employee_id)
  );

  // Expired / expiring count for tab badge
  const expiringCount = documents.filter((d) => {
    if (!d.expiry_date) return false;
    const info = getExpiryStatus(d.expiry_date);
    return info.status === "expired" || info.status === "expiring_soon";
  }).length;

  const pendingVerificationCount = documents.filter(
    (d) => d.verification_status === "pending_verification" && d.employee_id
  ).length;

  // Filter corporate docs
  const filteredCorporate = corporateDocs.filter((doc) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchDesc = doc.description?.toLowerCase().includes(q);
      const matchCat = doc.category?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat) return false;
    }
    if (categoryFilter !== "all" && doc.category !== categoryFilter) return false;
    return true;
  });

  // Filter employee docs
  const filteredEmployeeDocs = employeeDocs.filter((doc) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchEmp = doc.employees?.full_name?.toLowerCase().includes(q);
      const matchCode = doc.employees?.employee_code?.toLowerCase().includes(q);
      const matchCat = doc.category?.toLowerCase().includes(q);
      if (!matchTitle && !matchEmp && !matchCode && !matchCat) return false;
    }
    if (categoryFilter !== "all" && doc.category !== categoryFilter) return false;
    if (
      verificationFilter !== "all" &&
      doc.verification_status !== verificationFilter
    )
      return false;
    return true;
  });

  const handleOpenPreview = (doc: DocumentItem) => {
    setPreviewDoc(doc);
    setPreviewOpen(true);
  };

  const handleOpenVerify = (doc: DocumentItem) => {
    setVerifyDoc(doc);
    setVerifyOpen(true);
  };

  const handleDirectDownload = async (doc: DocumentItem) => {
    try {
      const url = await getSecureDocumentUrl(doc.file_url || doc.drive_link || "");
      if (!url) {
        toast.error("Document download link unavailable");
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
      toast.error(err.message || "Failed to download");
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["all-documents-list"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to delete document");
    },
  });

  return (
    <PageContainer maxWidth="wide">
      <PageHeader
        breadcrumbs={[{ label: "Document Vault" }]}
        title="Document Management"
        description="Central repository for company policies, employee identity documents, contracts, and expiry monitoring."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5 h-9 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </Button>

            {isAdminOrHR && (
              <Button
                size="sm"
                onClick={() => {
                  setUploadMode(
                    activeTab === "corporate" ? "corporate" : "employee"
                  );
                  setUploadOpen(true);
                }}
                className="gap-1.5 h-9 text-xs font-semibold"
              >
                <Upload className="w-4 h-4" />
                <span>
                  {activeTab === "corporate"
                    ? "Upload Corporate Policy"
                    : "Upload Employee Document"}
                </span>
              </Button>
            )}
          </>
        }
      />

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as any)}
        className="space-y-6"
      >
        <TabsList className="grid grid-cols-3 max-w-xl h-11 bg-muted/60 p-1">
          <TabsTrigger value="corporate" className="text-xs sm:text-sm gap-2">
            <Building2 className="w-4 h-4" />
            <span>Corporate Policies</span>
          </TabsTrigger>

          <TabsTrigger value="employee_docs" className="text-xs sm:text-sm gap-2 relative">
            <User className="w-4 h-4" />
            <span>Employee Docs</span>
            {pendingVerificationCount > 0 && (
              <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-amber-500 hover:bg-amber-600 text-white">
                {pendingVerificationCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger value="expiry_tracker" className="text-xs sm:text-sm gap-2 relative">
            <Calendar className="w-4 h-4" />
            <span>Expiry Alerts</span>
            {expiringCount > 0 && (
              <Badge className="ml-1 px-1.5 py-0 text-[10px] bg-rose-500 hover:bg-rose-600 text-white">
                {expiringCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CORPORATE POLICIES & HANDBOOKS */}
        <TabsContent value="corporate" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search policies, handbooks, forms..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48 h-9 text-xs">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="Policy">Policy</SelectItem>
                  <SelectItem value="Handbook">Handbook</SelectItem>
                  <SelectItem value="Form">Form / Template</SelectItem>
                  <SelectItem value="Guide">Guide / Manual</SelectItem>
                  <SelectItem value="General">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-44 rounded-lg" />
              ))}
            </div>
          ) : filteredCorporate.length === 0 ? (
            <Card className="p-12 text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground text-base">
                No corporate documents found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Upload official company handbooks, leave policies, IT usage guides, and benefit structures.
              </p>
              {isAdminOrHR && (
                <Button
                  size="sm"
                  onClick={() => {
                    setUploadMode("corporate");
                    setUploadOpen(true);
                  }}
                  className="mt-4 gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  Upload First Policy
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCorporate.map((doc) => (
                <Card
                  key={doc.id}
                  className="hover:border-primary/40 transition group flex flex-col justify-between"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <Badge variant="outline" className="text-[11px]">
                        {doc.category || "Policy"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold leading-snug mt-2 line-clamp-1 group-hover:text-primary transition-colors">
                      {doc.title}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2 mt-1">
                      {doc.description || "Official company document for organizational reference."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 border-t mt-auto">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span>{formatDate(doc.created_at)}</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full gap-1.5 text-xs h-8"
                        onClick={() => handleOpenPreview(doc)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5"
                        onClick={() => handleDirectDownload(doc)}
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {isAdminOrHR && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this document?")) {
                              deleteMutation.mutate(doc.id);
                            }
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2: EMPLOYEE DOCUMENTS LEDGER */}
        <TabsContent value="employee_docs" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-lg border">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employee name, code, document..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Select
                value={verificationFilter}
                onValueChange={setVerificationFilter}
              >
                <SelectTrigger className="w-full sm:w-44 h-9 text-xs">
                  <SelectValue placeholder="Verification Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Verification</SelectItem>
                  <SelectItem value="pending_verification">Pending Only</SelectItem>
                  <SelectItem value="verified">Verified Only</SelectItem>
                  <SelectItem value="rejected">Rejected Only</SelectItem>
                </SelectContent>
              </Select>

              {isAdminOrHR && (
                <Button
                  size="sm"
                  className="h-9 gap-1.5 text-xs ml-auto"
                  onClick={() => {
                    setUploadMode("employee");
                    setUploadOpen(true);
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Upload Document
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : filteredEmployeeDocs.length === 0 ? (
                <div className="p-12 text-center space-y-2">
                  <User className="w-10 h-10 text-muted-foreground mx-auto" />
                  <h3 className="font-semibold text-foreground">
                    No employee documents found
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Upload employee IDs, education certificates, contracts, and tax documents.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Employee</TableHead>
                        <TableHead>Document Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead>Expiry Status</TableHead>
                        <TableHead>Uploaded On</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployeeDocs.map((doc) => {
                        const verify = getVerificationStatusBadge(
                          doc.verification_status
                        );
                        const expiry = getExpiryStatus(doc.expiry_date);

                        return (
                          <TableRow key={doc.id} className="hover:bg-muted/40">
                            {/* Employee */}
                            <TableCell>
                              {doc.employees ? (
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                                    {doc.employees.full_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {doc.employees.employee_code}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  Unassigned
                                </span>
                              )}
                            </TableCell>

                            {/* Document Title */}
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="font-medium text-foreground text-sm flex items-center gap-1.5">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                  <span>{doc.title}</span>
                                  {doc.is_confidential && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-amber-500/30 text-amber-600 bg-amber-500/10"
                                    >
                                      Confidential
                                    </Badge>
                                  )}
                                </p>
                                {doc.file_name && (
                                  <p className="text-xs text-muted-foreground truncate max-w-xs">
                                    {doc.file_name} ({formatFileSize(doc.file_size)})
                                  </p>
                                )}
                              </div>
                            </TableCell>

                            {/* Category */}
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {doc.category}
                              </Badge>
                            </TableCell>

                            {/* Verification */}
                            <TableCell>
                              <Badge variant="outline" className={verify.colorClass}>
                                {verify.label}
                              </Badge>
                            </TableCell>

                            {/* Expiry Status */}
                            <TableCell>
                              <Badge variant="outline" className={expiry.colorClass}>
                                {expiry.label}
                              </Badge>
                            </TableCell>

                            {/* Uploaded On */}
                            <TableCell className="text-xs text-muted-foreground font-mono">
                              {formatDate(doc.created_at)}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleOpenPreview(doc)}
                                  title="Preview"
                                >
                                  <Eye className="w-4 h-4 text-foreground" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleDirectDownload(doc)}
                                  title="Download"
                                >
                                  <Download className="w-4 h-4 text-muted-foreground" />
                                </Button>

                                {isAdminOrHR &&
                                  doc.verification_status !== "verified" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 text-xs text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 dark:text-emerald-400 gap-1 ml-1"
                                      onClick={() => handleOpenVerify(doc)}
                                    >
                                      <FileCheck2 className="w-3.5 h-3.5" />
                                      Review
                                    </Button>
                                  )}

                                {isAdminOrHR && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          "Are you sure you want to delete this document?"
                                        )
                                      ) {
                                        deleteMutation.mutate(doc.id);
                                      }
                                    }}
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: EXPIRY TRACKER & ALERTS */}
        <TabsContent value="expiry_tracker">
          <DocumentExpiryLedger
            documents={documents}
            onPreview={handleOpenPreview}
            onVerify={handleOpenVerify}
            canVerify={isAdminOrHR}
          />
        </TabsContent>
      </Tabs>

      {/* Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onVerifyClick={handleOpenVerify}
        canVerify={isAdminOrHR}
      />

      {/* Upload Dialog */}
      <DocumentUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["all-documents-list"] });
        }}
        isCompanyPolicyMode={uploadMode === "corporate"}
        defaultCategory={uploadMode === "corporate" ? "Policy" : "ID_DOC"}
      />

      {/* Verification Dialog */}
      <DocumentVerificationDialog
        document={verifyDoc}
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["all-documents-list"] });
        }}
        onPreviewClick={handleOpenPreview}
      />
    </PageContainer>
  );
}

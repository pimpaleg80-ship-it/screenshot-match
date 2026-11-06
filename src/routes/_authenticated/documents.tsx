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
  HardDrive,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/documents")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Company Documents — Flowpeople by Fluxora" },
      {
        name: "description",
        content: "Corporate policies, employee handbooks, and official forms.",
      },
    ],
  }),
  component: DocumentsPage,
});

interface DocumentRow {
  id: string;
  title: string;
  category: string;
  description: string | null;
  file_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  drive_file_id: string | null;
  drive_link: string | null;
  created_at: string;
}

const CATEGORIES = ["All", "Policy", "Form", "Handbook", "Guide", "General"];

function DocumentsPage() {
  const session = useSession();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState("All");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "Policy",
    description: "",
    drive_link: "",
  });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DocumentRow[];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!formData.title.trim()) throw new Error("Document title is required");

      let fileUrl = formData.drive_link.trim() || null;
      let fileSize: number | null = null;
      let mimeType: string | null = null;

      if (uploadFile) {
        fileSize = uploadFile.size;
        mimeType = uploadFile.type;
        const fileExt = uploadFile.name.split(".").pop();
        const filePath = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { data: storageData, error: storageErr } = await supabase.storage
          .from("documents")
          .upload(filePath, uploadFile);

        if (storageErr) throw storageErr;

        const { data: publicUrlData } = supabase.storage
          .from("documents")
          .getPublicUrl(storageData.path);

        fileUrl = publicUrlData.publicUrl;
      }

      if (!fileUrl) {
        throw new Error("Please upload a document file or provide a Google Drive share link.");
      }

      const { error } = await supabase.from("documents").insert({
        title: formData.title.trim(),
        category: formData.category,
        description: formData.description.trim() || null,
        file_url: fileUrl,
        file_size: fileSize,
        mime_type: mimeType,
        drive_link: formData.drive_link.trim() || null,
        uploaded_by: session.user?.id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document uploaded to corporate library");
      setUploadModalOpen(false);
      setUploadFile(null);
      setFormData({
        title: "",
        category: "Policy",
        description: "",
        drive_link: "",
      });
      queryClient.invalidateQueries({ queryKey: ["documents-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to upload document");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document deleted");
      queryClient.invalidateQueries({ queryKey: ["documents-list"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete document");
    },
  });

  const canUpload = session.isAdmin || session.isManager;

  const filteredDocs = documents.filter((d) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      d.title.toLowerCase().includes(q) ||
      (d.description && d.description.toLowerCase().includes(q));
    const matchesCat =
      selectedCat === "All" || d.category.toLowerCase() === selectedCat.toLowerCase();
    return matchesSearch && matchesCat;
  });

  function formatBytes(bytes: number | null) {
    if (!bytes) return "";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function formatDate(iso: string) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6 p-3 sm:p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
            Company Documents
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
            Official repository for corporate policies, leave forms, handbooks, and guidelines.
          </p>
        </div>
        {canUpload && (
          <Button
            onClick={() => setUploadModalOpen(true)}
            className="gap-2 w-full sm:w-auto text-xs h-9"
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </Button>
        )}
      </div>

      {/* Categories Tabs & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={selectedCat === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCat(cat)}
              className="rounded-full text-xs h-8"
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/30" />
            <p className="mt-2 text-sm font-medium">No documents found</p>
            <p className="text-xs text-muted-foreground">
              Official documents uploaded for your organization will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filteredDocs.map((doc) => {
            const hasDrive = !!doc.drive_link || !!doc.drive_file_id;
            return (
              <Card
                key={doc.id}
                className="flex flex-col justify-between transition-all hover:shadow-soft"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="text-[11px] capitalize">
                      {doc.category}
                    </Badge>
                  </div>
                  <CardTitle className="text-base line-clamp-1 mt-2">{doc.title}</CardTitle>
                  {doc.description && (
                    <CardDescription className="line-clamp-2 text-xs">
                      {doc.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                    <span>{formatDate(doc.created_at)}</span>
                    {doc.file_size ? <span>{formatBytes(doc.file_size)}</span> : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {doc.file_url && (
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </a>
                        </Button>
                      )}

                      {hasDrive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
                          asChild
                        >
                          <a
                            href={
                              doc.drive_link ||
                              `https://drive.google.com/file/d/${doc.drive_file_id}/view`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <HardDrive className="h-3.5 w-3.5" />
                            Drive
                          </a>
                        </Button>
                      )}
                    </div>

                    {session.isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${doc.title}"?`)) {
                            deleteMutation.mutate(doc.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Add a policy, handbook, or official form to the corporate directory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Document Title</Label>
              <Input
                id="doc-title"
                placeholder="e.g. Employee Code of Conduct 2026"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
              >
                <option value="Policy">Policy</option>
                <option value="Form">Form</option>
                <option value="Handbook">Handbook</option>
                <option value="Guide">Guide</option>
                <option value="General">General</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-desc">Description (Optional)</Label>
              <Input
                id="doc-desc"
                placeholder="Brief summary of what this document covers"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-file">Upload PDF or Document</Label>
              <Input
                id="doc-file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setUploadFile(file);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="doc-drive">Google Drive Link (Optional)</Label>
              <Input
                id="doc-drive"
                placeholder="https://drive.google.com/..."
                value={formData.drive_link}
                onChange={(e) => setFormData((prev) => ({ ...prev, drive_link: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => uploadMutation.mutate()} disabled={uploadMutation.isPending}>
              {uploadMutation.isPending ? "Uploading..." : "Save Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

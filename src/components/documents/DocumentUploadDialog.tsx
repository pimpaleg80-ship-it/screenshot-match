import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { useQuery } from "@tanstack/react-query";
import { DocumentCategory, formatFileSize } from "@/lib/documents";

interface DocumentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  fixedEmployeeId?: string | null;
  defaultCategory?: string;
  isCompanyPolicyMode?: boolean;
}

export function DocumentUploadDialog({
  open,
  onOpenChange,
  onSuccess,
  fixedEmployeeId,
  defaultCategory = "ID_DOC",
  isCompanyPolicyMode = false,
}: DocumentUploadDialogProps) {
  const session = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [categoryCode, setCategoryCode] = useState(defaultCategory);
  const [employeeId, setEmployeeId] = useState<string>(fixedEmployeeId || "");
  const [description, setDescription] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isConfidential, setIsConfidential] = useState(false);
  const [isCompanyPolicy, setIsCompanyPolicy] = useState(isCompanyPolicyMode);
  const [driveLink, setDriveLink] = useState("");

  const isAdminOrHR =
    session.isAdmin ||
    session.isSuperadmin ||
    session.roles.includes("admin") ||
    session.roles.includes("hr");

  // Load document categories
  const { data: categories = [] } = useQuery({
    queryKey: ["document-categories-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_categories")
        .select("*")
        .order("name", { ascending: true });
      if (error) {
        console.warn("Could not load categories table, using defaults:", error.message);
        return [
          { id: "1", code: "ID_DOC", name: "Identity Document" },
          { id: "2", code: "EDU_CERT", name: "Educational Certificate" },
          { id: "3", code: "EXP_CERT", name: "Experience Certificate" },
          { id: "4", code: "EMP_AGMT", name: "Employment Agreement / Offer Letter" },
          { id: "5", code: "COMPANY_POLICY", name: "Company Policy / Handbook" },
          { id: "6", code: "FIN_TAX", name: "Financial & Tax Document" },
          { id: "7", code: "OTHER", name: "Other Document" },
        ] as DocumentCategory[];
      }
      return (data ?? []) as DocumentCategory[];
    },
  });

  // Load employees for selection if HR/Admin and not fixed
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-upload-picker"],
    enabled: isAdminOrHR && !fixedEmployeeId && !isCompanyPolicyMode,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, employee_code, email")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Sync fixedEmployeeId or session employee
  useEffect(() => {
    if (fixedEmployeeId) {
      setEmployeeId(fixedEmployeeId);
    } else if (!isAdminOrHR && session.user?.id) {
      // Find current employee id
      supabase
        .from("employees")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.id) setEmployeeId(data.id);
        });
    }
  }, [fixedEmployeeId, isAdminOrHR, session.user?.id]);

  useEffect(() => {
    if (open) {
      setTitle("");
      setSelectedFile(null);
      setDescription("");
      setIssueDate("");
      setExpiryDate("");
      setDriveLink("");
      setCategoryCode(defaultCategory);
      setIsCompanyPolicy(isCompanyPolicyMode);
      if (fixedEmployeeId) setEmployeeId(fixedEmployeeId);
    }
  }, [open, defaultCategory, fixedEmployeeId, isCompanyPolicyMode]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Max 25MB
      if (file.size > 25 * 1024 * 1024) {
        toast.error("File size cannot exceed 25MB");
        return;
      }
      setSelectedFile(file);
      if (!title) {
        // Default title to filename without extension
        const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        setTitle(baseName.replace(/[_-]/g, " "));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a document title");
      return;
    }

    if (!selectedFile && !driveLink.trim()) {
      toast.error("Please upload a file or provide a cloud Drive link");
      return;
    }

    setIsSubmitting(true);
    try {
      let fileStoragePath = "";
      const fileSize = selectedFile?.size || null;
      const mimeType = selectedFile?.type || null;
      const fileName = selectedFile?.name || null;

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop();
        const safeBase = selectedFile.name
          .replace(/[^a-zA-Z0-9.-]/g, "_")
          .substring(0, 40);
        fileStoragePath = `uploads/${Date.now()}_${safeBase}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(fileStoragePath, selectedFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          // If "documents" bucket fails, try "employee-documents"
          const fallbackPath = `${Date.now()}_${safeBase}`;
          const { error: fallbackError } = await supabase.storage
            .from("employee-documents")
            .upload(fallbackPath, selectedFile);
          if (fallbackError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }
          fileStoragePath = fallbackPath;
        }
      }

      // Find category record ID if any
      const matchingCategory = categories.find(
        (c) => c.code === categoryCode || c.id === categoryCode
      );

      // Default verification status: if uploaded by Admin/HR, verified immediately, otherwise pending
      const verificationStatus = isAdminOrHR ? "verified" : "pending_verification";

      const { error: insertError } = await supabase.from("documents").insert({
        title: title.trim(),
        category: matchingCategory?.name || categoryCode,
        category_id: matchingCategory?.id || null,
        description: description.trim() || null,
        file_url: fileStoragePath || driveLink.trim(),
        file_name: fileName,
        file_size: fileSize,
        mime_type: mimeType,
        drive_link: driveLink.trim() || null,
        employee_id: isCompanyPolicy ? null : employeeId || null,
        uploaded_by: session.user?.id || null,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        is_confidential: isConfidential,
        is_company_policy: isCompanyPolicy,
        verification_status: verificationStatus,
        verified_by: isAdminOrHR ? (session.user?.id ?? null) : null,
        verified_at: isAdminOrHR ? new Date().toISOString() : null,
      });

      if (insertError) throw insertError;

      toast.success("Document uploaded successfully");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Failed to upload document");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            <span>
              {isCompanyPolicyMode
                ? "Upload Corporate Policy / Document"
                : "Upload Employee Document"}
            </span>
          </DialogTitle>
          <DialogDescription>
            {isCompanyPolicyMode
              ? "Publish company policies, handbooks, guidelines, and compliance resources."
              : "Upload identity papers, certificates, employment contracts, or financial records."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* File Upload Drop Area */}
          <div className="space-y-1.5">
            <Label>Choose File</Label>
            <div className="border-2 border-dashed rounded-lg p-5 text-center hover:bg-muted/30 transition cursor-pointer relative bg-card">
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.txt"
              />
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                {selectedFile ? (
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)} • Click to replace
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Click or drag file here
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PDF, PNG, JPG, DOCX, XLSX up to 25MB
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-title">Document Title *</Label>
            <Input
              id="doc-title"
              placeholder="e.g. Passport Copy, Degree Certificate, Offer Letter"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Category & Employee Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category *</Label>
              <Select value={categoryCode} onValueChange={setCategoryCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.code || c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="OTHER">Other / Miscellaneous</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isCompanyPolicy && isAdminOrHR && !fixedEmployeeId && (
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Issue Date & Expiry Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="issue-date">Issue Date</Label>
              <Input
                id="issue-date"
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="expiry-date">Expiry Date</Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty if document does not expire
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-desc">Description / Notes</Label>
            <Textarea
              id="doc-desc"
              rows={2}
              placeholder="Optional notes or remarks regarding this document..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Cloud / Drive Link Fallback */}
          <div className="space-y-1.5">
            <Label htmlFor="drive-link">Cloud / Google Drive Link (Optional)</Label>
            <Input
              id="drive-link"
              type="url"
              placeholder="https://drive.google.com/..."
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
            />
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Confidential Document</Label>
                <p className="text-xs text-muted-foreground">
                  Restricted to HR Admin and employee only
                </p>
              </div>
              <Switch
                checked={isConfidential}
                onCheckedChange={setIsConfidential}
              />
            </div>

            {isAdminOrHR && !fixedEmployeeId && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Company Policy / Handbook</Label>
                  <p className="text-xs text-muted-foreground">
                    Available organization-wide in corporate documents library
                  </p>
                </div>
                <Switch
                  checked={isCompanyPolicy}
                  onCheckedChange={setIsCompanyPolicy}
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              <Upload className="w-4 h-4" />
              {isSubmitting ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/attendance";

export interface DocumentCategory {
  id: string;
  organization_id?: string | null;
  name: string;
  code?: string | null;
  description?: string | null;
  is_system?: boolean;
  requires_expiry?: boolean;
  requires_verification?: boolean;
  color?: string | null;
  created_at?: string;
}

export type DocumentVerificationStatus = "pending_verification" | "verified" | "rejected";

export type DocumentExpiryStatus = "valid" | "expiring_soon" | "expired" | "no_expiry";

export interface DocumentItem {
  id: string;
  title: string;
  category: string;
  category_id?: string | null;
  document_type?: string | null;
  file_url: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  employee_id?: string | null;
  uploaded_by?: string | null;
  description?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  verification_status?: DocumentVerificationStatus | string;
  verified_by?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  is_company_policy?: boolean;
  is_confidential?: boolean;
  target_department_id?: string | null;
  version?: number;
  drive_file_id?: string | null;
  drive_link?: string | null;
  created_at: string;
  updated_at?: string | null;
  employees?: {
    id: string;
    full_name: string;
    employee_code: string;
    department_id?: string | null;
    departments?: { name: string } | null;
  } | null;
  document_categories?: DocumentCategory | null;
}

/**
 * Calculates document expiry status and days remaining.
 */
export function getExpiryStatus(expiryDateStr?: string | null): {
  status: DocumentExpiryStatus;
  daysRemaining: number | null;
  label: string;
  colorClass: string;
} {
  if (!expiryDateStr) {
    return {
      status: "no_expiry",
      daysRemaining: null,
      label: "No Expiration",
      colorClass: "bg-muted text-muted-foreground border-border",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(expiryDateStr + "T00:00:00");
  const diffTime = expiry.getTime() - today.getTime();
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return {
      status: "expired",
      daysRemaining: days,
      label: `Expired ${Math.abs(days)}d ago`,
      colorClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
    };
  }

  if (days <= 30) {
    return {
      status: "expiring_soon",
      daysRemaining: days,
      label: days === 0 ? "Expires today" : `Expires in ${days}d`,
      colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold",
    };
  }

  return {
    status: "valid",
    daysRemaining: days,
    label: `Valid (${formatDate(expiryDateStr)})`,
    colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  };
}

/**
 * Returns UI metadata for document verification status.
 */
export function getVerificationStatusBadge(status?: string | null): {
  label: string;
  colorClass: string;
  variant: "verified" | "pending" | "rejected";
} {
  if (status === "verified") {
    return {
      label: "Verified",
      colorClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      variant: "verified",
    };
  }

  if (status === "rejected") {
    return {
      label: "Rejected",
      colorClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
      variant: "rejected",
    };
  }

  return {
    label: "Pending Verification",
    colorClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    variant: "pending",
  };
}

/**
 * Generates a secure, temporary signed URL for a file stored in private Supabase Storage.
 */
export async function getSecureDocumentUrl(pathOrUrl: string, bucket = "documents"): Promise<string> {
  if (!pathOrUrl) return "";

  // If already a signed URL or external cloud URL (e.g. Google Drive)
  if (pathOrUrl.startsWith("http") && !pathOrUrl.includes("supabase.co/storage")) {
    return pathOrUrl;
  }

  let storagePath = pathOrUrl;

  // Extract relative path if passed a full public supabase storage URL
  if (pathOrUrl.includes("/storage/v1/object/public/") || pathOrUrl.includes("/storage/v1/object/sign/")) {
    const parts = pathOrUrl.split(`/${bucket}/`);
    if (parts.length > 1 && parts[1]) {
      storagePath = decodeURIComponent(parts[1].split("?")[0] || "");
    }
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, 3600); // 1 hour validity

    if (error || !data?.signedUrl) {
      // Fallback to pathOrUrl if signed URL creation fails
      return pathOrUrl;
    }

    return data.signedUrl;
  } catch {
    return pathOrUrl;
  }
}

/**
 * Formats file size in bytes to a human readable string.
 */
export function formatFileSize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null) return "—";
  if (bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Extracts a normalized file extension from a file name or path.
 */
export function getFileExtension(nameOrPath?: string | null): string {
  if (!nameOrPath) return "";
  const withoutQuery = nameOrPath.split("?")[0] ?? "";
  const clean = withoutQuery.split("#")[0] ?? "";
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}

/**
 * Checks if a document is an image or PDF suitable for in-app preview.
 */
export function isPreviewableFile(mimeTypeOrPath?: string | null, fileName?: string | null): boolean {
  if (!mimeTypeOrPath && !fileName) return false;
  if (mimeTypeOrPath && (mimeTypeOrPath.startsWith("image/") || mimeTypeOrPath.includes("pdf"))) {
    return true;
  }
  const ext = getFileExtension(fileName || mimeTypeOrPath);
  return ["pdf", "png", "jpg", "jpeg", "webp", "gif"].includes(ext);
}

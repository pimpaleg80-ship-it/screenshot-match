import { describe, it, expect } from "vitest";
import {
  getExpiryStatus,
  getVerificationStatusBadge,
  formatFileSize,
  getFileExtension,
  isPreviewableFile,
} from "../lib/documents";
import {
  getOnboardingStatusBadge,
  getTaskCategoryBadge,
} from "../lib/onboarding";

describe("Document Management Logic & Helpers", () => {
  it("correctly identifies documents with no expiration", () => {
    const result1 = getExpiryStatus(null);
    expect(result1.status).toBe("no_expiry");
    expect(result1.daysRemaining).toBeNull();
    expect(result1.label).toBe("No Expiration");

    const result2 = getExpiryStatus("");
    expect(result2.status).toBe("no_expiry");

    const result3 = getExpiryStatus(undefined);
    expect(result3.status).toBe("no_expiry");
  });

  it("identifies expired documents and calculates past days", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 10);
    const dateStr = pastDate.toISOString().split("T")[0];

    const result = getExpiryStatus(dateStr);
    expect(result.status).toBe("expired");
    expect(result.daysRemaining).toBeLessThan(0);
    expect(result.label).toContain("Expired");
  });

  it("identifies documents expiring soon (within 30 days)", () => {
    const soonDate = new Date();
    soonDate.setDate(soonDate.getDate() + 15);
    const dateStr = soonDate.toISOString().split("T")[0];

    const result = getExpiryStatus(dateStr);
    expect(result.status).toBe("expiring_soon");
    expect(result.daysRemaining).toBeGreaterThanOrEqual(0);
    expect(result.daysRemaining).toBeLessThanOrEqual(30);
    expect(result.label).toContain("Expires in");
  });

  it("identifies valid documents expiring far in the future (> 30 days)", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 120);
    const dateStr = futureDate.toISOString().split("T")[0];

    const result = getExpiryStatus(dateStr);
    expect(result.status).toBe("valid");
    expect(result.daysRemaining).toBeGreaterThan(30);
    expect(result.label).toContain("Valid");
  });

  it("formats file sizes cleanly across bytes, KB, and MB", () => {
    expect(formatFileSize(null)).toBe("—");
    expect(formatFileSize(undefined)).toBe("—");
    expect(formatFileSize(0)).toBe("0 Bytes");
    expect(formatFileSize(500)).toBe("500 Bytes");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("extracts file extension from various paths and URLs", () => {
    expect(getFileExtension("passport.pdf")).toBe("pdf");
    expect(getFileExtension("resume.final.docx")).toBe("docx");
    expect(getFileExtension("uploads/image.PNG")).toBe("png");
    expect(getFileExtension("https://supabase.co/storage/v1/object/public/documents/id.jpg?token=123")).toBe("jpg");
    expect(getFileExtension("nofileextension")).toBe("");
  });

  it("identifies previewable files correctly", () => {
    expect(isPreviewableFile("contract.pdf")).toBe(true);
    expect(isPreviewableFile("photo.jpg")).toBe(true);
    expect(isPreviewableFile("scan.png")).toBe(true);
    expect(isPreviewableFile("logo.webp")).toBe(true);
    expect(isPreviewableFile("report.docx")).toBe(false);
    expect(isPreviewableFile("archive.zip")).toBe(false);
  });

  it("returns appropriate verification status badges", () => {
    const verified = getVerificationStatusBadge("verified");
    expect(verified.variant).toBe("verified");
    expect(verified.label).toBe("Verified");

    const rejected = getVerificationStatusBadge("rejected");
    expect(rejected.variant).toBe("rejected");
    expect(rejected.label).toBe("Rejected");

    const pending = getVerificationStatusBadge("pending_verification");
    expect(pending.variant).toBe("pending");
    expect(pending.label).toBe("Pending Verification");

    const fallback = getVerificationStatusBadge(null);
    expect(fallback.variant).toBe("pending");
  });
});

describe("Employee Onboarding Logic & Helpers", () => {
  it("returns proper badge metadata for onboarding pipeline stages", () => {
    expect(getOnboardingStatusBadge("in_progress").variant).toBe("in_progress");
    expect(getOnboardingStatusBadge("pending_hr_review").variant).toBe("pending_review");
    expect(getOnboardingStatusBadge("completed").variant).toBe("completed");
    expect(getOnboardingStatusBadge("draft").variant).toBe("draft");
    expect(getOnboardingStatusBadge("cancelled").variant).toBe("cancelled");
  });

  it("returns proper category labels for onboarding checklist items", () => {
    expect(getTaskCategoryBadge("document").label).toBe("Document Submission");
    expect(getTaskCategoryBadge("bank_details").label).toBe("Bank & Tax Info");
    expect(getTaskCategoryBadge("personal_info").label).toBe("Personal Details");
    expect(getTaskCategoryBadge("it_setup").label).toBe("IT & System Access");
    expect(getTaskCategoryBadge("policy_sign").label).toBe("Policy Sign-off");
    expect(getTaskCategoryBadge("hr_verification").label).toBe("HR Verification");
  });

  it("accurately calculates onboarding progress completion percentage", () => {
    const computeProgress = (tasks: { status: string; required?: boolean }[]) => {
      if (tasks.length === 0) return 0;
      const completed = tasks.filter(
        (t) => t.status === "verified" || t.status === "completed"
      ).length;
      return Math.round((completed / tasks.length) * 100);
    };

    expect(computeProgress([])).toBe(0);

    const halfDone = [
      { status: "verified" },
      { status: "completed" },
      { status: "pending" },
      { status: "pending" },
    ];
    expect(computeProgress(halfDone)).toBe(50);

    const allDone = [
      { status: "verified" },
      { status: "completed" },
      { status: "completed" },
    ];
    expect(computeProgress(allDone)).toBe(100);

    const sevenOfTen = [
      { status: "verified" },
      { status: "verified" },
      { status: "completed" },
      { status: "completed" },
      { status: "verified" },
      { status: "completed" },
      { status: "verified" },
      { status: "pending" },
      { status: "submitted" },
      { status: "pending" },
    ];
    expect(computeProgress(sevenOfTen)).toBe(70);
  });
});

import { describe, it, expect } from "vitest";
import {
  encryptToken,
  generateAttendancePdfText,
  handleGoogleDriveDailyBackup,
  handleGoogleDriveUpload,
} from "../lib/server-google-drive";

describe("Security & Google Drive Server Handlers", () => {
  const testEnv = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-secret-for-unit-test",
  };

  it("rejects unauthenticated requests to Google Drive daily backup", async () => {
    const req = new Request("https://app.example.com/api/integrations/google-drive/backup", {
      method: "POST",
    });
    const res = await handleGoogleDriveDailyBackup(req, testEnv);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success?: boolean };
    expect(body.success).toBe(false);
  });

  it("rejects unauthenticated requests to Google Drive upload", async () => {
    const req = new Request("https://app.example.com/api/integrations/google-drive/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_type: "report",
        file_name: "test.pdf",
        pdf_base64: btoa("%PDF-1.4"),
      }),
    });
    const res = await handleGoogleDriveUpload(req, testEnv);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { success?: boolean };
    expect(body.success).toBe(false);
  });

  it("refuses to encrypt tokens when no encryption secret is configured", async () => {
    await expect(encryptToken("refresh-secret", "")).rejects.toThrow(/secret/i);
  });

  it("generates attendance PDF with exact byte-accurate xref offsets and escaped text", () => {
    const bytes = generateAttendancePdfText(
      "2026-11-27",
      [
        {
          people: { person_code: "EMP001", name: "Alex (Ops)", department: "Engineering" },
          check_in: "2026-11-27T09:05:00.000Z",
          check_out: "2026-11-27T18:05:00.000Z",
          status: "present",
        },
      ],
      "Fluxora (HQ)",
    );

    const pdf = new TextDecoder().decode(bytes);
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf).toContain("Fluxora \\(HQ\\)");
    expect(pdf).toContain("Alex \\(Ops\\)");

    const startxrefMatch = pdf.match(/startxref\n(\d+)\n%%EOF$/);
    expect(startxrefMatch).not.toBeNull();
    const xrefOffset = Number(startxrefMatch![1]);
    expect(pdf.slice(xrefOffset, xrefOffset + 5)).toBe("xref\n");

    const entryMatches = [...pdf.matchAll(/^(\d{10}) 00000 n $/gm)];
    expect(entryMatches.length).toBe(5);
    entryMatches.forEach((m, idx) => {
      const off = Number(m[1]);
      expect(pdf.slice(off, off + 7)).toBe(`${idx + 1} 0 obj`);
    });
  });
});

# FlowPeople HRMS — Google Drive PDF Archival Integration

**Purpose**: Automated cloud backup of monthly workforce attendance records and compliance reports directly to Google Drive.  
**Storage Offload**: Completely bypasses Supabase database storage quotas for historical report files.

---

## 1. Architecture & Execution Flow

1. **OAuth Connection**:
   - Organization administrator connects their corporate Google Drive via OAuth 2.0 flow from Settings (`/settings`).
   - Refresh tokens and target folder IDs are stored securely in `attendance_archives` per tenant organization.

2. **PDF Generation (`src/lib/pdf-backup.ts`)**:
   - Renders professional tabular attendance PDFs with `jsPDF` and `jspdf-autotable`.
   - Generates individual employee monthly ledgers via `generateMonthlyEmployeeAttendancePdf()`.
   - Generates organization-wide monthly attendance manifests via `generateMonthlyOrgMasterPdf()`.

3. **Background Upload Pipeline**:
   - Converts generated PDF binary into base64 payload.
   - Invokes Supabase Edge Function `google-drive-upload` in a non-blocking background task.
   - Uploads to the organization's dedicated Google Drive folder structure:
     `FlowPeople Archives / <Organization Name> / <Year> / <Month> /`
   - Records upload metadata into `archive_files` with SHA-256 integrity checksums.

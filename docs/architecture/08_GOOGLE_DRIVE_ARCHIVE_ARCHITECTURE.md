# 08. Google Drive Archival & Monthly PDF Report Architecture

**OAuth Scope**: `https://www.googleapis.com/auth/drive.file`, `https://www.googleapis.com/auth/userinfo.email`  
**Encryption Standard**: AES-256-GCM (Authenticated Encryption with Associated Data)  
**Archive Frequency**: Real-time export backup + Automated 1st-of-month historical batch archival

---

## 1. Audit of Existing Google Drive Integration

The current repository contains a functioning, production-ready implementation of Google Drive OAuth 2.0 and PDF upload in `supabase/functions/` and `src/lib/pdf-backup.ts`:

### 1. Existing OAuth Configuration & Flow

- **Initiation (`google-drive-auth-start`)**:
  - Request URL: `https://accounts.google.com/o/oauth2/v2/auth`
  - Scopes requested:
    - `https://www.googleapis.com/auth/drive.file` (Restricted least-privilege scope: only accesses files created by this application).
    - `https://www.googleapis.com/auth/userinfo.email` (Retrieves account email for admin UI status).
  - Parameters: `access_type=offline`, `prompt=consent` (Ensures refresh token is always returned), `response_type=code`.
- **Callback & Token Storage (`google-drive-auth-callback`)**:
  - Exchanges authorization code for `access_token` and `refresh_token`.
  - Encrypts `refresh_token` using AES-256-GCM via Web Crypto API in `_shared/crypto.ts` with 12-byte random IV.
  - Stores encrypted token, root folder ID, and Google email in the `drive_connection` table.
- **Revocation Handling (`_shared/google-drive.ts`)**:
  - Detects `invalid_grant` error responses when refreshing tokens, setting `revoked = true` in UI to prompt administrator re-connection.
- **Upload Pipeline (`google-drive-upload`)**:
  - Automatically creates hierarchical directory structure:
    `FaceAttendance Backups / {Reports | Attendance} / YYYY / MM`
  - Uses multipart MIME upload for files $\le 5\text{MB}$ and resumable upload for files $> 5\text{MB}$.
  - Implements 3 exponential backoff retry attempts (1s, 2s).

---

## 2. Identified Limitations of Existing Drive Integration

1. **Single-Tenant Storage**:
   - `drive_connection` is a singleton table without `organization_id`.
   - All backups across all users go into one Google Drive account.
2. **Synchronous Browser PDF Generation**:
   - Monthly reports on `/reports` are generated in the browser via `jspdf` and `jspdf-autotable`.
   - The browser converts the PDF to base64 and dispatches it over HTTP. For organizations with hundreds of employees, this causes browser tab freezing and HTTP payload limit errors (413 Payload Too Large).
3. **No Individual Employee PDF Archival**:
   - The current export produces a single combined table. It does not generate individualized monthly attendance slips for each employee.

---

## 3. Target Multi-Tenant Monthly PDF Archival Engine

In Phase 2, the archival system will be migrated to an asynchronous backend worker in FastAPI:

```
[ Scheduled Batch Cron (1st of every month at 01:00 UTC) ]
                          │
                          ▼
        [ FastAPI Monthly Archival Service ]
                          │
       ┌──────────────────┴──────────────────┐
       ▼                                     ▼
1. Query All Tenant Orgs           2. For Each Org: Check Drive OAuth
                                      (attendance_archives where connected=true)
                                             │
                                             ▼
                                   3. Fetch Month Records
                                      (Shifts, Presence, Leaves, Overtime)
                                             │
                                             ▼
                                   4. Generate PDFs (ReportLab)
                                      ├── Master Org Summary PDF
                                      └── Individual Employee PDFs (1 per staff)
                                             │
                                             ▼
                                   5. Upload to Google Drive API v3
                                      (Target Folder: FlowPeople Archives/Org/YYYY/MM)
                                             │
                                             ▼
                                   6. Record Manifest & Hash
                                      (archive_jobs, archive_files with SHA-256)
```

### Folder Structure Specification

Inside the connected company Google Drive:

```
FlowPeople HRMS Archives/
└── [Acme Corporation - ORG102]/
    └── 2026/
        └── 10 (October)/
            ├── Master_Summary_Acme_Corp_2026_10.pdf
            ├── Archive_Manifest_2026_10.json
            └── Employees/
                ├── EMP001_John_Doe_Attendance_2026_10.pdf
                ├── EMP002_Jane_Smith_Attendance_2026_10.pdf
                └── EMP003_Robert_Taylor_Attendance_2026_10.pdf
```

### Archive Integrity Verification

- **Cryptographic Hash**: Every generated PDF is hashed with SHA-256 before upload.
- **Google Drive Verification**: After upload, the worker queries Google Drive API `files.get(fileId, fields='id,name,size,md5Checksum')`.
- **Manifest Record**: Once all employee files and the master summary are verified, an entry is written into `archive_jobs` with status `COMPLETED` and total verified file count.
- **Safety Gate**: The 90-day temporary GPS log cleanup worker is strictly blocked from running for any month that lacks a `COMPLETED` archive manifest.

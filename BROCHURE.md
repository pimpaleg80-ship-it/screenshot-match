# Flowpeople by Fluxora

## Enterprise Biometric Workforce & Attendance Management Suite

> **"Seamless Check-Ins. Trustless Security. Unified People Operations."**

---

## 1. Executive Summary

In today's fast-moving enterprise landscape, traditional attendance tracking methods—plastic ID cards, fingerprint scanners, manual paper rosters, and mobile apps prone to GPS spoofing—fail to deliver the accuracy, speed, and hygiene modern businesses demand.

**Flowpeople by Fluxora** is a next-generation, cloud-connected enterprise biometric workforce management suite. Powered by client-side facial recognition and an enterprise PostgreSQL backend with Row-Level Security (RLS), Flowpeople delivers instant, buddy-punch-proof check-ins and check-outs in under 300 milliseconds.

Designed specifically for **B2B deployments**, Flowpeople replaces cumbersome punch clocks with intuitive smart kiosks, gives administrators full control over employee rosters and leave cycles, and provides staff with a dedicated, self-service workspace.

```
       ┌────────────────────────────────────────────────────────┐
       │                 FLOWPEOPLE BY FLUXORA                  │
       └────────────────────────────────────────────────────────┘
                                   │
      ┌────────────────────────────┼───────────────────────────┐
      ▼                            ▼                           ▼
┌──────────────┐          ┌─────────────────┐         ┌────────────────┐
│ Smart Kiosk  │          │  Admin Console  │         │  Staff Portal  │
│ Zero-Touch   │          │  Roster & Logs  │         │  My Attendance │
│ Facial AI    │          │  Leaves & Vault │         │  Leave & Docs  │
└──────────────┘          └─────────────────┘         └────────────────┘
```

---

## 2. Key Challenges & The Flowpeople Solution

| Industry Challenge                    | Traditional Approach                                     | Flowpeople by Fluxora Solution                                                                                            |
| :------------------------------------ | :------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Buddy Punching & Time Theft**       | Shared RFID badges, PIN codes, easily faked mobile GPS   | **Edge 128D Biometric AI**: Matches facial landmarks directly on device. Zero proxy punching.                             |
| **Hardware Overhead & Costs**         | Proprietary \$2,000+ biometric wall units with lock-in   | **Hardware Agnostic**: Runs in any standard browser on iPads, Android tablets, laptops, or desktop webcams.               |
| **Hygiene & Physical Contact**        | Fingerprint sensors spreading germs in high-traffic hubs | **100% Touchless**: Stand in front of the kiosk camera, get verified instantly with visual feedback.                      |
| **Shift Rigidity & Unfair Penalties** | Rigid shift clocks flagging flexible knowledge workers   | **Exact Punch Logging**: Records real check-in and check-out timestamps with exact duration calculation.                  |
| **Privilege Exposure & Data Leaks**   | Shared admin accounts, publicly visible superusers       | **Stealth Governance**: Hidden Superadmin gateway (`/superadmin`) completely absent from public UI and staff directories. |
| **Compliance & Data Privacy**         | Raw biometric photos transmitted across the internet     | **Privacy-First AI**: Raw images never stored or transmitted. Only encrypted numerical vector embeddings are used.        |

---

## 3. Core Product Modules

### 📷 1. Smart Biometric Kiosk Terminal (`/kiosk`)

- **Sub-Second Facial Verification**: Client-side face detection utilizing lightweight neural networks running directly inside modern browsers via WebAssembly.
- **Smart Dual In/Out Detection**: Automatically determines whether an employee is checking in for the first time or checking out for the day, logging exact timestamps.
- **Anti-Duplicate Cooldown Engine**: Intelligent 2.5-minute lockout timer prevents unintentional multiple punch records when an employee lingers in camera view.
- **Auditory & Visual Confirmation**: Instant audio chime and high-contrast onscreen toast display employee name, timestamp, and confidence score.
- **Zero-Touch Kiosk Lock**: Runs in a full-screen, tamper-resistant kiosk mode with password-protected exit controls.

### 👥 2. Enterprise Employee Directory & Provisioning (`/employees`)

- **Direct B2B Account Provisioning**: Admins create employee profiles complete with corporate email, auto-generated or manual credentials, employee code, department, and role.
- **3-Click Biometric Enrollment (`/enroll`)**: Live webcam photo capture automatically calculates facial embedding vectors and registers employees to the recognition database.
- **Role-Based Clearance Levels**:
  - **Employee**: Access to personal attendance logs, leave applications, company circulars, and document vault.
  - **Manager**: Department-level oversight, live team attendance monitoring, and leave approval workflows.
  - **Administrator**: Full system authority across roster creation, manual time corrections, leave balance grants, announcements, and company settings.
  - **Stealth Superadmin**: Hidden root governance, security diagnostics, and system role elevations.

### ⏱️ 3. Attendance & Real-Time Punch Engine (`/attendance`)

- **Dual Check-In & Check-Out Visibility**: Transparently displays exact punch-in and punch-out timestamps, active shift state, and cumulative hours worked.
- **Administrative Overrides & Audit Logs**: Authorized admins can manually adjust missing punches, record off-site field assignments, or log explanatory audit notes.
- **Multi-Filter Search & Export**: Filter attendance by date range, department, attendance status (`Present`, `Late`, `Half-day`, `Absent`), and export to CSV or PDF with a single click.

### 🏖️ 4. Automated Leave Management & Balances (`/leaves`)

- **Self-Service Application Flow**: Employees submit leave requests selecting category (`Casual`, `Sick`, `Earned`, `Unpaid`), date ranges, and justification notes.
- **Live Generated Leave Balances**: Backed by PostgreSQL generated columns (`remaining = total - used`), ensuring mathematical balance integrity across fiscal cycles.
- **Instant Manager Approval Workflow**: Real-time notifications and one-click `Approve` or `Reject` actions with mandatory reviewer remarks.
- **Department Conflict Previews**: Managers can review team calendar overlays before approving to avoid department understaffing.

### 📢 5. Enterprise Announcement Board (`/announcements`)

- **Company-Wide & Departmental Broadcasts**: Publish memos, holiday advisories, policy updates, and executive messages.
- **Priority Tiering**: Highlight critical broadcasts with `Normal`, `High`, or `Urgent` visual badges.
- **Pinned Broadcasts**: Pin essential circulars to the top of employee dashboards.

### 📅 6. Corporate Holiday & Working Day Calendar (`/calendar`)

- **Centralized Holiday Schedule**: Visual month and year calendar displaying mandatory public holidays, optional regional holidays, and company observances.
- **Leave Planning Alignment**: Integrated directly with leave application date-pickers so employees never accidentally deduct annual leave on recognized holidays.

### 📁 7. Secure Document Vault (`/documents`)

- **Digital Employee Document Locker**: Upload and categorize offer letters, contracts, compliance certifications, identity proofs, and tax forms.
- **Secure Signed Downloads**: Direct, secure document retrieval backed by encrypted storage with access restricted strictly to the employee and authorized HR administrators.

### 📊 8. Executive Reports & Workforce Analytics (`/reports`)

- **Daily & Monthly Attendance Trends**: Visual charts showcasing department punctuality, absenteeism rates, and overtime statistics.
- **Automated Punctuality Scores**: Identify top performers and departments with high tardiness for proactive operational management.
- **One-Click Audit Exports**: Download payroll-ready CSV and tabular PDF reports formatted for seamless integration with ERP and payroll software.

### ⚙️ 9. Enterprise Configuration & Cloud Backup (`/settings`)

- **Configurable Biometric Thresholds**: Adjust facial recognition confidence cutoffs (default 0.70) to balance speed against strictness.
- **Automated Google Drive Cloud Backup**: Connect corporate Google Cloud storage for automated off-site backups of employee attendance archives and logs.

---

## 4. Architecture & Security Specifications

```
  ┌──────────────────────────────────────────────────────────────┐
  │                    CLIENT (BROWSER / KIOSK)                  │
  │  React 18 + Vite + TailwindCSS + TanStack Router             │
  │  In-Browser Face Detection (128-Dimensional Vector AI)       │
  └──────────────────────────────┬───────────────────────────────┘
                                 │ Encrypted HTTPS / WSS
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │              ENTERPRISE BACKEND (SUPABASE / POSTGRESQL)       │
  │  • PostgreSQL 15 Engine with Row Level Security (RLS)        │
  │  • Pure B2B Manual Authentication (No Public Registration)   │
  │  • Database Functions (admin_create_employee, RLS policies)  │
  │  • Vector Store & Generated Columns for Real-Time Balances   │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                   OFF-SITE STORAGE & BACKUP                  │
  │  • Encrypted Document Vault (Private S3/Supabase Storage)    │
  │  • Automated Google Drive Enterprise Cloud Synchronization   │
  └──────────────────────────────────────────────────────────────┘
```

### Security Highlights

- **Zero Raw Biometric Storage**: The platform converts facial landmarks into 128-dimensional floating point vectors locally on the device. Raw facial photos are never required for attendance validation.
- **PostgreSQL Row-Level Security (RLS)**: Enforced directly at the database engine level. Employees can only access their personal logs and documents; managers can access their team; administrators hold governed tenant access.
- **Stealth Superadmin Architecture**: The platform does not display "Superadmin" in any navigation menu, employee roster, or frontend dropdown. Root administration is accessible strictly via direct `/superadmin` route authentication.
- **B2B Closed Enrollment**: Public self-registration is permanently disabled. Only verified administrators can provision credentials.

---

## 5. Technical Requirements & Hardware Compatibility

| Component            | Minimum Specification                                                   | Recommended Specification                                          |
| :------------------- | :---------------------------------------------------------------------- | :----------------------------------------------------------------- |
| **Kiosk Device**     | Any device with a modern Chromium/WebKit browser (Chrome, Edge, Safari) | 10" or 12" Apple iPad / Android Tablet / Touchscreen All-in-One PC |
| **Camera**           | 720p HD webcam (30 FPS)                                                 | 1080p Full HD wide-angle USB or integrated webcam                  |
| **Network**          | 1 Mbps stable Wi-Fi / Ethernet                                          | 5+ Mbps low-latency connection (supports offline caching)          |
| **Operating System** | Windows 10/11, macOS, iPadOS, Android, Linux / ChromeOS                 | Any modern OS with automatic OS-level kiosk lock                   |
| **Server / Cloud**   | Supabase Cloud (Managed) or Self-Hosted Docker PostgreSQL               | Supabase Pro / Enterprise or AWS RDS PostgreSQL 15+                |

---

## 6. Business Value & Return on Investment (ROI)

1. **Eliminate 100% of Buddy Punching**: Biometric face verification stops employee time theft, saving typical mid-size businesses \$15,000 to \$50,000 annually.
2. **Cut HR Processing Time by 80%**: Automated check-in/out timestamps, instant CSV payroll exports, and automated leave balance ledgers free HR teams from manual data entry.
3. **No Expensive Hardware Lock-in**: Deploy on standard commercial tablets and webcams, cutting initial hardware capital expenditure by up to 75%.
4. **Enhanced Workplace Hygiene**: 100% contactless operation protects employee health, reducing seasonal illness spread in high-density office and manufacturing environments.

---

## 7. About Fluxora

**Fluxora** builds high-reliability, intelligent enterprise software products that transform traditional business operations.

- **Product**: Flowpeople by Fluxora
- **Official Documentation**: Included in repository (`USER_MANUAL.md`)
- **Version**: 2.4.0 (Enterprise Edition)
- **Licensing**: Enterprise B2B SaaS License
- **Support**: support@fluxora.com | enterprise@fluxora.com

---

_Flowpeople by Fluxora — The intelligent way to manage your modern workforce._

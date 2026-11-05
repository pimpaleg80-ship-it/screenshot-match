# Flowpeople by Fluxora
# Comprehensive User Manual & Operations Guide

> **Version:** 2.4.0 (Enterprise B2B Edition)  
> **Brand:** Flowpeople by Fluxora  
> **Target Audience:** System Administrators, HR Personnel, Department Managers, Employees, and Terminal Operators  

---

## Table of Contents

1. [Introduction & System Overview](#1-introduction--system-overview)
2. [Authentication & Role Clearance Hierarchy](#2-authentication--role-clearance-hierarchy)
3. [Stealth Superadmin Operations Guide (`/superadmin`)](#3-stealth-superadmin-operations-guide-superadmin)
4. [Administrator Operations Guide](#4-administrator-operations-guide)
   - [4.1 Executive Dashboard](#41-executive-dashboard)
   - [4.2 Creating & Provisioning Employees](#42-creating--provisioning-employees)
   - [4.3 Biometric Face Enrollment Guide](#43-biometric-face-enrollment-guide)
   - [4.4 Managing Employee Directory & Roster](#44-managing-employee-directory--roster)
   - [4.5 Attendance Monitoring & Audit Overrides](#45-attendance-monitoring--audit-overrides)
   - [4.6 Leave Governance & Balance Allotments](#46-leave-governance--balance-allotments)
   - [4.7 Publishing Corporate Announcements](#47-publishing-corporate-announcements)
   - [4.8 Managing the Holiday Calendar](#48-managing-the-holiday-calendar)
   - [4.9 Document Vault & File Management](#49-document-vault--file-management)
   - [4.10 Reports, Analytics & Payroll Exports](#410-reports-analytics--payroll-exports)
   - [4.11 System Settings & Google Drive Cloud Backup](#411-system-settings--google-drive-cloud-backup)
5. [Manager Portal Operations Guide](#5-manager-portal-operations-guide)
   - [5.1 Department Attendance Feed](#51-department-attendance-feed)
   - [5.2 Reviewing & Approving Leave Requests](#52-reviewing--approving-leave-requests)
   - [5.3 Team Circulars & Calendar](#53-team-circulars--calendar)
6. [Employee Self-Service Space Guide](#6-employee-self-service-space-guide)
   - [6.1 Accessing the Employee Workspace](#61-accessing-the-employee-workspace)
   - [6.2 Reading Announcements](#62-reading-announcements)
   - [6.3 Applying for Leave & Tracking Balances](#63-applying-for-leave--tracking-balances)
   - [6.4 Viewing Personal Attendance ("My Report")](#64-viewing-personal-attendance-my-report)
   - [6.5 Consulting the Holiday Calendar](#65-consulting-the-holiday-calendar)
   - [6.6 Accessing Documents & Payslips](#66-accessing-documents--payslips)
   - [6.7 Profile & Password Management](#67-profile--password-management)
7. [Biometric Kiosk Terminal Guide (`/kiosk`)](#7-biometric-kiosk-terminal-guide-kiosk)
   - [7.1 Terminal Setup & Hardware Recommendations](#71-terminal-setup--hardware-recommendations)
   - [7.2 Walk-Up Experience & Auto In/Out Detection](#72-walk-up-experience--auto-inout-detection)
   - [7.3 Anti-Duplicate Punch Lockout (Cooldown)](#73-anti-duplicate-punch-lockout-cooldown)
   - [7.4 Audio-Visual Feedback & Toast Notifications](#74-audio-visual-feedback--toast-notifications)
8. [Troubleshooting & Frequently Asked Questions (FAQ)](#8-troubleshooting--frequently-asked-questions-faq)
9. [Security, Privacy & Data Compliance](#9-security-privacy--data-compliance)

---

## 1. Introduction & System Overview

**Flowpeople by Fluxora** is a unified B2B workforce management and contactless attendance platform. The suite combines lightweight edge artificial intelligence for sub-second facial recognition with a secure cloud database backend.

### Key Architectural Strengths
- **Pure B2B Closed Enrollment**: Open public registrations are eliminated. Every account is explicitly created and credentialed by an administrator.
- **Stealth Superadmin Layer**: Root administration is completely decoupled and concealed from the standard user interface, preserving zero frontend disclosure.
- **Exact Punch Logging**: Unfair shift boundary penalties have been removed. System directly logs exact check-in and check-out timestamps with live duration metrics.
- **Client-Side Biometric Inference**: Raw camera streams never leave the client terminal. Facial features are converted locally to mathematical vectors (128-dimensional embeddings) and matched against secure encrypted records.
- **PostgreSQL Row-Level Security (RLS)**: Enforces strict data isolation between departments, employees, and executive administrators directly at the database engine layer.

---

## 2. Authentication & Role Clearance Hierarchy

Flowpeople implements four distinct clearance tiers, each tailored with appropriate functional boundaries:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. STEALTH SUPERADMIN (Direct URL: /superadmin)                             │
│    Root governance, database sync, role elevations, security diagnostics.   │
│    *Completely invisible in standard UI navigation and staff directories.*  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. ADMINISTRATOR (/dashboard, /employees, /attendance, /settings, etc.)     │
│    Full business operations: provision staff, enroll faces, approve leaves, │
│    audit check-in/out records, broadcast circulars, export payroll reports. │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. MANAGER (/dashboard, /attendance, /leaves, /announcements)               │
│    Department operations: live team attendance feed, approve/reject leaves, │
│    monitor department punctuality, team calendar oversight.                │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. EMPLOYEE (/dashboard, /leaves, /announcements, /calendar, /documents)    │
│    Self-service space: view personal check-in/out logs ("My Report"), apply │
│    for leaves, inspect leave balances, read memos, download tax/payslip docs│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sign-In Process
1. Navigate to the enterprise login screen: `https://your-domain.com/auth`.
2. Enter your corporate email address and assigned password.
3. Click **Sign in**.
4. The system inspects your role clearance and automatically redirects you:
   - **Superadmin:** Directed to `/superadmin` (or `/dashboard` if chosen).
   - **Admin / Manager / Employee:** Directed to `/dashboard`.

---

## 3. Stealth Superadmin Operations Guide (`/superadmin`)

The Superadmin console is an isolated administrative surface built for platform operators and root administrators.

> [!IMPORTANT]
> To preserve organizational hierarchy and operational security, **Superadmin links and branding are never displayed in the standard sidebar, navigation bars, or employee lists**. Access is exclusively via direct URL navigation to `/superadmin`.

### Accessing the Console
1. Log in with your Superadmin account (e.g., `pimpaleharshad99@gmail.com`).
2. Navigate directly to `/superadmin` in the browser address bar.
3. If accessed by an unauthorized user, the system automatically redirects them to `/dashboard` with an access-denied advisory.

### Console Features & Controls
- **System Health & Connectivity Status**: Real-time diagnostic ping checking the PostgreSQL database cluster, latency, and active connection pool status.
- **Account Clearance Governance**: View all provisioned administrative accounts and grant or revoke administrator privileges.
- **Superadmin Provisioning Form**: Privileged tool allowing the creation of root or executive accounts with encrypted credentials directly bypassing ordinary RLS gates.
- **Audit Ledger & Database Synchronization**: Trigger immediate schema checks, database health inspections, and inspect active RLS policy enforcement status.

---

## 4. Administrator Operations Guide

Administrators maintain complete authority over daily business operations, personnel records, attendance validations, and company-wide configurations.

### 4.1 Executive Dashboard
Upon logging in, administrators see an interactive overview of current day metrics:
- **Total Personnel Roster**: Active count of registered staff members.
- **Live Attendance Status**: Real-time count and percentage of employees currently checked in, checked out, on approved leave, or absent.
- **Dual Check-In & Check-Out Table**: Live feed showing each employee's name, department, exact Check-In timestamp, exact Check-Out timestamp, elapsed work duration, and status badge.
- **Pending Actions**: Count of open leave requests awaiting administrative approval.

### 4.2 Creating & Provisioning Employees
Because Flowpeople is a B2B enterprise platform, employees do not sign up on their own. Administrators create and credential every user account.

#### Step-by-Step Provisioning:
1. Open the left navigation sidebar and click **Employees** (`/employees`).
2. Click the primary **Add Employee** button at the top-right corner.
3. In the modal dialog, complete the profile fields:
   - **Full Name**: e.g., `Rohit Verma`
   - **Work Email**: e.g., `rohit.verma@company.com`
   - **Initial Password**: Set a temporary or permanent password (minimum 6 characters, e.g., `Company@2026`).
   - **Role**: Select `Employee`, `Manager`, or `Admin`.
   - **Department**: e.g., `Engineering`, `Human Resources`, `Sales`, `Operations`.
   - **Designation**: e.g., `Senior Frontend Engineer`, `Account Executive`.
   - **Employee Code**: Unique corporate ID (e.g., `EMP-1042`).
   - **Contact Phone**: Corporate or personal phone number.
4. Click **Create Employee**.
5. **Credentials Delivery**: The system provisions the account inside Supabase Auth, updates employee metadata, and initializes an annual leave ledger. Hand the employee their email and password so they can log in to their self-service space immediately.

### 4.3 Biometric Face Enrollment Guide
To enable an employee to punch in and out using the Smart Kiosk, their facial profile must be enrolled into the biometric engine.

#### Step-by-Step Face Enrollment:
1. Navigate to **Face Enrollment** (`/enroll`) from the sidebar or click **Enroll Face** beside any employee in the directory.
2. Select the target employee from the dropdown selector.
3. **Camera Placement**: Ensure the employee is seated or standing 1.5 to 2.5 feet directly in front of the webcam.
   - Use well-balanced frontal lighting. Avoid strong backlights or deep shadows.
   - Ensure glasses or face coverings do not obstruct facial landmarks.
4. The system provides a live camera viewfinder with an oval alignment guide:
   - **Capture Angle 1 (Frontal)**: Have the employee look straight into the camera lens until the frame highlights green. Click **Capture Front View**.
   - **Capture Angle 2 (Slight Left Turn)**: Have the employee turn their head 15 degrees to the left. Click **Capture Left Angle**.
   - **Capture Angle 3 (Slight Right Turn)**: Have the employee turn their head 15 degrees to the right. Click **Capture Right Angle**.
5. The neural network computes the 128-dimensional vector embedding. Click **Save Biometric Profile**.
6. A success message confirms the employee is now authorized for kiosk recognition.

### 4.4 Managing Employee Directory & Roster
- **Edit Profiles**: Update job titles, phone numbers, department transfers, or employee codes at any time.
- **Deactivate / Terminate Access**: Toggle an employee's status to `Inactive`. Inactive employees are immediately blocked from kiosk check-ins and portal sign-ins.
- **Search & Filters**: Instantly find personnel by name, email, department, or employee code.

### 4.5 Attendance Monitoring & Audit Overrides
Located under **Attendance** (`/attendance`):
- **Live Daily Register**: Inspect every punch event with exact times, method (`Face Recognition`, `Manual Entry`, `Kiosk`), and AI confidence score (e.g., `96.4%`).
- **Manual Punch Adjustment**: If an employee forgot to check out or was on client site duty:
  1. Click the **Adjust Record** button beside the entry.
  2. Enter the approved Check-In or Check-Out time.
  3. Enter a mandatory audit note explaining the manual adjustment (e.g., *"Client visit at Mumbai HQ approved by Director"*).
  4. Save the adjustment. The audit log permanently records the administrator's identity and timestamp.

### 4.6 Leave Governance & Balance Allotments
Located under **Leaves** (`/leaves`):
- **Review Requests**: View incoming leave applications from all departments.
- **Approve or Reject**: Click **Approve** or **Reject** with optional remarks. The employee's dashboard reflects the decision in real time.
- **Balance Ledgers**: View each employee's annual entitlement:
  - `Casual Leave` (CL)
  - `Sick Leave` (SL)
  - `Earned / Privilege Leave` (EL)
  - `Unpaid Leave` (LWP)
- The database calculates `Remaining = Total - Used` automatically.

### 4.7 Publishing Corporate Announcements
Located under **Announcements** (`/announcements`):
1. Click **New Announcement**.
2. Fill in:
   - **Title**: Clear headline (e.g., *"Annual Town Hall & Q3 Product Roadmap"*).
   - **Priority**: Select `Normal`, `High`, or `Urgent`. Urgent circulars display a vibrant red banner.
   - **Target Audience**: Select `All Departments` or a specific department (e.g., `Sales`).
   - **Content**: Detailed text, agenda, instructions, or links.
   - **Pin to Top**: Toggle to keep this circular pinned at the top of employee dashboards.
3. Click **Publish Broadcast**.

### 4.8 Managing the Holiday Calendar
Located under **Calendar** (`/calendar`):
- Add official corporate and gazetted holidays.
- Specify holiday name, date, type (`Public Holiday`, `Company Off`, `Regional Holiday`), and notes.
- Dates marked as holidays are automatically displayed on employee calendars and exempted from leave balance deductions.

### 4.9 Document Vault & File Management
Located under **Documents** (`/documents`):
- Upload corporate documents, company policies, tax declaration formats, and employee-specific contracts.
- Categorize documents by tag (`Payroll`, `Legal`, `HR Policies`, `Certificates`).
- Assign documents as public (visible to all staff) or restricted to an individual employee (e.g., monthly payslips).

### 4.10 Reports, Analytics & Payroll Exports
Located under **Reports** (`/reports`):
- **Date Range Selector**: Run reports for Today, This Week, This Month, or Custom Date Ranges.
- **Department Filters**: Drill down by department or view organization-wide metrics.
- **Key Metrics Displayed**:
  - Total Working Days
  - On-Time Arrival Percentage
  - Total Hours Logged per Employee
  - Leave & Absence Days
- **Exporting Data**: Click **Export to CSV** for direct Excel/payroll software import, or **Print / PDF** for printable compliance audit sheets.

### 4.11 System Settings & Google Drive Cloud Backup
Located under **Settings** (`/settings`):
- **Company Profile**: Update organization name, official contact email, and primary business address.
- **Biometric Confidence Sensitivity**: Adjust face verification sensitivity slider (recommended standard: `0.70`). Higher values increase strictness; lower values allow looser verification in variable lighting.
- **Google Drive Cloud Sync**:
  1. Toggle **Enable Google Drive Cloud Backup**.
  2. Enter your authorized corporate Google Cloud Backup Folder ID.
  3. Flowpeople will automatically sync daily attendance archives to your off-site cloud storage.

---

## 5. Manager Portal Operations Guide

Managers hold team-level visibility and approval powers for their designated departments.

### 5.1 Department Attendance Feed
- **Live Team Roster**: Managers see an attendance table showing only members of their assigned department.
- **Check-In / Out Status**: Instantly see who has arrived, who is currently working, who has left for the day, and who is on leave.
- **Punctuality & Working Hours**: View exact arrival times and accumulated hours to manage department workflows smoothly.

### 5.2 Reviewing & Approving Leave Requests
1. Navigate to **Leaves** (`/leaves`). The list filters automatically to show leave applications from team members.
2. Review the leave category, start/end dates, total working days requested, and employee reason.
3. Click **Approve** to authorize the leave (automatically deducting from their remaining balance) or **Reject** with an explanatory note.

### 5.3 Team Circulars & Calendar
Managers can post announcements targeting their specific department and consult the corporate holiday calendar when planning shift schedules.

---

## 6. Employee Self-Service Space Guide

The Employee Space is a clean, focused, distraction-free portal designed for staff members to access their own records without seeing administrative controls.

### 6.1 Accessing the Employee Workspace
1. Visit `https://your-domain.com/auth`.
2. Sign in with the work email and initial password provided by HR/Admin.
3. You will arrive at your personal **Dashboard** (`/dashboard`).

### 6.2 Reading Announcements
- The **Announcements** card on your dashboard showcases recent company notices, holiday advisories, and management circulars.
- Urgent or pinned broadcasts appear highlighted at the top. Click any announcement to read the complete memo.

### 6.3 Applying for Leave & Tracking Balances
1. Click **Leaves** in the sidebar.
2. Inspect your **Live Balance Cards**:
   - `Casual Leave`: Total, Used, Remaining
   - `Sick Leave`: Total, Used, Remaining
   - `Earned Leave`: Total, Used, Remaining
3. Click **Apply for Leave**.
4. Select the leave type, start date, end date, and enter a brief reason.
5. Click **Submit Application**.
6. Track the status badge (`Pending Review`, `Approved`, or `Rejected`) directly from your leave history table.

### 6.4 Viewing Personal Attendance ("My Report")
- On your dashboard and attendance section, click **My Report**.
- View your daily attendance record:
  - **Date**: The calendar date.
  - **Check-In**: Exact time you were scanned at the kiosk (e.g., `09:14 AM`).
  - **Check-Out**: Exact time you scanned out (e.g., `06:32 PM`).
  - **Logged Duration**: Total hours and minutes recorded for the day.
  - **Status**: `Present`, `Half-day`, or `Approved Leave`.

### 6.5 Consulting the Holiday Calendar
- Click **Holiday Calendar** (`/calendar`) to browse all upcoming official company holidays and long weekends throughout the year to assist with vacation planning.

### 6.6 Accessing Documents & Payslips
- Click **Documents** (`/documents`) to access digital copies of your appointment letter, tax compliance receipts, company policies, and monthly salary slips.
- Click the download icon beside any file to securely download it to your device.

### 6.7 Profile & Password Management
- Click **Settings** (`/settings`) to update your contact phone number, profile photo, or change your account password.

---

## 7. Biometric Kiosk Terminal Guide (`/kiosk`)

The Smart Kiosk is the touchless physical terminal installed at company entrances, reception desks, and factory floor gateways.

```
       ┌────────────────────────────────────────────────────────┐
       │             FLOWPEOPLE SMART KIOSK TERMINAL            │
       │                                                        │
       │                ┌─────────────────────┐                 │
       │                │      ● LIVE CAM     │                 │
       │                │                     │                 │
       │                │      [   O   ]      │                 │
       │                │    ALIGN FACE HERE  │                 │
       │                │                     │                 │
       │                └─────────────────────┘                 │
       │                                                        │
       │       ● Auto In/Out Detection   ● 2.5m Cooldown        │
       │                                                        │
       │     [SUCCESS] 09:14 AM — Check-In Recorded             │
       │               Rohit Verma (Engineering)                │
       └────────────────────────────────────────────────────────┘
```

### 7.1 Terminal Setup & Hardware Recommendations
- **Recommended Devices**: Dedicated 10" or 12" tablet (iPad, Samsung Galaxy Tab) or an all-in-one touchscreen PC mounted at eye level (5 to 5.5 feet from floor).
- **Lighting**: Ensure even, frontal ambient lighting. Avoid pointing cameras directly at exterior glass doors with fluctuating sunlight.
- **Launching Kiosk**: Log in as an administrator, navigate to `/kiosk`, and switch the browser to full-screen mode (`F11` on PC or iOS Guided Access on iPad).

### 7.2 Walk-Up Experience & Auto In/Out Detection
1. The employee walks up to the terminal and positions their face within the on-screen oval guide.
2. In less than 300ms, the facial recognition engine identifies the employee.
3. **Smart In/Out Logic**:
   - If the employee has not yet checked in today: the system records an instant **Check-In** timestamp.
   - If the employee is already checked in: the system records an instant **Check-Out** timestamp.
4. Both Check-In and Check-Out records are synchronized in real time to the cloud database.

### 7.3 Anti-Duplicate Punch Lockout (Cooldown)
To prevent accidental double-punches (such as when an employee stops to talk to a colleague in front of the camera), Flowpeople enforces a **2.5-minute cooldown timer**. If the same face remains in view within 2.5 minutes of a recorded punch, the system skips re-punching and displays a gentle on-screen notice.

### 7.4 Audio-Visual Feedback & Toast Notifications
- **Visual Toast**: Displays the employee's name, avatar, department, exact punch timestamp, and confirmation badge.
- **Audio Sound**: Emits a pleasant, audible confirmation chime indicating successful verification so employees know their punch succeeded without having to touch the screen.

---

## 8. Troubleshooting & Frequently Asked Questions (FAQ)

### Q1: The kiosk says "Camera permission denied" or video is black.
- **Resolution**:
  1. Look at your browser address bar. Click the camera/lock icon.
  2. Select **Allow** for camera permissions.
  3. Ensure no other application (Zoom, Teams, Skype) is currently using the webcam.
  4. Refresh the page (`Ctrl + F5` or `Cmd + Shift + R`).

### Q2: Face recognition says "Low Confidence" or does not identify an employee.
- **Resolution**:
  1. Check lighting conditions. If backlighting is too strong, add a warm frontal desk lamp or move the kiosk away from direct sunlight.
  2. Ask the employee to remove thick scarves, hats, or dark sunglasses.
  3. Open **Face Enrollment** (`/enroll`) and re-enroll the employee with 3 fresh angle captures.

### Q3: An employee forgot their login password.
- **Resolution**:
  1. An administrator can open **Employees** (`/employees`), click the employee profile, and select **Reset Password**.
  2. Alternatively, the employee can click **Forgot password?** on the sign-in page to receive an automated reset link via email.

### Q4: An employee worked off-site and missed their kiosk punch.
- **Resolution**:
  1. An administrator can open **Attendance** (`/attendance`).
  2. Click **Adjust Record** or **Add Manual Punch**.
  3. Select the employee, date, exact Check-In and Check-Out times, and type an explanatory note.

### Q5: How do I export attendance records for my monthly payroll?
- **Resolution**:
  1. Open **Reports** (`/reports`).
  2. Select the desired date range (e.g., `1st to 30th of the month`).
  3. Click **Export to CSV**. Open the downloaded CSV file in Microsoft Excel, Google Sheets, or import directly into your payroll software.

---

## 9. Security, Privacy & Data Compliance

### Biometric Privacy
Flowpeople adheres to strict data privacy principles:
- **No Raw Photo Storage**: The platform converts facial landmarks into 128-dimensional floating point numerical vectors locally on the device.
- **Non-Reversible Data**: A 128-dimensional mathematical vector cannot be reverse-engineered back into an image of a human face.

### Database Row-Level Security (RLS)
Every database table (`employees`, `attendance`, `leaves`, `documents`, `announcements`) is governed by PostgreSQL Row-Level Security policies:
- Employees are strictly prohibited by the database kernel from reading or modifying another employee's private records.
- All administrative and managerial operations require active, validated session tokens.

### Stealth Superadmin Protection
The Superadmin console does not expose root credentials or identifiers anywhere in public frontend code bundles, ensuring enterprise security from external and internal sniffing.

---

*Flowpeople by Fluxora User Manual — Version 2.4.0 — All Rights Reserved.*


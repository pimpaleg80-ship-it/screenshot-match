# Project Audit & Cleanup Report

**Date**: 2026-11-05  
**Project**: FaceTime Attendance with Google Drive Backup  
**Workspace**: `f:\New folder (3)`

---

## 1. Project Overview & Tech Stack

### What the Project Does

The project is a full-featured, biometric facial recognition attendance and kiosk management web application. It allows organizations to:

- Authenticate admins, managers, and kiosk devices via Supabase Auth.
- Enroll personnel ("People") with live camera capture and face descriptor extraction using `@vladmandic/face-api` (128-float biometric vectors stored in Supabase PostgreSQL).
- Run a touchless attendance Kiosk in full-screen/full-bleed mode with continuous camera face tracking, Euclidean distance face matching, cooldown tracking, and automated check-in/check-out.
- View real-time attendance logs, filter by date/department/status, and manually edit records.
- Generate department & monthly attendance analytics with charts (via `recharts`) and export printable/downloadable PDF reports (via `jspdf` and `jspdf-autotable`).
- Automatically back up generated attendance and report PDFs to Google Drive using Google Drive API v3 (OAuth 2.0 flow with offline refresh tokens and Supabase Edge Functions).

### Tech Stack

- **Framework & Routing**: [TanStack Start](https://tanstack.com/start) (`@tanstack/react-start`), [TanStack Router](https://tanstack.com/router) (`@tanstack/react-router`) with full file-based routing and SSR via Nitro.
- **Data Fetching & State**: [TanStack Query](https://tanstack.com/query) (`@tanstack/react-query` v5).
- **UI & Styling**: [React 19](https://react.dev), [Tailwind CSS v4](https://tailwindcss.com), [Lucide React](https://lucide.dev) icons, Radix UI primitives.
- **Backend & Database**: [Supabase](https://supabase.com) (PostgreSQL, Supabase Auth, Row Level Security, Edge Functions).
- **Biometrics / ML**: `@vladmandic/face-api` for client-side face detection, landmark identification, and descriptor computation.
- **Document Generation**: `jspdf` and `jspdf-autotable`.
- **Testing & Tooling**: Vitest, React Testing Library, ESLint 9, Prettier, TypeScript 5.8.

---

## 2. Folder Structure

```
f:\New folder (3)\
├── .env                                # Environment variables (VITE_SUPABASE_*, etc.)
├── drizzle\                            # Drizzle database migrations and schemas
│   ├── migrations\                     # SQL migrations (including Google Drive backup schema)
│   └── schema.ts                       # Drizzle schema definitions
├── drizzle.config.ts                   # Drizzle configuration
├── eslint.config.js                    # ESLint configuration
├── package.json                        # Dependencies & scripts
├── public\                             # Static assets (face-api models, favicon, logos)
│   └── models\                         # Pretrained face-api neural network weights
├── src\
│   ├── components\
│   │   ├── app-layout.tsx              # Main authenticated shell with desktop/mobile navigation
│   │   ├── theme-toggle.tsx            # Light/dark mode switcher
│   │   └── ui\                         # Shadcn/Radix UI primitive components
│   ├── hooks\
│   │   ├── use-mobile.tsx              # Viewport detection hook (unused outside sidebar)
│   │   └── use-session.ts              # Supabase auth session and user roles hook
│   ├── integrations\
│   │   └── supabase\                   # Supabase clients, auth attacher, and database types
│   ├── lib\
│   │   ├── attendance.ts               # Daily attendance computation & aggregation utilities
│   │   ├── error-capture.ts            # Nitro / SSR error logging capture
│   │   ├── error-page.ts               # SSR fallback error page
│   │   ├── face.ts                     # Face-api model loading, detection, and vector matching
│   │   ├── lovable-error-reporting.ts  # Lovable runtime error listener
│   │   ├── pdf-backup.ts               # Client-side PDF generator & Drive auto-upload trigger
│   │   └── utils.ts                    # Class name utility (clsx + twMerge)
│   ├── routes\                         # TanStack Router file routes
│   │   ├── __root.tsx                  # Root layout with TanStack Query provider & toaster
│   │   ├── _authenticated.tsx          # Authenticated layout route
│   │   ├── auth.tsx                    # Login & registration page
│   │   ├── index.tsx                   # Redirect to /dashboard
│   │   ├── reset-password.tsx          # Password recovery page
│   │   └── _authenticated\
│   │       ├── attendance.tsx          # Attendance log table, manual mark, filters
│   │       ├── dashboard.tsx           # Metrics cards, attendance trend chart, quick stats
│   │       ├── kiosk.tsx               # Fullscreen touchless face recognition kiosk
│   │       ├── people.tsx              # Person directory, face enrollment modal, badge generator
│   │       ├── reports.tsx             # Analytics summaries, PDF generator with Drive backup
│   │       └── settings.tsx            # Org settings, shifts, and Google Drive backup panel
│   ├── test\                           # Vitest unit & integration test suites
│   ├── router.tsx                      # TanStack Router instance creation
│   ├── routeTree.gen.ts                # Auto-generated route tree
│   ├── server.ts                       # Nitro custom server entry point
│   ├── start.ts                        # TanStack Start client/server middleware entry
│   └── styles.css                      # Tailwind v4 theme configuration & CSS variables
├── supabase\
│   └── functions\                      # Supabase Deno Edge Functions
│       ├── _shared\                    # Shared CORS, crypto, and Google Drive API v3 client
│       ├── google-drive-auth-start\    # OAuth 2.0 authorization redirect builder
│       ├── google-drive-auth-callback\ # OAuth 2.0 token exchange & encrypted storage
│       ├── google-drive-daily-backup\  # Scheduled 11:30 PM attendance PDF backup
│       ├── google-drive-status\        # Drive connection status & metadata query
│       └── google-drive-upload\        # Direct PDF upload & folder hierarchy creation
├── tsconfig.json                       # TypeScript compiler options
├── vite.config.ts                      # Vite & TanStack Start build configuration
└── vitest.config.ts                    # Vitest runner configuration
```

---

## 3. Unused Files (Candidates for Removal)

The following files are not imported anywhere in the application or are only imported by other unused files:

### Unused UI Components (in `src/components/ui/`)

1. `src/components/ui/accordion.tsx` — Unused Radix accordion component; not referenced anywhere.
2. `src/components/ui/alert-dialog.tsx` — Unused modal confirmation dialog; not referenced anywhere.
3. `src/components/ui/alert.tsx` — Unused static banner component; notifications use `sonner`.
4. `src/components/ui/aspect-ratio.tsx` — Unused aspect ratio container; not referenced anywhere.
5. `src/components/ui/avatar.tsx` — Unused avatar element; people list uses custom avatar placeholders.
6. `src/components/ui/breadcrumb.tsx` — Unused breadcrumb navigation; not referenced anywhere.
7. `src/components/ui/calendar.tsx` — Unused date picker; dates are selected via native HTML5 date inputs.
8. `src/components/ui/carousel.tsx` — Unused Embla carousel wrapper; not referenced anywhere.
9. `src/components/ui/chart.tsx` — Unused shadcn chart container; dashboard & reports render Recharts directly.
10. `src/components/ui/collapsible.tsx` — Unused collapsible container; not referenced anywhere.
11. `src/components/ui/command.tsx` — Unused cmdk palette; not referenced anywhere.
12. `src/components/ui/context-menu.tsx` — Unused right-click menu; not referenced anywhere.
13. `src/components/ui/drawer.tsx` — Unused mobile drawer; mobile navigation uses `sheet.tsx`.
14. `src/components/ui/form.tsx` — Unused react-hook-form wrapper; forms use standard React state & form events.
15. `src/components/ui/hover-card.tsx` — Unused hover tooltip card; not referenced anywhere.
16. `src/components/ui/input-otp.tsx` — Unused OTP one-time-passcode input; not referenced anywhere.
17. `src/components/ui/menubar.tsx` — Unused desktop menubar; navigation is handled in `app-layout.tsx`.
18. `src/components/ui/navigation-menu.tsx` — Unused desktop navigation menu; not referenced anywhere.
19. `src/components/ui/pagination.tsx` — Unused pagination control; table uses direct slice/page controls.
20. `src/components/ui/popover.tsx` — Unused popover float; not referenced anywhere.
21. `src/components/ui/progress.tsx` — Unused progress bar; not referenced anywhere.
22. `src/components/ui/radio-group.tsx` — Unused radio group; options use select dropdowns or buttons.
23. `src/components/ui/resizable.tsx` — Unused split panel resizer; not referenced anywhere.
24. `src/components/ui/scroll-area.tsx` — Unused scroll area; overflow uses Tailwind `overflow-auto`.
25. `src/components/ui/separator.tsx` — Only imported by unused `sidebar.tsx`.
26. `src/components/ui/sidebar.tsx` — Unused shadcn sidebar; `app-layout.tsx` uses a custom responsive layout.
27. `src/components/ui/slider.tsx` — Unused range slider; settings use native input sliders or toggles.
28. `src/components/ui/table.tsx` — Unused table wrapper; records & reports use direct HTML tables with Tailwind classes.
29. `src/components/ui/textarea.tsx` — Unused multi-line text input; not referenced anywhere.
30. `src/components/ui/toggle-group.tsx` — Unused toggle button group; not referenced anywhere.
31. `src/components/ui/toggle.tsx` — Only imported by unused `toggle-group.tsx`.
32. `src/components/ui/tooltip.tsx` — Only imported by unused `sidebar.tsx`.

### Unused Hooks

1. `src/hooks/use-mobile.tsx` — Only imported by unused `src/components/ui/sidebar.tsx`.

### Temporary Scratch Files

1. `scripts/scan-project.js` — Temporary scan script created during previous inspection.

---

## 4. Unused Components, Functions, Variables, and Imports

### Unused Imports in Active Files

1. `src/components/app-layout.tsx:13`
   - `import { toast } from "sonner";`
   - _Reason_: `toast` is imported but never invoked in `AppLayout`.

---

## 5. Unused npm Packages in `package.json`

The following 28 packages are either completely unreferenced across the codebase or are only imported by the unused UI components listed above:

| Package                           | Reason / Dependency Source                                  | Safe to Remove? |
| :-------------------------------- | :---------------------------------------------------------- | :-------------- |
| `@hookform/resolvers`             | Only used in unused `src/components/ui/form.tsx`            | Yes (Safe)      |
| `@radix-ui/react-accordion`       | Only used in unused `src/components/ui/accordion.tsx`       | Yes (Safe)      |
| `@radix-ui/react-alert-dialog`    | Only used in unused `src/components/ui/alert-dialog.tsx`    | Yes (Safe)      |
| `@radix-ui/react-aspect-ratio`    | Only used in unused `src/components/ui/aspect-ratio.tsx`    | Yes (Safe)      |
| `@radix-ui/react-avatar`          | Only used in unused `src/components/ui/avatar.tsx`          | Yes (Safe)      |
| `@radix-ui/react-collapsible`     | Only used in unused `src/components/ui/collapsible.tsx`     | Yes (Safe)      |
| `@radix-ui/react-context-menu`    | Only used in unused `src/components/ui/context-menu.tsx`    | Yes (Safe)      |
| `@radix-ui/react-hover-card`      | Only used in unused `src/components/ui/hover-card.tsx`      | Yes (Safe)      |
| `@radix-ui/react-menubar`         | Only used in unused `src/components/ui/menubar.tsx`         | Yes (Safe)      |
| `@radix-ui/react-navigation-menu` | Only used in unused `src/components/ui/navigation-menu.tsx` | Yes (Safe)      |
| `@radix-ui/react-popover`         | Only used in unused `src/components/ui/popover.tsx`         | Yes (Safe)      |
| `@radix-ui/react-progress`        | Only used in unused `src/components/ui/progress.tsx`        | Yes (Safe)      |
| `@radix-ui/react-radio-group`     | Only used in unused `src/components/ui/radio-group.tsx`     | Yes (Safe)      |
| `@radix-ui/react-scroll-area`     | Only used in unused `src/components/ui/scroll-area.tsx`     | Yes (Safe)      |
| `@radix-ui/react-separator`       | Only used in unused `src/components/ui/separator.tsx`       | Yes (Safe)      |
| `@radix-ui/react-slider`          | Only used in unused `src/components/ui/slider.tsx`          | Yes (Safe)      |
| `@radix-ui/react-toggle`          | Only used in unused `src/components/ui/toggle.tsx`          | Yes (Safe)      |
| `@radix-ui/react-toggle-group`    | Only used in unused `src/components/ui/toggle-group.tsx`    | Yes (Safe)      |
| `@radix-ui/react-tooltip`         | Only used in unused `src/components/ui/tooltip.tsx`         | Yes (Safe)      |
| `cmdk`                            | Only used in unused `src/components/ui/command.tsx`         | Yes (Safe)      |
| `date-fns`                        | Zero imports anywhere in repo (native `Date` methods used)  | Yes (Safe)      |
| `embla-carousel-react`            | Only used in unused `src/components/ui/carousel.tsx`        | Yes (Safe)      |
| `input-otp`                       | Only used in unused `src/components/ui/input-otp.tsx`       | Yes (Safe)      |
| `react-day-picker`                | Only used in unused `src/components/ui/calendar.tsx`        | Yes (Safe)      |
| `react-hook-form`                 | Only used in unused `src/components/ui/form.tsx`            | Yes (Safe)      |
| `react-resizable-panels`          | Only used in unused `src/components/ui/resizable.tsx`       | Yes (Safe)      |
| `vaul`                            | Only used in unused `src/components/ui/drawer.tsx`          | Yes (Safe)      |
| `zod`                             | Zero imports anywhere in repo                               | Yes (Safe)      |

---

## 6. Duplicate Code or Components

- **Table Styles**: Tables in `attendance.tsx` and `reports.tsx` share similar styled `<table>` / `<th>` / `<td>` markup instead of using `src/components/ui/table.tsx`. Since each has custom columns, actions, and sorting, keeping them inline is standard and avoids excessive abstraction.
- **No Duplicate Routes or Components Found**: Each route handles a distinct view (`dashboard`, `people`, `kiosk`, `attendance`, `reports`, `settings`).

---

## 7. Console.log, Commented-out Code, and TODO Leftovers

- **`console.log`**: 0 instances found in `src/`.
- **`TODO` / `FIXME`**: 0 instances found in `src/`.
- **`console.error` / `console.warn`**: 18 instances found. All are appropriate runtime error handlers:
  - `src/start.ts`, `src/server.ts`, `src/lib/error-capture.ts`: SSR error logging pipeline.
  - `src/lib/pdf-backup.ts`: Non-blocking warning logs when automatic background Drive upload fails.
  - `src/routes/_authenticated/kiosk.tsx`, `people.tsx`: Webcam access and face detection failure logging.
  - `src/integrations/supabase/client.ts`: Supabase credential failure logging.

---

## 8. TypeScript & ESLint Status

- **TypeScript (`npx tsc --noEmit`)**: Passes with **0 errors**.
- **Unit Tests (`npm test`)**: **12 / 12 tests passed** (100% passing).
- **Production Build (`npm run build`)**: Nitro + Vite builds successfully without errors.
- **ESLint**:
  - Semantic warnings on `react-refresh/only-export-components` across UI components exporting variants.
  - `@typescript-eslint/no-explicit-any` on Supabase error handlers in Edge Functions and Settings.
  - Windows CRLF formatting notices from `eslint-plugin-prettier` (`Delete ␍`).

---

## 9. "Needs My Review" (Kept for Safety)

The following files are not currently imported by client route code, but are **retained** because they are generated integration files or toolchain configs:

1. `src/integrations/supabase/auth-middleware.ts` — Lovable-generated SSR authentication middleware. Kept so server functions can authenticate users if added.
2. `src/integrations/supabase/client.server.ts` — Lovable-generated service role admin client. Kept for secure server-side execution.
3. `src/integrations/supabase/cron-auth.ts` — Lovable-generated cron authentication helper.
4. `drizzle.config.ts`, `drizzle-kit`, `drizzle-orm`, `postgres` — Retained because they manage database migrations.
5. `bun.lock`, `bunfig.toml` — Kept for developers who may use Bun instead of npm.

---

## 10. Cleanup Summary

- **Total Files Removed**: 34 files
  - 32 unused UI component files in `src/components/ui/`
  - 1 unused hook in `src/hooks/use-mobile.tsx`
  - 1 temporary script in `scripts/scan-project.js` (and the `scripts/` directory)
- **Total npm Packages Removed**: 28 direct packages uninstalled (35 packages removed total including transitive dependencies)
- **Total Lines of Code Removed**: 3,568 lines of code
- **Bundle Optimization**: Production CSS bundle reduced from `95.05 kB` to `62.87 kB` (a 34% reduction in CSS overhead).
- **Compilation Status**:
  - `npx tsc --noEmit`: 0 errors
  - `npm test`: 12 / 12 tests passing
  - `npm run build`: Production Nitro + Vite build succeeded with 0 errors.

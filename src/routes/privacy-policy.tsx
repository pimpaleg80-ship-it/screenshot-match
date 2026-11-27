import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import "@/components/homepage/landing.css";
import { Navbar } from "@/components/homepage/Navbar";
import { Footer } from "@/components/homepage/Footer";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Flowpeople by Fluxora" },
      {
        name: "description",
        content:
          "Privacy Policy for Flowpeople by Fluxora. Learn how we handle GPS geofencing, attendance records, workforce profiles, and Google Drive cloud backups.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

const PRIVACY_SECTIONS = [
  { id: "introduction", label: "1. Introduction" },
  { id: "collection", label: "2. Information We Collect" },
  { id: "google-drive", label: "3. Google Drive API & Limited Use" },
  { id: "processing", label: "4. How We Use Information" },
  { id: "security", label: "5. Security & Storage Architecture" },
  { id: "retention", label: "6. Retention & Deletion" },
  { id: "rights", label: "7. Your Privacy Rights" },
  { id: "contact", label: "8. Contact Privacy Officer" },
];

const DATA_CATEGORIES = [
  {
    title: "Account & Organization Data",
    description:
      "Administrator names, corporate email addresses, company identifiers, roles, department hierarchies, and encrypted credentials.",
  },
  {
    title: "Employee Workforce Records",
    description:
      "Employee codes, full names, job titles, department assignments, shift allocations, and leave balances.",
  },
  {
    title: "Attendance & Time Logs",
    description:
      "Clock-in and clock-out timestamps, working hours summaries, overtime computations, and anomaly flags.",
  },
  {
    title: "Biometric Facial Descriptors",
    description:
      "When facial recognition is enrolled, our on-device algorithm extracts mathematical embeddings (128-dimensional vectors) for attendance matching. Full-resolution photos are never shared with third parties.",
  },
  {
    title: "Geofencing & Location Data",
    description:
      "Precise GPS coordinates (latitude, longitude, accuracy) captured strictly when an employee submits a clock-in or clock-out to check workplace perimeter boundaries. Continuous background tracking is not performed.",
  },
];

const SECURITY_SAFEGUARDS = [
  {
    label: "Data in transit",
    detail:
      "All traffic between browsers, kiosks, and application servers is encrypted with modern TLS 1.3.",
  },
  {
    label: "Data at rest",
    detail:
      "Database records, storage objects, and OAuth tokens are encrypted using AES-256.",
  },
  {
    label: "Row-Level Security (RLS)",
    detail:
      "Every database table enforces PostgreSQL Row-Level Security policies to prevent cross-tenant data access.",
  },
  {
    label: "Local biometric extraction",
    detail:
      "Facial descriptor extraction runs client-side in WebAssembly/WebGL models, minimizing raw photo transmission.",
  },
];

function PrivacyPolicyPage() {
  const lastUpdated = "November 15, 2026";

  return (
    <div className="fp-landing min-h-screen overflow-x-clip bg-[#F7F9FE] text-[#64748B] font-sans flex flex-col selection:bg-[#EDEBFF] selection:text-[#172554]">
      <Navbar />

      {/* Broad Editorial Header */}
      <section className="border-b border-[#E5EAF4] bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-[#315EFB]">
                Trust &amp; Transparency
              </p>
              <h1 className="fp-display mt-2.5 text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-[-0.03em] text-[#172554]">
                Privacy Policy
              </h1>
              <p className="mt-2.5 text-sm text-[#64748B]">
                Effective &amp; Last Updated:{" "}
                <span className="font-semibold text-[#172554]">{lastUpdated}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/terms"
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E5EAF4] bg-[#F7F9FE] px-4 py-2.5 text-xs font-semibold text-[#172554] transition-colors hover:border-[#315EFB]/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315EFB]"
              >
                Terms of Service
              </Link>
              <Link
                to="/"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#315EFB] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#254EDB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315EFB]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Back to Home
              </Link>
            </div>
          </div>

          <div className="mt-7 border-l-2 border-[#315EFB] bg-[#F7F9FE] px-5 py-4 rounded-r-xl max-w-4xl">
            <p className="text-sm leading-relaxed text-[#64748B]">
              <strong className="font-semibold text-[#172554]">Our data commitment: </strong>
              Flowpeople by Fluxora is built on strict data minimization. We never sell workforce or employee records, we do not train public AI models on your data, and Google Drive backups operate solely inside a user-granted sandboxed folder.
            </p>
          </div>
        </div>
      </section>

      {/* Broad Two-Column Legal Document */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Sticky Quick Index */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24 rounded-2xl border border-[#E5EAF4] bg-white p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#315EFB] mb-3">
                Policy Contents
              </p>
              <nav className="space-y-1 text-xs" aria-label="Privacy policy sections">
                {PRIVACY_SECTIONS.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="block rounded-lg px-2.5 py-2 font-medium text-[#64748B] transition-colors hover:bg-[#F7F9FE] hover:text-[#172554]"
                  >
                    {sec.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Right Broad Unified Policy Sheet */}
          <article className="lg:col-span-9 overflow-hidden rounded-2xl border border-[#E5EAF4] bg-white divide-y divide-[#E5EAF4] text-sm leading-relaxed text-[#64748B]">
            {/* Section 1 */}
            <section id="introduction" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">1. Introduction</h2>
              <p className="max-w-3xl">
                Flowpeople (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;), operated by{" "}
                <strong className="text-[#172554]">Fluxora</strong>, provides an enterprise workforce management, GPS geofenced attendance, leave management, and automated document reporting platform.
              </p>
              <p className="max-w-3xl">
                This Privacy Policy explains how we collect, store, process, and protect personal data when you use the Flowpeople application, web portal, and related services.
              </p>
            </section>

            {/* Section 2 */}
            <section id="collection" className="scroll-mt-24 p-6 sm:p-9 space-y-4">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                2. Information We Collect
              </h2>
              <p className="max-w-3xl">
                We process the following categories of information to provide workforce management services:
              </p>
              <dl className="divide-y divide-[#E5EAF4] border-y border-[#E5EAF4]">
                {DATA_CATEGORIES.map((item) => (
                  <div
                    key={item.title}
                    className="grid gap-1.5 py-4 sm:grid-cols-[15rem_1fr] sm:gap-6"
                  >
                    <dt className="font-semibold text-[#172554]">{item.title}</dt>
                    <dd className="text-[13px] leading-relaxed text-[#64748B]">
                      {item.description}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Section 3 */}
            <section id="google-drive" className="scroll-mt-24 p-6 sm:p-9 space-y-4">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                3. Google Drive API &amp; Limited Use Disclosure
              </h2>
              <p className="max-w-3xl">
                Flowpeople includes an optional automated Google Drive cloud backup feature allowing enterprise administrators to archive daily attendance PDF logs and monthly payroll summaries directly to their organization&apos;s Google Drive account.
              </p>
              <div className="border-l-2 border-[#315EFB] bg-[#F7F9FE] px-5 py-4 rounded-r-xl space-y-3">
                <div className="flex items-center gap-2 font-semibold text-[#172554]">
                  <CheckCircle2 className="h-4 w-4 text-[#12A879] shrink-0" aria-hidden="true" />
                  Google API Services User Data Policy Compliance
                </div>
                <p className="text-xs leading-relaxed">
                  Flowpeople&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
                  <a
                    href="https://developers.google.com/terms/api-services-user-data-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#315EFB] underline hover:text-[#5946F6]"
                  >
                    Google API Services User Data Policy
                  </a>
                  , including the Limited Use requirements.
                </p>
                <ul className="text-xs list-disc pl-4 space-y-1.5">
                  <li>
                    <strong className="text-[#172554]">Minimal Scope:</strong> We only request{" "}
                    <code className="bg-white px-1.5 py-0.5 rounded border border-[#E5EAF4] text-[#172554]">
                      drive.file
                    </code>{" "}
                    (access strictly to files created or opened by Flowpeople) and{" "}
                    <code className="bg-white px-1.5 py-0.5 rounded border border-[#E5EAF4] text-[#172554]">
                      userinfo.email
                    </code>
                    .
                  </li>
                  <li>
                    <strong className="text-[#172554]">No Access to Personal Files:</strong> Flowpeople creates and writes exclusively to a dedicated folder named{" "}
                    <code className="bg-white px-1.5 py-0.5 rounded border border-[#E5EAF4] text-[#172554]">
                      FaceAttendance Backups
                    </code>
                    . We cannot view, read, modify, or delete any of your other Google Drive files or folders.
                  </li>
                  <li>
                    <strong className="text-[#172554]">Encrypted Tokens:</strong> Offline OAuth refresh tokens are encrypted at rest with AES-256-GCM. You may revoke access at any time through Flowpeople Settings or directly via your Google Account Security Permissions.
                  </li>
                  <li>
                    <strong className="text-[#172554]">No Human Reading or Advertising:</strong> Google Drive user data is never used for advertising, surveillance, or AI model training.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 4 */}
            <section id="processing" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                4. How We Use and Process Information
              </h2>
              <p>We process collected data solely for legitimate business purposes:</p>
              <ul className="list-disc pl-5 space-y-1.5 max-w-3xl">
                <li>Authenticating users and verifying authorized employee clock-in identity.</li>
                <li>Validating workplace attendance against verified office geofence locations.</li>
                <li>Generating accurate payroll ledgers, overtime reports, and attendance exports.</li>
                <li>Enabling multi-tenant data segregation to ensure strict isolation between organizations.</li>
                <li>Maintaining security audit logs of administrative actions.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section id="security" className="scroll-mt-24 p-6 sm:p-9 space-y-4">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                5. Data Security &amp; Storage Architecture
              </h2>
              <p>We implement enterprise-grade technical and organizational safeguards:</p>
              <dl className="divide-y divide-[#E5EAF4] border-y border-[#E5EAF4]">
                {SECURITY_SAFEGUARDS.map((item) => (
                  <div
                    key={item.label}
                    className="grid gap-1.5 py-4 sm:grid-cols-[15rem_1fr] sm:gap-6"
                  >
                    <dt className="font-semibold text-[#172554]">{item.label}</dt>
                    <dd className="text-[13px] leading-relaxed text-[#64748B]">
                      {item.detail}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Section 6 */}
            <section id="retention" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                6. Data Retention and Deletion
              </h2>
              <p className="max-w-3xl">
                We retain attendance and workforce data for as long as your organization maintains an active subscription or as required by applicable employment and labor laws.
              </p>
              <p className="max-w-3xl">
                Upon employee departure or customer request, biometric facial embeddings and employee profiles can be permanently purged by an authorized administrator directly through the People management console.
              </p>
            </section>

            {/* Section 7 */}
            <section id="rights" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">7. Your Rights</h2>
              <p className="max-w-3xl">
                Depending on your jurisdiction (including GDPR, CCPA, and local privacy laws), you have the right to:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 max-w-3xl">
                <li>Request access to the personal data we maintain about you.</li>
                <li>Request correction of inaccurate or outdated records.</li>
                <li>Request deletion of your biometric facial descriptors and profile.</li>
                <li>Export your attendance ledgers in portable machine-readable format (CSV/PDF).</li>
                <li>Revoke third-party integrations (including Google Drive) at any time.</li>
              </ul>
            </section>

            {/* Section 8: Contact */}
            <section id="contact" className="scroll-mt-24 p-6 sm:p-9 space-y-4">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                8. Contact Us &amp; Privacy Officer
              </h2>
              <p className="max-w-3xl">
                If you have questions or requests regarding this Privacy Policy or your personal data, please contact our Data Protection Team:
              </p>
              <div className="flex flex-col gap-1 border-l-2 border-[#315EFB] pl-4 text-sm">
                <span className="font-semibold text-[#172554]">Fluxora / Flowpeople Support</span>
                <span className="text-xs text-[#64748B]">Enterprise Privacy &amp; Compliance</span>
                <a
                  href="mailto:hqfluxora@gmail.com"
                  className="mt-1 inline-flex items-center gap-2 font-semibold text-[#315EFB] hover:text-[#5946F6] hover:underline"
                >
                  <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                  hqfluxora@gmail.com
                </a>
              </div>
            </section>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}

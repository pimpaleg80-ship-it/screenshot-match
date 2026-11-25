import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Mail, Lock, FileText, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

function PrivacyPolicyPage() {
  const lastUpdated = "November 15, 2026";

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo variant="horizontal" size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/terms">
              <Button variant="ghost" size="sm">
                Terms of Service
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Back to Sign in
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        {/* Title Header */}
        <div className="mb-10 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
            <Shield className="h-3.5 w-3.5" />
            Trust & Transparency
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective & Last Updated: <span className="font-medium text-foreground">{lastUpdated}</span>
          </p>
        </div>

        {/* Highlight Card */}
        <Card className="mb-10 border-primary/20 bg-primary/5">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <Lock className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-base">Our Commitment to Enterprise Data Privacy</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Flowpeople by Fluxora is built on strict data minimization principles. We do not sell your personal or employee data, we do not train external public AI models on your workforce records, and our Google Drive integration operates strictly within user-granted sandboxed folder permissions.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Content Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">1. Introduction</h2>
            <p>
              Flowpeople (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;), operated by <strong>Fluxora</strong>, provides an enterprise workforce management, GPS geofenced attendance, leave management, and automated document reporting platform.
            </p>
            <p>
              This Privacy Policy explains how we collect, store, process, and protect personal data when you use the Flowpeople application, web portal, and related services.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">2. Information We Collect</h2>
            <p>We process the following categories of information to provide workforce management services:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Account and Organization Data:</strong> Administrator names, corporate email addresses, company identifiers, roles, department hierarchies, and encrypted credentials.
              </li>
              <li>
                <strong className="text-foreground">Employee Workforce Records:</strong> Employee identifiers (employee code), full names, job titles, department assignments, shift allocations, and leave balances.
              </li>
              <li>
                <strong className="text-foreground">Attendance & Time Logs:</strong> Clock-in and clock-out timestamps, working hours summaries, overtime computations, and anomaly flags.
              </li>
              <li>
                <strong className="text-foreground">Biometric Facial Descriptors:</strong> When facial recognition is enrolled, our on-device algorithm extracts mathematical numerical embeddings (128-dimensional vectors) for 1:N attendance matching. Raw full-resolution photos are handled with strict consent and are never distributed to third parties.
              </li>
              <li>
                <strong className="text-foreground">Geofencing & Location Data:</strong> Precise GPS coordinates (latitude, longitude, accuracy) captured only during the moment an employee submits a clock-in or clock-out to verify designated workplace geofence radius boundaries. Continuous background tracking is not performed.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">3. Google Drive API & Limited Use Disclosure</h2>
            <p>
              Flowpeople includes an optional automated Google Drive cloud backup feature allowing enterprise administrators to archive daily attendance PDF logs and generated monthly payroll summaries directly to their organization&apos;s Google Drive account.
            </p>
            <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Google API Services User Data Policy Compliance
              </div>
              <p className="text-xs text-muted-foreground leading-normal">
                Flowpeople&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:text-primary/80"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
              <ul className="text-xs list-disc pl-4 space-y-1 text-muted-foreground">
                <li>
                  <strong>Minimal Scope:</strong> We only request <code className="bg-background px-1 py-0.5 rounded border">drive.file</code> (access strictly to files created or opened by Flowpeople) and <code className="bg-background px-1 py-0.5 rounded border">userinfo.email</code>.
                </li>
                <li>
                  <strong>No Access to Personal Files:</strong> Flowpeople creates and writes exclusively to a dedicated folder named <code className="bg-background px-1 py-0.5 rounded border">FaceAttendance Backups</code>. We cannot view, read, modify, or delete any of your other Google Drive files or folders.
                </li>
                <li>
                  <strong>Encrypted Tokens:</strong> Offline OAuth refresh tokens are encrypted at rest with AES-256-GCM. You may revoke access at any time through Flowpeople Settings or directly via your Google Account Security Permissions.
                </li>
                <li>
                  <strong>No Human Reading or Advertising:</strong> Google Drive user data is never used for advertising, surveillance, or AI model training.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">4. How We Use and Process Information</h2>
            <p>We process collected data solely for legitimate business purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Authenticating users and verifying authorized employee clock-in identity.</li>
              <li>Validating workplace attendance against verified office geofence locations.</li>
              <li>Generating accurate payroll ledgers, overtime reports, and attendance exports.</li>
              <li>Enabling multi-tenant data segregation to ensure total privacy between organizations.</li>
              <li>Maintaining immutable security audit logs of administrative actions.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">5. Data Security & Storage Architecture</h2>
            <p>We implement enterprise-grade technical and organizational safeguards:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Data in Transit:</strong> All data transmitted between browsers, kiosks, and servers is secured using modern TLS 1.3 cryptographic protocols.
              </li>
              <li>
                <strong>Data at Rest:</strong> Database records, storage objects, and tokens are protected with AES-256 encryption.
              </li>
              <li>
                <strong>Row-Level Security (RLS):</strong> Every database table is protected by PostgreSQL Row-Level Security, preventing cross-tenant leakage.
              </li>
              <li>
                <strong>Local Biometric Extraction:</strong> Facial analysis runs client-side inside WebAssembly / WebGL neural models, minimizing raw photographic transmission.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">6. Data Retention and Deletion</h2>
            <p>
              We retain attendance and workforce data for as long as your organization maintains an active subscription or as required by applicable employment and labor laws.
            </p>
            <p>
              Upon employee departure or upon customer request, biometric facial embeddings and employee profiles can be permanently purged by an authorized administrator directly through the People management console.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">7. Your Rights</h2>
            <p>Depending on your jurisdiction (including GDPR, CCPA, and local privacy laws), you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Request access to the personal data we maintain about you.</li>
              <li>Request rectification of incorrect or outdated records.</li>
              <li>Request erasure of your biometric facial descriptors and profile.</li>
              <li>Export your attendance ledgers in portable machine-readable format (CSV/PDF).</li>
              <li>Revoke third-party integrations (including Google Drive) at any time.</li>
            </ul>
          </section>

          {/* Section 8: Contact */}
          <section className="space-y-4 pt-4 border-t">
            <h2 className="text-lg font-bold text-foreground">8. Contact Us & Privacy Officer</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact our Data Protection Team:
            </p>
            <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm max-w-md">
              <div className="font-semibold text-foreground">Fluxora / Flowpeople Support</div>
              <div className="text-xs text-muted-foreground mt-0.5">Enterprise Privacy & Compliance</div>
              <div className="mt-3 flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a
                  href="mailto:hqfluxora@gmail.com"
                  className="font-medium text-primary hover:underline"
                >
                  hqfluxora@gmail.com
                </a>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-14 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Fluxora. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:underline">
              Terms of Service
            </Link>
            <span>•</span>
            <a href="mailto:hqfluxora@gmail.com" className="hover:underline">
              Contact: hqfluxora@gmail.com
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

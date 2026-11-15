import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Mail, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — Flowpeople by Fluxora" },
      {
        name: "description",
        content:
          "Terms and Conditions of Service for Flowpeople by Fluxora biometric workforce and attendance management platform.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
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
            <Link to="/privacy-policy">
              <Button variant="ghost" size="sm">
                Privacy Policy
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
            <FileText className="h-3.5 w-3.5" />
            Terms of Service
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Terms and Conditions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Effective & Last Updated: <span className="font-medium text-foreground">{lastUpdated}</span>
          </p>
        </div>

        {/* Highlight Card */}
        <Card className="mb-10 border-primary/20 bg-primary/5">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-base">Enterprise Agreement Overview</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                By accessing or using Flowpeople by Fluxora, you agree to comply with these terms. Flowpeople provides enterprise biometric attendance, geofence verification, workforce analytics, and secure cloud archiving.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Content Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">1. Agreement & Acceptance of Terms</h2>
            <p>
              These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement between your business or organization (&quot;Customer&quot;, &quot;you&quot;, &quot;your&quot;) and <strong>Fluxora</strong> (&quot;Fluxora&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;), governing your use of the Flowpeople enterprise platform, web applications, and attendance kiosks.
            </p>
            <p>
              By accessing, registering for, or using Flowpeople, you represent that you have the authority to bind your organization to these Terms. If you do not agree to these Terms, you must discontinue use immediately.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">2. Description of the Service</h2>
            <p>Flowpeople provides an enterprise workforce management solution featuring:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Biometric facial recognition clock-in/out and kiosk operation.</li>
              <li>GPS workplace geofence radius boundary verification.</li>
              <li>Shift scheduling, leave requests, approval pipelines, and balance tracking.</li>
              <li>Attendance ledger reporting, overtime calculation, and payroll exports.</li>
              <li>Automated cloud archiving and document backups (including Google Drive).</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">3. Customer Responsibilities & Biometric Compliance</h2>
            <p>
              Customer acknowledges that facial biometric templates constitute sensitive personal data under applicable employment and privacy laws (e.g., GDPR, BIPA, state labor codes). Customer agrees to:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Obtain Lawful Consent:</strong> Provide required notices and obtain valid informed written consent from employees and contractors prior to enrolling their facial biometric profiles into Flowpeople.
              </li>
              <li>
                <strong>Account Confidentiality:</strong> Maintain the security and confidentiality of administrator and supervisor credentials. Customer is responsible for all activity conducted through its tenant workspace.
              </li>
              <li>
                <strong>Lawful Workforce Surveillance:</strong> Utilize geolocation verification strictly for legitimate workplace attendance and shift compliance during active clock-in/out events.
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">4. Google Drive Integration & Third-Party Services</h2>
            <p>
              Customer may optionally connect its Google Drive account to receive automated daily attendance PDF archives and monthly reports.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Customer authorizes Flowpeople to create and manage files strictly within the designated <code className="bg-background px-1 py-0.5 rounded border">FaceAttendance Backups</code> folder on Customer&apos;s Google Drive.
              </li>
              <li>
                Flowpeople adheres to the Google API Services User Data Policy (including Limited Use requirements). We never access or modify personal or unrelated files in your Google Drive.
              </li>
              <li>
                Customer may disconnect the integration or revoke authorization at any time via Flowpeople Settings or Google Account security controls.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">5. Data Ownership & Intellectual Property</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Customer Data Ownership:</strong> Customer retains exclusive ownership, title, and interest in all workforce records, attendance ledgers, employee information, and organization data entered into Flowpeople.
              </li>
              <li>
                <strong className="text-foreground">Fluxora Intellectual Property:</strong> All software code, algorithms, neural network integration models, user interface designs, logos, and trademarks remain the sole and exclusive intellectual property of Fluxora.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">6. Service Availability & Support</h2>
            <p>
              Fluxora uses commercially reasonable efforts to ensure 99.9% uptime for the hosted Service. Scheduled maintenance will be announced in advance when possible. Technical support and incident response are available by contacting our support desk.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, neither party will be liable for any indirect, incidental, consequential, special, or punitive damages (including loss of profits, data, or business interruption) arising out of or related to these Terms or the use of the Service.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-foreground">8. Termination & Data Deletion</h2>
            <p>
              Either party may terminate the enterprise agreement in accordance with the applicable service contract. Upon termination:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Customer will have 30 days to export attendance ledgers, archives, and reporting data.</li>
              <li>Following the export window, Customer data and biometric embeddings will be permanently and securely deleted from active databases.</li>
            </ul>
          </section>

          {/* Section 9: Contact */}
          <section className="space-y-4 pt-4 border-t">
            <h2 className="text-lg font-bold text-foreground">9. Contact & Inquiries</h2>
            <p>
              If you have any questions or legal inquiries regarding these Terms and Conditions, please contact us at:
            </p>
            <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm max-w-md">
              <div className="font-semibold text-foreground">Fluxora Legal & Support</div>
              <div className="text-xs text-muted-foreground mt-0.5">Flowpeople Enterprise Platform</div>
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
            <Link to="/privacy-policy" className="hover:underline">
              Privacy Policy
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

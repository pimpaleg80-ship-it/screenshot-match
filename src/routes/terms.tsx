import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import "@/components/homepage/landing.css";
import { Navbar } from "@/components/homepage/Navbar";
import { Footer } from "@/components/homepage/Footer";

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

const TERMS_SECTIONS = [
  { id: "acceptance", label: "1. Agreement & Acceptance" },
  { id: "service", label: "2. Description of the Service" },
  { id: "responsibilities", label: "3. Customer Responsibilities" },
  { id: "google-drive", label: "4. Google Drive Integration" },
  { id: "ownership", label: "5. Data Ownership & IP" },
  { id: "availability", label: "6. Availability & Support" },
  { id: "liability", label: "7. Limitation of Liability" },
  { id: "termination", label: "8. Termination & Deletion" },
  { id: "contact", label: "9. Contact & Inquiries" },
];

const CUSTOMER_RESPONSIBILITIES = [
  {
    title: "Obtain Lawful Consent",
    description:
      "Provide required notices and obtain valid informed written consent from employees and contractors before enrolling facial biometric profiles into Flowpeople.",
  },
  {
    title: "Account Confidentiality",
    description:
      "Maintain the security and confidentiality of administrator and supervisor credentials. Customer is responsible for all activity inside its tenant workspace.",
  },
  {
    title: "Lawful Workplace Verification",
    description:
      "Use geolocation verification solely for workplace attendance and shift compliance during active clock-in and clock-out events.",
  },
];

const OWNERSHIP_TERMS = [
  {
    title: "Customer Data Ownership",
    description:
      "Customer retains exclusive ownership, title, and interest in all workforce records, attendance ledgers, employee details, and organization data entered into Flowpeople.",
  },
  {
    title: "Fluxora Intellectual Property",
    description:
      "All software code, algorithms, neural integration models, interface designs, logos, and trademarks remain the sole and exclusive intellectual property of Fluxora.",
  },
];

function TermsPage() {
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
                Terms of Service
              </p>
              <h1 className="fp-display mt-2.5 text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold tracking-[-0.03em] text-[#172554]">
                Terms and Conditions
              </h1>
              <p className="mt-2.5 text-sm text-[#64748B]">
                Effective &amp; Last Updated:{" "}
                <span className="font-semibold text-[#172554]">{lastUpdated}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/privacy-policy"
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#E5EAF4] bg-[#F7F9FE] px-4 py-2.5 text-xs font-semibold text-[#172554] transition-colors hover:border-[#315EFB]/40 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#315EFB]"
              >
                Privacy Policy
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

          <div className="mt-7 border-l-2 border-[#12A879] bg-[#F7F9FE] px-5 py-4 rounded-r-xl max-w-4xl">
            <p className="text-sm leading-relaxed text-[#64748B]">
              <strong className="font-semibold text-[#172554]">Enterprise agreement overview: </strong>
              By accessing or using Flowpeople by Fluxora, you agree to comply with these terms governing biometric attendance, GPS geofence verification, workforce analytics, and automated cloud archiving.
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
                Agreement Index
              </p>
              <nav className="space-y-1 text-xs" aria-label="Terms sections">
                {TERMS_SECTIONS.map((sec) => (
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

          {/* Right Broad Unified Terms Sheet */}
          <article className="lg:col-span-9 overflow-hidden rounded-2xl border border-[#E5EAF4] bg-white divide-y divide-[#E5EAF4] text-sm leading-relaxed text-[#64748B]">
            {/* Section 1 */}
            <section id="acceptance" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                1. Agreement &amp; Acceptance of Terms
              </h2>
              <p className="max-w-3xl">
                These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement between your business or organization (&quot;Customer&quot;, &quot;you&quot;, &quot;your&quot;) and{" "}
                <strong className="text-[#172554]">Fluxora</strong> (&quot;Fluxora&quot;, &quot;we&quot;, &quot;us&quot;, &quot;our&quot;), governing your use of the Flowpeople enterprise platform, web applications, and attendance kiosks.
              </p>
              <p className="max-w-3xl">
                By accessing, registering for, or using Flowpeople, you represent that you have the authority to bind your organization to these Terms. If you do not agree to these Terms, you must discontinue use immediately.
              </p>
            </section>

            {/* Section 2 */}
            <section id="service" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                2. Description of the Service
              </h2>
              <p>Flowpeople provides an enterprise workforce management solution featuring:</p>
              <ul className="list-disc pl-5 space-y-1.5 max-w-3xl">
                <li>Biometric facial recognition clock-in/out and kiosk operation.</li>
                <li>GPS workplace geofence radius boundary verification.</li>
                <li>Shift scheduling, leave requests, approval pipelines, and balance tracking.</li>
                <li>Attendance ledger reporting, overtime calculation, and payroll exports.</li>
                <li>Automated cloud archiving and document backups (including Google Drive).</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="responsibilities" className="scroll-mt-24 p-6 sm:p-9 space-y-4">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                3. Customer Responsibilities &amp; Biometric Compliance
              </h2>
              <p className="max-w-3xl">
                Customer acknowledges that facial biometric templates constitute sensitive personal data under applicable employment and privacy laws (e.g., GDPR, BIPA, state labor codes). Customer agrees to:
              </p>
              <dl className="divide-y divide-[#E5EAF4] border-y border-[#E5EAF4]">
                {CUSTOMER_RESPONSIBILITIES.map((item) => (
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

            {/* Section 4 */}
            <section id="google-drive" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                4. Google Drive Integration &amp; Third-Party Services
              </h2>
              <p className="max-w-3xl">
                Customer may optionally connect its Google Drive account to receive automated daily attendance PDF archives and monthly reports.
              </p>
              <ul className="list-disc pl-5 space-y-1.5 max-w-3xl">
                <li>
                  Customer authorizes Flowpeople to create and manage files strictly within the designated{" "}
                  <code className="bg-[#F7F9FE] px-1.5 py-0.5 rounded border border-[#E5EAF4] text-[#172554]">
                    FaceAttendance Backups
                  </code>{" "}
                  folder on Customer&apos;s Google Drive.
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
            <section id="ownership" className="scroll-mt-24 p-6 sm:p-9 space-y-4">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                5. Data Ownership &amp; Intellectual Property
              </h2>
              <dl className="divide-y divide-[#E5EAF4] border-y border-[#E5EAF4]">
                {OWNERSHIP_TERMS.map((item) => (
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

            {/* Section 6 */}
            <section id="availability" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                6. Service Availability &amp; Support
              </h2>
              <p className="max-w-3xl">
                Fluxora uses commercially reasonable efforts to ensure 99.9% uptime for the hosted Service. Scheduled maintenance will be announced in advance when possible. Technical support and incident response are available by contacting our support desk.
              </p>
            </section>

            {/* Section 7 */}
            <section id="liability" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                7. Limitation of Liability
              </h2>
              <p className="max-w-3xl">
                To the maximum extent permitted by applicable law, neither party will be liable for any indirect, incidental, consequential, special, or punitive damages (including loss of profits, data, or business interruption) arising out of or related to these Terms or the use of the Service.
              </p>
            </section>

            {/* Section 8 */}
            <section id="termination" className="scroll-mt-24 p-6 sm:p-9 space-y-3">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                8. Termination &amp; Data Deletion
              </h2>
              <p className="max-w-3xl">
                Either party may terminate the enterprise agreement in accordance with the applicable service contract. Upon termination:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 max-w-3xl">
                <li>
                  Customer will have 30 days to export attendance ledgers, archives, and reporting data.
                </li>
                <li>
                  Following the export window, Customer data and biometric embeddings will be permanently and securely deleted from active databases.
                </li>
              </ul>
            </section>

            {/* Section 9: Contact */}
            <section id="contact" className="scroll-mt-24 p-6 sm:p-9 space-y-4">
              <h2 className="fp-display text-lg font-bold text-[#172554]">
                9. Contact &amp; Inquiries
              </h2>
              <p className="max-w-3xl">
                If you have questions or legal inquiries regarding these Terms and Conditions, please contact us at:
              </p>
              <div className="flex flex-col gap-1 border-l-2 border-[#315EFB] pl-4 text-sm">
                <span className="font-semibold text-[#172554]">Fluxora Legal &amp; Support</span>
                <span className="text-xs text-[#64748B]">Flowpeople Enterprise Platform</span>
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

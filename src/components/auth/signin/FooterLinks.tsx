type FooterLinksProps = {
  privacyHref?: string;
  termsHref?: string;
  contactEmail?: string;
};

export default function FooterLinks({
  privacyHref = "/privacy",
  termsHref = "/terms",
  contactEmail = "hqfluxora@gmail.com",
}: FooterLinksProps) {
  const link = "text-fp-muted hover:text-ink";

  return (
    <nav
      aria-label="Legal and contact"
      className="flex flex-wrap justify-center gap-x-7 gap-y-1.5 text-center text-[13px]"
    >
      <a href={privacyHref} className={link}>
        Privacy Policy
      </a>
      <a href={termsHref} className={link}>
        Terms &amp; Conditions
      </a>
      <a href={`mailto:${contactEmail}`} className={link}>
        {contactEmail}
      </a>
    </nav>
  );
}

import SignInForm from "./SignInForm";
import type { SignInValues } from "./SignInForm";
import FooterLinks from "./FooterLinks";

type SignInPanelProps = {
  onSubmit?: ((values: SignInValues) => Promise<void> | void) | undefined;
};

/** Right side. The form is centered, the footer links sit at the bottom. */
export default function SignInPanel({ onSubmit }: SignInPanelProps) {
  return (
    <main className="flex min-w-0 flex-1 flex-col bg-white px-6 py-8 lg:px-14 lg:py-9">
      <div className="flex flex-1 items-center justify-center">
        <SignInForm onSubmit={onSubmit} />
      </div>
      <FooterLinks />
    </main>
  );
}

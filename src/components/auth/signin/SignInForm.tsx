import { useState } from "react";
import type { FormEvent } from "react";
import UnderlineField from "./UnderlineField";
import PasswordField from "./PasswordField";
import BrandLogo from "./BrandLogo";

export type SignInValues = {
  email: string;
  password: string;
};

type SignInFormProps = {
  /** Called with the email and password. Throw an Error to show a message under the form. */
  onSubmit?: ((values: SignInValues) => Promise<void> | void) | undefined;
};

export default function SignInForm({ onSubmit }: SignInFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError(null);
    setLoading(true);
    try {
      await onSubmit?.({ email: email.trim(), password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="w-full max-w-[360px]">
      {/* Logo shows here only when the hero panel is hidden (small screens) */}
      <BrandLogo variant="dark" className="mb-11 lg:hidden" />

      <h1 className="mb-14 text-[34px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink lg:text-[38px]">
        Sign in
      </h1>

      <div className="mb-[34px]">
        <UnderlineField
          label="Work email"
          type="email"
          name="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="mb-[34px]">
        <PasswordField
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error && (
        <p role="alert" className="-mt-4 mb-5 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-2.5 h-[54px] w-full rounded-xl bg-brand text-base font-semibold text-white shadow-cta hover:brightness-110 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

import HeroPanel from "../components/HeroPanel";
import SignInPanel from "../components/SignInPanel";
import type { SignInValues } from "../components/SignInForm";

export default function SignInPage() {
  async function handleSignIn({ email, password }: SignInValues) {
    // TODO: connect your real sign-in here. Example with Supabase:
    //
    // const { error } = await supabase.auth.signInWithPassword({ email, password });
    // if (error) throw new Error(error.message);
    // navigate("/dashboard");
    void email;
    void password;
  }

  return (
    <div className="flex min-h-screen bg-white font-sans text-ink antialiased">
      <HeroPanel />
      <SignInPanel onSubmit={handleSignIn} />
    </div>
  );
}

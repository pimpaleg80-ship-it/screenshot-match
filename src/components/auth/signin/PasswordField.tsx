import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import UnderlineField from "./UnderlineField";
import { EyeIcon, EyeOffIcon } from "./icons";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/** Password input with a show / hide button. */
export default function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <UnderlineField
      label="Password"
      autoComplete="current-password"
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="-mr-2.5 flex h-11 w-11 flex-none items-center justify-center rounded-[10px] text-[#6A7289] hover:text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-indigo-600"
        >
          {visible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
        </button>
      }
    />
  );
}

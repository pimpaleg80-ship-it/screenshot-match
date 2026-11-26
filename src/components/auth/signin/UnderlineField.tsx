import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";

type UnderlineFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Accessible name. Shown as the placeholder when none is given. */
  label: string;
  /** Optional element on the right side of the field, for example a button. */
  trailing?: ReactNode;
};

/** Minimal text field with a thin underline that turns indigo on focus. */
const UnderlineField = forwardRef<HTMLInputElement, UnderlineFieldProps>(
  ({ label, trailing, placeholder, className = "", ...rest }, ref) => (
    <div className="flex h-[52px] items-center border-b border-line focus-within:border-fp-indigo">
      <input
        ref={ref}
        aria-label={label}
        placeholder={placeholder ?? label}
        className={`min-w-0 flex-1 border-0 bg-transparent p-0 text-[16.5px] text-ink outline-none placeholder:text-[#667086] ${className}`}
        {...rest}
      />
      {trailing}
    </div>
  )
);

UnderlineField.displayName = "UnderlineField";

export default UnderlineField;

import logo from "@/assets/logo.png";

type BrandLogoProps = {
  /** "light" = white text for dark backgrounds, "dark" = dark text for white backgrounds */
  variant?: "light" | "dark";
  className?: string;
};

export default function BrandLogo({ variant = "light", className = "" }: BrandLogoProps) {
  const dark = variant === "dark";

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <img
        src={logo}
        alt="Flowpeople logo"
        className={`block w-auto ${dark ? "h-12" : "h-14"}`}
      />
      <div>
        <div
          className={`font-bold leading-none tracking-[-0.025em] ${
            dark ? "text-[22px] text-ink" : "text-[26px] text-white"
          }`}
        >
          Flow
          <span className={dark ? "text-fp-indigo" : "text-[#B4C2FF]"}>people</span>
        </div>
        <div
          className={`mt-[7px] text-[10.5px] font-semibold leading-none tracking-[0.36em] ${
            dark ? "text-fp-muted" : "text-[#A9B4E2]"
          }`}
        >
          BY FLUXORA
        </div>
      </div>
    </div>
  );
}

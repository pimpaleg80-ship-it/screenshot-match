import BrandLogo from "./BrandLogo";
import WavesBackground from "./WavesBackground";

const FEATURES = ["Attendance", "Leave", "Payroll", "Records", "Reports"];

/** Left brand panel. Hidden below the `lg` breakpoint. */
export default function HeroPanel() {
  return (
    <section className="relative isolate hidden min-w-0 flex-[1.1] flex-col justify-between overflow-hidden bg-hero px-12 py-12 text-white lg:flex xl:px-[88px] xl:py-16">
      <WavesBackground />

      <BrandLogo variant="light" />

      <div>
        <h2 className="max-w-[620px] text-5xl font-bold leading-[1.05] tracking-[-0.04em] xl:text-[62px]">
          Complete HR software for{" "}
          <em className="not-italic text-[#79D4FF]">every business.</em>
        </h2>

        <p className="mt-[26px] max-w-[460px] text-lg leading-relaxed text-[#BFC8EE]">
          One simple place to manage your people, from the first day to the last payslip.
        </p>

        <ul className="mt-[34px] flex flex-wrap items-center text-[14.5px] font-medium tracking-[0.01em] text-[#E2E8FF]/90">
          {FEATURES.map((item, i) => (
            <li key={item} className="flex items-center">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className="mx-[14px] inline-block h-1 w-1 rounded-full bg-[#79D4FF]/80"
                />
              )}
              {item}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[13px] text-[#8F9BCB]">
        Protected by enterprise-grade encryption and multi-tenant security standards.
      </p>
    </section>
  );
}

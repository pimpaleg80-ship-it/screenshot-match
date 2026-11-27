import type { Config } from "tailwindcss";

// Merge the `extend` block below into your existing tailwind.config.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      colors: {
        ink: "#0A0F2C",
        muted: "#5E667D",
        line: "#D3D7E8",
        brand: "#1357E0",
        fp: { indigo: "#4338CA" },
      },
      backgroundImage: {
        hero:
          "radial-gradient(900px 600px at 100% 0%, rgba(22,150,220,.7), transparent 62%), radial-gradient(800px 640px at 0% 100%, rgba(78,40,230,.8), transparent 60%), linear-gradient(170deg,#030822 0%,#05114C 55%,#082A9A 100%)",
      },
      boxShadow: {
        cta: "0 14px 28px -16px rgba(19,87,224,.8)",
      },
    },
  },
  plugins: [],
} satisfies Config;

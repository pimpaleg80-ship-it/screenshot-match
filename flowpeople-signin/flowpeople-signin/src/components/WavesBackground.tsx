/** Soft decorative waves for the hero panel. Purely visual, hidden from screen readers. */
export default function WavesBackground() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      viewBox="0 0 800 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="fp-wave-fill-1" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2CC4FF" stopOpacity=".30" />
          <stop offset="1" stopColor="#4F46E5" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fp-wave-fill-2" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#6A3DFF" stopOpacity=".40" />
          <stop offset="1" stopColor="#22B4F0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fp-wave-line" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#9BE3FF" stopOpacity=".7" />
          <stop offset="1" stopColor="#9BE3FF" stopOpacity="0" />
        </linearGradient>
      </defs>

      <path
        d="M800 120C660 190 590 340 450 440S130 540 0 660V1000H800Z"
        fill="url(#fp-wave-fill-1)"
      />
      <path
        d="M800 560C700 610 610 700 510 780S250 890 0 940V1000H800Z"
        fill="url(#fp-wave-fill-2)"
      />
      <path
        d="M800 120C660 190 590 340 450 440S130 540 0 660"
        fill="none"
        stroke="url(#fp-wave-line)"
        strokeWidth="1.2"
      />
      <path
        d="M800 560C700 610 610 700 510 780S250 890 0 940"
        fill="none"
        stroke="url(#fp-wave-line)"
        strokeWidth="1"
        opacity=".7"
      />
    </svg>
  );
}

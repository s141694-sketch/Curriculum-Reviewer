/**
 * Site wallpaper: two faint compass roses that turn very slowly, over the
 * dotted chart grid painted by the body background. Purely decorative.
 */
export function Wallpaper() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <CompassRose className="harak-rose absolute -bottom-52 -left-52 size-[760px] text-navy opacity-[0.06]" />
      <CompassRose className="harak-rose-reverse absolute -top-40 -right-40 size-[440px] text-gold-ink opacity-[0.08]" />
    </div>
  );
}

function CompassRose({ className }: { className?: string }) {
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  return (
    <svg viewBox="-150 -150 300 300" className={className}>
      <circle r="140" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle r="118" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 8" />
      <circle r="70" fill="none" stroke="currentColor" strokeWidth="1" />
      {ticks.map((deg) => (
        <line
          key={deg}
          x1="0"
          y1="-140"
          x2="0"
          y2={deg % 90 === 0 ? "-120" : deg % 30 === 0 ? "-130" : "-135"}
          stroke="currentColor"
          strokeWidth={deg % 90 === 0 ? 2 : 1}
          transform={`rotate(${deg})`}
        />
      ))}
      <line x1="0" y1="-150" x2="0" y2="150" stroke="currentColor" strokeWidth="0.75" />
      <line x1="-150" y1="0" x2="150" y2="0" stroke="currentColor" strokeWidth="0.75" />
      <polygon points="0,-70 12,0 -12,0" fill="currentColor" />
      <polygon points="-12,0 12,0 0,70" fill="currentColor" fillOpacity="0.45" />
    </svg>
  );
}

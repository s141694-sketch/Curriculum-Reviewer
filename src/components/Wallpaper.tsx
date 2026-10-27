/**
 * خلفية الموقع المتحركة: ثلاث طبقات أمواج هادئة أسفل الصفحة تنساب بسرعات واتجاهات مختلفة،
 * ووردة بوصلة باهتة تدور ببطء في الأعلى، فوق شبكة النقاط التي ترسمها خلفية body.
 * زخرفية فقط: لا تستقبل المؤشر، ومخفية عن قارئ الشاشة، وتتوقف مع «تقليل الحركة» (globals.css).
 */
export function Wallpaper() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <CompassRose className="harak-rose absolute -top-40 -right-40 size-[460px] text-sky opacity-[0.14]" />
      <div className="harak-sea">
        <Wave className="harak-wave harak-wave-3" />
        <Wave className="harak-wave harak-wave-2" />
        <Wave className="harak-wave harak-wave-1" />
      </div>
    </div>
  );
}

// موجتان كاملتان على عرض 200%: إزاحة النصف تعيد الشكل نفسه فتتكرر الحركة بلا قفزة
const WAVE_PATH =
  "M0 60 C240 20 480 20 720 60 S1200 100 1440 60 S1920 20 2160 60 S2640 100 2880 60 V120 H0 Z";

function Wave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 2880 120" preserveAspectRatio="none" className={className}>
      <path d={WAVE_PATH} fill="currentColor" />
    </svg>
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

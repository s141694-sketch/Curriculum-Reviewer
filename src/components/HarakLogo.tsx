type NeedleTone = "color" | "reverse" | "mono";

const needleFills: Record<NeedleTone, [string, string, string, string]> = {
  // north-left, north-right, south-left, south-right
  color: ["#7E1416", "#A0282C", "#1B1F4B", "#2E3470"],
  reverse: ["#C7383C", "#E0555A", "#D4AD6A", "#E8CF9A"],
  mono: ["currentColor", "currentColor", "currentColor", "currentColor"],
};

/** The compass needle that stands in for the alef of "حراك". */
export function CompassNeedle({
  height,
  tone = "color",
  className,
}: {
  height: number;
  tone?: NeedleTone;
  className?: string;
}) {
  const [nl, nr, sl, sr] = needleFills[tone];
  return (
    <svg
      width={(height * 48) / 176}
      height={height}
      viewBox="0 0 48 176"
      aria-hidden="true"
      className={className ? `harak-needle ${className}` : "harak-needle"}
    >
      <polygon points="24,0 24,88 8,88" fill={nl} />
      <polygon points="24,0 40,88 24,88" fill={nr} />
      <polygon points="8,88 24,88 24,176" fill={sl} />
      <polygon points="24,88 40,88 24,176" fill={sr} />
      {tone !== "mono" && (
        <circle cx="24" cy="88" r="8" fill={tone === "reverse" ? "#FBF8F1" : "#D4AD6A"} />
      )}
    </svg>
  );
}

/**
 * The "حراك" wordmark: "حر" + needle + "ك". Those three pieces never join
 * in Arabic script (ر and ا are non-connecting), so splitting them keeps the
 * word's correct letterforms.
 */
export function HarakWordmark({
  size,
  tone = "color",
  className = "",
}: {
  size: number;
  tone?: NeedleTone;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="حراك"
      className={`harak-wordmark inline-flex items-baseline font-display font-bold leading-[1.25] ${className}`}
      style={{ fontSize: size, gap: size * 0.07 }}
    >
      <span aria-hidden="true">حر</span>
      <CompassNeedle height={size * 0.93} tone={tone} />
      <span aria-hidden="true">ك</span>
    </span>
  );
}

/** Compass ring with the needle, used for loaders and the app icon. */
export function CompassMark({
  size,
  spinning = false,
  className,
}: {
  size: number;
  spinning?: boolean;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" aria-hidden="true" className={className}>
      <circle r="44" fill="none" stroke="currentColor" strokeWidth="5" />
      <g className={spinning ? "harak-seek" : undefined}>
        <polygon points="0,-32 0,0 -9,0" fill="#C7383C" />
        <polygon points="0,-32 9,0 0,0" fill="#E0555A" />
        <polygon points="-9,0 0,0 0,32" fill="#D4AD6A" />
        <polygon points="0,0 9,0 0,32" fill="#E8CF9A" />
      </g>
    </svg>
  );
}

/** Diamond ornament taken from the needle's outline, used as a section divider. */
export function Diamond({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className={className}>
      <polygon points="7,0 14,7 7,14 0,7" fill="currentColor" />
    </svg>
  );
}

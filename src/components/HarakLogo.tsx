type NeedleTone = "color" | "reverse" | "mono";

const needleFills: Record<NeedleTone, [string, string, string, string]> = {
  // north-left, north-right, south-left, south-right
  color: ["#74B4DA", "#9CC8E5", "#10367D", "#0B5497"],
  reverse: ["#74B4DA", "#BFDCEE", "#FFFEF9", "#DCE8F3"],
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
        <circle cx="24" cy="88" r="8" fill="#D4AD6A" />
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
        <polygon points="0,-32 0,0 -9,0" fill="#74B4DA" />
        <polygon points="0,-32 9,0 0,0" fill="#BFDCEE" />
        <polygon points="-9,0 0,0 0,32" fill="#FFFEF9" />
        <polygon points="0,0 9,0 0,32" fill="#DCE8F3" />
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

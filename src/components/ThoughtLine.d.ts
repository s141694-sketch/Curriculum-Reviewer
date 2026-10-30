// أنواع ThoughtLine.jsx لمشروع TypeScript (المصدر JavaScript من React Bits)
import type { CSSProperties, JSX, ReactNode } from "react";

export interface ThoughtLineProps {
  /** سطر العمل، ويُقرأ لقارئ الشاشة */
  label?: string;
  /** سطر الاستقرار؛ فارغًا يصير «فكّر لمدة» أو «انتهى التفكير» */
  doneLabel?: string;
  renderLabel?: (text: string, working: boolean) => ReactNode;
  glyph?: "sparkle" | "dot" | "none" | ReactNode;
  /** الخطوات تحت السطر: الأخيرة هي الحالية، وما قبلها مكتمل */
  steps?: string[];
  collapsible?: boolean;
  collapseOnSettle?: boolean;
  color?: string;
  glyphColor?: string;
  fontSize?: number;
  breathPeriod?: number;
  breathDepth?: number;
  shimmer?: boolean;
  shimmerDuration?: number;
  settleDuration?: number;
  settleBlur?: number;
  working?: boolean;
  settleAfter?: number;
  elapsed?: number;
  showTimer?: boolean;
  onSettle?: (seconds: number) => void;
  className?: string;
  style?: CSSProperties;
}

declare function ThoughtLine(props: ThoughtLineProps): JSX.Element;
export default ThoughtLine;

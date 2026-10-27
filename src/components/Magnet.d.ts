// أنواع Magnet.jsx لمشروع TypeScript (المصدر JavaScript من React Bits)
import type { CSSProperties, HTMLAttributes, JSX, ReactNode } from "react";

export interface MagnetProps extends Omit<HTMLAttributes<HTMLDivElement>, "style" | "children"> {
  children?: ReactNode;
  /** المسافة حول العنصر التي يبدأ عندها الجذب، بالبكسل */
  padding?: number;
  /** يُقسَم الإزاحة عليه: 1 يتبع المؤشر، والأكبر يتحرك أقل */
  magnetStrength?: number;
  exclusive?: boolean;
  axis?: "both" | "x" | "y";
  /** أقصى إزاحة عن موضع الراحة، بالبكسل */
  maxOffset?: number;
  /** أقصى ميل ثلاثي الأبعاد، بالدرجات */
  tilt?: number;
  scale?: number;
  spring?: { stiffness?: number; damping?: number; mass?: number };
  disabled?: boolean;
  onActiveChange?: (active: boolean) => void;
  wrapperClassName?: string;
  innerClassName?: string;
  style?: CSSProperties;
}

declare function Magnet(props: MagnetProps): JSX.Element;
export default Magnet;

// أنواع PillNav.jsx لمشروع TypeScript (المصدر JavaScript من React Bits)
import type { CSSProperties, ElementType, JSX, MouseEvent, ReactNode } from "react";

export interface PillNavItem {
  label: string;
  /** بلا href يصير العنصر زرًا */
  href?: string;
  icon?: ReactNode;
  ariaLabel?: string;
  /** يخفي العنصر من الشريط ومن القائمة المطوية */
  hidden?: boolean;
  /** سمات إضافية على زر العنصر أو رابطه، مثل data-tab */
  attrs?: Record<string, string | undefined>;
}

export interface PillNavProps {
  items?: PillNavItem[];
  logo?: string | ReactNode;
  logoAlt?: string;
  logoHref?: string;
  activeHref?: string;
  /** العنصر الحالي برقمه، للعناصر التي هي أزرار */
  activeIndex?: number;
  defaultActiveIndex?: number;
  onItemClick?: (item: PillNavItem, index: number, event: MouseEvent) => void;
  linkComponent?: ElementType;
  theme?: "dark" | "light";
  layout?: "split" | "joined";
  itemStyle?: "pill" | "plain";
  hoverEffect?: "fill" | "glide" | "none";
  indicator?: "dot" | "pill" | "none";
  surface?: "glass" | "solid" | "none";
  size?: "sm" | "md" | "lg";
  highlightColor?: string;
  highlightTextColor?: string;
  barColor?: string;
  textColor?: string;
  bounce?: number;
  stretch?: number;
  collapse?: "auto" | "always" | "never";
  onMenuToggle?: (open: boolean) => void;
  intro?: boolean;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties & Record<`--${string}`, string>;
}

declare function PillNav(props: PillNavProps): JSX.Element;
export default PillNav;

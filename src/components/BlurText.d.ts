// أنواع BlurText.jsx لمشروع TypeScript (المصدر JavaScript من React Bits)
import type { ElementType, JSX } from "react";
import type { Easing, TargetAndTransition } from "motion/react";

export interface BlurTextProps {
  text?: string;
  /** وسم العنصر الجذر؛ الافتراضي "p" */
  as?: ElementType;
  effect?: "blur" | "zoom" | "tilt" | "focus" | "drift";
  animateBy?: "words" | "letters";
  direction?: "top" | "bottom" | "left" | "right";
  staggerFrom?: "start" | "center" | "end" | "random";
  trigger?: "view" | "load" | "hover" | "click";
  /** بين كل كلمة أو حرف، بالمللي ثانية */
  delay?: number;
  /** مدة كل خطوة، بالثواني */
  stepDuration?: number;
  loop?: boolean;
  /** بالثواني */
  loopDelay?: number;
  /** بالبكسل */
  blur?: number;
  /** بالبكسل */
  distance?: number;
  color?: string;
  fromColor?: string;
  focusOnHover?: boolean;
  threshold?: number;
  rootMargin?: string;
  animationFrom?: TargetAndTransition;
  animationTo?: TargetAndTransition[];
  easing?: Easing | Easing[];
  className?: string;
  onAnimationComplete?: () => void;
}

declare function BlurText(props: BlurTextProps): JSX.Element;
export default BlurText;

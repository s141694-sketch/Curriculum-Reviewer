// أنواع PromptBar.jsx لمشروع TypeScript (المصدر JavaScript من React Bits)
import type { JSX, ReactNode } from "react";

export interface PromptBarSource {
  key: string;
  name: string;
  description?: string;
  /** أيقونة من Hugeicons أو أي عنصر */
  icon?: unknown;
  /** الصف الذي يضيف ملفات */
  attach?: boolean;
}
export interface PromptBarCommand {
  key: string;
  /** مع الشرطة المائلة، مثل /لخّص */
  name: string;
  description?: string;
}
export interface PromptBarModel {
  key: string;
  name: string;
  tag?: string;
}

export interface PromptBarProps {
  placeholder?: string;
  sources?: PromptBarSource[];
  commands?: PromptBarCommand[];
  /** قائمة فارغة تخفي اختيار النموذج */
  models?: PromptBarModel[];
  defaultModel?: string;
  /** قائمة فارغة تخفي شريط الجهد */
  efforts?: string[];
  defaultEffort?: string;
  onEffortChange?: (effort: string) => void;
  busy?: boolean;
  onSend?: (text: string, meta: { attachments: string[]; model: PromptBarModel; effort: string }) => void;
  onStop?: () => void;
  onAttach?: () => string | string[] | null | Promise<string | string[] | null>;
  /** بلا هذه الدالة يختفي الميكروفون */
  onDictate?: () => string | Promise<string>;
  background?: string;
  color?: string;
  menuBackground?: string;
  sparkColor?: string;
  sparkBoost?: number;
  width?: number;
  radius?: number;
  maxRows?: number;
  morphDuration?: number;
  squash?: number;
  tilt?: number;
  pressScale?: number;
  className?: string;
  children?: ReactNode;
}

declare function PromptBar(props: PromptBarProps): JSX.Element;
export default PromptBar;

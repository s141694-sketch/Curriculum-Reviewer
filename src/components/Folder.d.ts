// أنواع Folder.jsx لمشروع TypeScript (المصدر JavaScript من React Bits)
import type { CSSProperties, JSX, ReactNode } from "react";

/** عنصر داخل المجلد: نص، أو ورقة بعنوان ووصف، أو صورة، أو محتوى مخصص */
export type FolderItem =
  | string
  | number
  | { title?: string; description?: string; image?: string; alt?: string; content?: ReactNode };

export interface FolderProps {
  /** حتى ستة عناصر، وما زاد يُتجاهَل */
  items?: FolderItem[];
  /** تسمية اللسان، وتُقرأ لقارئ الشاشة «مجلد …» */
  label?: string;
  mode?: "flap" | "book";
  variant?: "solid" | "glass" | "matte";
  color?: string;
  paperColor?: string;
  tabPosition?: "left" | "center" | "right";
  layout?: "spread" | "row" | "stack";
  /** مُضاعِف الحجم: 1 يساوي 224×196 بكسل في نمط flap */
  size?: number;
  openOn?: "click" | "hover";
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onItemClick?: (item: FolderItem | ReactNode, index: number) => void;
  onItemDrop?: (item: FolderItem | ReactNode, index: number, inside: boolean) => void;
  draggable?: boolean;
  zoomOnClick?: boolean;
  peek?: boolean;
  intro?: boolean;
  tilt?: number;
  bounce?: number;
  speed?: number;
  frost?: number;
  closeOnOutsideClick?: boolean;
  theme?: "dark" | "light";
  /** "rtl": في نمط flap تبدأ الأوراق من اليمين */
  dir?: "ltr" | "rtl";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

declare function Folder(props: FolderProps): JSX.Element;
export default Folder;

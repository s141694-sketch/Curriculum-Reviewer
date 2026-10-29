// أنواع FileFolder.jsx لمشروع TypeScript
import type { JSX } from "react";

export interface StoredFile {
  id: string;
  title: string;
  /** سطر وصفي تحت العنوان، مثل المستوى والمدة */
  meta?: string;
}

export interface FileFolderProps {
  /** مرتبة من الأحدث، ويظهر منها أربعة */
  files: StoredFile[];
  /** تسمية لسان المجلد */
  label: string;
  /** نوع الملف فوق عنوان كل ورقة، مثل «منهج» */
  kind?: string;
  /** سطر إرشادي تحت المجلد */
  hint?: string;
  onOpen?: (file: StoredFile) => void;
  className?: string;
}

declare function FileFolder(props: FileFolderProps): JSX.Element;
export default FileFolder;

import "server-only";

export {
  extractDocumentText as extractText,
  fixVisualArabic,
  splitIntoSections,
  SUPPORTED_EXTENSIONS,
} from "@/lib/document-text";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

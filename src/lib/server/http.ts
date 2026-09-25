import "server-only";
import { NextResponse } from "next/server";
import { BlobError } from "@vercel/blob";
import { StorageNotConfiguredError } from "@/lib/server/store";

// Route handlers that throw make Next.js answer with an empty 500 body, which
// the browser then fails to parse ("Unexpected end of JSON input"). Wrapping
// every API handler guarantees a JSON `{ error }` body the UI can display.

const STORAGE_ERROR_CODES = new Set(["EROFS", "EACCES", "EPERM", "ENOTDIR", "ENOSPC", "ENOENT"]);

export function describeError(error: unknown): string {
  if (error instanceof StorageNotConfiguredError) return error.message;
  if (error instanceof BlobError) {
    return `تعذر الوصول إلى مخزن Vercel Blob: ${error.message}. تحقق من ربط المخزن بالمشروع وصلاحية BLOB_READ_WRITE_TOKEN.`;
  }
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code && STORAGE_ERROR_CODES.has(code)) {
    const hint = process.env.VERCEL
      ? " هذا النظام مصمم للتشغيل على خادم داخلي، ونظام الملفات في Vercel للقراءة فقط فلا يمكن حفظ المراجعات عليه."
      : " تأكد أن المجلد المحدد في DATA_DIR موجود وقابل للكتابة وفيه مساحة كافية.";
    return `تعذر حفظ البيانات على الخادم (${code}).${hint}`;
  }
  return error instanceof Error ? error.message : "حدث خطأ غير متوقع في الخادم";
}

export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error("[api] unhandled error:", error);
      return NextResponse.json({ error: describeError(error) }, { status: 500 });
    }
  };
}

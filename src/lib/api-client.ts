// Browser-side fetch helper. Never calls `response.json()` blindly: an empty or
// HTML error page (proxy limits, hosting errors, crashes) would otherwise
// surface as "Unexpected end of JSON input" instead of a useful message.

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function messageForStatus(status: number): string {
  if (status === 413) {
    return "الملف أكبر من الحد المسموح به على الخادم. جرّب ملفًا أصغر، أو قسّم المنهج إلى أجزاء.";
  }
  if (status === 401 || status === 403) return "غير مصرح: تحقق من تسجيل الدخول.";
  if (status === 404) return "العنصر المطلوب غير موجود.";
  if (status === 502 || status === 503 || status === 504) {
    return "الخادم لا يستجيب حاليًا أو انتهت مهلة الطلب. حاول مرة أخرى بعد قليل.";
  }
  return `حدث خطأ غير متوقع في الخادم (HTTP ${status}).`;
}

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new ApiError("تعذر الاتصال بالخادم. تحقق من الشبكة ومن أن الخادم يعمل.", 0);
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const serverMessage =
      data && typeof data === "object" && "error" in data && typeof data.error === "string"
        ? data.error
        : null;
    throw new ApiError(serverMessage ?? messageForStatus(response.status), response.status);
  }
  if (data === null && response.status !== 204) {
    throw new ApiError("وصل رد غير صالح من الخادم.", response.status);
  }
  return data as T;
}

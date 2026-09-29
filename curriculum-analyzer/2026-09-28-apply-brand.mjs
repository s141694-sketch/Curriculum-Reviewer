// يطبّق هوية «حراك» (مقترح البوصلة) على curriculum-analyzer.html:
// كتلة :root، الخطوط المدمجة base64، الشريط العلوي، والشعار الافتراضي.
// الاستخدام (مرة واحدة، بعد `npm run build` في جذر المشروع لتوليد ملفات الخطوط):
//   node 2026-09-28-apply-brand.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const here = new URL(".", import.meta.url).pathname;
const htmlPath = resolve(here, "curriculum-analyzer.html");
const media = resolve(here, "../.next/static/media");
const emblemPath = resolve(here, "../src/assets/academy-emblem.webp");

const b64 = (p) => readFileSync(p).toString("base64");
const face = (family, weight, file, range) =>
  `@font-face { font-family: "${family}"; font-style: normal; font-weight: ${weight}; font-display: swap; ` +
  `src: url(data:font/woff2;base64,${b64(resolve(media, file))}) format("woff2"); unicode-range: ${range}; }`;

const ARABIC = "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB";
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

const fonts = [
  face("El Messiri", "400 700", "bdbeee9d91ec0c78-s.p.10yd3ypge-a6n.woff2", ARABIC),
  face("El Messiri", "400 700", "173f0f83f71fd8cd-s.p.1lef-am24b6cs.woff2", LATIN),
  face("IBM Plex Sans Arabic", "400", "c9a0d344f313d307-s.p.3ik2qu-u9tgho.woff2", ARABIC),
  face("IBM Plex Sans Arabic", "400", "5d6231e6818a3930-s.p.2vs72h_x6qrve.woff2", LATIN),
  face("IBM Plex Sans Arabic", "600", "ceec3e50f42c26e3-s.p.0da8nscnv1nkd.woff2", ARABIC),
  face("IBM Plex Sans Arabic", "600", "441492499fc86682-s.p.1fbvi_fot8u4l.woff2", LATIN),
].join("\n");

const root = `/* ---------- 1أ. متغيرات التصميم — هوية «حراك» (مقترح البوصلة) ---------- */
:root {
  /* الشمال عنابي، الجنوب كحلي، المحور ذهبي */
  --color-primary:   #1b1f4b;
  --color-secondary: #2e3470;
  --color-accent:    #d4ad6a;
  --color-action:    #7e1416;
  --color-action-2:  #a0282c;
  --color-gold-ink:  #7a5b22;
  --color-gold-soft: #e8cf9a;
  --color-bg:        #f4efe4;
  --color-surface:   #ffffff;
  --color-ivory:     #fbf8f1;
  --color-line:      #e3d9c4;
  --color-text:      #14162e;
  --color-muted:     #4a4c63;
  --color-success:   #1e7a4c;
  --color-warning:   #7a5b22;
  --color-danger:    #a0282c;

  --font-heading: "El Messiri", "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
  --font-body:    "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;

  --radius:     12px;
  --space-unit: 8px;

  /* مستويات بلوم الستة: من الذهبي الفاتح إلى الكحلي ثم العنابي للإبداع */
  --bloom-1: #e8cf9a;
  --bloom-2: #d4ad6a;
  --bloom-3: #7a5b22;
  --bloom-4: #2e3470;
  --bloom-5: #1b1f4b;
  --bloom-6: #7e1416;
}

${fonts}
`;

const brandCss = `
/* ---------- الشريط العلوي: شعار حراك بجانب شعار الجهة ---------- */
.app-header { background: var(--color-surface); color: var(--color-text); border-bottom: 1px solid var(--color-line); }
.app-brand { display: flex; align-items: center; gap: calc(var(--space-unit) * 2); }
.harak-wordmark { display: inline-flex; align-items: baseline; gap: 0.07em; font-family: var(--font-heading); font-weight: 700; font-size: 2.2rem; line-height: 1.25; color: var(--color-primary); }
.harak-wordmark svg { width: 0.25em; height: 0.93em; }
.brand-divider { width: 1px; height: 44px; background: var(--color-accent); }
.app-logo { background: transparent; border-radius: 0; color: var(--color-primary); }
.app-title { font-size: 1.05rem; font-weight: 600; font-family: var(--font-body); color: var(--color-text); }
.app-org { color: var(--color-muted); opacity: 1; }
.tabs { border-bottom-color: var(--color-line); }
.tab-btn { color: var(--color-muted); font-family: var(--font-body); font-weight: 500; }
.tab-btn[aria-selected="true"] { color: var(--color-action); border-bottom-color: var(--color-action); }
.btn { border-color: var(--color-primary); }
.btn-primary { background: var(--color-action); border-color: var(--color-action); }
.btn-primary:hover { background: var(--color-action-2); border-color: var(--color-action-2); }
.btn-secondary:hover { background: var(--color-bg); }
input[type="text"], textarea, select { border-color: var(--color-line); background: var(--color-ivory); }
input[type="text"]:focus, textarea:focus, select:focus { border-color: var(--color-primary); background: var(--color-surface); outline: 3px solid var(--color-gold-soft); outline-offset: 1px; }
.card { border: 1px solid var(--color-line); border-radius: 16px; }
.card > h2 { font-size: 1.35rem; color: var(--color-primary); margin-bottom: var(--space-unit); }
.dropzone { border-color: var(--color-accent); background: var(--color-ivory); }
.steps li { border-inline-start-color: var(--color-line); }
.tag { border-radius: 999px; }
.tag-bloom-1, .tag-bloom-2 { color: var(--color-text); }
.tag-medium { background: var(--color-gold-ink); }
th { color: var(--color-primary); font-family: var(--font-body); font-weight: 600; }
.summary-card { background: var(--color-ivory); border-top: 4px solid var(--color-accent); }
.report-header { border-bottom-color: var(--color-accent); }
.report-section h2 { border-inline-start-color: var(--color-accent); }
.alert { border-inline-start-color: var(--color-accent); }
.ref-card summary, .ref-level { border-radius: var(--radius); }
`;

const wordmark =
  `<span class="harak-wordmark" role="img" aria-label="حراك"><span aria-hidden="true">حر</span>` +
  `<svg viewBox="0 0 48 176" aria-hidden="true"><polygon points="24,0 24,88 8,88" fill="#7E1416"/><polygon points="24,0 40,88 24,88" fill="#A0282C"/>` +
  `<polygon points="8,88 24,88 24,176" fill="#1B1F4B"/><polygon points="24,88 40,88 24,176" fill="#2E3470"/><circle cx="24" cy="88" r="8" fill="#D4AD6A"/></svg>` +
  `<span aria-hidden="true">ك</span></span>`;

const header = `<header class="app-header">
  <div class="app-brand">
    ${wordmark}
    <span class="brand-divider" aria-hidden="true"></span>
    <div class="app-logo" id="app-logo" aria-label="الشعار">م</div>
  </div>
  <div>
    <h1 class="app-title">محلّل المناهج</h1>
    <div class="app-org" id="app-org">اسم الجهة</div>
  </div>
</header>`;

let html = readFileSync(htmlPath, "utf8");
const replaceOnce = (from, to, label) => {
  const at = html.indexOf(from);
  if (at < 0 || html.indexOf(from, at + 1) >= 0) throw new Error(`لم يُعثر على موضع وحيد لـ: ${label}`);
  html = html.slice(0, at) + to + html.slice(at + from.length);
};

replaceOnce("<title>محلّل المناهج</title>", "<title>حراك — محلّل المناهج</title>", "title");
replaceOnce(html.slice(html.indexOf("/* ---------- 1أ."), html.indexOf("/* ---------- 1ب.")), root + "\n", ":root");
replaceOnce("/* ---------- 1ج. أنماط الطباعة ---------- */", brandCss + "\n/* ---------- 1ج. أنماط الطباعة ---------- */", "brand css");
replaceOnce(html.slice(html.indexOf('<header class="app-header">'), html.indexOf("</header>") + "</header>".length), header, "header");
replaceOnce('<button class="btn" id="btn-analyze"', '<button class="btn btn-primary" id="btn-analyze"', "analyze btn");
replaceOnce('<button class="btn" id="btn-print"', '<button class="btn btn-primary" id="btn-print"', "print btn");

// الشعار واسم الجهة الافتراضيان حين لا يضبطهما المستخدم من الإعدادات
replaceOnce(
  "let settings = store.read(STORAGE_KEYS.settings, { orgName: '', logoDataUrl: '' });",
  `const DEFAULT_ORG_NAME = 'أكاديمية السلطان قابوس البحرية';\nconst DEFAULT_LOGO = 'data:image/webp;base64,${b64(emblemPath)}';\nlet settings = store.read(STORAGE_KEYS.settings, { orgName: '', logoDataUrl: '' });`,
  "settings",
);
replaceOnce(
  "${settings.logoDataUrl ? `<img class=\"report-logo\" src=\"${settings.logoDataUrl}\" alt=\"الشعار\">` : ''}",
  "<img class=\"report-logo\" src=\"${settings.logoDataUrl || DEFAULT_LOGO}\" alt=\"الشعار\">",
  "report logo",
);
replaceOnce("<h2>${escapeHtml(settings.orgName || 'تقرير تحليل المنهج')}</h2>", "<h2>${escapeHtml(settings.orgName || DEFAULT_ORG_NAME)}</h2>", "report org");
replaceOnce("$('app-org').textContent = settings.orgName || 'اسم الجهة';", "$('app-org').textContent = settings.orgName || DEFAULT_ORG_NAME;", "app org");
replaceOnce(
  "else { logo.textContent = 'م'; prev.hidden = true; prev.removeAttribute('src'); }",
  "else { logo.innerHTML = `<img src=\"${DEFAULT_LOGO}\" alt=\"شعار أكاديمية السلطان قابوس البحرية\">`; prev.hidden = true; prev.removeAttribute('src'); }",
  "default logo",
);

writeFileSync(htmlPath, html);
console.log("تم تطبيق الهوية. الحجم:", (html.length / 1024 / 1024).toFixed(2), "MB");

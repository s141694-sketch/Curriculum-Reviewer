// يبني harak.html: محلّل المناهج + غلاف حراك (الدخول بالدور، المناهج، المساعد، الإدارة)
// التشغيل: node build.mjs   (من مجلد harak-app)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildSync } from "esbuild";

const here = new URL(".", import.meta.url).pathname;
const read = (p) => readFileSync(resolve(here, p), "utf8");

let html = read("../curriculum-analyzer/curriculum-analyzer.html");
const once = (from, to, label) => {
  const at = html.indexOf(from);
  if (at < 0 || html.indexOf(from, at + 1) >= 0) throw new Error(`موضع غير وحيد: ${label}`);
  html = html.slice(0, at) + to + html.slice(at + from.length);
};

once("<title>حراك — محلّل المناهج</title>", "<title>حراك — بوصلة المنهج الدراسي</title>", "title");
once("/* ---------- 1ج. أنماط الطباعة ---------- */", read("src/shell.css") + "\n/* ---------- 1ج. أنماط الطباعة ---------- */", "css");
// الأمواج مرتين: خلف النظام، وداخل شاشة الدخول التي تغطيه
const sea = read("src/sea.html");
once("<body>\n", "<body>\n" + sea + read("src/landing.html").replace("<!--harak-sea-->", sea) + "\n", "landing");
once(
  `    <h1 class="app-title">محلّل المناهج</h1>\n    <div class="app-org" id="app-org">اسم الجهة</div>\n  </div>\n</header>`,
  `    <h1 class="app-title">بوصلة المنهج الدراسي</h1>\n    <div class="app-org" id="app-org">اسم الجهة</div>\n  </div>\n  <div class="app-user" id="app-user" hidden>\n    <button class="user-btn" type="button" id="user-menu-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="user-menu"><span class="avatar" id="app-user-initial" aria-hidden="true"></span><span class="who"><strong id="app-user-name"></strong><span id="app-user-role"></span></span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>\n    <div class="user-menu" id="user-menu" role="menu" hidden>\n      <button type="button" role="menuitem" id="menu-change-password">تغيير كلمة المرور</button>\n      <button type="button" role="menuitem" id="menu-logout" class="danger">تسجيل الخروج</button>\n    </div>\n  </div>\n</header>`,
  "header",
);
once(
  `  <button class="tab-btn" role="tab" id="tab-upload"    aria-controls="panel-upload"    aria-selected="true"  type="button">رفع</button>`,
  `  <button class="tab-btn" role="tab" id="tab-curricula" aria-controls="panel-curricula" aria-selected="true"  type="button">المناهج</button>\n` +
    `  <button class="tab-btn" role="tab" id="tab-assistant" aria-controls="panel-assistant" aria-selected="false" type="button">المساعد</button>\n` +
    `  <button class="tab-btn" role="tab" id="tab-upload"    aria-controls="panel-upload"    aria-selected="false" type="button">تحليل منهج</button>`,
  "tabs",
);
once(
  `  <button class="tab-btn" role="tab" id="tab-settings"  aria-controls="panel-settings"  aria-selected="false" type="button">المعايير والإعدادات</button>`,
  `  <button class="tab-btn" role="tab" id="tab-settings"  aria-controls="panel-settings"  aria-selected="false" type="button">المعايير والإعدادات</button>\n` +
    `  <button class="tab-btn" role="tab" id="tab-admin"     aria-controls="panel-admin"     aria-selected="false" type="button" hidden>الإدارة</button>`,
  "admin tab",
);
// الشريط العلوي والتبويبات في حزمة زرقاء واحدة (الاتجاه «ب»: المحيط)
once(`<header class="app-header">`, `<div class="app-top">\n<header class="app-header">`, "app-top open");
once(`hidden>الإدارة</button>\n</nav>`, `hidden>الإدارة</button>\n</nav>\n</div>`, "app-top close");
once(`  <section class="tab-panel is-active" role="tabpanel" id="panel-upload"`, `  <section class="tab-panel" role="tabpanel" id="panel-upload"`, "upload panel");
once(
  `    <div id="report" class="report">\n      <p class="placeholder">لا نتائج بعد. ارفع منهجًا من تبويب "رفع" أو جرّب العينة.</p>\n    </div>`,
  read("src/ai-review.html").split("\n")[0] + `\n    <div id="report" class="report">\n      <p class="placeholder">لا نتائج بعد. ارفع منهجًا من تبويب "تحليل منهج" أو جرّب العينة.</p>\n    </div>\n` + read("src/ai-review.html").split("\n").slice(1).join("\n"),
  "ai review card",
);
once(`      <p class="file-name" id="file-name">لم يُختر ملف بعد.</p>`, `      <p class="file-name" id="file-name">لم يُختر ملف بعد.</p>\n` + read("src/analyze-brief.html"), "brief");
once(`$('btn-analyze').addEventListener('click', () => state.file && runAnalysis(state.file));`, `$('btn-analyze').addEventListener('click', () => state.file && (window.harakAnalyze ? window.harakAnalyze(state.file) : runAnalysis(state.file)));`, "analyze hook");
once(`<button class="btn btn-secondary" id="btn-sample" type="button">جرّب على عينة</button>`, `<button class="btn btn-secondary" id="btn-sample" type="button" hidden>جرّب على عينة</button>`, "sample button");
once(`    <div class="card">\n      <h2>الجهة والشعار</h2>`, `    <div class="card" hidden>\n      <h2>الجهة والشعار</h2>`, "org card");
once(`<li>أضف معايير مادتك واسم الجهة والشعار من تبويب "المعايير والإعدادات"؛ تُحفظ في هذا المتصفح فقط.</li>`, `<li>أضف معايير مادتك من تبويب "المعايير والإعدادات"؛ تُحفظ في هذا المتصفح فقط.</li>`, "settings hint");
once(`ارفع منهجًا من تبويب "تحليل منهج" أو جرّب العينة.`, `ارفع منهجًا من تبويب "تحليل منهج" أو حلّل منهجًا من "المناهج".`, "results placeholder");
once("const update = () => { btn.hidden = location.hash !== '#dev'; };", "const update = () => { btn.hidden = true; };", "dev button");
once(`placeholder="ع1 يذكر الطالب أجزاء النبات&#10;ع2 يشرح الطالب عملية التمثيل الضوئي"`, `placeholder="م1 يحدد الطالب موقع السفينة على الخريطة الملاحية&#10;م2 يطبّق الطالب القواعد الدولية لمنع التصادم في البحر"`, "standards placeholder");
once("</main>", read("src/panels.html") + "</main>", "panels");
// التقارير المحفوظة في مجلد أيضًا (Folder من React Bits): كل عنصر يحمل عنوانه ووصفه للمجلد
once(
  `      <ul class="reports-list" id="reports-list"></ul>`,
  `      <div class="folder-shelf" data-folder-source="#reports-list" data-folder-label="التقارير" data-folder-kind="تقرير" data-folder-hint="أحدث التقارير المحفوظة. افتح المجلد ثم اختر تقريرًا."></div>\n      <ul class="reports-list" id="reports-list"></ul>`,
  "reports folder",
);
once(
  "<li data-id=\"${r.id}\">",
  "<li data-id=\"${r.id}\" data-folder-id=\"${r.id}\" data-folder-title=\"${escapeHtml(r.fileName)}\" data-folder-meta=\"${new Date(r.savedAt).toLocaleDateString('ar-OM-u-nu-latn', { dateStyle: 'medium' })} · الأهداف: ${r.analysis.stats.objectives}\">",
  "reports folder items",
);
// مكوّنات React (BlurText وMagnet وFolder من React Bits) محزومة في سكربت واحد يُدمج بعد shell.js، وأنماطها في <style>
const bundle = buildSync({
  entryPoints: [resolve(here, "src/islands.jsx")],
  outdir: resolve(here, "dist-islands"), // لا يُكتب شيء (write: false)، لكن esbuild يحتاجه لفصل CSS عن JS
  bundle: true,
  minify: true,
  format: "iife",
  jsx: "automatic",
  target: ["es2020"],
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "eof",
  logLevel: "error",
  write: false,
}).outputFiles;
const islands = bundle.find((f) => f.path.endsWith(".js")).text;
// أنماط المكوّنات (Folder.css وFileFolder.css) تُضاف إلى نهاية أنماط الصفحة
const islandsCss = bundle.find((f) => f.path.endsWith(".css"))?.text ?? "";
if (/<\/script/i.test(islands)) throw new Error("حزمة المكوّنات تحتوي </script>");
if (/<\/style/i.test(islandsCss)) throw new Error("أنماط المكوّنات تحتوي </style>");
once("</style>\n</head>", `/* ---------- مكوّنات React ---------- */\n${islandsCss}</style>\n</head>`, "islands css");
once("</body>\n</html>", `<script>\n${read("src/shell.js")}\n</script>\n<script>\n${islands}</script>\n\n</body>\n</html>`, "script");

const out = resolve(here, "harak.html");
writeFileSync(out, html);
console.log("بُني", out, (html.length / 1024 / 1024).toFixed(2), "MB");

// يبني harak.html: محلّل المناهج + غلاف حراك (الدخول بالدور، المناهج، المساعد، الإدارة)
// التشغيل: node build.mjs   (من مجلد harak-app)
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
once("<body>\n", "<body>\n" + read("src/landing.html") + "\n", "landing");
once(
  `    <h1 class="app-title">محلّل المناهج</h1>\n    <div class="app-org" id="app-org">اسم الجهة</div>\n  </div>\n</header>`,
  `    <h1 class="app-title">بوصلة المنهج الدراسي</h1>\n    <div class="app-org" id="app-org">اسم الجهة</div>\n  </div>\n  <div class="app-user" id="app-user" hidden>\n    <div class="who"><strong id="app-user-name"></strong><span id="app-user-role"></span></div>\n    <button class="btn btn-secondary btn-sm" type="button" id="btn-switch-role">تبديل الدور</button>\n  </div>\n</header>`,
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
once(`  <section class="tab-panel is-active" role="tabpanel" id="panel-upload"`, `  <section class="tab-panel" role="tabpanel" id="panel-upload"`, "upload panel");
once(
  `    <div id="report" class="report">\n      <p class="placeholder">لا نتائج بعد. ارفع منهجًا من تبويب "رفع" أو جرّب العينة.</p>\n    </div>`,
  `    <div id="report" class="report">\n      <p class="placeholder">لا نتائج بعد. ارفع منهجًا من تبويب "تحليل منهج" أو جرّب العينة.</p>\n    </div>\n` + read("src/ai-review.html"),
  "ai review card",
);
once("</main>", read("src/panels.html") + "</main>", "panels");
once("</body>\n</html>", `<script>\n${read("src/shell.js")}\n</script>\n\n</body>\n</html>`, "script");

const out = resolve(here, "harak.html");
writeFileSync(out, html);
console.log("بُني", out, (html.length / 1024 / 1024).toFixed(2), "MB");

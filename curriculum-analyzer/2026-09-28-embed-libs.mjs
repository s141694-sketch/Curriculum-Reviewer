// أمر build يُنفَّذ مرة واحدة: يدمج pdf.js وmammoth.js داخل curriculum-analyzer.html
// الاستخدام: node 2026-09-28-embed-libs.mjs <مجلد node_modules>
// الإصدارات المثبّتة: pdfjs-dist@3.11.174 (legacy build) ، mammoth@1.8.0
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const nm = process.argv[2];
if (!nm) { console.error('المجلد node_modules مطلوب'); process.exit(1); }

const html = join(here, 'curriculum-analyzer.html');
const libs = {
  'lib-pdfjs':        readFileSync(join(nm, 'pdfjs-dist/legacy/build/pdf.min.js'), 'utf8'),
  'lib-pdfjs-worker': readFileSync(join(nm, 'pdfjs-dist/legacy/build/pdf.worker.min.js'), 'utf8'),
  'lib-mammoth':      readFileSync(join(nm, 'mammoth/mammoth.browser.min.js'), 'utf8'),
};

let src = readFileSync(html, 'utf8');
for (const [id, code] of Object.entries(libs)) {
  if (code.includes('</script')) throw new Error(`${id} يحوي </script ولا يمكن دمجه خامًا`);
  // الـ worker يُخزَّن كنص خام ويُحوَّل إلى blob وقت التشغيل؛ الباقي سكربتات تُنفَّذ
  const type = id === 'lib-pdfjs-worker' ? ' type="text/plain"' : '';
  const re = new RegExp(`<script id="${id}"[^>]*>[\\s\\S]*?</script>`);
  if (!re.test(src)) throw new Error(`لم يُعثر على العنصر النائب ${id}`);
  src = src.replace(re, () => `<script id="${id}"${type}>\n${code}\n</script>`);
}
writeFileSync(html, src);
console.log('تم الدمج:', Object.keys(libs).join(', '), '— الحجم', (src.length / 1024 / 1024).toFixed(2), 'MB');

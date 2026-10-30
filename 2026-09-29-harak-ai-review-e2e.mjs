// اختبار التقييم المنظّم بدرجة ومؤشر المحلية في harak.html
// يحتاج playwright والخادم الوهمي: node harak-app/2026-10-05-mock-ollama.mjs &
import { readFileSync } from 'node:fs';
import { launch, watchErrors, check, finish, setupAdmin, shot } from './2026-10-23-harak-test-helpers.mjs';

const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true })).newPage(); const errs = []; watchErrors(p, errs);
await setupAdmin(p);

await p.click('[data-tab=tab-assistant]');
check('المحلية مع نموذج منزَّل', await p.textContent('#ai-locality'), t => t.startsWith('يعمل محليًا بالكامل'));
await p.fill('#ai-model', 'gemma4:31b-cloud'); await p.waitForTimeout(100);
check('تحذير مع نموذج سحابي', await p.textContent('#ai-locality'), t => t.startsWith('نموذج سحابي'));
await p.fill('#ai-model', 'qwen2.5:7b');

await p.click('[data-tab=tab-results]');
check('النتائج فارغة: حالة فارغة واضحة', [await p.isVisible('#results-empty'), await p.isHidden('#ai-review-card'), await p.isHidden('#panel-results > .actions')], [true, true, true]);
await p.click('#results-empty [data-go="tab-upload"]');
check('زر الحالة الفارغة ينقل إلى تحليل منهج', await p.$eval('.tab-btn[aria-selected=true]', t => t.id), 'tab-upload');
check('زر التقييم معطّل قبل التحليل', await p.$eval('#btn-ai-review', x => x.disabled));

await p.evaluate(() => document.getElementById('btn-sample').click()); await p.waitForSelector('#panel-results.is-active', { timeout: 15000 });
await p.waitForSelector('#ai-review-card:not([hidden])');
check('زر التقييم مفعّل بعد التحليل', !(await p.$eval('#btn-ai-review', x => x.disabled)));
await p.click('#btn-ai-review'); await p.waitForSelector('#ai-review .summary-card', { timeout: 15000 });
check('الدرجة', await p.$eval('#ai-review .summary-card .num', n => n.textContent), '72');
check('سطر التقييم (ThoughtLine)', await p.$eval('[data-thought=review] [role=status]', s => s.textContent), t => /^اكتمل التقييم في \d+\.\d ثانية$/.test(t));
check('أقسام التقييم', await p.$$eval('#ai-review .report-section h2', hs => hs.map(h => h.textContent)), ['الحكم العام', 'نقاط القوة', 'نقاط الضعف', 'الأهداف المقترح تحسينها', 'عناصر ناقصة', 'التوصيات']);
await p.$eval('#ai-review-card', el => el.scrollIntoView()); await shot(p, 'h-review.png');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btn-json')]);
check('ملف JSON يتضمن التقييم', readFileSync(await dl.path(), 'utf8').includes('"aiReview"'));

await p.click('[data-tab=tab-upload]'); await p.evaluate(() => document.getElementById('btn-sample').click()); await p.waitForSelector('#panel-results.is-active');
await p.waitForFunction(() => !document.querySelector('#ai-review .summary-card'));
check('تحليل جديد يمسح التقييم السابق', (await p.$$('#ai-review .summary-card')).length, 0);

check('لا أخطاء JavaScript', errs, []);
await b.close();
finish();

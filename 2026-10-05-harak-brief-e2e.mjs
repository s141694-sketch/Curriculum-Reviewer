// اختبار التحليل بأمر المستخدم والنتائج التفاعلية والمساعد في harak.html
// يحتاج playwright والخادم الوهمي: node harak-app/2026-10-05-mock-ollama.mjs &
import { launch, watchErrors, check, finish, setupAdmin, closeToasts, shot } from './2026-10-23-harak-test-helpers.mjs';

const CJK = /[一-鿿]/;
const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1366, height: 1000 } })).newPage(); const errs = []; watchErrors(p, errs);
await setupAdmin(p);
check('تنبيه الترحيب', await p.textContent('.toast'), t => t.includes('أهلًا مريم البلوشية'));
check('لا منطقة حذف، والعربية لغة الردود', [(await p.$('#btn-admin-wipe')) === null, await p.$eval('#ai-lang', s => s.value)], [true, 'ar']);

// تحليل بأمر المستخدم مع التحليل الآلي
await p.click('#tab-upload');
await p.setInputFiles('#file-input', { name: 'منهج.txt', mimeType: 'text/plain', buffer: Buffer.from('الوحدة الأولى: الملاحة الساحلية\nالدرس الأول: الخرائط البحرية\nالأهداف:\nأن يذكر الطالب رموز الخريطة البحرية.\nأن يحلل الطالب مسار السفينة على الخريطة.\n') });
await p.click('[data-brief]');
check('عبارة جاهزة تملأ الأمر', await p.inputValue('#brief-text'), t => t.length > 10);
await p.click('#btn-analyze'); await p.waitForSelector('#panel-results.is-active', { timeout: 15000 });
await p.waitForFunction(() => document.querySelector('#custom-report .md h2') && !document.querySelector('#custom-report .skeleton'), null, { timeout: 15000 });
await p.waitForFunction(() => document.querySelector('#custom-report').textContent.includes('وحّد الصياغة'), null, { timeout: 15000 });
const custom = await p.textContent('#custom-report');
check('عناوين التقرير', await p.$$eval('#custom-report .md :is(h2, h3)', h => h.map(x => x.textContent)), ['تقرير', 'الملاحظات', 'التوصيات']);
check('حذف الحروف الصينية من التقرير', !CJK.test(custom) && !/\S {2,}\S/.test(custom));
check('بنود القوائم', await p.$$eval('#custom-report .md li', l => l.length), 4);
check('التقرير الآلي ظاهر والطباعة متاحة', [await p.isVisible('#report .summary-cards'), !(await p.$eval('#btn-print', x => x.disabled))], [true, true]);
await p.waitForTimeout(900);
check('أرقام الملخص بعد العد التصاعدي', await p.$$eval('#report .summary-card .num', ns => ns.slice(0, 4).map(n => n.textContent)), a => a.length === 4 && a.every(x => /^\d+(\.\d+)?%?$/.test(x)));
check('بطاقة الملخص قابلة للنقر', await p.$eval('#report .summary-card[role=button]', c => c.title), t => t.length > 0);
await p.click('#report .summary-card[role=button]'); await p.waitForSelector('.report-section.is-flash');
check('النقر يضيء القسم', await p.$eval('.report-section.is-flash h2', h => h.textContent), t => t.length > 0);
await closeToasts(p); await p.$eval('#custom-report', el => el.scrollIntoView()); await shot(p, 'h-custom-report.png');

// بلا تحليل آلي
await p.click('#tab-upload'); await p.uncheck('#brief-auto'); await p.fill('#brief-text', 'ارصد الملاحظات'); await p.click('#btn-analyze');
await p.waitForSelector('#panel-results.is-active', { timeout: 15000 });
await p.waitForFunction(() => document.querySelector('#custom-report').textContent.includes('وحّد الصياغة'), null, { timeout: 15000 });
check('بلا آلي: التقرير الآلي وبطاقة التقييم مخفيان', [await p.$eval('#report', r => r.hidden), await p.$eval('#ai-review-card', r => r.hidden), !(await p.$eval('#btn-print', x => x.disabled))], [true, true, true]);

// بلا أمر ولا تحليل آلي
await p.click('#tab-upload'); await p.fill('#brief-text', ''); await p.click('#btn-analyze');
await p.waitForSelector('.toast-warn');
check('تحذير عند غياب الأمر والتحليل', await p.textContent('.toast-warn'), t => t.length > 0);
await p.check('#brief-auto');

// المساعد: حذف الحروف الدخيلة
await p.click('#tab-assistant'); await p.selectOption('#ai-lang', 'en'); await p.selectOption('#ai-lang', 'ar');
await p.fill('#chat-text', 'هل الأهداف جيدة؟'); await p.click('#chat-send');
await p.waitForFunction(() => !document.getElementById('chat-send').disabled && [...document.querySelectorAll('.msg.assistant')].at(-1)?.textContent.includes('وحدة'), null, { timeout: 15000 });
check('رد المساعد بلا حروف صينية', await p.$$eval('.msg.assistant', ms => ms.at(-1).textContent), t => !CJK.test(t));
check('سطر الحالة يذكر الحذف بصياغة سليمة', await p.textContent('#ai-status'), 'حُذف حرفان دخيلان من الرد.');
await p.click('#tab-upload'); await closeToasts(p); await shot(p, 'h-brief.png');

check('لا أخطاء JavaScript', errs, []);
await b.close();
finish();

// اختبار المناهج والمساعد والإدارة والأدوار في harak.html
// يحتاج playwright والخادم الوهمي: node harak-app/2026-10-05-mock-ollama.mjs &
import { launch, watchErrors, check, finish, setupAdmin, addUser, logout, loginFirstTime, closeToasts, shot } from './2026-10-23-harak-test-helpers.mjs';

const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); const errs = []; watchErrors(p, errs);
await setupAdmin(p);
check('التبويبات', await p.$$eval('.tab-btn', ts => ts.filter(t => !t.hidden).map(t => t.textContent.trim())), ['المناهج', 'المساعد', 'تحليل منهج', 'النتائج', 'المرجع', 'المعايير والإعدادات', 'الإدارة']);

// منهج جديد بمسودة من المساعد
check('زر رئيسي واحد في الحالة الفارغة', await p.$eval('#btn-cur-new', x => x.hidden));
await p.click('[data-empty-new]'); await p.fill('#cur-subject', 'الملاحة البحرية'); await p.fill('#cur-goals', 'أن يحدد الطالب المواقع.');
await p.click('#btn-cur-ai'); await p.waitForSelector('#cur-editor-view:not([hidden])', { timeout: 15000 });
check('وحدات المسودة', await p.$$eval('.module-card', m => m.length), 2);
await shot(p, 'h-editor.png', { fullPage: true });

// تحليل المنهج
await p.click('#btn-cur-analyze'); await p.fill('#brief-text', ''); await p.click('#btn-analyze');
await p.waitForSelector('#panel-results.is-active', { timeout: 15000 }); await p.waitForTimeout(900);
check('أرقام الملخص', await p.$$eval('#report .summary-card .num', ns => ns.length), n => n >= 4);
check('النتائج: لا حالة فارغة', await p.$eval('#results-empty', e => e.hidden));

// المساعد
await p.click('#tab-curricula'); await p.click('#btn-cur-ask');
check('سياق المساعد', await p.$eval('#ai-context', s => s.selectedOptions[0].textContent), t => t.includes('الملاحة البحرية'));
await p.click('#btn-ai-test'); await p.waitForFunction(() => /متصل|يعمل|نجح/.test(document.getElementById('ai-status').textContent), null, { timeout: 10000 }).catch(() => {});
check('حالة الاتصال', await p.textContent('#ai-status'), t => t.length > 0);
// يُؤخَّر طلب هذا السؤال ثانية واحدة ليُفحص سلوك الواجهة أثناء انتظار الرد
const slow = async route => { await new Promise(r => setTimeout(r, 1000)); await route.continue(); };
await p.route('**/api/chat', slow);
await p.fill('#chat-text', 'هل الأهداف جيدة؟'); await p.click('#chat-send');
check('الأسئلة الجاهزة معطّلة أثناء الرد', await p.$eval('[data-quick]', x => x.disabled));
await p.fill('#chat-text', 'سؤال تالٍ'); await p.press('#chat-text', 'Control+Enter');
check('النص المكتوب أثناء الرد لا يضيع', await p.inputValue('#chat-text'), 'سؤال تالٍ');
await p.fill('#chat-text', '');
await p.waitForFunction(() => !document.getElementById('chat-send').disabled, null, { timeout: 15000 });
await p.unroute('**/api/chat', slow);
check('رد المساعد كامل وبلا حروف صينية', await p.$$eval('.msg.assistant', ms => ms.at(-1).textContent), t => t.includes('نشاط عملي') && !/[一-鿿]/.test(t) && !/\S {2,}\S/.test(t));
await p.click('[data-quick*="JSON"]'); await p.waitForSelector('[data-apply]', { timeout: 15000 });
await p.click('[data-apply]'); await p.click('#dlg-ok'); await p.waitForSelector('#cur-editor-view:not([hidden])');
check('تطبيق النسخة المقترحة', [await p.$$eval('.module-card', m => m.length), await p.$eval('.tab-btn[aria-selected=true]', t => t.textContent.trim())], [2, 'المناهج']);
await p.click('#tab-assistant'); await closeToasts(p); await shot(p, 'h-assistant.png');

// الإدارة
await p.click('#tab-admin'); await shot(p, 'h-admin.png', { fullPage: true });
check('سجل الدخول', await p.$$eval('#users-table tbody tr', r => r.length), 1);
await p.click('#btn-admin-tests'); await p.waitForSelector('#admin-test-results strong', { timeout: 30000 });
check('اختبارات المحلّل كلها ناجحة', await p.textContent('#admin-test-results strong'), t => /^\s*(\d+)\s*\/\s*\1\s*$/.test(t));

// الأدوار
await addUser(p, { fullName: 'سعيد العامري', username: 'saeed.review', role: 'reviewer', password: 'TempPass2030' });
await addUser(p, { fullName: 'سالم الحارثي', username: 'salem.design', role: 'designer', password: 'TempPass2031' });
await logout(p); await loginFirstTime(p, 'saeed.review', 'TempPass2030', 'Saeed2026review');
check('مصمم المنهج: يرى الإدارة دون عناصر المدير', [!(await p.$eval('#tab-admin', t => t.hidden)), await p.$$eval('[data-admin-only]', ts => ts.every(t => t.hidden))], [true, true]);
await logout(p); await loginFirstTime(p, 'salem.design', 'TempPass2031', 'Salem2026design');
check('المصمم التعليمي: لا إدارة', await p.$eval('#tab-admin', t => t.hidden));
check('المصمم التعليمي يرى المناهج المشتركة', await p.$$eval('.cur-card', c => c.length), 1);
await p.reload(); await p.waitForLoadState('load');
check('إعادة التحميل تبقي الجلسة', await p.isHidden('#landing'));

check('لا أخطاء JavaScript', errs, []);
await b.close();
finish();

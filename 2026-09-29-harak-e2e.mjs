// اختبار المناهج والمساعد والإدارة والأدوار في harak.html
// يحتاج playwright والخادم الوهمي: node harak-app/2026-10-05-mock-ollama.mjs &
import { launch, watchErrors, check, finish, setupAdmin, addUser, logout, loginFirstTime, closeToasts, shot } from './2026-10-23-harak-test-helpers.mjs';

const b = await launch();
const p = await (await b.newContext({ viewport: { width: 1366, height: 900 } })).newPage(); const errs = []; watchErrors(p, errs);
await setupAdmin(p);
// PillNav (React Bits): الأقسام بأيقوناتها، والقسم الحالي مميز، والشعار بلا دائرة بيضاء
check('التبويبات', await p.$$eval('.harak-nav .pill-nav__slot:not([hidden]) .pill-nav__face', ts => ts.map(t => t.textContent.trim())), ['المناهج', 'المساعد', 'تحليل منهج', 'النتائج', 'المرجع', 'المعايير والإعدادات', 'الإدارة']);

check('أيقونة لكل قسم', await p.$$eval('.harak-nav .pill-nav__slot:not([hidden]) .pill-nav__face svg', s => s.length), 7);
check('القسم الحالي في الشريط', await p.$eval('.harak-nav [aria-current=page]', x => x.dataset.tab), 'tab-curricula');
check('شعار الأكاديمية بخلفية شفافة', await p.$eval('.app-logo', x => [getComputedStyle(x).backgroundColor, getComputedStyle(x).borderRadius]), ['rgba(0, 0, 0, 0)', '0px']);
await p.click('[data-tab=tab-reference]');
check('اختيار قسم من الشريط', [await p.isVisible('#panel-reference'), await p.$eval('.harak-nav [aria-current=page]', x => x.dataset.tab)], [true, 'tab-reference']);
await p.click('[data-tab=tab-curricula]');

// BlurText (React Bits) في عنوان «مناهجي»: يكتمل ظاهرًا، والنص الكامل لقارئ الشاشة مرة واحدة
await p.waitForFunction(() => { const s = [...document.querySelectorAll('#panel-curricula h2 [aria-hidden="true"]')]; return s.length && s.every(x => getComputedStyle(x).opacity === '1'); }, null, { timeout: 5000 });
check('BlurText: العنوان يكتمل ظاهرًا', await p.$eval('#panel-curricula h2', h => [h.tagName, h.querySelectorAll('[aria-hidden="true"]').length, [...h.querySelectorAll('span')].filter(s => !s.closest('[aria-hidden]') && !s.querySelector('span')).map(s => s.textContent)]), ['H2', 1, ['مناهجي']]);

// الهوية الزرقاء: الأمواج تتحرك، وMagnet يغلّف الأزرار الأساسية، والتركيز لا يبيّض الزر الأساسي
check('الخلفية المتحركة', await p.$eval('body > .harak-sea .harak-wave-1', w => getComputedStyle(w).animationName), 'harak-tide');
check('Magnet على الزر الأساسي', await p.$eval('[data-empty-new]', x => !!x.closest('.magnet-wrap')));
await p.focus('[data-empty-new]');
check('الزر الأساسي يبقى أزرق عند التركيز', await p.$eval('[data-empty-new]', x => getComputedStyle(x).backgroundColor), 'rgb(11, 84, 151)');

// منهج جديد بمسودة من المساعد
check('زر رئيسي واحد في الحالة الفارغة', await p.$eval('#btn-cur-new', x => x.hidden));
check('لا مجلد والقائمة فارغة', await p.$eval('#cur-list-view .file-folder', f => f.hidden));
await p.click('[data-empty-new]'); await p.fill('#cur-subject', 'الملاحة البحرية'); await p.fill('#cur-goals', 'أن يحدد الطالب المواقع.');
await p.click('#btn-cur-ai'); await p.waitForSelector('#cur-editor-view:not([hidden])', { timeout: 15000 });
check('وحدات المسودة', await p.$$eval('.module-card', m => m.length), 2);
await shot(p, 'h-editor.png', { fullPage: true });

// تحليل المنهج
await p.click('#btn-cur-analyze'); await p.fill('#brief-text', ''); await p.click('#btn-analyze');
await p.waitForSelector('#panel-results.is-active', { timeout: 15000 }); await p.waitForTimeout(900);
check('أرقام الملخص', await p.$$eval('#report .summary-card .num', ns => ns.length), n => n >= 4);
// ThoughtLine (React Bits): سطر التحليل يستقر بمدته، وتحته الخطوات الخمس
await p.click('[data-tab=tab-upload]');
await p.waitForFunction(() => !document.querySelector('[data-thought=analysis] .thought-line[data-working]'));
check('سطر التحليل', await p.$eval('[data-thought=analysis]', h => [h.hidden, h.querySelector('[role=status]').textContent]), ([hidden, t]) => !hidden && /^اكتمل التحليل في \d+\.\d ثانية$/.test(t));
check('خطوات التحليل تحت السطر', await p.$$eval('[data-thought=analysis] .thought-line__step-text', s => s.map(x => x.textContent)), ['قراءة الملف', 'استخراج الوحدات والدروس والأهداف', 'تصنيف الأهداف على مستويات بلوم', 'مطابقة المعايير', 'حساب الاكتمال والإحصاءات']);
await p.click('[data-tab=tab-results]');
check('النتائج: لا حالة فارغة', await p.$eval('#results-empty', e => e.hidden));

// مجلد الملفات المحفوظة (Folder من React Bits): المناهج في تبويبها والتقارير في الإعدادات، والورقة تفتح ملفها
await p.click('#btn-save'); await closeToasts(p);
await p.click('[data-tab=tab-curricula]'); await p.click('#cur-editor-view [data-cur-back]');
await p.waitForSelector('#cur-list-view .folder-root');
check('مجلد المناهج: التسمية والأوراق', await p.$eval('#cur-list-view .folder-shelf', s => [s.querySelector('.folder-stage').getAttribute('aria-label'), [...s.querySelectorAll('.file-card-title')].map(t => t.textContent)]), ['مجلد المناهج', ['الملاحة البحرية']]);
await p.click('#cur-list-view .folder-stage'); await p.waitForTimeout(1200);
check('المجلد يُفتح', await p.$eval('#cur-list-view .folder-stage', s => s.getAttribute('aria-expanded')), 'true');
await shot(p, 'h-folder.png');
await p.click('#cur-list-view .folder-item'); await p.waitForSelector('#cur-editor-view:not([hidden])');
check('ورقة المجلد تفتح المنهج', await p.inputValue('#ed-subject'), 'الملاحة البحرية');
await p.click('[data-tab=tab-settings]'); await p.waitForSelector('#panel-settings .folder-root');
check('مجلد التقارير', await p.$$eval('#panel-settings .file-card-title', ts => ts.length), 1);
await p.click('#panel-settings .folder-stage'); await p.waitForTimeout(1200);
await p.click('#panel-settings .folder-item'); await p.waitForSelector('#panel-results.is-active');
check('ورقة التقرير تفتح نتائجه', await p.$$eval('#report .summary-card .num', ns => ns.length), n => n >= 4);

// المساعد: PromptBar (React Bits)
const input = '#chat-prompt .prompt-bar__input', sendBtn = '#chat-prompt .prompt-bar__send';
await p.click('[data-tab=tab-curricula]'); await p.click('#btn-cur-ask');
check('سياق المساعد', await p.$eval('#ai-context', s => s.selectedOptions[0].textContent), t => t.includes('الملاحة البحرية'));
check('«اسأل المساعد» يركّز الحقل', await p.evaluate(s => document.activeElement === document.querySelector(s), input));
await p.fill(input, '/الموض');
check('قائمة / للأسئلة الجاهزة بالعربية', await p.$$eval('.prompt-bar__row .prompt-bar__row-name', r => r.map(x => x.textContent)), ['/الموضوعات الناقصة']);
await p.fill(input, '@الملا');
check('قائمة @ للمناهج', await p.$$eval('.prompt-bar__row .prompt-bar__row-name', r => r.map(x => x.textContent)), ['الملاحة البحرية']);
await p.press(input, 'Enter');
check('اختيار منهج يكتب اسمه', await p.inputValue(input), '@الملاحة البحرية ');
await p.fill(input, '');
await p.click('#chat-prompt .prompt-bar__pick'); await p.waitForSelector('.prompt-bar__menu[data-kind=model]');
check('النماذج من Ollama', await p.$$eval('.prompt-bar__row .prompt-bar__row-name', r => r.map(x => x.textContent)), ['qwen2.5:7b', 'gemma4:31b-cloud', 'llama3.2:latest']);
await p.keyboard.press('Escape'); await p.click(input);
await p.click('#btn-ai-test'); await p.waitForFunction(() => /متصل|يعمل|نجح/.test(document.getElementById('ai-status').textContent), null, { timeout: 10000 }).catch(() => {});
check('حالة الاتصال', await p.textContent('#ai-status'), t => t.length > 0);
// يُؤخَّر طلب هذا السؤال ثانية واحدة ليُفحص سلوك الواجهة أثناء انتظار الرد
const slow = async route => { await new Promise(r => setTimeout(r, 1000)); await route.continue().catch(() => {}); }; // «إيقاف» يلغي الطلب أثناء الانتظار
await p.route('**/api/chat', slow);
await p.fill(input, 'هل الأهداف جيدة؟'); await p.press(input, 'Enter');
check('الأسئلة الجاهزة معطّلة أثناء الرد', await p.$eval('[data-quick]', x => x.disabled));
check('زر الإرسال يصير إيقافًا أثناء الرد', await p.getAttribute(sendBtn, 'aria-label'), 'إيقاف');
await p.fill(input, 'سؤال تالٍ'); await p.press(input, 'Enter');
check('النص المكتوب أثناء الرد لا يضيع', await p.inputValue(input), 'سؤال تالٍ');
await p.fill(input, '');
await p.waitForFunction(s => document.querySelector(s).getAttribute('aria-label') === 'إرسال', sendBtn, { timeout: 15000 });
// «إيقاف» يقطع الرد ويُبقي ما وصل منه
await p.fill(input, 'سؤال سيوقف'); await p.press(input, 'Enter'); await p.click(sendBtn);
await p.waitForFunction(s => document.querySelector(s).getAttribute('aria-label') === 'إرسال', sendBtn, { timeout: 15000 });
check('إيقاف الرد', await p.$$eval('.msg.assistant', ms => ms.at(-1).textContent), t => t.includes('أُوقف الرد بطلبك'));
await p.unroute('**/api/chat', slow);
// ملف مرفق من قائمة +: يظهر اسمه في السؤال، ويصل نصه إلى النموذج
let sentBody = '';
await p.route('**/api/chat', async route => { sentBody = route.request().postData() || ''; await route.continue(); });
await p.click('#chat-prompt .prompt-bar__tool');
const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.click('.prompt-bar__row:has-text("ملف من هذا الجهاز")')]);
await chooser.setFiles({ name: 'خطة.txt', mimeType: 'text/plain', buffer: Buffer.from('الوحدة الأولى: الأرصاد البحرية') });
await p.waitForSelector('#chat-prompt .prompt-bar__chip');
check('شريحة الملف المرفق', await p.textContent('#chat-prompt .prompt-bar__chip-name'), 'خطة.txt');
await p.fill(input, 'لخّص الملف'); await p.press(input, 'Enter');
await p.waitForFunction(s => document.querySelector(s).getAttribute('aria-label') === 'إرسال', sendBtn, { timeout: 15000 });
check('نص الملف يصل إلى النموذج', sentBody.includes('الأرصاد البحرية') && sentBody.includes('خطة.txt'));
check('اسم الملف في رسالة المستخدم', await p.$$eval('.msg.user', ms => ms.at(-1).textContent), t => t.includes('مرفق: خطة.txt'));
await p.unroute('**/api/chat');
check('رد المساعد كامل وبلا حروف صينية', await p.$$eval('.msg.assistant', ms => ms.at(-1).textContent), t => t.includes('نشاط عملي') && !/[一-鿿]/.test(t) && !/\S {2,}\S/.test(t));
await p.click('[data-quick*="JSON"]'); await p.waitForSelector('[data-apply]', { timeout: 15000 });
await p.click('[data-apply]'); await p.click('#dlg-ok'); await p.waitForSelector('#cur-editor-view:not([hidden])');
check('تطبيق النسخة المقترحة', [await p.$$eval('.module-card', m => m.length), await p.$eval('.harak-nav [aria-current=page]', t => t.dataset.tab)], [2, 'tab-curricula']);
await p.click('[data-tab=tab-assistant]'); await closeToasts(p); await shot(p, 'h-assistant.png');

// الإدارة
await p.click('[data-tab=tab-admin]'); await shot(p, 'h-admin.png', { fullPage: true });
check('سجل الدخول', await p.$$eval('#users-table tbody tr', r => r.length), 1);
await p.click('#btn-admin-tests'); await p.waitForSelector('#admin-test-results strong', { timeout: 30000 });
check('اختبارات المحلّل كلها ناجحة', await p.textContent('#admin-test-results strong'), t => /^\s*(\d+)\s*\/\s*\1\s*$/.test(t));

// الأدوار
await addUser(p, { fullName: 'سعيد العامري', username: 'saeed.review', role: 'reviewer', password: 'TempPass2030' });
await addUser(p, { fullName: 'سالم الحارثي', username: 'salem.design', role: 'designer', password: 'TempPass2031' });
await logout(p); await loginFirstTime(p, 'saeed.review', 'TempPass2030', 'Saeed2026review');
check('مصمم المنهج: يرى الإدارة دون عناصر المدير', [!(await p.$eval('#tab-admin', t => t.hidden)), await p.$$eval('[data-admin-only]', ts => ts.every(t => t.hidden))], [true, true]);
await logout(p); await loginFirstTime(p, 'salem.design', 'TempPass2031', 'Salem2026design');
check('المصمم التعليمي: لا إدارة', [await p.$eval('#tab-admin', t => t.hidden), await p.isHidden('[data-tab=tab-admin]')], [true, true]);
check('المصمم التعليمي يرى المناهج المشتركة', await p.$$eval('.cur-card', c => c.length), 1);
await p.reload(); await p.waitForLoadState('load');
check('إعادة التحميل تبقي الجلسة', await p.isHidden('#landing'));
check('إعادة التحميل تعرض المناهج', await p.isVisible('#panel-curricula .cur-card'));

check('لا أخطاء JavaScript', errs, []);
await b.close();
finish();

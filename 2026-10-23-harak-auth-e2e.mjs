// اختبار تسجيل الدخول والحسابات في harak.html: node 2026-10-23-harak-auth-e2e.mjs
import { readFileSync } from 'node:fs';
import { FILE, ADMIN, launch, watchErrors, check, finish, setupAdmin, addUser, logout, login, loginFirstTime, submitAndWaitError, shot } from './2026-10-23-harak-test-helpers.mjs';

const GENERIC = 'اسم المستخدم أو كلمة المرور غير صحيحة.';
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage(); const errs = []; watchErrors(p, errs);

// ١) أول تشغيل: التحقق من الحقول
await p.goto(FILE); await p.waitForSelector('#setup-form:not([hidden])');
check('أول تشغيل يعرض إعداد المدير ويخفي الدخول', await p.isHidden('#login-form'));
await shot(p, 'a-setup.png');
await p.fill('#setup-fullname', 'م'); await p.fill('#setup-username', 'A b'); await p.fill('#setup-password', 'short1'); await p.fill('#setup-password2', 'other');
await p.click('#setup-submit');
check('أخطاء الحقول الأربعة', await p.$$eval('.field-error', es => es.map(e => e.textContent).filter(Boolean).length), 4);
check('يبقى في الإعداد', await p.isVisible('#setup-form'));
await setupAdmin(p);
check('المدير دخل ويرى الإدارة', !(await p.$eval('#tab-admin', t => t.hidden)));
check('الاسم في الشريط العلوي', await p.textContent('#app-user-name'), ADMIN.fullName);
const db = await p.evaluate(() => JSON.parse(localStorage.getItem('harak.users')));
check('لا كلمة مرور صريحة في التخزين', !JSON.stringify(db).includes(ADMIN.password));
check('تجزئة PBKDF2 بعدد التكرارات', [db.users[0].hash.length > 20, db.users[0].iterations], [true, 210000]);

// ٢) إضافة مستخدمين
await addUser(p, { fullName: 'سالم الحارثي', username: 'salem.design', role: 'designer', password: 'TempPass2026' });
await addUser(p, { fullName: 'خالد الرواحي', username: 'khalid.review', role: 'reviewer', password: 'TempPass2027' });
check('الحصة', await p.textContent('#accounts-quota'), '3 من 30 مستخدمًا.');
check('الحالات', await p.$$eval('#accounts-table tbody tr td:nth-child(4)', ts => ts.map(t => t.textContent)), ['نشط', 'بانتظار تعيين كلمة مرور', 'بانتظار تعيين كلمة مرور']);
check('لا حذف لصف المدير نفسه', await p.$$eval('#accounts-table tbody tr:first-child [data-act="delete"]', x => x.length), 0);
check('دور المدير نفسه غير قابل للتغيير', await p.$eval('#accounts-table tbody tr:first-child select', s => s.disabled));
check('تنبيه النسخ الاحتياطي', await p.isVisible('#accounts-backup'));
await shot(p, 'a-admin.png', { fullPage: true });

// ٣) دخول خاطئ: رسالة واحدة للحالتين
await logout(p);
await p.focus('#login-password'); await p.waitForTimeout(120);
check('التركيز لا يُسحب من حقل بدأ المستخدم فيه', await p.evaluate(() => document.activeElement.id), 'login-password');
await login(p, 'salem.design', 'WrongPass123');
check('كلمة مرور خاطئة', await p.textContent('#login-error'), GENERIC);
await login(p, 'nobody.here', 'WrongPass123');
check('مستخدم غير موجود: الرسالة نفسها', await p.textContent('#login-error'), GENERIC);

// ٤) أول دخول للمصمم التعليمي: تغيير إلزامي
await login(p, 'salem.design', 'TempPass2026');
check('تغيير كلمة المرور إلزامي', await p.isVisible('#change-form'));
await p.fill('#change-password', 'TempPass2026'); await p.fill('#change-password2', 'TempPass2026');
check('رفض إعادة المؤقتة', await submitAndWaitError(p, '#change-submit', '#change-password-error'), 'اختر كلمة مرور تختلف عن كلمة المرور المؤقتة.');
await p.waitForFunction(() => !document.getElementById('change-submit').disabled);
await p.fill('#change-password', 'Salem2026design'); await p.fill('#change-password2', 'Salem2026design'); await p.click('#change-submit');
await p.waitForSelector('#landing', { state: 'hidden' });
check('دور المصمم التعليمي', await p.textContent('#app-user-role'), 'المصمم التعليمي');
check('المصمم التعليمي لا يرى الإدارة', await p.$eval('#tab-admin', t => t.hidden));
await logout(p);

// ٥) مصمم المنهج: يرى الإدارة دون إدارة المستخدمين
await loginFirstTime(p, 'khalid.review', 'TempPass2027', 'Khalid2026review');
check('دور مصمم المنهج', await p.textContent('#app-user-role'), 'مصمم المنهج');
await p.click('[data-tab=tab-admin]');
check('مصمم المنهج لا يرى إدارة الحسابات', await p.$eval('#accounts-card', c => c.hidden));
check('سجل الدخول يشمل المحاولات الفاشلة', await p.$$eval('#users-table tbody tr', rs => [rs.length, rs.filter(x => x.textContent.includes('فاشل')).length]), [5, 2]);
await logout(p);

// ٦) القفل بعد ٥ محاولات
for (let i = 0; i < 5; i++) await login(p, 'salem.design', 'Wrong' + i + 'abcdefg');
check('رسالة القفل', await p.textContent('#login-error'), 'قُفل الحساب بعد 5 محاولات خاطئة. أعد المحاولة بعد 5 دقائق.');
await login(p, 'salem.design', 'Salem2026design');
check('كلمة صحيحة أثناء القفل مرفوضة', (await p.textContent('#login-error')).includes('قُفل'));

// ٧) المدير: فك القفل، إعادة التعيين، التعطيل
await login(p, ADMIN.username, ADMIN.password); await p.waitForSelector('#landing', { state: 'hidden' });
await p.click('[data-tab=tab-admin]');
const statusOf = name => p.$eval(`#accounts-table tr:has-text("${name}") td:nth-child(4)`, t => t.textContent);
check('حالة مقفل', await statusOf('salem.design'), 'مقفل');
await p.click('#accounts-table tr:has-text("salem.design") [data-act="unlock"]');
check('بعد فك القفل', await statusOf('salem.design'), 'نشط');
await p.click('#accounts-table tr:has-text("salem.design") [data-act="reset"]');
await p.click('#dlg-ok'); await p.waitForSelector('.temp-pw');
check('كلمة مؤقتة من 12 حرفًا', /^[A-Za-z0-9]{12}$/.test((await p.textContent('.temp-pw')).trim()));
await p.click('#dlg-ok');
await p.click('#accounts-table tr:has-text("khalid.review") [data-act="toggle"]');
check('حوار التأكيد مفتوح', await p.isVisible('#harak-dialog'));
await p.keyboard.press('Escape'); await p.waitForSelector('#harak-dialog', { state: 'hidden' });
check('Esc يلغي', await statusOf('khalid.review'), 'نشط');
await p.click('#accounts-table tr:has-text("khalid.review") [data-act="toggle"]'); await p.click('#dlg-ok');
await p.waitForFunction(() => document.querySelector('#accounts-table tr:nth-child(3) td:nth-child(4)').textContent === 'معطّل');
check('معطّل', await statusOf('khalid.review'), 'معطّل');

// ٨) تغيير كلمة المرور من القائمة
await p.click('#user-menu-btn'); await p.click('#menu-change-password');
await p.fill('#cp-current', 'nope'); await p.fill('#cp-new', 'Mariam2027admin'); await p.fill('#cp-new2', 'Mariam2027admin');
check('الحالية خاطئة', await submitAndWaitError(p, '#dlg-ok', '#dlg-error'), 'كلمة المرور الحالية غير صحيحة.');
await p.waitForFunction(() => !document.getElementById('dlg-ok').disabled);
await p.fill('#cp-current', ADMIN.password); await p.click('#dlg-ok'); await p.waitForSelector('#harak-dialog', { state: 'hidden' });
check('تنبيه التغيير', await p.textContent('.toast:last-child'), 'غُيّرت كلمة المرور.');

// ٩) التصدير
await p.click('[data-tab=tab-admin]');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btn-accounts-export')]);
const exported = readFileSync(await dl.path(), 'utf8');
check('التصدير بلا كلمات صريحة', [JSON.parse(exported).users.length, !exported.includes('Mariam2027admin') && !exported.includes('Salem2026design')], [3, true]);
check('اختفى تنبيه النسخ الاحتياطي', await p.isHidden('#accounts-backup'));

// ١٠) الجلسة: إعادة التحميل تبقي الدخول، والخمول ينهيه
await p.reload(); await p.waitForLoadState('load');
check('إعادة التحميل تبقي الجلسة', await p.isHidden('#landing'));
await p.evaluate(() => { const s = JSON.parse(sessionStorage.getItem('harak.session')); s.lastActive = Date.now() - 31 * 60 * 1000; sessionStorage.setItem('harak.session', JSON.stringify(s)); });
await p.reload(); await p.waitForSelector('#login-form:not([hidden])');
check('الخمول ينهي الجلسة', await p.isVisible('#login-form'));

// ١١) المعطّل لا يدخل
await login(p, 'khalid.review', 'Khalid2026review');
check('الحساب المعطّل', await p.textContent('#login-error'), 'هذا الحساب معطّل. راجع مدير النظام.');

// ١٢) الاستيراد على جهاز جديد
const ctx2 = await b.newContext({ viewport: { width: 1366, height: 900 } }); const p2 = await ctx2.newPage(); watchErrors(p2, errs, 'p2 ');
await setupAdmin(p2, { fullName: 'مدير ثانٍ', username: 'second.admin', password: 'Second2026admin' });
await p2.click('[data-tab=tab-admin]');
await p2.setInputFiles('#accounts-import', { name: 'users.json', mimeType: 'application/json', buffer: Buffer.from(exported) });
await p2.click('#dlg-ok'); await p2.waitForFunction(() => document.querySelectorAll('#accounts-table tbody tr').length === 4);
check('الصفوف بعد الاستيراد', await p2.$$eval('#accounts-table tbody tr', rs => rs.length), 4);
await logout(p2); await login(p2, ADMIN.username, 'Mariam2027admin');
check('المدير المستورد يدخل', await p2.isHidden('#landing'));

// ١٣) نظافة النصوص
await p2.click('[data-tab=tab-reference]');
const text = await p2.evaluate(() => document.body.innerText);
check('لا كلمات غير رسمية أو أدوار قديمة', ['مؤقت —', 'هيكل مؤقت', 'بند مؤقت', 'غير رسمي', 'تجريبي', 'تبديل الدور', 'جرّب على عينة', 'مراجع مناهج', 'مصمم منهج'].filter(w => text.includes(w)), []);
check('اسم المرجع الداخلي', text.includes('قائمة تحقق عامة لمبادئ الاعتماد الأكاديمي'));
check('القسم الحالي في الشريط', await p2.$eval('.harak-nav [aria-current=page]', x => x.dataset.tab), 'tab-reference');

// ١٤) الجوال
const m = await b.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true }); const pm = await m.newPage(); watchErrors(pm, errs, 'mobile ');
await pm.goto(FILE); await pm.waitForSelector('#setup-form:not([hidden])');
check('الجوال: الإعداد بلا تمرير أفقي', await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await shot(pm, 'a-mobile-setup.png', { fullPage: true });
await setupAdmin(pm);
check('الجوال: النظام بلا تمرير أفقي', await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await shot(pm, 'a-mobile-app.png');

check('لا أخطاء JavaScript', errs, []);
await b.close();
finish();

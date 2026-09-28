// اختبار شامل للواجهة بلا إنترنت (Playwright + Chromium). التشغيل: node 2026-09-28-e2e-test.mjs
// يحتاج حزمة playwright مثبتة في المجلد الذي يُشغَّل منه ومتصفح Chromium في /opt/pw-browsers/chromium (عدّل المسار عند الحاجة).
import { chromium } from 'playwright';
const URL_ = 'file:///home/user/Curriculum-Reviewer/curriculum-analyzer/curriculum-analyzer.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await b.newContext({ offline: true, acceptDownloads: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
const r = {};
await p.goto(URL_);
// 1) العينة → النتائج
await p.click('#btn-sample');
await p.waitForSelector('#panel-results.is-active', { timeout: 15000 });
r.steps = await p.$$eval('#steps li', ls => ls.map(l => l.className));
r.alerts = await p.$$eval('#warnings .alert', as => as.map(a => a.textContent.slice(0, 40)));
r.sections = await p.$$eval('#report .report-section h2', hs => hs.map(h => h.textContent));
r.tables = await p.$$eval('#report table', ts => ts.map(t => t.querySelectorAll('tbody tr').length));
r.svgBars = await p.$$eval('#report svg rect', rs => rs.length);
r.footer = await p.$eval('#report .report-footer', f => f.textContent);
r.buttonsEnabled = await p.$$eval('#panel-results button', bs => bs.map(b => !b.disabled));
// 2) الطباعة: الأزرار والتبويبات مخفية، التقرير ظاهر
await p.emulateMedia({ media: 'print' });
r.print = await p.evaluate(() => ({ header: getComputedStyle(document.querySelector('.app-header')).display, tabs: getComputedStyle(document.querySelector('.tabs')).display, buttons: getComputedStyle(document.querySelector('#panel-results .actions')).display, report: getComputedStyle(document.querySelector('#report')).display, sectionBreak: getComputedStyle(document.querySelectorAll('.report-section')[1]).breakBefore }));
await p.emulateMedia({ media: 'screen' });
// 3) تنزيل JSON
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#btn-json')]);
r.download = dl.suggestedFilename();
// 4) الإعدادات: معيار + اسم جهة + شعار + حفظ تقرير
await p.click('#tab-settings');
await p.fill('#std-paste', 'ع1 يذكر الطالب أجزاء النبات الرئيسية\nمعيار بلا رمز عن دورة الماء في الطبيعة');
await p.click('#btn-std-paste');
await p.fill('#org-name', 'دائرة المناهج');
const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
await p.setInputFiles('#logo-input', { name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from(png1x1.split(',')[1], 'base64') });
await p.waitForFunction(() => !document.getElementById('logo-preview').hidden);
await p.click('#tab-results'); await p.click('#btn-save');
r.stdRows = await p.$$eval('#standards-table tbody tr', rs => rs.map(tr => [tr.querySelector('[data-k=code]').value, tr.querySelector('[data-k=text]').value.slice(0, 20)]));
// 5) إعادة التحميل: البقاء
await p.reload();
r.afterReload = await p.evaluate(() => ({ org: document.getElementById('app-org').textContent, orgInput: document.getElementById('org-name').value, logo: !!document.querySelector('#app-logo img'), stdRows: document.querySelectorAll('#standards-table tbody tr input[data-k=code]').length, reports: document.querySelectorAll('#reports-list li').length }));
// 6) فتح تقرير محفوظ ثم إعادة التحليل مع المعايير (مطابقة المستخدم تظهر)
await p.click('#tab-settings'); await p.click('#reports-list [data-open]');
r.openedSaved = await p.$eval('#panel-results', s => s.classList.contains('is-active')) && await p.$eval('#report .report-header h2', h => h.textContent);
await p.click('#tab-upload'); await p.click('#btn-sample'); await p.waitForSelector('#panel-results.is-active');
r.userMatches = await p.$$eval('#report .report-section:nth-of-type(3) tbody tr', rs => rs.filter(tr => tr.textContent.includes('معايير المادة')).length);
// 7) حذف التقرير المحفوظ
await p.click('#tab-settings'); await p.click('#reports-list [data-delete]');
r.reportsAfterDelete = await p.$$eval('#reports-list li', ls => ls.length);
// 8) وضع المطوّر
await p.goto(URL_ + '#dev'); await p.click('#tab-upload');
r.devBtnVisible = await p.$eval('#btn-dev-tests', b => !b.hidden);
await p.click('#btn-dev-tests');
await p.waitForFunction(() => document.querySelector('#dev-results ul'));
r.dev = await p.$eval('#dev-results', d => ({ summary: d.querySelector('p').textContent, fails: [...d.querySelectorAll('.dev-fail')].map(x => x.textContent) }));
// 9) بلا #dev الزر مخفي
await p.goto(URL_); r.devHiddenNormally = await p.$eval('#btn-dev-tests', b => b.hidden);
console.log(JSON.stringify(r, null, 1)); console.log('errors:', errs);
await b.close();

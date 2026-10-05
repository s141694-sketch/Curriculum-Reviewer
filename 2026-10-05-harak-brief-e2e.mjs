// اختبار التحليل بأمر المستخدم والنتائج التفاعلية والمساعد: يحتاج playwright والخادم الوهمي harak-app/2026-10-05-mock-ollama.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await b.newPage({viewport:{width:1366,height:1000}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,200)); });
await p.goto('file:///home/user/Curriculum-Reviewer/harak-app/harak.html');
await p.click('.role-card[data-role=admin]'); await p.fill('#landing-name','مريم'); await p.click('#landing-enter'); await p.waitForTimeout(300);
console.log('toast shown:', await p.isVisible('.toast'));
console.log('danger zone absent:', (await p.$('#btn-admin-wipe'))===null, '| lang select:', await p.$eval('#ai-lang', s=>s.value));
// تحليل بأمر المستخدم + تحليل آلي
await p.click('#tab-upload');
await p.setInputFiles('#file-input', { name: 'منهج.txt', mimeType: 'text/plain', buffer: Buffer.from('الوحدة الأولى: النباتات\nالدرس الأول: أجزاء النبات\nالأهداف:\nأن يذكر الطالب أجزاء النبات.\nأن يحلل الطالب وظيفة الجذر.\n') });
await p.click('[data-brief]'); console.log('brief filled:', (await p.inputValue('#brief-text')).slice(0,20));
await p.click('#btn-analyze'); await p.waitForSelector('#panel-results.is-active',{timeout:15000});
await p.waitForFunction(() => document.querySelector('#custom-report .md h2'), null, {timeout:15000}); await p.waitForTimeout(600);
const custom = await p.textContent('#custom-report');
console.log('custom report has headings:', await p.$$eval('#custom-report .md h2', h=>h.map(x=>x.textContent)), '| CJK removed:', !/[一-鿿]/.test(custom), '| list items:', await p.$$eval('#custom-report .md li', l=>l.length));
console.log('auto report visible:', await p.isVisible('#report .summary-cards'), '| print enabled:', !(await p.$eval('#btn-print', b=>b.disabled)));
await p.waitForTimeout(900); console.log('summary nums after count-up:', await p.$$eval('#report .summary-card .num', ns=>ns.slice(0,4).map(n=>n.textContent)));
console.log('summary card linked:', await p.$eval('#report .summary-card[role=button]', c=>c.title));
await p.click('#report .summary-card[role=button]'); await p.waitForTimeout(300); console.log('flash:', await p.$eval('.report-section.is-flash h2', h=>h.textContent));
await p.$eval('#custom-report', el=>el.scrollIntoView()); await p.screenshot({path:'h-custom-report.png'});
// بلا تحليل آلي
await p.click('#tab-upload'); await p.uncheck('#brief-auto'); await p.fill('#brief-text','ارصد الملاحظات'); await p.click('#btn-analyze');
await p.waitForSelector('#panel-results.is-active',{timeout:15000}); await p.waitForFunction(() => document.querySelector('#custom-report .md h2'), null, {timeout:15000}); await p.waitForTimeout(300);
console.log('no-auto: report hidden:', await p.$eval('#report', r=>r.hidden), '| print enabled:', !(await p.$eval('#btn-print', b=>b.disabled)));
// بلا أمر ولا آلي
await p.click('#tab-upload'); await p.fill('#brief-text',''); await p.click('#btn-analyze'); await p.waitForTimeout(200); console.log('warn toast:', await p.textContent('.toast-warn'));
await p.check('#brief-auto');
// المساعد: الحذف الدخيل + النسخ + ماركداون
await p.click('#tab-assistant'); await p.selectOption('#ai-lang','en'); await p.selectOption('#ai-lang','ar');
await p.fill('#chat-text','هل الأهداف جيدة؟'); await p.click('#chat-send'); await p.waitForTimeout(1200);
const last = await p.$$eval('.msg.assistant', ms=>ms.at(-1).textContent); console.log('chat CJK removed:', !/[一-鿿]/.test(last), '| status:', await p.textContent('#ai-status'));
await p.click('#tab-upload'); await p.screenshot({path:'h-brief.png'});
console.log('errors:', errs); await b.close();

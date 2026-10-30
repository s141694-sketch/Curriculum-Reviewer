// أدوات مشتركة لاختبارات harak.html. تحتاج playwright وChromium.
// مسار Chromium: CHROMIUM_PATH إن وُجد، وإلا /opt/pw-browsers/chromium إن وُجد، وإلا متصفح playwright الافتراضي.
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const FILE = new URL('./harak-app/harak.html', import.meta.url).href;
export const ADMIN = { fullName: 'مريم البلوشية', username: 'mariam.admin', password: 'Harak2026sqna' };

export function launch() {
  const exe = process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  return chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
}

export function watchErrors(p, errs, tag = '') {
  // DEBUG=1: يطبع كل إرسال لنموذج مع أطوال الحقول (لا محتوى كلمات المرور)
  if (process.env.DEBUG) p.addInitScript(() => {
    document.addEventListener('submit', e => {
      const vals = [...e.target.querySelectorAll('input')].map(i => i.id + '=' + (i.type === 'password' ? `[${i.value.length}]` : i.value));
      console.log('[submit]', e.target.id, vals.join(' '));
    }, true);
  });
  p.on('pageerror', e => { errs.push(tag + e.message); if (process.env.DEBUG) console.error('pageerror:', tag + e.message); });
  p.on('console', m => { if (m.type() === 'error') errs.push(tag + m.text().slice(0, 200)); if (process.env.DEBUG) console.error('console:', m.text().slice(0, 300)); });
}

// تحقق بسيط: القيمة الفعلية تساوي المتوقعة، أو دالة تحقق تعيد true
const results = [];
export function check(name, actual, expected = true) {
  const ok = typeof expected === 'function' ? !!expected(actual) : JSON.stringify(actual) === JSON.stringify(expected);
  results.push(ok);
  console.log(`${ok ? '✓' : '✗'} ${name}: ${JSON.stringify(actual)}${ok || typeof expected === 'function' ? '' : ` (المتوقع ${JSON.stringify(expected)})`}`);
  return ok;
}
export function finish() {
  const failed = results.filter(x => !x).length;
  console.log(`\n${results.length - failed}/${results.length} نجح`);
  process.exitCode = failed ? 1 : 0;
}

// أول تشغيل: إنشاء حساب مدير النظام والدخول
export async function setupAdmin(p, a = ADMIN) {
  await p.goto(FILE);
  await p.waitForSelector('#setup-form:not([hidden])');
  await p.fill('#setup-fullname', a.fullName); await p.fill('#setup-username', a.username);
  await p.fill('#setup-password', a.password); await p.fill('#setup-password2', a.password);
  await p.click('#setup-submit');
  await p.waitForSelector('#landing', { state: 'hidden' });
}

export async function addUser(p, u) {
  await p.click('[data-tab=tab-admin]');
  await p.fill('#nu-fullname', u.fullName); await p.fill('#nu-username', u.username);
  await p.selectOption('#nu-role', u.role); await p.fill('#nu-password', u.password);
  await p.click('#nu-submit');
  await p.waitForSelector(`#accounts-table td:has-text("${u.username}")`);
}

export async function logout(p) {
  await p.click('#user-menu-btn'); await p.click('#menu-logout');
  await p.waitForSelector('#login-form:not([hidden])');
}

// ينتظر نتيجة فعلية: رسالة خطأ، أو نموذج تغيير كلمة المرور، أو دخول النظام
export async function login(p, username, password) {
  await p.fill('#login-username', username); await p.fill('#login-password', password);
  await p.evaluate(() => { const e = document.getElementById('login-error'); e.hidden = true; e.textContent = ''; });
  await p.click('#login-submit');
  await withState(p, async () => {
    await p.waitForFunction(() => {
      const err = document.getElementById('login-error');
      return (!err.hidden && err.textContent) || document.getElementById('landing').hidden || !document.getElementById('change-form').hidden;
    }, null, { timeout: 15000 });
    await p.waitForFunction(() => !document.getElementById('login-submit').disabled, null, { timeout: 15000 });
  });
}

export async function loginFirstTime(p, username, temp, fresh) {
  await login(p, username, temp);
  await p.waitForSelector('#change-form:not([hidden])');
  await p.fill('#change-password', fresh); await p.fill('#change-password2', fresh);
  await p.click('#change-submit');
  await p.waitForSelector('#landing', { state: 'hidden' });
}

export async function submitAndWaitError(p, submitSel, errSel) {
  await p.evaluate(s => { document.querySelector(s).textContent = ''; }, errSel);
  await p.click(submitSel);
  await withState(p, () => p.waitForFunction(s => document.querySelector(s).textContent.trim().length > 0, errSel, { timeout: 15000 }));
  return p.textContent(errSel);
}

// عند انتهاء المهلة: يطبع حالة شاشة الدخول للتشخيص
export async function authState(p) {
  return p.evaluate(() => {
    const g = id => document.getElementById(id);
    return { landing: !g('landing').hidden, view: ['setup', 'login', 'change'].find(v => !g(v + '-form').hidden) || null,
      loginError: g('login-error').hidden ? '' : g('login-error').textContent, changeError: g('change-password-error').textContent,
      busy: [...document.querySelectorAll('.auth-form button[type=submit]')].filter(x => x.disabled).map(x => x.id) };
  });
}
const withState = async (p, fn) => { try { return await fn(); } catch (e) { console.error('حالة الدخول عند انتهاء المهلة:', JSON.stringify(await authState(p).catch(() => null))); throw e; } };

export const closeToasts = p => p.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));

// لقطات اختيارية: SHOTS=<مجلد> node <اختبار>
export async function shot(p, name, opts = {}) {
  if (process.env.SHOTS) await p.screenshot({ path: join(process.env.SHOTS, name), ...opts });
}

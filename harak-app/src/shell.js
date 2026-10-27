// ============================================================
// حراك: الغلاف فوق محلّل المناهج
// الدخول بالدور، المناهج، المساعد الذكي، التحليل بأمر المستخدم، الإدارة.
// يعتمد على العناصر العامة في المحلّل: $, store, state, settings, userStandards,
// activateTab, runAnalysis, readDocument, renderResults, escapeHtml, downloadBlob,
// dateStamp, fmtDate, runDevTests, DEFAULT_LOGO, APP_VERSION, STORAGE_KEYS.
// ============================================================

const HARAK_KEYS = { session: 'harak.session', logins: 'harak.logins', curricula: 'harak.curricula', ai: 'harak.ai', chat: 'harak.chat', brief: 'harak.brief' };
const ROLE_LABELS = { designer: 'المصمم التعليمي', reviewer: 'مصمم المنهج', admin: 'مدير النظام' };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const NEEDLE_SVG = '<svg class="spin" width="14" height="14" viewBox="-50 -50 100 100" aria-hidden="true"><polygon points="0,-40 11,0 -11,0" fill="#BFDCEE"/><polygon points="-11,0 11,0 0,40" fill="#FFFEF9"/></svg>';
// صياغة العدد مع المعدود: 1 مفرد، 2 مثنى، 3–10 جمع، 0 و11 فأكثر مفرد منصوب
// forms = [مفرد، مثنى، جمع، مفرد منصوب]، مثل ['وحدة واحدة', 'وحدتان', 'وحدات', 'وحدة']
function countOf(n, [one, two, few, many]) {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n % 100 >= 3 && n % 100 <= 10 ? few : many}`;
}
const NOUNS = {
  weeks: ['أسبوع واحد', 'أسبوعان', 'أسابيع', 'أسبوعًا'],
  units: ['وحدة واحدة', 'وحدتان', 'وحدات', 'وحدة'],
  unitsGen: ['وحدة واحدة', 'وحدتين', 'وحدات', 'وحدة'],
  topics: ['موضوع واحد', 'موضوعان', 'موضوعات', 'موضوعًا'],
  models: ['نموذج واحد', 'نموذجان', 'نماذج', 'نموذجًا'],
  foreign: ['حرف دخيل واحد', 'حرفان دخيلان', 'أحرف دخيلة', 'حرفًا دخيلًا'],
  minutesGen: ['دقيقة واحدة', 'دقيقتين', 'دقائق', 'دقيقة'],
  daysGen: ['يوم واحد', 'يومين', 'أيام', 'يومًا'],
  usersGen: ['مستخدم واحد', 'مستخدمَين', 'مستخدمين', 'مستخدمًا'],
  users: ['مستخدم واحد', 'مستخدمان', 'مستخدمين', 'مستخدمًا'],
  newUsers: ['مستخدم جديد واحد', 'مستخدمان جديدان', 'مستخدمين جدد', 'مستخدمًا جديدًا'],
  existing: ['حساب واحد موجود', 'حسابان موجودان', 'حسابات موجودة', 'حسابًا موجودًا'],
  curricula: ['منهج واحد', 'منهجان', 'مناهج', 'منهجًا'],
  reports: ['تقرير واحد', 'تقريران', 'تقارير', 'تقريرًا'],
  standards: ['معيار واحد', 'معياران', 'معايير', 'معيارًا'],
};
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- التنبيهات (بدل نوافذ alert) ----------
function toast(message, kind = 'info', ms = 3600) {
  let host = $('toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.appendChild(host); }
  const el = document.createElement('div');
  const icons = { success: '<path d="M5 12l4 4 10-10"/>', warn: '<path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>' };
  el.className = `toast toast-${kind}`;
  el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">${icons[kind] || icons.info}</svg><span></span>`;
  el.querySelector('span').textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => { el.classList.remove('is-in'); setTimeout(() => el.remove(), 300); }, ms);
}

// ---------- عرض Markdown بسيط وآمن (عناوين، قوائم، عريض) ----------
function renderMarkdown(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const out = []; let list = null; let para = [];
  const inline = s => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flushPara(); flushList(); const lvl = Math.min(4, h[1].length + 1); out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`); continue; }
    const ul = line.match(/^(?:[-*•]|[–—])\s+(.*)$/);
    const ol = line.match(/^(?:\d+|[٠-٩]+)[.)]\s+(.*)$/);
    if (ul || ol) { flushPara(); const tag = ul ? 'ul' : 'ol'; if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; } list.items.push((ul || ol)[1]); continue; }
    if (line.startsWith('|')) { flushPara(); flushList(); out.push(`<pre class="md-table">${escapeHtml(line)}</pre>`); continue; }
    flushList(); para.push(line);
  }
  flushPara(); flushList();
  return out.join('');
}

// ---------- حوار مخصّص بدل نوافذ المتصفح ----------
function openDialog({ title, body = '', html = false, confirmLabel = 'تأكيد', cancelLabel = 'إلغاء', danger = false, hideCancel = false, onConfirm = null }) {
  return new Promise(resolve => {
    let dlg = $('harak-dialog');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'harak-dialog'; dlg.className = 'harak-dialog'; dlg.setAttribute('aria-labelledby', 'dlg-title'); document.body.appendChild(dlg); }
    dlg.innerHTML = `<form class="dlg-form" novalidate>
      <h3 class="dlg-title" id="dlg-title">${escapeHtml(title)}</h3>
      <div class="dlg-body">${html ? body : `<p>${escapeHtml(body)}</p>`}</div>
      <div class="form-error" id="dlg-error" role="alert" hidden></div>
      <div class="dlg-actions">
        <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="dlg-ok">${escapeHtml(confirmLabel)}</button>
        ${hideCancel ? '' : `<button type="button" class="btn btn-secondary" id="dlg-cancel">${escapeHtml(cancelLabel)}</button>`}
      </div></form>`;
    const finish = v => { if (dlg.open) dlg.close(); resolve(v); };
    dlg.oncancel = e => { e.preventDefault(); finish(false); };
    const cancel = dlg.querySelector('#dlg-cancel'); if (cancel) cancel.onclick = () => finish(false);
    dlg.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      if (onConfirm) {
        const ok = $('dlg-ok'); ok.disabled = true;
        let err = '';
        try { err = await onConfirm(dlg.querySelector('form')); } catch (x) { err = x.message || String(x); }
        ok.disabled = false;
        if (err) { const el = $('dlg-error'); el.textContent = err; el.hidden = false; return; }
      }
      finish(true);
    };
    dlg.showModal();
    (dlg.querySelector('.dlg-body input, .dlg-body select, .dlg-body textarea') || $('dlg-ok')).focus();
  });
}
const confirmDialog = (title, body, confirmLabel = 'تأكيد', danger = false) => openDialog({ title, body, confirmLabel, danger });

// ---------- الحسابات وكلمات المرور ----------
// كلمات المرور لا تُخزَّن أبدًا: يُخزَّن ناتج PBKDF2-SHA256 مع ملح عشوائي لكل مستخدم.
const AUTH = {
  KEY: 'harak.users', ITER: 210000, MAX_FAILS: 5, LOCK_MS: 5 * 60 * 1000, IDLE_MS: 30 * 60 * 1000, DEFAULT_MAX: 30,
  db() { const d = store.read(this.KEY, null) || {}; return { version: 1, maxUsers: this.DEFAULT_MAX, users: [], lastExport: null, ...d }; },
  save(d) { return store.write(this.KEY, d); },
  norm: u => String(u || '').trim().toLowerCase(),
  validUsername: u => /^[a-z0-9._-]{3,32}$/.test(u),
  passwordProblem(pw, username) {
    if (pw.length < 10) return 'كلمة المرور يجب ألا تقل عن 10 أحرف.';
    if (!/[A-Za-zء-ي]/.test(pw) || !/[0-9٠-٩]/.test(pw)) return 'كلمة المرور يجب أن تتضمن حرفًا ورقمًا على الأقل.';
    if (username && pw.toLowerCase().includes(username)) return 'كلمة المرور يجب ألا تتضمن اسم المستخدم.';
    return '';
  },
  b64: bytes => btoa(String.fromCharCode(...bytes)),
  unb64: s => Uint8Array.from(atob(s), c => c.charCodeAt(0)),
  async derive(pw, salt, iterations) {
    if (!(window.crypto && crypto.subtle)) throw new Error('هذا المتصفح لا يدعم التشفير المطلوب لتسجيل الدخول. استخدم إصدارًا حديثًا من Chrome أو Edge أو Firefox.');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: this.unb64(salt), iterations }, key, 256);
    return this.b64(new Uint8Array(bits));
  },
  async secret(pw) { const salt = this.b64(crypto.getRandomValues(new Uint8Array(16))); return { salt, iterations: this.ITER, hash: await this.derive(pw, salt, this.ITER) }; },
  async verify(user, pw) { const h = await this.derive(pw, user.salt, user.iterations); let r = h.length ^ user.hash.length; for (let i = 0; i < Math.min(h.length, user.hash.length); i++) r |= h.charCodeAt(i) ^ user.hash.charCodeAt(i); return r === 0; },
  tempPassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let out;
    do { out = Array.from(crypto.getRandomValues(new Uint32Array(12)), n => chars[n % chars.length]).join(''); } while (!/[A-Za-z]/.test(out) || !/\d/.test(out));
    return out;
  },
  activeAdmins(d) { return d.users.filter(u => u.role === 'admin' && !u.disabled); },
};

function setFieldError(id, msg) {
  const el = $(id + '-error'), input = $(id);
  if (el) el.textContent = msg || '';
  if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
  return !msg;
}
function setBusy(btn, busy, label) {
  if (busy) { btn.dataset.label = btn.textContent; btn.classList.add('is-busy'); btn.disabled = true; btn.innerHTML = NEEDLE_SVG + escapeHtml(label || 'جارٍ التنفيذ…'); }
  else { btn.classList.remove('is-busy'); btn.disabled = false; btn.textContent = btn.dataset.label || btn.textContent; }
}
function logLogin(entry) {
  const L = store.read(HARAK_KEYS.logins, []);
  L.unshift({ ...entry, at: new Date().toISOString() });
  store.write(HARAK_KEYS.logins, L.slice(0, 1000));
}

// ---------- الجلسة ----------
// الجلسة في sessionStorage فتنتهي بإغلاق المتصفح، وتنتهي بعد 30 دقيقة بلا نشاط.
let session = null;
let pendingUserId = null;
const readSession = () => { try { return JSON.parse(sessionStorage.getItem(HARAK_KEYS.session)); } catch { return null; } };
const writeSession = () => { if (session) sessionStorage.setItem(HARAK_KEYS.session, JSON.stringify(session)); else sessionStorage.removeItem(HARAK_KEYS.session); };
function currentUser() {
  if (!session) return null;
  const u = AUTH.db().users.find(x => x.id === session.userId);
  return u && !u.disabled ? u : null;
}

function applyRole() {
  const u = currentUser(); const role = u ? u.role : null;
  const elevated = role === 'reviewer' || role === 'admin';
  $('tab-admin').hidden = !elevated;
  document.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = role !== 'admin'; });
  $('app-user').hidden = !u;
  if (u) {
    $('app-user-name').textContent = u.fullName;
    $('app-user-role').textContent = ROLE_LABELS[u.role];
    $('app-user-initial').textContent = (u.fullName.trim()[0] || '؟');
    $('admin-role-chip').textContent = ROLE_LABELS[u.role];
    $('admin-title').textContent = u.role === 'admin' ? 'لوحة التحكم بالنظام' : 'لوحة الإدارة';
  }
  if (!elevated && $('tab-admin').getAttribute('aria-selected') === 'true') activateTab('tab-curricula');
  if (window.positionTabIndicator) positionTabIndicator();
  if (window.syncTabEdges) syncTabEdges();
}

function showAuth(view) {
  const landing = $('landing');
  const returning = landing.hidden; // العودة من داخل النظام (خروج أو انتهاء جلسة)
  landing.hidden = false;
  ['setup', 'login', 'change'].forEach(v => { $(v + '-form').hidden = v !== view; });
  if (returning) document.dispatchEvent(new CustomEvent('harak:auth')); // يعيد حركة الشعار النصي
  landing.setAttribute('aria-labelledby', view + '-title');
  // تأخير بسيط حتى تظهر الشاشة، ولا يُنقل التركيز إن بدأ المستخدم الكتابة في حقل آخر من النموذج
  const form = $(view + '-form'), first = form.querySelector('input');
  if (first) setTimeout(() => { if (!form.hidden && !form.contains(document.activeElement)) first.focus(); }, 30);
}

function enterApp(user, greet = true) {
  pendingUserId = null;
  session = { userId: user.id, at: new Date().toISOString(), lastActive: Date.now() };
  writeSession();
  document.querySelectorAll('.auth-form').forEach(f => f.reset());
  $('landing').hidden = true;
  applyRole();
  activateTab('tab-curricula');
  renderCurricula();
  document.dispatchEvent(new CustomEvent('harak:enter')); // يعيد حركة عنوان «مناهجي»
  if (greet) toast(`أهلًا ${user.fullName}. دخلت بصفة ${ROLE_LABELS[user.role]}.`, 'success');
}

function logout(reason) {
  session = null; pendingUserId = null; writeSession();
  $('user-menu').hidden = true; $('user-menu-btn').setAttribute('aria-expanded', 'false');
  if ($('harak-dialog') && $('harak-dialog').open) $('harak-dialog').close();
  applyRole();
  showAuth(AUTH.db().users.length ? 'login' : 'setup');
  if (reason) toast(reason, 'info', 5000);
}

(function initAuth() {
  $('landing-emblem').src = DEFAULT_LOGO;

  // إظهار كلمة المرور وإخفاؤها
  const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pw-toggle]'); if (!b) return;
    const input = $(b.dataset.pwToggle); const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', String(show)); b.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
  });
  document.querySelectorAll('[data-pw-toggle]').forEach(b => { b.innerHTML = EYE; });
  document.querySelectorAll('.auth-form input').forEach(i => i.addEventListener('input', () => { setFieldError(i.id, ''); $('login-error').hidden = true; }));
  $('login-password').addEventListener('keyup', e => { if (e.getModifierState) $('login-caps').hidden = !e.getModifierState('CapsLock'); });

  // أول تشغيل: حساب مدير النظام
  $('setup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const fullName = $('setup-fullname').value.trim(), username = AUTH.norm($('setup-username').value);
    const pw = $('setup-password').value, pw2 = $('setup-password2').value;
    let ok = setFieldError('setup-fullname', fullName.length < 2 ? 'اكتب الاسم الكامل.' : '');
    ok = setFieldError('setup-username', AUTH.validUsername(username) ? '' : 'اسم المستخدم من 3 إلى 32 حرفًا لاتينيًا أو رقمًا، ويُسمح بالنقطة والشرطة.') && ok;
    ok = setFieldError('setup-password', AUTH.passwordProblem(pw, username)) && ok;
    ok = setFieldError('setup-password2', pw === pw2 ? '' : 'كلمتا المرور غير متطابقتين.') && ok;
    if (!ok) { $('setup-form').querySelector('[aria-invalid="true"]').focus(); return; }
    const d = AUTH.db();
    if (d.users.length) { showAuth('login'); toast('أُعدّ حساب مدير النظام مسبقًا. سجّل الدخول.', 'info'); return; }
    const btn = $('setup-submit'); setBusy(btn, true, 'جارٍ إنشاء الحساب…');
    try {
      const now = new Date().toISOString();
      const user = { id: uid(), username, fullName, role: 'admin', ...(await AUTH.secret(pw)), mustChange: false, disabled: false, failed: 0, lockedUntil: 0, createdAt: now, lastLogin: now };
      d.users.push(user); AUTH.save(d);
      logLogin({ username, fullName, role: 'admin', ok: true });
      enterApp(user);
    } catch (x) { setFieldError('setup-password', x.message || String(x)); }
    finally { setBusy(btn, false); }
  });

  // الدخول
  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('login-error'); err.hidden = true;
    const username = AUTH.norm($('login-username').value), pw = $('login-password').value;
    const fail = msg => { err.textContent = msg; err.hidden = false; $('login-password').value = ''; $('login-password').focus(); };
    if (!username || !pw) { fail('أدخل اسم المستخدم وكلمة المرور.'); return; }
    const btn = $('login-submit'); setBusy(btn, true, 'جارٍ التحقق…');
    try {
      const d = AUTH.db(); const u = d.users.find(x => x.username === username); const now = Date.now();
      if (u && u.lockedUntil > now) {
        const min = Math.ceil((u.lockedUntil - now) / 60000);
        logLogin({ username, fullName: u.fullName, role: u.role, ok: false });
        fail(`قُفل الحساب بعد ${AUTH.MAX_FAILS} محاولات خاطئة. أعد المحاولة بعد ${countOf(min, NOUNS.minutesGen)}.`); return;
      }
      // يُحسب التشفير حتى لاسم غير موجود كي لا يكشف زمن الرد وجود الحساب
      const ok = u ? await AUTH.verify(u, pw) : (await AUTH.derive(pw, 'AAAAAAAAAAAAAAAAAAAAAA==', AUTH.ITER), false);
      if (!ok) {
        let locked = false;
        if (u && !u.disabled) { u.failed = (u.failed || 0) + 1; if (u.failed >= AUTH.MAX_FAILS) { u.lockedUntil = now + AUTH.LOCK_MS; u.failed = 0; locked = true; } AUTH.save(d); }
        logLogin({ username, fullName: u ? u.fullName : '', role: u ? u.role : '', ok: false });
        fail(locked ? `قُفل الحساب بعد ${AUTH.MAX_FAILS} محاولات خاطئة. أعد المحاولة بعد ${countOf(AUTH.LOCK_MS / 60000, NOUNS.minutesGen)}.` : 'اسم المستخدم أو كلمة المرور غير صحيحة.'); return;
      }
      if (u.disabled) { logLogin({ username, fullName: u.fullName, role: u.role, ok: false }); fail('هذا الحساب معطّل. راجع مدير النظام.'); return; }
      u.failed = 0; u.lockedUntil = 0; u.lastLogin = new Date().toISOString(); AUTH.save(d);
      logLogin({ username, fullName: u.fullName, role: u.role, ok: true });
      if (u.mustChange) { pendingUserId = u.id; $('change-intro').textContent = `مرحبًا ${u.fullName}. كلمة المرور الحالية مؤقتة؛ عيّن كلمة مرور خاصة بك للمتابعة.`; showAuth('change'); return; }
      enterApp(u);
    } catch (x) { fail(x.message || String(x)); }
    finally { setBusy(btn, false); }
  });

  // تغيير كلمة المرور الإلزامي
  $('change-form').addEventListener('submit', async e => {
    e.preventDefault();
    const d = AUTH.db(); const u = d.users.find(x => x.id === pendingUserId);
    if (!u) { showAuth('login'); return; }
    const pw = $('change-password').value, pw2 = $('change-password2').value;
    let ok = setFieldError('change-password', AUTH.passwordProblem(pw, u.username));
    ok = setFieldError('change-password2', pw === pw2 ? '' : 'كلمتا المرور غير متطابقتين.') && ok;
    if (!ok) return;
    const btn = $('change-submit'); setBusy(btn, true, 'جارٍ الحفظ…');
    try {
      if (await AUTH.verify(u, pw)) { setFieldError('change-password', 'اختر كلمة مرور تختلف عن كلمة المرور المؤقتة.'); return; }
      Object.assign(u, await AUTH.secret(pw), { mustChange: false });
      AUTH.save(d);
      enterApp(u);
      toast('حُفظت كلمة المرور الجديدة.', 'success');
    } finally { setBusy(btn, false); }
  });
  $('change-cancel').addEventListener('click', () => { pendingUserId = null; showAuth('login'); });

  // قائمة المستخدم في الشريط العلوي
  const menu = $('user-menu'), menuBtn = $('user-menu-btn');
  const closeMenu = (focusBtn) => { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); if (focusBtn) menuBtn.focus(); };
  menuBtn.addEventListener('click', () => { const open = menu.hidden; menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('button').focus(); });
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('#app-user')) closeMenu(false); });
  menu.addEventListener('keydown', e => {
    const items = Array.from(menu.querySelectorAll('button')); const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
  });
  $('menu-logout').addEventListener('click', () => { closeMenu(false); logout('سُجّل خروجك.'); });
  $('menu-change-password').addEventListener('click', () => {
    closeMenu(false);
    const pwField = (id, label, ac) => `<div class="field"><label for="${id}">${label}</label><div class="pw-wrap"><input type="password" id="${id}" dir="ltr" autocomplete="${ac}" required><button type="button" class="pw-toggle" data-pw-toggle="${id}" aria-label="إظهار كلمة المرور" aria-pressed="false">${EYE}</button></div></div>`;
    openDialog({
      title: 'تغيير كلمة المرور', html: true, confirmLabel: 'حفظ',
      body: pwField('cp-current', 'كلمة المرور الحالية', 'current-password') + pwField('cp-new', 'كلمة المرور الجديدة', 'new-password') + '<small class="hint">10 أحرف على الأقل، وتتضمن حرفًا ورقمًا.</small>' + pwField('cp-new2', 'تأكيد كلمة المرور الجديدة', 'new-password'),
      onConfirm: async () => {
        const d = AUTH.db(); const u = d.users.find(x => x.id === session?.userId); if (!u) return 'انتهت الجلسة. سجّل الدخول مجددًا.';
        const cur = $('cp-current').value, pw = $('cp-new').value, pw2 = $('cp-new2').value;
        if (!(await AUTH.verify(u, cur))) return 'كلمة المرور الحالية غير صحيحة.';
        const p = AUTH.passwordProblem(pw, u.username); if (p) return p;
        if (pw !== pw2) return 'كلمتا المرور الجديدتان غير متطابقتين.';
        if (pw === cur) return 'اختر كلمة مرور تختلف عن الحالية.';
        Object.assign(u, await AUTH.secret(pw)); AUTH.save(d);
        return '';
      },
    }).then(done => { if (done) toast('غُيّرت كلمة المرور.', 'success'); });
  });

  // الخروج التلقائي بعد الخمول
  let lastPersist = 0;
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => document.addEventListener(ev, () => {
    if (!session) return;
    session.lastActive = Date.now();
    if (session.lastActive - lastPersist > 15000) { lastPersist = session.lastActive; writeSession(); }
  }, { passive: true, capture: true }));
  setInterval(() => {
    if (!session) return;
    if (!currentUser()) logout('أُوقف حسابك أو حُذف. راجع مدير النظام.');
    else if (Date.now() - session.lastActive > AUTH.IDLE_MS) logout(`انتهت الجلسة بعد ${countOf(AUTH.IDLE_MS / 60000, NOUNS.minutesGen)} بلا نشاط. سجّل الدخول مجددًا.`);
  }, 30000);

  // استعادة الجلسة في التبويب نفسه
  session = readSession();
  const u = currentUser();
  if (u && session && Date.now() - (session.lastActive || 0) < AUTH.IDLE_MS && !u.mustChange) { session.lastActive = Date.now(); writeSession(); $('landing').hidden = true; applyRole(); }
  else { session = null; writeSession(); applyRole(); showAuth(AUTH.db().users.length ? 'login' : 'setup'); }
})();

// ---------- المناهج ----------
let curricula = store.read(HARAK_KEYS.curricula, []);
let currentId = null;
const saveCurricula = () => { store.write(HARAK_KEYS.curricula, curricula); refreshContextOptions(); };
const getCur = id => curricula.find(c => c.id === id);

function showCurView(name) {
  ['cur-list-view', 'cur-new-view', 'cur-editor-view'].forEach(id => { $(id).hidden = id !== name; });
}

function renderCurricula() {
  const list = [...curricula].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  $('cur-list').innerHTML = list.length
    ? `<div class="cur-grid">${list.map(c => `
        <div class="cur-card" data-open="${c.id}" role="button" tabindex="0" aria-label="فتح منهج ${escapeHtml(c.subject)}">
          <strong>${escapeHtml(c.subject)}</strong>
          <span class="meta">${escapeHtml(c.level)} · ${countOf(c.durationWeeks, NOUNS.weeks)}</span>
          <span class="count">${countOf(c.modules.length, NOUNS.units)}، ${countOf(c.modules.reduce((n, m) => n + m.topics.length, 0), NOUNS.topics)}</span>
          <span class="meta">آخر تعديل ${fmtDate(c.updatedAt)}</span>
        </div>`).join('')}</div>`
    : `<div class="empty">
         <svg width="56" height="56" viewBox="-50 -50 100 100" aria-hidden="true"><circle r="44" fill="none" stroke="currentColor" stroke-width="3"/><polygon points="0,-30 9,0 -9,0" fill="#74B4DA"/><polygon points="-9,0 9,0 0,30" fill="#10367D"/></svg>
         <p>لا توجد مناهج بعد.</p>
         <button class="btn btn-primary" type="button" data-empty-new>ابدأ منهجًا جديدًا</button>
       </div>`;
  $('btn-cur-new').hidden = !list.length; // زر رئيسي واحد في الحالة الفارغة
  refreshContextOptions();
}

function openCurriculum(id) {
  currentId = id;
  renderEditor();
  showCurView('cur-editor-view');
}

function renderEditor() {
  const c = getCur(currentId);
  if (!c) { showCurView('cur-list-view'); return; }
  $('cur-editor').innerHTML = `
    <input class="editor-title" id="ed-subject" value="${escapeHtml(c.subject)}" aria-label="اسم المنهج">
    <p class="muted">${escapeHtml(c.level)} · ${countOf(c.durationWeeks, NOUNS.weeks)}${c.goals ? ' · ' + escapeHtml(c.goals) : ''}</p>
    ${c.modules.length ? '' : '<div class="empty"><p>لا وحدات بعد. أضف وحدة من الزر أعلاه، أو اطلب مسودة من المساعد.</p></div>'}
    ${c.modules.map((m, mi) => `
      <div class="module-card" data-module="${m.id}">
        <div class="panel-head" style="margin:0"><span class="chip">الوحدة ${mi + 1}</span><button class="btn btn-ghost btn-sm" type="button" data-del-module="${m.id}">حذف الوحدة</button></div>
        <div class="row">
          <div class="field"><label>عنوان الوحدة</label><input type="text" class="title" data-field="title" value="${escapeHtml(m.title)}" placeholder="عنوان الوحدة"></div>
          <div class="field"><label>الساعات</label><input type="number" min="0" data-field="durationHours" value="${m.durationHours}"></div>
        </div>
        <div class="field"><label>هدف الوحدة</label><textarea data-field="objective" placeholder="أن يحدد الطالب…">${escapeHtml(m.objective)}</textarea></div>
        <div class="section-title"><svg class="diamond" viewBox="0 0 14 14" aria-hidden="true"><polygon points="7,0 14,7 7,14 0,7" fill="currentColor"/></svg><h3>الموضوعات</h3></div>
        ${m.topics.map((t, ti) => `
          <div class="topic-row" data-topic="${t.id}">
            <span class="n">${ti + 1}</span>
            <div class="fields">
              <input type="text" data-tfield="title" value="${escapeHtml(t.title)}" placeholder="عنوان الموضوع" aria-label="عنوان الموضوع">
              <input type="text" data-tfield="description" value="${escapeHtml(t.description)}" placeholder="وصف مختصر" aria-label="وصف الموضوع">
            </div>
            <button class="btn btn-ghost btn-sm" type="button" data-del-topic="${t.id}">حذف</button>
          </div>`).join('')}
        <button class="btn btn-dashed" type="button" data-add-topic="${m.id}">+ إضافة موضوع</button>
      </div>`).join('')}`;
}

let savedTimer = null;
function touch(c) {
  c.updatedAt = new Date().toISOString(); saveCurricula();
  const el = $('cur-saved'); if (!el) return;
  el.textContent = 'تم الحفظ'; el.classList.add('is-on');
  clearTimeout(savedTimer); savedTimer = setTimeout(() => el.classList.remove('is-on'), 1500);
}

(function initCurricula() {
  const openNew = () => { $('cur-new-form').reset(); $('cur-new-status').innerHTML = ''; showCurView('cur-new-view'); $('cur-subject').focus(); };
  $('btn-cur-new').addEventListener('click', openNew);
  document.querySelectorAll('[data-cur-back]').forEach(b => b.addEventListener('click', () => { renderCurricula(); showCurView('cur-list-view'); }));
  $('cur-list').addEventListener('click', e => {
    if (e.target.closest('[data-empty-new]')) { openNew(); return; }
    const card = e.target.closest('[data-open]'); if (card) openCurriculum(card.dataset.open);
  });
  $('cur-list').addEventListener('keydown', e => { const card = e.target.closest('[data-open]'); if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCurriculum(card.dataset.open); } });

  const readBrief = () => ({
    subject: $('cur-subject').value.trim(), level: $('cur-level').value, goals: $('cur-goals').value.trim(),
    durationWeeks: Math.max(1, Number($('cur-weeks').value) || 12),
  });
  const create = (brief, modules) => {
    const now = new Date().toISOString();
    const c = { id: uid(), ...brief, subject: brief.subject || 'منهج بلا عنوان', modules, createdAt: now, updatedAt: now };
    curricula.push(c); saveCurricula();
    openCurriculum(c.id);
  };
  $('btn-cur-blank').addEventListener('click', () => create(readBrief(), []));
  $('cur-new-form').addEventListener('submit', async e => {
    e.preventDefault();
    const brief = readBrief();
    const btn = $('btn-cur-ai'); btn.classList.add('is-busy'); btn.innerHTML = NEEDLE_SVG + 'جارٍ إعداد المسودة…';
    $('cur-new-status').innerHTML = '';
    try {
      const modules = await AI.draftModules(brief);
      create(brief, modules);
      toast(`أُنشئت مسودة من ${countOf(modules.length, NOUNS.unitsGen)}.`, 'success');
    } catch (err) {
      $('cur-new-status').innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message || String(err))}<br><small>تأكد من إعدادات المحرّك في تبويب «المساعد»، أو ابدأ من صفحة فارغة.</small></div>`;
    } finally { btn.classList.remove('is-busy'); btn.textContent = 'إنشاء مسودة بالذكاء الاصطناعي'; }
  });

  const editor = $('cur-editor');
  editor.addEventListener('input', e => {
    const c = getCur(currentId); if (!c) return;
    if (e.target.id === 'ed-subject') { c.subject = e.target.value; touch(c); return; }
    const mEl = e.target.closest('[data-module]'); if (!mEl) return;
    const m = c.modules.find(x => x.id === mEl.dataset.module); if (!m) return;
    const tEl = e.target.closest('[data-topic]');
    if (tEl) { const t = m.topics.find(x => x.id === tEl.dataset.topic); if (t) t[e.target.dataset.tfield] = e.target.value; }
    else if (e.target.dataset.field) m[e.target.dataset.field] = e.target.dataset.field === 'durationHours' ? Number(e.target.value) || 0 : e.target.value;
    touch(c);
  });
  editor.addEventListener('click', e => {
    const c = getCur(currentId); if (!c) return;
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.delModule) { confirmDialog('حذف الوحدة', 'ستُحذف الوحدة وموضوعاتها من هذا المنهج.', 'حذف', true).then(ok => { if (!ok) return; c.modules = c.modules.filter(m => m.id !== b.dataset.delModule); touch(c); renderEditor(); }); return; }
    else if (b.dataset.addTopic) c.modules.find(m => m.id === b.dataset.addTopic).topics.push({ id: uid(), title: '', description: '' });
    else if (b.dataset.delTopic) c.modules.forEach(m => { m.topics = m.topics.filter(t => t.id !== b.dataset.delTopic); });
    else return;
    touch(c); renderEditor();
  });
  $('btn-cur-add-module').addEventListener('click', () => { const c = getCur(currentId); if (!c) return; c.modules.push({ id: uid(), title: '', objective: '', durationHours: 0, topics: [] }); touch(c); renderEditor(); const last = editor.querySelector('.module-card:last-of-type input.title'); if (last) last.focus(); });
  $('btn-cur-delete').addEventListener('click', async () => {
    const c = getCur(currentId); if (!c || !(await confirmDialog('حذف المنهج', `سيُحذف منهج «${c.subject}» بكل وحداته.`, 'حذف', true))) return;
    curricula = curricula.filter(x => x.id !== c.id); saveCurricula(); currentId = null;
    renderCurricula(); showCurView('cur-list-view'); toast('حُذف المنهج.', 'info');
  });
  $('btn-cur-analyze').addEventListener('click', () => {
    const c = getCur(currentId); if (!c) return;
    const file = new File([curriculumToText(c)], `${dateStamp()}-${c.subject.replace(/\s+/g, '-')}.txt`, { type: 'text/plain' });
    state.file = file;
    $('file-name').textContent = 'منهج من حراك: ' + c.subject;
    $('btn-analyze').disabled = false;
    activateTab('tab-upload');
    toast('اكتب ما تريده من التحليل ثم اضغط «حلّل».', 'info');
    $('brief-text').focus();
  });
  $('btn-cur-ask').addEventListener('click', () => { $('ai-context').value = currentId; activateTab('tab-assistant'); $('chat-text').focus(); });
  renderCurricula();
})();

// يحوّل المنهج إلى النص الذي يفهمه المحلّل (وحدة/درس/الأهداف)
function curriculumToText(c) {
  const lines = [c.subject, `${c.level} - ${countOf(c.durationWeeks, NOUNS.weeks)}`, ''];
  if (c.goals) lines.push('أهداف المنهج العامة:', c.goals, '');
  c.modules.forEach((m, i) => {
    lines.push(`الوحدة ${i + 1}: ${m.title || 'بلا عنوان'}`);
    lines.push(`الدرس ${i + 1}: ${m.title || 'بلا عنوان'}`);
    lines.push('الأهداف:');
    (m.objective || '').split(/\n|؛|\.\s+/).map(s => s.trim()).filter(Boolean).forEach(s => lines.push(s.endsWith('.') ? s : s + '.'));
    if (m.topics.length) { lines.push('الموضوعات:'); m.topics.forEach(t => lines.push(`${t.title}${t.description ? ' - ' + t.description : ''}`)); }
    lines.push('');
  });
  return lines.join('\n');
}

// ---------- محرّك الذكاء الاصطناعي ----------
// حروف الكتابات الصينية واليابانية والكورية: تُحذف من الردود لأن بعض النماذج تسرّبها خطأً
const CJK_RE = /[⺀-⿟　-〿぀-ヿ㄀-ㇿ㈀-㏿㐀-䶿一-鿿ꀀ-꓏가-힯豈-﫿︰-﹏＀-￯]|[\u{20000}-\u{2FA1F}]/gu;
function scrubForeign(text) {
  let removed = 0;
  const clean = text.replace(CJK_RE, () => { removed++; return ''; });
  return { clean, removed };
}

const AI = {
  settings: Object.assign({ engine: 'ollama', url: 'http://localhost:11434', openaiUrl: '', model: 'qwen2.5:7b', openaiModel: '', webllmModel: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', key: '', lang: 'ar' }, store.read(HARAK_KEYS.ai, {})),
  webllm: null,
  lastScrubbed: 0,
  save() { store.write(HARAK_KEYS.ai, this.settings); },
  baseUrl() { return (this.settings.engine === 'openai' ? this.settings.openaiUrl || this.settings.url : this.settings.url).replace(/\/$/, ''); },
  model() { return this.settings.engine === 'webllm' ? this.settings.webllmModel : this.settings.engine === 'openai' ? (this.settings.openaiModel || this.settings.model) : this.settings.model; },
  textBudget() { return this.settings.engine === 'ollama' ? 12000 : 7000; },

  // تعليمات اللغة تُلحق بكل أمر نظام
  langInstruction() {
    return this.settings.lang === 'en'
      ? 'Reply in English only. Never output Chinese, Japanese or Korean characters. Keep Arabic only when quoting the curriculum text verbatim.'
      : 'أجب بالعربية الفصحى فقط. لا تكتب أي حرف صيني أو ياباني أو كوري إطلاقًا. استخدم الحروف اللاتينية فقط للمصطلحات التقنية أو الأسماء الأجنبية عند الضرورة.';
  },

  // هل يبقى كل شيء على هذا الجهاز؟
  locality() {
    const S = this.settings;
    if (S.engine === 'webllm') return { local: false, text: 'داخل المتصفح: يُحمَّل النموذج من الإنترنت مرة واحدة ثم يعمل محليًا.' };
    let host = '';
    try { host = new URL(this.baseUrl()).hostname; } catch { return { local: false, text: 'عنوان الخادم غير صالح.' }; }
    const localHost = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
    if (!localHost) return { local: false, text: `خادم خارجي (${host}): نص المنهج يغادر جهازك.` };
    if (/-cloud$/i.test(this.model())) return { local: false, text: 'نموذج سحابي (-cloud): Ollama يمرّر النص إلى خوادمه عبر الإنترنت.' };
    return { local: true, text: 'يعمل محليًا بالكامل: الملف والنموذج على هذا الجهاز، لا يغادر النص المتصفح وlocalhost.' };
  },

  // قائمة النماذج المنزّلة في Ollama (/api/tags)
  async listModels() {
    const res = await fetch(`${this.baseUrl()}/api/tags`).catch(() => { throw new Error('تعذّر الوصول إلى Ollama. شغّله بـ OLLAMA_ORIGINS="*" ollama serve'); });
    if (!res.ok) throw new Error(`Ollama ردّ بخطأ ${res.status}`);
    const data = await res.json();
    return (data.models || []).map(m => m.name);
  },

  async *readLines(res) {
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (line) yield line; }
    }
    if (buf.trim()) yield buf.trim();
  },

  async *rawStream(messages, onStatus) {
    const S = this.settings;
    if (S.engine === 'webllm') {
      if (!this.webllm) {
        onStatus('جارٍ تحميل النموذج داخل المتصفح (مرة واحدة، قد يستغرق دقائق)…');
        const mod = await import('https://esm.run/@mlc-ai/web-llm');
        this.webllm = await mod.CreateMLCEngine(this.model(), { initProgressCallback: p => onStatus(p.text) });
      }
      const chunks = await this.webllm.chat.completions.create({ messages, stream: true, temperature: 0.3 });
      for await (const ch of chunks) { const d = ch.choices?.[0]?.delta?.content; if (d) yield d; }
      return;
    }
    const native = S.engine === 'ollama';
    // Ollama الأصلية تسمح بضبط حجم السياق؛ الافتراضي (2048) أصغر من منهج كامل فيفقد النموذج تعليماته
    const url = native ? `${this.baseUrl()}/api/chat` : `${this.baseUrl()}/v1/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (S.key) headers.Authorization = `Bearer ${S.key}`;
    const body = native
      ? { model: this.model(), messages, stream: true, options: { temperature: 0.3, num_ctx: 8192, repeat_penalty: 1.1 } }
      : { model: this.model(), messages, stream: true, temperature: 0.3 };
    let res;
    try { res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) }); }
    catch { throw new Error(`تعذّر الوصول إلى ${url}. هل الخادم يعمل؟ (Ollama: شغّله بـ OLLAMA_ORIGINS="*" ثم أعد المحاولة)`); }
    if (!res.ok) throw new Error(`الخادم ردّ بخطأ ${res.status}: ${(await res.text()).slice(0, 200)}`);
    for await (const line of this.readLines(res)) {
      if (native) {
        try { const j = JSON.parse(line); if (j.error) throw new Error(j.error); const d = j.message?.content; if (d) yield d; if (j.done) return; } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
      } else {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if (data === '[DONE]') return;
        try { const d = JSON.parse(data).choices?.[0]?.delta?.content; if (d) yield d; } catch { /* سطر ناقص */ }
      }
    }
  },

  // التدفق بعد حذف الحروف الدخيلة
  async *stream(messages, onStatus = () => {}) {
    this.lastScrubbed = 0;
    let last = '', prevRemoved = 0;
    for await (const d of this.rawStream(messages, onStatus)) {
      let { clean, removed } = scrubForeign(d);
      this.lastScrubbed += removed;
      // الحذف يترك مسافتين متتاليتين؛ تُدمجان داخل الجزء الواحد وعند حدود الأجزاء
      if (removed || prevRemoved) {
        clean = clean.replace(/(\S)[ \t]{2,}/g, '$1 ');
        if (/[ \t]$/.test(last)) clean = clean.replace(/^[ \t]+/, '');
      }
      prevRemoved = removed;
      if (clean) { last = clean; yield clean; }
    }
  },

  async complete(messages, onStatus) { let out = ''; for await (const d of this.stream(messages, onStatus)) out += d; return out; },

  async test() {
    if (this.settings.engine === 'webllm') {
      if (!navigator.gpu) throw new Error('هذا المتصفح لا يدعم WebGPU؛ استخدم Chrome أو Edge حديثًا، أو اختر Ollama.');
      return 'المتصفح يدعم WebGPU. سيُحمَّل النموذج عند أول رسالة.';
    }
    const t = await this.complete([{ role: 'system', content: this.langInstruction() }, { role: 'user', content: 'أجب بكلمة واحدة: جاهز' }]);
    return `متصل. النموذج ${this.model()} أجاب: ${t.trim().slice(0, 40)}`;
  },

  systemPrompt(ctx) {
    let s = 'أنت «حراك»، مساعد خبير في تصميم المناهج ومراجعتها في أكاديمية السلطان قابوس البحرية. تجيب بإيجاز وتنظيم، وتستند إلى تصنيف بلوم (المعدَّل) وأركان الهدف السلوكي (الفعل القابل للقياس، المتعلم، المحتوى، الشرط، المعيار). عند اقتراح أهداف اكتبها بفعل مضارع قابل للقياس يبدأ بـ"أن" مثل: أن يحدد الطالب… ' + this.langInstruction();
    if (ctx.curriculum) s += '\n\nالمنهج الحالي (JSON):\n' + JSON.stringify(ctx.curriculum, (k, v) => (k === 'id' || k === 'createdAt' || k === 'updatedAt') ? undefined : v);
    if (ctx.analysis) s += '\n\nملخص آخر تحليل آلي:\n' + ctx.analysis;
    return s;
  },

  async draftModules(brief) {
    const sys = 'أنت مساعد تصميم مناهج. أعد مخططًا منظمًا للمقرر. ' + this.langInstruction() + ' أجب بـJSON صالح فقط، بلا شرح ولا علامات ```، بهذا الشكل بالضبط: {"modules":[{"title":"...","objective":"أن ...","durationHours":6,"topics":[{"title":"...","description":"..."}]}]}. اجعل عدد الوحدات قريبًا من عدد الأسابيع (وحدة لكل أسبوع تقريبًا)، وكل هدف سلوكيًا بفعل قابل للقياس، ووصف كل موضوع جملة أو جملتين.';
    const user = `المادة: ${brief.subject}\nالمستوى: ${brief.level}\nأهداف التعلّم: ${brief.goals || 'إتقان عام للمادة'}\nالمدة: ${brief.durationWeeks} أسبوعًا`;
    const text = await this.complete([{ role: 'system', content: sys }, { role: 'user', content: user }]);
    return parseModules(text);
  },
};

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const a = body.indexOf('{'), b = body.lastIndexOf('}');
  return a >= 0 && b > a ? body.slice(a, b + 1) : body;
}

function parseModules(text) {
  let parsed;
  try { parsed = JSON.parse(extractJson(text)); } catch { throw new Error('لم يُعِد النموذج JSON صالحًا. جرّب مرة أخرى أو نموذجًا أكبر.'); }
  if (!parsed || !Array.isArray(parsed.modules)) throw new Error('الرد لا يحتوي على قائمة وحدات.');
  return parsed.modules.map(m => ({
    id: uid(), title: String(m.title ?? ''), objective: String(m.objective ?? ''), durationHours: Number(m.durationHours ?? 0) || 0,
    topics: (Array.isArray(m.topics) ? m.topics : []).map(t => ({ id: uid(), title: String(t.title ?? ''), description: String(t.description ?? '') })),
  }));
}

function analysisSummary() {
  const a = state.analysis; if (!a) return '';
  const s = a.stats;
  const missing = a.completeness.filter(c => !c.hasActivities || !c.hasAssessment).map(c => c.lessonRef.title);
  return `الوحدات ${s.units}، الدروس ${s.lessons}، الأهداف ${s.objectives}. توزيع بلوم: ${Object.entries(s.bloomCounts).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join('، ')}. المجالات: معرفي ${s.domainCounts.cognitive}، وجداني ${s.domainCounts.affective}، نفس‑حركي ${s.domainCounts.psychomotor}. دروس تفتقر إلى أنشطة أو تقويم: ${missing.length ? missing.join('، ') : 'لا شيء'}. أهداف بأخطاء صياغة: ${a.quality.filter(q => q.errors.length).length}.`;
}

// ---------- المساعد ----------
let chat = store.read(HARAK_KEYS.chat, []);
function refreshContextOptions() {
  const sel = $('ai-context'); const cur = sel.value;
  sel.innerHTML = '<option value="">بلا منهج محدد</option>' + curricula.map(c => `<option value="${c.id}">${escapeHtml(c.subject)}</option>`).join('');
  if (getCur(cur)) sel.value = cur;
}

function renderChat() {
  const log = $('chat-log');
  if (!chat.length) { log.innerHTML = '<div class="chat-hello"><span class="harak-wordmark" aria-hidden="true">حر<svg viewBox="0 0 48 176" style="width:.25em;height:.93em"><polygon points="24,0 40,88 24,176 8,88" fill="#10367D"/><circle cx="24" cy="88" r="8" fill="#D4AD6A"/></svg>ك</span><br>اختر منهجًا من القائمة ثم اسأل، أو استخدم الأسئلة الجاهزة.<br>المساعد يعمل بنموذج مفتوح المصدر على جهازك.</div>'; return; }
  log.innerHTML = chat.map((m, i) => {
    const applicable = m.role === 'assistant' && /"modules"\s*:/.test(m.content);
    const body = m.pending && !m.content ? '<div class="skeleton" aria-label="جارٍ إعداد الرد"><span></span><span></span><span></span></div>' : m.role === 'assistant' ? renderMarkdown(m.content) : escapeHtml(m.content);
    return `<div class="msg ${m.role}">${body}${applicable ? `<div class="apply"><button class="btn btn-sm" type="button" data-apply="${i}">تطبيق هذه النسخة على المنهج المحدد</button></div>` : ''}${m.role === 'assistant' && m.content ? `<button class="msg-copy" type="button" data-copy-msg="${i}" aria-label="نسخ الرد">نسخ</button>` : ''}</div>`;
  }).join('');
  log.scrollTop = log.scrollHeight;
}

(function initAssistant() {
  const S = AI.settings;
  const syncFields = () => {
    $('ai-engine').value = S.engine;
    $('ai-url').value = S.engine === 'openai' ? (S.openaiUrl || '') : S.url;
    $('ai-url').placeholder = S.engine === 'openai' ? 'https://api.example.com/v1 أو http://localhost:1234' : 'http://localhost:11434';
    $('ai-model').value = AI.model();
    $('ai-key').value = S.key;
    $('ai-lang').value = S.lang;
    document.querySelectorAll('[data-engine]').forEach(el => { el.hidden = !el.dataset.engine.split(' ').includes(S.engine); });
  };
  $('ai-engine').addEventListener('change', e => { S.engine = e.target.value; AI.save(); syncFields(); locality(); });
  $('ai-url').addEventListener('input', e => { if (S.engine === 'openai') S.openaiUrl = e.target.value.trim(); else S.url = e.target.value.trim(); AI.save(); locality(); });
  $('ai-model').addEventListener('input', e => { const v = e.target.value.trim(); if (S.engine === 'webllm') S.webllmModel = v; else if (S.engine === 'openai') S.openaiModel = v; else S.model = v; AI.save(); locality(); });
  $('ai-key').addEventListener('input', e => { S.key = e.target.value; AI.save(); });
  $('ai-lang').addEventListener('change', e => { S.lang = e.target.value; AI.save(); toast(S.lang === 'en' ? 'Assistant replies will be in English.' : 'ستكون ردود المساعد بالعربية.', 'info'); });

  const status = (text, cls = '') => { const el = $('ai-status'); el.textContent = text; el.className = 'engine-status ' + cls; };
  window.aiStatus = status;
  function locality() {
    const el = $('ai-locality'); const l = AI.locality();
    el.textContent = l.text; el.className = 'engine-status ' + (l.local ? 'ok' : 'err');
  }
  syncFields(); locality();

  $('btn-ai-test').addEventListener('click', async () => {
    status('جارٍ الاختبار…');
    try { status(await AI.test(), 'ok'); } catch (e) { status(e.message || String(e), 'err'); }
  });
  $('btn-ai-models').addEventListener('click', async () => {
    status('جارٍ قراءة قائمة النماذج…');
    try {
      const names = await AI.listModels();
      $('ai-models').innerHTML = names.map(n => `<option value="${escapeHtml(n)}"></option>`).join('');
      $('ai-models-hint').textContent = names.length ? 'المتاحة: ' + names.join('، ') : 'لا نماذج منزّلة بعد: ollama pull qwen2.5:7b';
      if (names.length && !names.includes(S.model)) { S.model = names.find(n => /qwen|gemma|llama/i.test(n)) || names[0]; AI.save(); $('ai-model').value = S.model; locality(); }
      status(`وُجد ${countOf(names.length, NOUNS.models)}. النموذج المختار: ${AI.model()}`, 'ok');
    } catch (e) { status(e.message || String(e), 'err'); }
  });
  $('btn-ai-clear').addEventListener('click', () => { chat = []; store.write(HARAK_KEYS.chat, chat); renderChat(); toast('مُسحت المحادثة.', 'info'); });
  document.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => send(b.dataset.quick)));
  $('chat-form').addEventListener('submit', e => {
    e.preventDefault();
    if (busy) { toast('انتظر اكتمال الرد الحالي، ثم أرسل سؤالك.', 'info'); return; } // يبقى النص المكتوب كما هو
    const t = $('chat-text').value.trim(); if (t) { $('chat-text').value = ''; send(t); }
  });
  $('chat-text').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('chat-form').requestSubmit(); } });
  $('chat-log').addEventListener('click', async e => {
    const copy = e.target.closest('[data-copy-msg]');
    if (copy) { navigator.clipboard?.writeText(chat[Number(copy.dataset.copyMsg)].content).then(() => toast('نُسخ الرد.', 'success')); return; }
    const b = e.target.closest('[data-apply]'); if (!b) return;
    const c = getCur($('ai-context').value);
    if (!c) { toast('اختر المنهج المستهدف من قائمة «السياق» أولًا.', 'warn'); return; }
    try {
      const modules = parseModules(chat[Number(b.dataset.apply)].content);
      if (!(await confirmDialog('تطبيق النسخة المقترحة', `ستُستبدل وحدات «${c.subject}» بالنسخة المقترحة (${countOf(modules.length, NOUNS.units)}).`, 'تطبيق'))) return;
      c.modules = modules; touch(c);
      renderCurricula(); openCurriculum(c.id); activateTab('tab-curricula');
      toast('طُبّقت النسخة المقترحة على المنهج.', 'success');
    } catch (err) { toast(err.message, 'warn'); }
  });

  let busy = false;
  // أثناء وصول الرد: يُعطَّل الإرسال والأسئلة الجاهزة، ويبقى الحقل متاحًا لكتابة السؤال التالي
  const setChatBusy = v => {
    busy = v; $('chat-send').classList.toggle('is-busy', v); $('chat-send').disabled = v;
    document.querySelectorAll('[data-quick]').forEach(x => { x.disabled = v; });
  };
  async function send(text) {
    if (busy) return; setChatBusy(true);
    chat.push({ role: 'user', content: text });
    const reply = { role: 'assistant', content: '', pending: true }; chat.push(reply); renderChat();
    const ctx = { curriculum: getCur($('ai-context').value) || null, analysis: $('ai-include-analysis').checked ? analysisSummary() : '' };
    const history = chat.slice(-11, -1).filter(m => m.content).map(m => ({ role: m.role, content: m.content }));
    const messages = [{ role: 'system', content: AI.systemPrompt(ctx) }, ...history];
    try {
      for await (const d of AI.stream(messages, s => status(s))) { reply.content += d; renderChat(); }
      if (!reply.content) reply.content = '(لم يصل رد)';
      if (AI.lastScrubbed) status(`حُذف ${countOf(AI.lastScrubbed, NOUNS.foreign)} من الرد.`, '');
    } catch (e) {
      reply.role = 'system'; reply.content = 'تعذّر الاتصال بالمحرّك: ' + (e.message || String(e));
      status(reply.content, 'err');
    } finally {
      setChatBusy(false); delete reply.pending;
      store.write(HARAK_KEYS.chat, chat.slice(-60)); renderChat();
    }
  }
  renderChat();
})();

// ---------- تحليل منهج بأمر المستخدم ----------
(function initBrief() {
  const text = $('brief-text'), auto = $('brief-auto');
  const saved = store.read(HARAK_KEYS.brief, null);
  if (saved) { text.value = saved.text || ''; auto.checked = saved.auto !== false; }
  const persist = () => store.write(HARAK_KEYS.brief, { text: text.value, auto: auto.checked });
  text.addEventListener('input', persist); auto.addEventListener('change', persist);
  document.querySelectorAll('[data-brief]').forEach(b => b.addEventListener('click', () => { text.value = b.dataset.brief; persist(); text.focus(); }));

  const card = () => $('custom-report');
  function renderCustom(r, streaming = false) {
    const el = card(); if (!el) return;
    if (!r) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.innerHTML = `
      <div class="report-section">
        <h2>التقرير بحسب طلبك</h2>
        <p class="muted custom-brief">الطلب: ${escapeHtml(r.brief)}</p>
        <div class="md">${streaming && !r.text ? '<div class="skeleton" aria-label="جارٍ إعداد التقرير"><span></span><span></span><span></span><span></span></div>' : renderMarkdown(r.text)}${streaming && r.text ? '<span class="caret" aria-hidden="true"></span>' : ''}</div>
        ${r.error ? `<div class="alert alert-danger">${escapeHtml(r.error)}</div>` : ''}
        ${!streaming && r.model ? `<p class="muted" style="font-size:0.85rem">أعدّه النموذج «${escapeHtml(r.model)}» في ${fmtDate(r.at)}؛ يحتاج مراجعة بشرية.</p>` : ''}
      </div>`;
  }

  // يُستدعى من زر «حلّل» بدل runAnalysis مباشرة
  window.harakAnalyze = async function (file) {
    const brief = text.value.trim();
    const withAuto = auto.checked;
    if (!brief && !withAuto) { toast('اكتب ما تريده من التحليل أو فعّل التحليل الآلي.', 'warn'); return; }
    state.customReport = null;
    if (withAuto) {
      await runAnalysis(file);
      if (!state.analysis) return;
    } else {
      clearAlerts(); resetSteps();
      $('btn-analyze').disabled = true;
      try { setStep(1); state.doc = await readDocument(file); state.file = file; state.analysis = null; setStep(1, 'done'); }
      catch (e) { setStep(1, 'error'); showAlert(e.code || 'ERROR', e.message || String(e), 'danger'); $('btn-analyze').disabled = false; return; }
      $('btn-analyze').disabled = false;
      renderResults(); activateTab('tab-results');
    }
    if (!brief) return;

    const report = { brief, text: '', model: AI.model(), at: new Date().toISOString() };
    state.customReport = report;
    renderCustom(report, true); syncResultChrome();
    activateTab('tab-results');
    const docText = state.doc.pages.map(p => p.text).join('\n').slice(0, AI.textBudget());
    const sys = 'أنت «حراك»، مراجع مناهج خبير في أكاديمية السلطان قابوس البحرية. نفّذ طلب المستخدم على نص المنهج المرفق بدقة والتزم بالطلب فقط. ' + AI.langInstruction() + ' نسّق الرد بعناوين (#) وقوائم (-) بصيغة Markdown بسيطة بلا جداول. لا تخترع محتوى غير موجود في النص؛ عند رصد خطأ أو ملاحظة اقتبس السطر المعني ثم اكتب التصحيح أو الاقتراح.';
    const user = `الطلب: ${brief}\n\n${withAuto && state.analysis ? 'ملخص التحليل الآلي: ' + analysisSummary() + '\n\n' : ''}نص المنهج:\n${docText}`;
    try {
      for await (const d of AI.stream([{ role: 'system', content: sys }, { role: 'user', content: user }], s => window.aiStatus && window.aiStatus(s))) {
        report.text += d; renderCustom(report, true);
      }
      if (!report.text) report.text = '(لم يصل رد من النموذج)';
      if (AI.lastScrubbed) toast(`حُذف ${countOf(AI.lastScrubbed, NOUNS.foreign)} من التقرير.`, 'info');
      if (state.analysis) state.analysis.customReport = report;
      toast('اكتمل التقرير بحسب طلبك.', 'success');
    } catch (e) {
      report.error = 'تعذّر تنفيذ الطلب بالذكاء الاصطناعي: ' + (e.message || String(e)) + ' (راجع إعدادات المحرّك في تبويب «المساعد»)';
    }
    renderCustom(report, false); syncResultChrome();
  };

  // حالة فارغة واضحة في «النتائج» بدل أزرار معطّلة وبطاقات بلا محتوى
  const resultsEmpty = document.createElement('div');
  resultsEmpty.className = 'empty no-print'; resultsEmpty.id = 'results-empty';
  resultsEmpty.innerHTML = `<svg width="56" height="56" viewBox="-50 -50 100 100" aria-hidden="true"><circle r="44" fill="none" stroke="currentColor" stroke-width="3"/><polygon points="0,-30 9,0 -9,0" fill="#74B4DA"/><polygon points="-9,0 9,0 0,30" fill="#10367D"/></svg>
    <p>لا نتائج بعد. ارفع ملف منهج في «تحليل منهج»، أو حلّل منهجًا محفوظًا من «المناهج».</p>
    <div class="empty-actions"><button class="btn btn-primary" type="button" data-go="tab-upload">تحليل منهج</button><button class="btn btn-secondary" type="button" data-go="tab-curricula">المناهج</button></div>`;
  $('panel-results').prepend(resultsEmpty);
  resultsEmpty.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) activateTab(b.dataset.go); });

  // الطباعة متاحة متى وُجد تقرير حر، ويُخفى التقرير الآلي الفارغ حين لا تحليل آلي
  function syncResultChrome() {
    const r = state.customReport || (state.analysis && state.analysis.customReport) || null;
    const has = !!state.analysis || !!r;
    if (r) $('btn-print').disabled = false;
    resultsEmpty.hidden = has;
    document.querySelector('#panel-results > .actions').hidden = !has;
    $('report').hidden = !state.analysis;
    $('ai-review-card').hidden = !state.analysis;
  }

  // نلحق عرض التقرير الحر بكل عرض للنتائج
  const original = renderResults;
  renderResults = function () {
    original();
    renderCustom(state.customReport || (state.analysis && state.analysis.customReport) || null, false);
    syncResultChrome();
    animateSummary();
  };
  syncResultChrome();
})();

// ---------- النتائج التفاعلية: عدّ تصاعدي، تنقّل بالنقر، أعمدة تنمو ----------
function animateSummary() {
  const nums = document.querySelectorAll('#report .summary-card .num');
  const sectionFor = label => {
    const map = [['الوحدات', 'الاكتمال'], ['الدروس', 'الاكتمال'], ['الأهداف', 'توزيع بلوم'], ['الكلمات', 'الإحصاءات'], ['الصفحات', 'الإحصاءات']];
    const hit = map.find(([k]) => label.includes(k));
    const title = hit ? hit[1] : null;
    return title ? Array.from(document.querySelectorAll('#report .report-section h2')).find(h => h.textContent.trim() === title) : null;
  };
  nums.forEach(el => {
    const card = el.closest('.summary-card');
    const label = card.querySelector('.lbl')?.textContent || '';
    const target = sectionFor(label);
    if (target && !card.dataset.linked) {
      card.dataset.linked = '1'; card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0'); card.title = `انتقل إلى ${target.textContent}`;
      const go = () => { target.closest('.report-section').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); target.closest('.report-section').classList.add('is-flash'); setTimeout(() => target.closest('.report-section').classList.remove('is-flash'), 1200); };
      card.addEventListener('click', go);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    }
    const raw = el.textContent.trim();
    const m = raw.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
    if (!m || reducedMotion()) return;
    const value = parseFloat(m[1]), suffix = m[2], decimals = (m[1].split('.')[1] || '').length;
    const start = performance.now(), dur = 800;
    const tick = now => {
      const t = Math.min(1, (now - start) / dur), eased = 1 - Math.pow(1 - t, 4);
      el.textContent = (value * eased).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(tick); else el.textContent = raw;
    };
    requestAnimationFrame(tick);
  });
  document.querySelectorAll('#report .bloom-chart rect').forEach((r, i) => { r.style.setProperty('--i', i); });
}

// ---------- الإدارة ----------
(function initAdmin() {
  const logins = () => store.read(HARAK_KEYS.logins, []);
  const isAdmin = () => currentUser()?.role === 'admin';

  function statusOf(u) {
    if (u.disabled) return ['معطّل', 'tag-low'];
    if (u.lockedUntil > Date.now()) return ['مقفل', 'tag-medium'];
    if (u.mustChange) return ['بانتظار تعيين كلمة مرور', 'tag-medium'];
    return ['نشط', 'tag-high'];
  }

  function renderAccounts() {
    if (!isAdmin()) return;
    const d = AUTH.db(); const me = currentUser();
    $('accounts-quota').textContent = `${d.users.length} من ${countOf(d.maxUsers, NOUNS.usersGen)}.`;
    $('accounts-max').value = d.maxUsers;
    $('nu-submit').disabled = d.users.length >= d.maxUsers;
    const days = d.lastExport ? Math.floor((Date.now() - new Date(d.lastExport)) / 86400000) : null;
    const note = $('accounts-backup');
    if (days === null) { note.hidden = false; note.textContent = 'لم تُصدَّر الحسابات بعد. صدّرها واحفظ الملف في مكان آمن؛ مسح بيانات المتصفح يحذف الحسابات.'; }
    else if (days > 30) { note.hidden = false; note.textContent = `آخر تصدير للحسابات قبل ${countOf(days, NOUNS.daysGen)}. يُستحسن تصدير نسخة حديثة.`; }
    else note.hidden = true;
    $('accounts-table').querySelector('tbody').innerHTML = d.users.map(u => {
      const [label, cls] = statusOf(u); const self = u.id === me.id;
      return `<tr data-user="${u.id}">
        <td><strong>${escapeHtml(u.fullName)}</strong>${self ? ' <span class="chip">أنت</span>' : ''}</td>
        <td dir="ltr" class="mono">${escapeHtml(u.username)}</td>
        <td><select data-act="role" aria-label="دور ${escapeHtml(u.fullName)}" ${self ? 'disabled' : ''}>${Object.entries(ROLE_LABELS).map(([k, v]) => `<option value="${k}" ${k === u.role ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td><span class="tag ${cls}">${label}</span></td>
        <td>${u.lastLogin ? fmtDate(u.lastLogin) : 'لم يدخل بعد'}</td>
        <td class="row-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-act="reset">إعادة تعيين كلمة المرور</button>
          ${u.lockedUntil > Date.now() ? '<button class="btn btn-secondary btn-sm" type="button" data-act="unlock">فك القفل</button>' : ''}
          ${self ? '' : `<button class="btn btn-secondary btn-sm" type="button" data-act="toggle">${u.disabled ? 'تفعيل' : 'تعطيل'}</button><button class="btn btn-ghost btn-sm" type="button" data-act="delete">حذف</button>`}
        </td></tr>`;
    }).join('');
  }

  function render() {
    const L = logins(); const d = AUTH.db();
    const okCount = L.filter(x => x.ok !== false).length, failCount = L.filter(x => x.ok === false).length;
    $('admin-stats').innerHTML = [['مرات الدخول', okCount], ['محاولات فاشلة', failCount], ['المستخدمون', d.users.length], ['المناهج', curricula.length], ['التقارير المحفوظة', store.read(STORAGE_KEYS.reports, []).length]]
      .map(([l, n]) => `<div class="stat"><div class="num">${n}</div><div class="lbl">${l}</div></div>`).join('');
    $('users-table').querySelector('tbody').innerHTML = L.map(x => `<tr><td>${escapeHtml(x.fullName || x.name || '—')}</td><td dir="ltr" class="mono">${escapeHtml(x.username || '—')}</td><td>${ROLE_LABELS[x.role] || '—'}</td><td>${x.ok === false ? '<span class="tag tag-low">فاشل</span>' : '<span class="tag tag-high">ناجح</span>'}</td><td>${fmtDate(x.at)}</td></tr>`).join('');
    $('users-empty').hidden = L.length > 0;
    renderAccounts();
  }
  $('tab-admin').addEventListener('click', render);
  window.renderAdmin = render;

  // إضافة مستخدم
  $('nu-generate').addEventListener('click', () => { $('nu-password').value = AUTH.tempPassword(); setFieldError('nu-password', ''); });
  $('nu-password').value = AUTH.tempPassword();
  ['nu-fullname', 'nu-username', 'nu-password'].forEach(id => $(id).addEventListener('input', () => setFieldError(id, '')));
  $('add-user-form').addEventListener('submit', async e => {
    e.preventDefault(); if (!isAdmin()) return;
    const d = AUTH.db();
    const fullName = $('nu-fullname').value.trim(), username = AUTH.norm($('nu-username').value), role = $('nu-role').value, pw = $('nu-password').value;
    let ok = setFieldError('nu-fullname', fullName.length < 2 ? 'اكتب الاسم الكامل.' : '');
    ok = setFieldError('nu-username', !AUTH.validUsername(username) ? 'اسم المستخدم من 3 إلى 32 حرفًا لاتينيًا أو رقمًا، ويُسمح بالنقطة والشرطة.' : d.users.some(u => u.username === username) ? 'اسم المستخدم مستخدم مسبقًا.' : '') && ok;
    ok = setFieldError('nu-password', AUTH.passwordProblem(pw, username)) && ok;
    if (!ok) return;
    if (d.users.length >= d.maxUsers) { toast(`بلغ عدد المستخدمين الحد الأقصى (${d.maxUsers}).`, 'warn'); return; }
    const btn = $('nu-submit'); setBusy(btn, true, 'جارٍ الإضافة…');
    try {
      d.users.push({ id: uid(), username, fullName, role, ...(await AUTH.secret(pw)), mustChange: true, disabled: false, failed: 0, lockedUntil: 0, createdAt: new Date().toISOString(), lastLogin: null });
      AUTH.save(d);
      $('add-user-form').reset(); $('nu-password').value = AUTH.tempPassword();
      toast(`أُضيف ${fullName} بصفة ${ROLE_LABELS[role]}. سلّمه اسم المستخدم «${username}» وكلمة المرور المؤقتة.`, 'success', 6000);
    } finally { setBusy(btn, false); render(); }
  });

  // إجراءات الصفوف
  const lastAdminGuard = (d, u) => u.role === 'admin' && !u.disabled && AUTH.activeAdmins(d).length <= 1;
  $('accounts-table').addEventListener('change', e => {
    const sel = e.target.closest('[data-act="role"]'); if (!sel || !isAdmin()) return;
    const d = AUTH.db(); const u = d.users.find(x => x.id === sel.closest('tr').dataset.user); if (!u) return;
    if (sel.value !== 'admin' && lastAdminGuard(d, u)) { toast('لا يمكن تغيير دور آخر مدير نظام نشط.', 'warn'); sel.value = 'admin'; return; }
    u.role = sel.value; AUTH.save(d); toast(`أصبح دور ${u.fullName}: ${ROLE_LABELS[u.role]}.`, 'success'); render();
  });
  $('accounts-table').addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]'); if (!b || !isAdmin()) return;
    const d = AUTH.db(); const u = d.users.find(x => x.id === b.closest('tr').dataset.user); if (!u) return;
    const act = b.dataset.act;
    if (act === 'reset') {
      if (!(await confirmDialog('إعادة تعيين كلمة المرور', `ستُولَّد كلمة مرور مؤقتة جديدة لـ ${u.fullName}، ويُلزم بتغييرها عند دخوله التالي.`, 'إعادة التعيين'))) return;
      const pw = AUTH.tempPassword(); const fresh = AUTH.db(); const t = fresh.users.find(x => x.id === u.id);
      Object.assign(t, await AUTH.secret(pw), { mustChange: true, failed: 0, lockedUntil: 0 }); AUTH.save(fresh); render();
      await openDialog({ title: 'كلمة المرور المؤقتة', html: true, hideCancel: true, confirmLabel: 'تم',
        body: `<p>سلّم ${escapeHtml(t.fullName)} كلمة المرور التالية. لن تظهر مرة أخرى.</p><p class="temp-pw" dir="ltr">${escapeHtml(pw)}</p><button type="button" class="btn btn-secondary btn-sm" onclick="navigator.clipboard && navigator.clipboard.writeText('${pw}').then(() => toast('نُسخت كلمة المرور.', 'success'))">نسخ</button>` });
      return;
    }
    if (act === 'unlock') { u.lockedUntil = 0; u.failed = 0; AUTH.save(d); toast(`فُك قفل حساب ${u.fullName}.`, 'success'); render(); return; }
    if (act === 'toggle') {
      if (!u.disabled && lastAdminGuard(d, u)) { toast('لا يمكن تعطيل آخر مدير نظام نشط.', 'warn'); return; }
      if (!u.disabled && !(await confirmDialog('تعطيل الحساب', `لن يتمكن ${u.fullName} من الدخول حتى يُعاد تفعيل حسابه.`, 'تعطيل', true))) return;
      const fresh = AUTH.db(); const t = fresh.users.find(x => x.id === u.id); t.disabled = !t.disabled; AUTH.save(fresh);
      toast(t.disabled ? `عُطّل حساب ${t.fullName}.` : `فُعّل حساب ${t.fullName}.`, 'success'); render(); return;
    }
    if (act === 'delete') {
      if (lastAdminGuard(d, u)) { toast('لا يمكن حذف آخر مدير نظام نشط.', 'warn'); return; }
      if (!(await confirmDialog('حذف المستخدم', `سيُحذف حساب ${u.fullName} (${u.username}) نهائيًا. يبقى سجل دخوله في السجل.`, 'حذف', true))) return;
      const fresh = AUTH.db(); fresh.users = fresh.users.filter(x => x.id !== u.id); AUTH.save(fresh);
      toast(`حُذف حساب ${u.fullName}.`, 'success'); render();
    }
  });

  // الحد الأقصى، وتصدير الحسابات واستيرادها
  $('btn-accounts-max').addEventListener('click', () => {
    const d = AUTH.db(); const n = Math.floor(Number($('accounts-max').value));
    if (!(n >= Math.max(1, d.users.length) && n <= 200)) { toast(`الحد الأقصى يجب أن يكون بين ${Math.max(1, d.users.length)} و200.`, 'warn'); return; }
    d.maxUsers = n; AUTH.save(d); toast(`الحد الأقصى للمستخدمين: ${n}.`, 'success'); render();
  });
  $('btn-accounts-export').addEventListener('click', () => {
    const d = AUTH.db();
    const payload = { app: 'harak-users', version: 1, exportedAt: new Date().toISOString(), maxUsers: d.maxUsers, users: d.users.map(({ failed, lockedUntil, ...u }) => u) };
    downloadBlob(`${dateStamp()}-harak-users.json`, JSON.stringify(payload, null, 2), 'application/json');
    d.lastExport = payload.exportedAt; AUTH.save(d); toast('صُدّرت الحسابات. احفظ الملف في مكان آمن.', 'success'); render();
  });
  $('accounts-import').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f || !isAdmin()) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'harak-users' || !Array.isArray(data.users)) throw new Error('الملف ليس ملف مستخدمين من حراك.');
      const valid = data.users.filter(u => u && AUTH.validUsername(u.username) && ROLE_LABELS[u.role] && u.hash && u.salt && Number(u.iterations) >= 100000 && u.fullName);
      const d = AUTH.db(); const names = new Set(d.users.map(u => u.username));
      const fresh = valid.filter(u => !names.has(u.username));
      if (d.users.length + fresh.length > d.maxUsers) throw new Error(`الاستيراد يتجاوز الحد الأقصى (${d.maxUsers}). ارفع الحد أولًا.`);
      if (!(await confirmDialog('استيراد المستخدمين', `سيُضاف ${countOf(fresh.length, NOUNS.newUsers)}${valid.length > fresh.length ? `، ويُتجاوز ${countOf(valid.length - fresh.length, NOUNS.existing)} مسبقًا` : ''}.`, 'استيراد'))) return;
      fresh.forEach(u => d.users.push({ id: uid(), username: u.username, fullName: String(u.fullName), role: u.role, salt: u.salt, hash: u.hash, iterations: Number(u.iterations), mustChange: !!u.mustChange, disabled: !!u.disabled, failed: 0, lockedUntil: 0, createdAt: u.createdAt || new Date().toISOString(), lastLogin: u.lastLogin || null }));
      AUTH.save(d); toast(`استُورد ${countOf(fresh.length, NOUNS.users)}.`, 'success'); render();
    } catch (err) { toast('تعذّر الاستيراد: ' + (err.message || err), 'warn', 6000); }
  });

  $('btn-users-clear').addEventListener('click', async () => { if (await confirmDialog('مسح سجل الدخول', 'سيُحذف سجل الدخول بالكامل من هذا المتصفح.', 'مسح', true)) { store.write(HARAK_KEYS.logins, []); render(); toast('مُسح سجل الدخول.', 'info'); } });

  const allData = () => ({ app: 'harak', version: APP_VERSION, exportedAt: new Date().toISOString(), curricula, reports: store.read(STORAGE_KEYS.reports, []), standards: userStandards, frameworks: store.read(STORAGE_KEYS.frameworks, []), settings, logins: logins() });
  $('btn-data-export').addEventListener('click', () => { downloadBlob(`${dateStamp()}-harak-data.json`, JSON.stringify(allData(), null, 2), 'application/json'); toast('صُدّرت البيانات.', 'success'); });
  $('btn-data-show').addEventListener('click', () => { const pre = $('data-json'); pre.hidden = !pre.hidden; if (!pre.hidden) pre.textContent = JSON.stringify(allData(), null, 2); });
  $('data-import').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (Array.isArray(d.curricula)) { const ids = new Set(curricula.map(c => c.id)); d.curricula.forEach(c => { if (!ids.has(c.id)) curricula.push(c); }); saveCurricula(); }
      if (Array.isArray(d.reports)) store.write(STORAGE_KEYS.reports, [...store.read(STORAGE_KEYS.reports, []), ...d.reports]);
      if (Array.isArray(d.standards)) { userStandards.push(...d.standards); store.write(STORAGE_KEYS.standards, userStandards); }
      $('data-notice').textContent = `استُوردت البيانات: ${countOf((d.curricula || []).length, NOUNS.curricula)}، ${countOf((d.reports || []).length, NOUNS.reports)}، ${countOf((d.standards || []).length, NOUNS.standards)}. أعد تحميل الصفحة لرؤية كل شيء.`;
      renderCurricula(); render(); toast('اكتمل الاستيراد.', 'success');
    } catch (err) { $('data-notice').textContent = 'تعذّر الاستيراد: ' + (err.message || err); toast('تعذّر الاستيراد.', 'warn'); }
    e.target.value = '';
  });
  $('btn-admin-settings').addEventListener('click', () => activateTab('tab-settings'));
  $('btn-admin-tests').addEventListener('click', async () => {
    const btn = $('btn-admin-tests'); setBusy(btn, true, 'جارٍ التشغيل…');
    const box = $('admin-test-results'); box.innerHTML = '';
    try {
      const results = await runDevTests();
      const pass = results.filter(r => r.ok).length;
      box.innerHTML = `<p><strong>${pass} / ${results.length}</strong> نجح</p><ul>${results.map(r => `<li class="${r.ok ? 'dev-pass' : 'dev-fail'}">${escapeHtml(r.name)}${r.ok ? '' : ' - ' + escapeHtml(r.error)}</li>`).join('')}</ul>`;
    } finally { setBusy(btn, false); }
  });
})();

// ---------- التقييم المنظّم بدرجة (اختياري، في تبويب النتائج) ----------
(function initAiReview() {
  const box = $('ai-review'), btn = $('btn-ai-review');
  const list = (arr) => (arr && arr.length) ? `<ul>${arr.map(x => `<li>${escapeHtml(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul>` : '<p class="muted">لا شيء</p>';
  const section = (title, body) => `<div class="report-section"><h2>${title}</h2>${body}</div>`;

  function render() {
    const r = state.analysis && state.analysis.aiReview;
    btn.disabled = !state.analysis;
    if (!r) { box.innerHTML = `<p class="placeholder">${state.analysis ? 'تقييم منظّم بدرجة من 100 مع صياغات بديلة للأهداف الضعيفة.' : 'حلّل منهجًا أولًا.'}</p>`; return; }
    if (r.raw) { box.innerHTML = `<div class="report-section"><h2>تقييم النموذج</h2><div class="md">${renderMarkdown(r.raw)}</div></div>`; return; }
    const score = Number(r.score);
    box.innerHTML = `
      <div class="summary-cards" style="margin-bottom:calc(var(--space-unit)*2)">
        <div class="summary-card"><div class="num">${Number.isFinite(score) ? score : '—'}</div><div class="lbl">الدرجة الكلية من 100</div></div>
        <div class="summary-card"><div class="num">${(r.strengths || []).length}</div><div class="lbl">نقاط قوة</div></div>
        <div class="summary-card"><div class="num">${(r.weaknesses || []).length}</div><div class="lbl">نقاط ضعف</div></div>
        <div class="summary-card"><div class="num">${(r.objectives || []).length}</div><div class="lbl">أهداف مقترح تحسينها</div></div>
      </div>
      ${section('الحكم العام', `<p>${escapeHtml(r.overall || '')}</p>`)}
      ${section('نقاط القوة', list(r.strengths))}
      ${section('نقاط الضعف', list(r.weaknesses))}
      ${(r.objectives || []).length ? section('الأهداف المقترح تحسينها', `<div class="table-wrap"><table><thead><tr><th>الهدف الحالي</th><th>المستوى المقدّر</th><th>الملاحظة</th><th>الصياغة المقترحة</th></tr></thead><tbody>${r.objectives.map(o => `<tr><td>${escapeHtml(o.text || '')}</td><td>${escapeHtml(o.level || '')}</td><td>${escapeHtml(o.issue || '')}</td><td><strong>${escapeHtml(o.rewrite || '')}</strong></td></tr>`).join('')}</tbody></table></div>`) : ''}
      ${section('عناصر ناقصة', list(r.missing))}
      ${section('التوصيات', list(r.recommendations))}
      <p class="muted" style="font-size:0.85rem">تقييم آلي من النموذج «${escapeHtml(r.model || '')}» في ${fmtDate(r.at)}؛ يحتاج مراجعة بشرية.</p>`;
  }

  const original = renderResults;
  renderResults = function () { original(); render(); };
  render();

  btn.addEventListener('click', async () => {
    const a = state.analysis; if (!a) return;
    btn.classList.add('is-busy'); btn.innerHTML = NEEDLE_SVG + 'جارٍ التقييم…';
    box.innerHTML = '<p class="placeholder">النموذج يقرأ المنهج والنتائج الآلية…</p>';
    const text = state.doc.pages.map(p => p.text).join('\n').slice(0, AI.textBudget());
    const objectives = a.bloom.slice(0, 40).map(b => `- ${b.text} (المستوى المكتشف: ${b.level || 'غير محدد'})`).join('\n');
    const sys = 'أنت مراجع مناهج خبير في أكاديمية السلطان قابوس البحرية. قيّم المنهج المرفق بموضوعية وفق تصنيف بلوم المعدَّل وأركان الهدف السلوكي واكتمال عناصر الدرس (أهداف، أنشطة، تقويم، مراجع) وملاءمة المحتوى للمستوى. ' + AI.langInstruction() + ' أجب بـJSON صالح فقط، بلا شرح ولا علامات ```، بهذا الشكل: {"score": 0-100, "overall": "فقرة", "strengths": ["..."], "weaknesses": ["..."], "objectives": [{"text": "الهدف كما ورد", "level": "مستوى بلوم", "issue": "المشكلة", "rewrite": "صياغة سلوكية أفضل تبدأ بـ أن"}], "missing": ["..."], "recommendations": ["..."]}. اختر للأهداف أضعف 3 إلى 8 أهداف فقط.';
    const user = `ملخص التحليل الآلي: ${analysisSummary()}\n\nالأهداف المكتشفة:\n${objectives}\n\nنص المنهج:\n${text}`;
    try {
      const out = await AI.complete([{ role: 'system', content: sys }, { role: 'user', content: user }], s => window.aiStatus && window.aiStatus(s));
      let review;
      try { review = JSON.parse(extractJson(out)); } catch { review = { raw: out }; }
      a.aiReview = { ...review, model: AI.model(), at: new Date().toISOString() };
      render(); animateSummary(); toast('اكتمل التقييم المنظّم.', 'success');
    } catch (e) {
      box.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message || String(e))}<br><small>تحقق من إعدادات المحرّك في تبويب «المساعد».</small></div>`;
    } finally { btn.classList.remove('is-busy'); btn.textContent = 'تقييم منظّم بدرجة'; }
  });
})();

// ---------- التبويبات: أيقونات ومؤشر نشط منزلق ----------
(function initTabsChrome() {
  const ICONS = {
    'tab-curricula': '<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v14"/>',
    'tab-assistant': '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    'tab-upload': '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v4h16v-4"/>',
    'tab-results': '<path d="M5 20V11M12 20V5M19 20v-6"/>',
    'tab-reference': '<circle cx="12" cy="12" r="9"/><path d="M12 5.5l2 6.5h-4z"/><path d="M10 12h4l-2 6.5z"/>',
    'tab-settings': '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    'tab-admin': '<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>',
  };
  const tabs = document.querySelector('.tabs');
  document.querySelectorAll('.tab-btn').forEach(t => {
    const d = ICONS[t.id];
    if (d) t.insertAdjacentHTML('afterbegin', `<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`);
  });
  const ind = document.createElement('span'); ind.className = 'tab-indicator'; ind.setAttribute('aria-hidden', 'true'); tabs.appendChild(ind);
  window.positionTabIndicator = function () {
    const a = tabs.querySelector('.tab-btn[aria-selected="true"]');
    if (!a || a.hidden || !a.offsetWidth) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1';
    // كبسولة عاجية خلف التبويب النشط: عرض وارتفاع حقيقيان (التحجيم يشوّه الحواف المستديرة)
    ind.style.width = a.offsetWidth + 'px';
    ind.style.height = a.offsetHeight + 'px';
    ind.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
    // أول تموضع بلا حركة، ثم تنزلق الكبسولة بين التبويبات
    if (!ind.classList.contains('is-ready')) requestAnimationFrame(() => ind.classList.add('is-ready'));
  };
  const base = window.activateTab;
  window.activateTab = function (id) {
    base(id); positionTabIndicator();
    const a = tabs.querySelector('.tab-btn[aria-selected="true"]');
    if (a && tabs.scrollWidth > tabs.clientWidth) a.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
    if (a && a.id === 'tab-admin' && window.renderAdmin) renderAdmin();
  };
  // تلاشٍ خفيف عند طرف الشريط حين توجد تبويبات خارج العرض (RTL: scrollLeft سالب في Chromium)
  const edges = () => {
    const max = tabs.scrollWidth - tabs.clientWidth, x = Math.abs(tabs.scrollLeft);
    tabs.classList.toggle('more-end', max > 1 && x < max - 1);
    tabs.classList.toggle('more-start', max > 1 && x > 1);
  };
  tabs.addEventListener('scroll', edges, { passive: true });
  window.addEventListener('resize', () => { positionTabIndicator(); edges(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { positionTabIndicator(); edges(); });
  requestAnimationFrame(() => { positionTabIndicator(); edges(); });
  window.syncTabEdges = edges;
})();

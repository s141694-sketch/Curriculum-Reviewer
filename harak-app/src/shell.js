// ============================================================
// حراك: الغلاف فوق محلّل المناهج
// الدخول بالدور، المناهج، المساعد الذكي، الإدارة.
// يعتمد على العناصر العامة في المحلّل: $, store, state, settings, userStandards,
// activateTab, runAnalysis, escapeHtml, downloadBlob, dateStamp, runDevTests.
// ============================================================

const HARAK_KEYS = { session: 'harak.session', logins: 'harak.logins', curricula: 'harak.curricula', ai: 'harak.ai', chat: 'harak.chat' };
const ROLE_LABELS = { designer: 'مصمم منهج', reviewer: 'مراجع مناهج', admin: 'مدير النظام' };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const NEEDLE_SVG = '<svg class="spin" width="14" height="14" viewBox="-50 -50 100 100" aria-hidden="true"><polygon points="0,-40 11,0 -11,0" fill="#E0555A"/><polygon points="-11,0 11,0 0,40" fill="#E8CF9A"/></svg>';

// ---------- الجلسة والدور ----------
let session = (() => { try { return JSON.parse(sessionStorage.getItem(HARAK_KEYS.session)); } catch { return null; } })();

function applyRole() {
  const role = session ? session.role : null;
  const elevated = role === 'reviewer' || role === 'admin';
  $('tab-admin').hidden = !elevated;
  document.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = role !== 'admin'; });
  $('app-user').hidden = !session;
  if (session) {
    $('app-user-name').textContent = session.name || ROLE_LABELS[session.role];
    $('app-user-role').textContent = session.name ? ROLE_LABELS[session.role] : '';
    $('admin-role-chip').textContent = ROLE_LABELS[session.role];
    $('admin-title').textContent = session.role === 'admin' ? 'لوحة التحكم بالنظام' : 'لوحة المراجعة';
  }
  if (!elevated && $('tab-admin').getAttribute('aria-selected') === 'true') activateTab('tab-curricula');
}

(function initLanding() {
  $('landing-emblem').src = DEFAULT_LOGO;
  const cards = Array.from(document.querySelectorAll('.role-card'));
  let picked = 'designer';
  cards.forEach(c => c.addEventListener('click', () => { picked = c.dataset.role; cards.forEach(x => x.setAttribute('aria-pressed', String(x === c))); }));
  $('landing-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('landing-name').value.trim().slice(0, 60);
    session = { name, role: picked, at: new Date().toISOString() };
    sessionStorage.setItem(HARAK_KEYS.session, JSON.stringify(session));
    const logins = store.read(HARAK_KEYS.logins, []);
    logins.unshift(session);
    store.write(HARAK_KEYS.logins, logins.slice(0, 1000));
    $('landing').hidden = true;
    applyRole();
    activateTab('tab-curricula');
    renderCurricula();
  });
  $('btn-switch-role').addEventListener('click', () => {
    session = null; sessionStorage.removeItem(HARAK_KEYS.session);
    applyRole();
    $('landing').hidden = false;
  });
  if (session) { $('landing').hidden = true; applyRole(); }
  else applyRole();
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
        <div class="cur-card" data-open="${c.id}" role="button" tabindex="0">
          <strong>${escapeHtml(c.subject)}</strong>
          <span class="meta">${escapeHtml(c.level)} · ${c.durationWeeks} أسبوعًا</span>
          <span class="count">${c.modules.length} وحدات · ${c.modules.reduce((n, m) => n + m.topics.length, 0)} موضوعًا</span>
        </div>`).join('')}</div>`
    : '<div class="empty">لا توجد مناهج بعد. اضغط «منهج جديد» لتبدأ.</div>';
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
    <p class="muted">${escapeHtml(c.level)} · ${c.durationWeeks} أسبوعًا${c.goals ? ' · ' + escapeHtml(c.goals) : ''}</p>
    ${c.modules.length ? '' : '<div class="empty">لا وحدات بعد. أضف وحدة أو اطلب مسودة من المساعد.</div>'}
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
              <input type="text" data-tfield="title" value="${escapeHtml(t.title)}" placeholder="عنوان الموضوع">
              <input type="text" data-tfield="description" value="${escapeHtml(t.description)}" placeholder="وصف مختصر">
            </div>
            <button class="btn btn-ghost btn-sm" type="button" data-del-topic="${t.id}">حذف</button>
          </div>`).join('')}
        <button class="btn btn-dashed" type="button" data-add-topic="${m.id}">+ إضافة موضوع</button>
      </div>`).join('')}`;
}

function touch(c) { c.updatedAt = new Date().toISOString(); saveCurricula(); }

(function initCurricula() {
  $('btn-cur-new').addEventListener('click', () => { $('cur-new-form').reset(); $('cur-new-status').innerHTML = ''; showCurView('cur-new-view'); });
  document.querySelectorAll('[data-cur-back]').forEach(b => b.addEventListener('click', () => { renderCurricula(); showCurView('cur-list-view'); }));
  $('cur-list').addEventListener('click', e => { const card = e.target.closest('[data-open]'); if (card) openCurriculum(card.dataset.open); });
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
    if (b.dataset.delModule) c.modules = c.modules.filter(m => m.id !== b.dataset.delModule);
    else if (b.dataset.addTopic) c.modules.find(m => m.id === b.dataset.addTopic).topics.push({ id: uid(), title: '', description: '' });
    else if (b.dataset.delTopic) c.modules.forEach(m => { m.topics = m.topics.filter(t => t.id !== b.dataset.delTopic); });
    else return;
    touch(c); renderEditor();
  });
  $('btn-cur-add-module').addEventListener('click', () => { const c = getCur(currentId); if (!c) return; c.modules.push({ id: uid(), title: '', objective: '', durationHours: 0, topics: [] }); touch(c); renderEditor(); });
  $('btn-cur-delete').addEventListener('click', () => {
    const c = getCur(currentId); if (!c || !confirm(`حذف منهج «${c.subject}»؟`)) return;
    curricula = curricula.filter(x => x.id !== c.id); saveCurricula(); currentId = null;
    renderCurricula(); showCurView('cur-list-view');
  });
  $('btn-cur-analyze').addEventListener('click', () => {
    const c = getCur(currentId); if (!c) return;
    const file = new File([curriculumToText(c)], `${dateStamp()}-${c.subject.replace(/\s+/g, '-')}.txt`, { type: 'text/plain' });
    $('file-name').textContent = 'منهج من حراك: ' + c.subject;
    activateTab('tab-upload');
    runAnalysis(file);
  });
  $('btn-cur-ask').addEventListener('click', () => { $('ai-context').value = currentId; activateTab('tab-assistant'); $('chat-text').focus(); });
  renderCurricula();
})();

// يحوّل المنهج إلى النص الذي يفهمه المحلّل (وحدة/درس/الأهداف)
function curriculumToText(c) {
  const lines = [c.subject, `${c.level} — ${c.durationWeeks} أسبوعًا`, ''];
  if (c.goals) lines.push('أهداف المنهج العامة:', c.goals, '');
  c.modules.forEach((m, i) => {
    lines.push(`الوحدة ${i + 1}: ${m.title || 'بلا عنوان'}`);
    lines.push(`الدرس ${i + 1}: ${m.title || 'بلا عنوان'}`);
    lines.push('الأهداف:');
    (m.objective || '').split(/\n|؛|\.\s+/).map(s => s.trim()).filter(Boolean).forEach(s => lines.push(s.endsWith('.') ? s : s + '.'));
    if (m.topics.length) { lines.push('الموضوعات:'); m.topics.forEach(t => lines.push(`${t.title}${t.description ? ' — ' + t.description : ''}`)); }
    lines.push('');
  });
  return lines.join('\n');
}

// ---------- المساعد الذكي ----------
const AI = {
  settings: Object.assign({ engine: 'ollama', url: 'http://localhost:11434', openaiUrl: '', model: 'qwen2.5:7b', openaiModel: '', webllmModel: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', key: '' }, store.read(HARAK_KEYS.ai, {})),
  webllm: null,
  save() { store.write(HARAK_KEYS.ai, this.settings); },
  baseUrl() { return (this.settings.engine === 'openai' ? this.settings.openaiUrl || this.settings.url : this.settings.url).replace(/\/$/, ''); },
  model() { return this.settings.engine === 'webllm' ? this.settings.webllmModel : this.settings.engine === 'openai' ? (this.settings.openaiModel || this.settings.model) : this.settings.model; },

  async *stream(messages, onStatus = () => {}) {
    if (this.settings.engine === 'webllm') {
      if (!this.webllm) {
        onStatus('جارٍ تحميل النموذج داخل المتصفح (مرة واحدة، قد يستغرق دقائق)…');
        const mod = await import('https://esm.run/@mlc-ai/web-llm');
        this.webllm = await mod.CreateMLCEngine(this.model(), { initProgressCallback: p => onStatus(p.text) });
      }
      const chunks = await this.webllm.chat.completions.create({ messages, stream: true, temperature: 0.4 });
      for await (const ch of chunks) { const d = ch.choices?.[0]?.delta?.content; if (d) yield d; }
      return;
    }
    const url = `${this.baseUrl()}/v1/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (this.settings.key) headers.Authorization = `Bearer ${this.settings.key}`;
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ model: this.model(), messages, stream: true, temperature: 0.4 }) });
    } catch (e) { throw new Error(`تعذّر الوصول إلى ${url}. هل الخادم يعمل؟ (Ollama: ollama serve، ومع ملف محلي قد تحتاج OLLAMA_ORIGINS="*")`); }
    if (!res.ok) throw new Error(`الخادم ردّ بخطأ ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim(); if (data === '[DONE]') return;
        try { const d = JSON.parse(data).choices?.[0]?.delta?.content; if (d) yield d; } catch { /* سطر ناقص */ }
      }
    }
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
    return { local: true, text: '✔ يعمل محليًا بالكامل: الملف والنموذج على هذا الجهاز، لا يغادر النص المتصفح وlocalhost.' };
  },

  async complete(messages, onStatus) { let out = ''; for await (const d of this.stream(messages, onStatus)) out += d; return out; },

  // قائمة النماذج المنزّلة في Ollama (/api/tags)
  async listModels() {
    const res = await fetch(`${this.baseUrl()}/api/tags`).catch(() => { throw new Error('تعذّر الوصول إلى Ollama. شغّله بـ OLLAMA_ORIGINS="*" ollama serve'); });
    if (!res.ok) throw new Error(`Ollama ردّ بخطأ ${res.status}`);
    const data = await res.json();
    return (data.models || []).map(m => m.name);
  },

  async test() {
    if (this.settings.engine === 'webllm') {
      if (!navigator.gpu) throw new Error('هذا المتصفح لا يدعم WebGPU؛ استخدم Chrome أو Edge حديثًا، أو اختر Ollama.');
      return 'المتصفح يدعم WebGPU. سيُحمَّل النموذج عند أول رسالة.';
    }
    const t = await this.complete([{ role: 'user', content: 'أجب بكلمة واحدة: جاهز' }]);
    return `متصل. النموذج ${this.model()} أجاب: ${t.trim().slice(0, 40)}`;
  },

  systemPrompt(ctx) {
    let s = 'أنت «حراك»، مساعد خبير في تصميم المناهج ومراجعتها في أكاديمية السلطان قابوس البحرية. تجيب بالعربية الفصحى، بإيجاز وتنظيم، وتستند إلى تصنيف بلوم (المعدَّل) وأركان الهدف السلوكي (الفعل القابل للقياس، المتعلم، المحتوى، الشرط، المعيار). عند اقتراح أهداف اكتبها بفعل مضارع قابل للقياس يبدأ بـ"أن" مثل: أن يحدد الطالب…';
    if (ctx.curriculum) s += '\n\nالمنهج الحالي (JSON):\n' + JSON.stringify(ctx.curriculum, (k, v) => (k === 'id' || k === 'createdAt' || k === 'updatedAt') ? undefined : v);
    if (ctx.analysis) s += '\n\nملخص آخر تحليل آلي:\n' + ctx.analysis;
    return s;
  },

  async draftModules(brief) {
    const sys = 'أنت مساعد تصميم مناهج. أعد مخططًا منظمًا للمقرر بالعربية الفصحى. أجب بـJSON صالح فقط، بلا شرح ولا علامات ```، بهذا الشكل بالضبط: {"modules":[{"title":"...","objective":"أن ...","durationHours":6,"topics":[{"title":"...","description":"..."}]}]}. اجعل عدد الوحدات قريبًا من عدد الأسابيع (وحدة لكل أسبوع تقريبًا)، وكل هدف سلوكيًا بفعل قابل للقياس، ووصف كل موضوع جملة أو جملتين.';
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

let chat = store.read(HARAK_KEYS.chat, []);
function refreshContextOptions() {
  const sel = $('ai-context'); const cur = sel.value;
  sel.innerHTML = '<option value="">بلا منهج محدد</option>' + curricula.map(c => `<option value="${c.id}">${escapeHtml(c.subject)}</option>`).join('');
  if (getCur(cur)) sel.value = cur;
}

function renderChat() {
  const log = $('chat-log');
  if (!chat.length) { log.innerHTML = '<div class="chat-hello"><span class="harak-wordmark" aria-hidden="true">حر<svg viewBox="0 0 48 176" style="width:.25em;height:.93em"><polygon points="24,0 40,88 24,176 8,88" fill="#1B1F4B"/><circle cx="24" cy="88" r="8" fill="#D4AD6A"/></svg>ك</span><br>اختر منهجًا من القائمة ثم اسأل، أو استخدم الأسئلة الجاهزة.<br>المساعد يعمل بنموذج مفتوح المصدر على جهازك.</div>'; return; }
  log.innerHTML = chat.map((m, i) => {
    const applicable = m.role === 'assistant' && /"modules"\s*:/.test(m.content);
    return `<div class="msg ${m.role}">${escapeHtml(m.content)}${applicable ? `<div class="apply"><button class="btn btn-sm" type="button" data-apply="${i}">تطبيق هذه النسخة على المنهج المحدد</button></div>` : ''}</div>`;
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
    document.querySelectorAll('[data-engine]').forEach(el => { el.hidden = !el.dataset.engine.split(' ').includes(S.engine); });
  };
  $('ai-engine').addEventListener('change', e => { S.engine = e.target.value; AI.save(); syncFields(); });
  $('ai-url').addEventListener('input', e => { if (S.engine === 'openai') S.openaiUrl = e.target.value.trim(); else S.url = e.target.value.trim(); AI.save(); });
  $('ai-model').addEventListener('input', e => { const v = e.target.value.trim(); if (S.engine === 'webllm') S.webllmModel = v; else if (S.engine === 'openai') S.openaiModel = v; else S.model = v; AI.save(); });
  $('ai-key').addEventListener('input', e => { S.key = e.target.value; AI.save(); });
  syncFields();

  const status = (text, cls = '') => { const el = $('ai-status'); el.textContent = text; el.className = 'engine-status ' + cls; };
  window.aiStatus = status;
  const locality = () => {
    const el = $('ai-locality'); const l = AI.locality();
    el.textContent = l.text; el.className = 'engine-status ' + (l.local ? 'ok' : 'err');
  };
  ['ai-engine', 'ai-url', 'ai-model'].forEach(id => $(id).addEventListener('input', locality));
  $('ai-engine').addEventListener('change', locality);
  locality();
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
      if (names.length && !names.includes(S.model)) { S.model = names.find(n => /qwen|gemma|llama/i.test(n)) || names[0]; AI.save(); $('ai-model').value = S.model; }
      status(`وُجد ${names.length} نموذجًا. النموذج المختار: ${AI.model()}`, 'ok');
    } catch (e) { status(e.message || String(e), 'err'); }
  });
  $('btn-ai-clear').addEventListener('click', () => { chat = []; store.write(HARAK_KEYS.chat, chat); renderChat(); });
  document.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => send(b.dataset.quick)));
  $('chat-form').addEventListener('submit', e => { e.preventDefault(); const t = $('chat-text').value.trim(); if (t) { $('chat-text').value = ''; send(t); } });
  $('chat-text').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('chat-form').requestSubmit(); } });
  $('chat-log').addEventListener('click', e => {
    const b = e.target.closest('[data-apply]'); if (!b) return;
    const c = getCur($('ai-context').value);
    if (!c) { alert('اختر المنهج المستهدف من قائمة «السياق» أولًا.'); return; }
    try {
      const modules = parseModules(chat[Number(b.dataset.apply)].content);
      if (!confirm(`استبدال وحدات «${c.subject}» بالنسخة المقترحة (${modules.length} وحدات)؟`)) return;
      c.modules = modules; touch(c);
      renderCurricula(); openCurriculum(c.id); activateTab('tab-curricula');
    } catch (err) { alert(err.message); }
  });

  let busy = false;
  async function send(text) {
    if (busy) return; busy = true;
    $('chat-send').classList.add('is-busy');
    chat.push({ role: 'user', content: text });
    const reply = { role: 'assistant', content: '' }; chat.push(reply); renderChat();
    const ctx = { curriculum: getCur($('ai-context').value) || null, analysis: $('ai-include-analysis').checked ? analysisSummary() : '' };
    const history = chat.slice(-11, -1).filter(m => m.content).map(m => ({ role: m.role, content: m.content }));
    const messages = [{ role: 'system', content: AI.systemPrompt(ctx) }, ...history];
    try {
      for await (const d of AI.stream(messages, s => status(s))) { reply.content += d; renderChat(); }
      if (!reply.content) reply.content = '(لم يصل رد)';
    } catch (e) {
      reply.role = 'system'; reply.content = 'تعذّر الاتصال بالمحرّك: ' + (e.message || String(e));
      status(reply.content, 'err');
    } finally {
      busy = false; $('chat-send').classList.remove('is-busy');
      store.write(HARAK_KEYS.chat, chat.slice(-60)); renderChat();
    }
  }
  renderChat();
})();

// ---------- الإدارة ----------
(function initAdmin() {
  const logins = () => store.read(HARAK_KEYS.logins, []);
  function render() {
    const L = logins();
    const count = r => L.filter(x => x.role === r).length;
    $('admin-stats').innerHTML = [['مرات الدخول', L.length], ['مصممو المناهج', count('designer')], ['المراجعون', count('reviewer')], ['المديرون', count('admin')], ['المناهج', curricula.length], ['التقارير المحفوظة', store.read(STORAGE_KEYS.reports, []).length]]
      .map(([l, n]) => `<div class="stat"><div class="num">${n}</div><div class="lbl">${l}</div></div>`).join('');
    $('users-table').querySelector('tbody').innerHTML = L.map(x => `<tr><td>${escapeHtml(x.name || '—')}</td><td><span class="chip">${ROLE_LABELS[x.role] || x.role}</span></td><td>${fmtDate(x.at)}</td></tr>`).join('');
    $('users-empty').hidden = L.length > 0;
  }
  $('tab-admin').addEventListener('click', render);
  $('btn-users-clear').addEventListener('click', () => { if (confirm('مسح سجل الدخول؟')) { store.write(HARAK_KEYS.logins, []); render(); } });

  const allData = () => ({ app: 'harak', version: APP_VERSION, exportedAt: new Date().toISOString(), curricula, reports: store.read(STORAGE_KEYS.reports, []), standards: userStandards, frameworks: store.read(STORAGE_KEYS.frameworks, []), settings, logins: logins() });
  $('btn-data-export').addEventListener('click', () => downloadBlob(`${dateStamp()}-harak-data.json`, JSON.stringify(allData(), null, 2), 'application/json'));
  $('btn-data-show').addEventListener('click', () => { const pre = $('data-json'); pre.hidden = !pre.hidden; if (!pre.hidden) pre.textContent = JSON.stringify(allData(), null, 2); });
  $('data-import').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (Array.isArray(d.curricula)) { const ids = new Set(curricula.map(c => c.id)); d.curricula.forEach(c => { if (!ids.has(c.id)) curricula.push(c); }); saveCurricula(); }
      if (Array.isArray(d.reports)) store.write(STORAGE_KEYS.reports, [...store.read(STORAGE_KEYS.reports, []), ...d.reports]);
      if (Array.isArray(d.standards)) { userStandards.push(...d.standards); store.write(STORAGE_KEYS.standards, userStandards); }
      $('data-notice').textContent = `استُوردت البيانات: ${(d.curricula || []).length} منهجًا، ${(d.reports || []).length} تقريرًا، ${(d.standards || []).length} معيارًا. أعد تحميل الصفحة لرؤية كل شيء.`;
      renderCurricula(); render();
    } catch (err) { $('data-notice').textContent = 'تعذّر الاستيراد: ' + (err.message || err); }
    e.target.value = '';
  });
  $('btn-admin-settings').addEventListener('click', () => activateTab('tab-settings'));
  $('btn-admin-tests').addEventListener('click', async () => {
    const box = $('admin-test-results'); box.innerHTML = '<p>جارٍ التشغيل…</p>';
    const results = await runDevTests();
    const pass = results.filter(r => r.ok).length;
    box.innerHTML = `<p><strong>${pass} / ${results.length}</strong> نجح</p><ul>${results.map(r => `<li class="${r.ok ? 'dev-pass' : 'dev-fail'}">${escapeHtml(r.name)}${r.ok ? '' : ' — ' + escapeHtml(r.error)}</li>`).join('')}</ul>`;
  });
  $('btn-admin-wipe').addEventListener('click', () => {
    if (!confirm('حذف كل بيانات حراك من هذا المتصفح؟ لا يمكن التراجع.')) return;
    [...Object.values(HARAK_KEYS), ...Object.values(STORAGE_KEYS)].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem(HARAK_KEYS.session);
    location.reload();
  });
})();

// ---------- التقييم بالذكاء الاصطناعي في تبويب النتائج ----------
(function initAiReview() {
  const box = $('ai-review'), btn = $('btn-ai-review');
  const list = (arr, cls = '') => (arr && arr.length) ? `<ul class="${cls}">${arr.map(x => `<li>${escapeHtml(typeof x === 'string' ? x : JSON.stringify(x))}</li>`).join('')}</ul>` : '<p class="muted">—</p>';
  const section = (title, body) => `<div class="report-section"><h2>${title}</h2>${body}</div>`;

  function render() {
    const r = state.analysis && state.analysis.aiReview;
    btn.disabled = !state.analysis;
    if (!r) { box.innerHTML = `<p class="placeholder">${state.analysis ? 'اضغط «قيّم بالذكاء الاصطناعي» لتقييم يشرح النتائج ويقترح صياغات بديلة.' : 'حلّل منهجًا أولًا.'}</p>`; return; }
    if (r.raw) { box.innerHTML = `<div class="report-section"><h2>تقييم النموذج</h2><div class="msg assistant" style="max-width:100%">${escapeHtml(r.raw)}</div></div>`; return; }
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

  // يُستدعى المحلّل renderResults عند كل تحليل جديد؛ نلحق به عرض التقييم الذكي
  const original = renderResults;
  renderResults = function () { original(); render(); };
  render();

  btn.addEventListener('click', async () => {
    const a = state.analysis; if (!a) return;
    btn.classList.add('is-busy'); btn.innerHTML = NEEDLE_SVG + 'جارٍ التقييم…';
    box.innerHTML = '<p class="placeholder">النموذج يقرأ المنهج والنتائج الآلية…</p>';
    const text = state.doc.pages.map(p => p.text).join('\n').slice(0, 7000);
    const objectives = a.bloom.slice(0, 40).map(b => `- ${b.text} (المستوى المكتشف: ${b.level || 'غير محدد'})`).join('\n');
    const sys = 'أنت مراجع مناهج خبير في أكاديمية السلطان قابوس البحرية. قيّم المنهج المرفق بموضوعية وفق تصنيف بلوم المعدَّل وأركان الهدف السلوكي واكتمال عناصر الدرس (أهداف، أنشطة، تقويم، مراجع) وملاءمة المحتوى للمستوى. أجب بالعربية الفصحى وبـJSON صالح فقط، بلا شرح ولا علامات ```، بهذا الشكل: {"score": 0-100, "overall": "فقرة", "strengths": ["..."], "weaknesses": ["..."], "objectives": [{"text": "الهدف كما ورد", "level": "مستوى بلوم", "issue": "المشكلة", "rewrite": "صياغة سلوكية أفضل تبدأ بـ أن"}], "missing": ["..."], "recommendations": ["..."]}. اختر للأهداف أضعف 3 إلى 8 أهداف فقط.';
    const user = `ملخص التحليل الآلي: ${analysisSummary()}\n\nالأهداف المكتشفة:\n${objectives}\n\nنص المنهج:\n${text}`;
    try {
      const out = await AI.complete([{ role: 'system', content: sys }, { role: 'user', content: user }], s => window.aiStatus && window.aiStatus(s));
      let review;
      try { review = JSON.parse(extractJson(out)); } catch { review = { raw: out }; }
      a.aiReview = { ...review, model: AI.model(), at: new Date().toISOString() };
      render();
    } catch (e) {
      box.innerHTML = `<div class="alert alert-danger">${escapeHtml(e.message || String(e))}<br><small>تحقق من إعدادات المحرّك في تبويب «المساعد».</small></div>`;
    } finally { btn.classList.remove('is-busy'); btn.textContent = 'قيّم بالذكاء الاصطناعي'; }
  });
})();

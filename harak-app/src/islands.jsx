// مكوّنات React داخل حراك: تُحزم بـ esbuild في build.mjs وتُدمج في harak.html (يعمل بلا إنترنت).
// كل عنصر يحمل data-blur-text يصبح BlurText بالنص نفسه، ويبقى العنصر الأصلي (h2، span) بوسمه ونمطه.
// النص الأصلي داخل العنصر هو البديل إن لم يعمل JavaScript.
import { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import BlurText from '../../src/components/BlurText.jsx';
import Magnet from '../../src/components/Magnet.jsx';
import FileFolder from '../../src/components/FileFolder.jsx';
import PillNav from '../../src/components/PillNav.jsx';
import PromptBar from '../../src/components/PromptBar.jsx';
import ThoughtLine from '../../src/components/ThoughtLine.jsx';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AiChat02Icon,
  Attachment01Icon,
  BookOpen01Icon,
  ChartHistogramIcon,
  CompassIcon,
  FileSearchIcon,
  ShieldUserIcon,
  SlidersHorizontalIcon,
} from '@hugeicons/core-free-icons';

// كلمات لا حروف: تقسيم الحروف العربية يفصل الحروف المتصلة
const PRESETS = {
  tagline: { effect: 'blur', direction: 'top', delay: 140, stepDuration: 0.4, blur: 10, distance: 16 },
  title: { effect: 'blur', direction: 'top', delay: 120, stepDuration: 0.38, blur: 8, distance: 14 },
};

const roots = new Map();
let replayCount = 0;

function mount(el) {
  const text = el.dataset.blurText || el.textContent.trim();
  const preset = PRESETS[el.dataset.blurPreset] || PRESETS.title;
  if (!roots.has(el)) roots.set(el, createRoot(el));
  // مفتاح جديد = تركيب جديد = إعادة تشغيل الحركة من بدايتها
  roots.get(el).render(
    <BlurText key={++replayCount} as="span" text={text} animateBy="words" trigger="load" className="blur-text" {...preset} />
  );
}

const replay = selector => document.querySelectorAll(selector).forEach(mount);

replay('[data-blur-text]');
// shell.js يطلق هذين الحدثين: عند دخول النظام، وعند ظهور شاشة الدخول من جديد
document.addEventListener('harak:enter', () => replay('[data-blur-on="enter"]'));
document.addEventListener('harak:auth', () => replay('[data-blur-on="auth"]'));

// ---------- Magnet على الأزرار الأساسية ----------
// أزرار حراك عناصر DOM عادية يربط shell.js أحداثها، فلا يعيد React إنشاءها:
// يُنقل الزر نفسه (بأحداثه) إلى داخل غلاف Magnet، ويُستبعد ما يحتاج ثباتًا (الجداول والحوارات والأسئلة الجاهزة).
const MAGNET_SKIP = '.users-table, .row-actions, .quick, dialog, .magnet-host';

function MagnetHost({ button, disabled }) {
  const slot = useRef(null);
  useLayoutEffect(() => { slot.current.appendChild(button); }, [button]);
  return (
    <Magnet padding={50} magnetStrength={4} maxOffset={8} disabled={disabled} wrapperClassName="magnet-wrap" innerClassName="magnet-inner">
      <span ref={slot} className="magnet-slot" />
    </Magnet>
  );
}

const hosts = new Map(); // الحاوية ← { root, observer }

function magnetize(button) {
  if (!button.isConnected || button.closest(MAGNET_SKIP)) return;
  const host = document.createElement('div');
  host.className = 'magnet-host';
  button.before(host);
  const root = createRoot(host);
  const render = () => root.render(<MagnetHost button={button} disabled={button.disabled} />);
  const observer = new MutationObserver(render); // يتوقف الجذب حين يُعطَّل الزر
  observer.observe(button, { attributes: true, attributeFilter: ['disabled'] });
  hosts.set(host, { root, observer });
  render();
}

const scan = node => {
  if (node.nodeType !== 1) return;
  if (node.matches('.btn-primary')) magnetize(node);
  node.querySelectorAll('.btn-primary').forEach(magnetize);
};

scan(document.body);
// shell.js يعيد رسم أجزاء الصفحة: أزرار جديدة تُغلَّف، والأغلفة المحذوفة تُفكّ
new MutationObserver(records => {
  for (const r of records) {
    r.addedNodes.forEach(scan);
    r.removedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      for (const [host, h] of hosts) {
        if (!host.isConnected && (node === host || node.contains(host))) {
          h.observer.disconnect();
          h.root.unmount();
          hosts.delete(host);
        }
      }
    });
  }
}).observe(document.body, { childList: true, subtree: true });

// ---------- مجلد الملفات المحفوظة (Folder من React Bits) ----------
// القائمة التي يرسمها shell.js أو المحلّل هي المصدر: كل عنصر فيها يحمل data-folder-id وعنوانه ووصفه،
// ويُعاد رسم المجلد كلما تغيّرت. فتح ورقة من المجلد يضغط زر الفتح نفسه في القائمة، فلا يتكرر منطق الفتح.
function mountFolder(host) {
  const source = document.querySelector(host.dataset.folderSource);
  if (!source) return;
  const root = createRoot(host);
  const { folderLabel: label, folderKind: kind, folderHint: hint } = host.dataset;
  const open = file => source.querySelector(`[data-open="${CSS.escape(file.id)}"]`)?.click();
  const render = () => {
    const files = [...source.querySelectorAll('[data-folder-id]')].map(el => ({
      id: el.dataset.folderId,
      title: el.dataset.folderTitle,
      meta: el.dataset.folderMeta,
    }));
    root.render(<FileFolder files={files} label={label} kind={kind} hint={hint} onOpen={open} />);
  };
  new MutationObserver(render).observe(source, { childList: true, subtree: true });
  render();
}

document.querySelectorAll('[data-folder-source]').forEach(mountFolder);

// ---------- التبويبات بـ PillNav (React Bits) ----------
// الأزرار الأصلية (.tab-btn) تبقى مخفية مصدرًا للحالة: activateTab يضبط aria-selected عليها، وapplyRole يخفي «الإدارة».
// PillNav يرسمها بأيقونات Hugeicons، واختيار عنصر يضغط زره الأصلي فتعمل كل الأحداث المربوطة به كما هي.
const TAB_ICONS = {
  'tab-curricula': BookOpen01Icon,
  'tab-assistant': AiChat02Icon,
  'tab-upload': FileSearchIcon,
  'tab-results': ChartHistogramIcon,
  'tab-reference': CompassIcon,
  'tab-settings': SlidersHorizontalIcon,
  'tab-admin': ShieldUserIcon,
};

function mountTabs() {
  const tabs = document.querySelector('.app-top .tabs');
  if (!tabs) return;
  const buttons = [...tabs.querySelectorAll('.tab-btn')];
  const host = document.createElement('div');
  host.className = 'harak-nav';
  tabs.after(host);
  tabs.hidden = true;
  const root = createRoot(host);
  let entry = 0; // مفتاح جديد عند كل دخول يعيد حركة ظهور الشريط
  const render = () => {
    const items = buttons.map(b => ({
      label: b.textContent.trim(),
      icon: <HugeiconsIcon icon={TAB_ICONS[b.id]} size={18} strokeWidth={1.8} />,
      hidden: b.hidden,
      attrs: { 'data-tab': b.id },
    }));
    root.render(
      <PillNav
        key={entry}
        items={items}
        activeIndex={buttons.findIndex(b => b.getAttribute('aria-selected') === 'true')}
        onItemClick={(_, index) => buttons[index].click()}
        theme="dark"
        surface="none"
        itemStyle="pill"
        hoverEffect="fill"
        indicator="pill"
        highlightColor="#FFFEF9"
        highlightTextColor="#10367D"
        textColor="#DCE8F3"
        ariaLabel="أقسام حراك"
        style={{ '--pn-tile': 'transparent', '--pn-tile-rim': 'inset 0 0 0 1px #5B8FC4', '--pn-ring': '#FFFEF9' }}
      />
    );
  };
  new MutationObserver(render).observe(tabs, { subtree: true, attributes: true, attributeFilter: ['aria-selected', 'hidden'] });
  document.addEventListener('harak:enter', () => { entry += 1; render(); });
  render();
}
mountTabs();

// ---------- المساعد بـ PromptBar (React Bits) ----------
// shell.js يملك المحادثة (window.harakChat)، وهنا الرسم فقط. يُعاد الرسم عند تغيّر حالة الرد أو المناهج أو النماذج.
const SOURCE_ICONS = { file: Attachment01Icon, analysis: ChartHistogramIcon, curriculum: BookOpen01Icon };

function mountPrompt() {
  const host = document.getElementById('chat-prompt');
  const chat = window.harakChat;
  if (!host || !chat) return;
  const root = createRoot(host);
  const render = () => {
    root.render(
      // مفتاح النموذج: تغيير النموذج من الإعدادات يعيد اختيار النموذج في الحقل
      <PromptBar
        key={chat.model()}
        placeholder="اسأل «حراك» عن المنهج… (@ لمنهج أو ملف، / للأسئلة الجاهزة)"
        sources={chat.sources().map(src => ({ ...src, icon: SOURCE_ICONS[src.kind] }))}
        commands={chat.commands()}
        models={chat.models()}
        defaultModel={chat.model()}
        efforts={[]}
        busy={chat.busy()}
        onSend={(text, meta) => chat.send(text, meta)}
        onStop={chat.stop}
        onAttach={chat.attach}
        background="#FFFFFF"
        color="#0A1F44"
        menuBackground="#FFFFFF"
        sparkColor="#74B4DA"
        width={2000}
        radius={16}
        maxRows={6}
      />
    );
  };
  document.addEventListener('harak:chat', render);
  // قائمة @ تتبع المناهج: تُعاد عند كل رسم لقائمة المناهج أو عند تحليل جديد
  const list = document.getElementById('cur-list');
  if (list) new MutationObserver(render).observe(list, { childList: true });
  document.addEventListener('harak:thought', render);
  render();
}
mountPrompt();

// ---------- سطر التفكير بـ ThoughtLine (React Bits) ----------
// shell.js يرسل { id, run, working, label, doneLabel, steps, hidden } فيُرسم في [data-thought=id]
const thoughtRoots = new Map();
document.addEventListener('harak:thought', e => {
  const { id, hidden, run, ...line } = e.detail;
  const host = document.querySelector(`[data-thought="${id}"]`);
  if (!host) return;
  host.hidden = !!hidden;
  if (hidden) return;
  if (!thoughtRoots.has(id)) thoughtRoots.set(id, createRoot(host));
  thoughtRoots.get(id).render(
    <ThoughtLine key={run} fontSize={15} color="#10367D" glyphColor="#0B5497" collapsible collapseOnSettle showTimer {...line} />
  );
});

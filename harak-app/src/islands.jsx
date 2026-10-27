// مكوّنات React داخل حراك: تُحزم بـ esbuild في build.mjs وتُدمج في harak.html (يعمل بلا إنترنت).
// كل عنصر يحمل data-blur-text يصبح BlurText بالنص نفسه، ويبقى العنصر الأصلي (h2، span) بوسمه ونمطه.
// النص الأصلي داخل العنصر هو البديل إن لم يعمل JavaScript.
import { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import BlurText from '../../src/components/BlurText.jsx';
import Magnet from '../../src/components/Magnet.jsx';

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

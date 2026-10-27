// مكوّنات React داخل حراك: تُحزم بـ esbuild في build.mjs وتُدمج في harak.html (يعمل بلا إنترنت).
// كل عنصر يحمل data-blur-text يصبح BlurText بالنص نفسه، ويبقى العنصر الأصلي (h2، span) بوسمه ونمطه.
// النص الأصلي داخل العنصر هو البديل إن لم يعمل JavaScript.
import { createRoot } from 'react-dom/client';
import BlurText from '../../src/components/BlurText.jsx';

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

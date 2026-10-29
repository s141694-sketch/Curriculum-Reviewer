'use client';

// مجلد الملفات المحفوظة في حراك: Folder من React Bits بألوان الهوية.
// يعرض أحدث الملفات أوراقًا تُقرأ، ويتسع لعرض حاويته: انتشار أفقي على الشاشات العريضة،
// ورزمة رأسية على الضيقة. يحجز المساحة فوق المجلد مسبقًا فلا تتحرك الصفحة عند فتحه.

import { useEffect, useRef, useState } from 'react';
import Folder from './Folder.jsx';
import './FileFolder.css';

// أكثر من أربع أوراق تصغر حتى لا يُقرأ العنوان
const MAX_FILES = 4;
const SPREAD_MIN_WIDTH = 600;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const FileCard = ({ kind, title, meta }) => (
  <div className={`file-card${kind ? '' : ' file-card-plain'}`}>
    {kind && <span className="file-card-kind">{kind}</span>}
    <strong className="file-card-title">{title}</strong>
    {meta && <span className="file-card-meta">{meta}</span>}
    <span className="folder-doc-line" style={{ width: '92%' }} />
    <span className="folder-doc-line" style={{ width: '78%' }} />
    <span className="folder-doc-line" style={{ width: '86%' }} />
    <span className="folder-doc-line" style={{ width: '60%' }} />
  </div>
);

// الحجم والتخطيط وارتفاع الأوراق فوق المجلد عند فتحه، بوحدة size (مقيسة من Folder)
function fit(width, count) {
  if (width >= SPREAD_MIN_WIDTH) {
    const size = Math.min(1.2, width / 540);
    return { layout: 'spread', size, reserve: 76 * size };
  }
  const size = clamp(width / 300, 0.8, 1.1);
  const strip = count > 1 ? Math.min(30, 109 / (count - 1)) : 0;
  return { layout: 'stack', size, reserve: (53 + (count - 1) * strip) * size };
}

export default function FileFolder({ files, label, kind, hint, onOpen, className = '' }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    // العرض صفر والقسم مخفي: يبقى آخر قياس، ولا يُركَّب المجلد قبل أول ظهور
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const shown = files.slice(0, MAX_FILES);
  const { layout, size, reserve } = fit(width, shown.length);
  // في الرزمة لا يظهر من كل ورقة إلا شريطها العلوي، فيكون للعنوان لا لنوع الملف
  const items = shown.map(file => ({
    content: <FileCard kind={layout === 'stack' ? null : kind} title={file.title} meta={file.meta} />,
  }));

  return (
    // الحاوية تبقى في الصفحة وإن خلت، ليقيس ResizeObserver عرضها حين تظهر الملفات
    <div ref={ref} className={`file-folder${className ? ` ${className}` : ''}`} hidden={!shown.length}>
      {width > 0 && shown.length > 0 && (
        <div className="file-folder-stage" style={{ paddingTop: Math.ceil(reserve) }}>
          <Folder
            items={items}
            label={label}
            color="#0B5497"
            paperColor="#FFFEF9"
            theme="light"
            dir="rtl"
            layout={layout}
            size={size}
            open={open}
            onOpenChange={setOpen}
            draggable={false}
            zoomOnClick={false}
            onItemClick={(_, index) => {
              setOpen(false);
              onOpen?.(shown[index]);
            }}
            style={{ '--folder-focus': '#0B5497' }}
          />
        </div>
      )}
      {hint && <p className="file-folder-hint">{hint}</p>}
    </div>
  );
}

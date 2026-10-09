import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Segmented control whose white thumb glides to the active option. */
export function Segmented<T extends string>({ value, options, onChange, className = '' }: {
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLButtonElement>(`button[data-value="${value}"]`);
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options.length]);
  return (
    <div ref={wrap} className={`b3-seg ${className}`}>
      {thumb && <span className="b3-seg-thumb" style={{ left: thumb.left, width: thumb.width }} />}
      {options.map((o) => (
        <button key={o.value} data-value={o.value} data-active={o.value === value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Number that eases to its new value instead of jumping. */
export const CountUp: React.FC<{ value: number; decimals?: number; className?: string }> = ({ value, decimals = 0, className }) => {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min((t - start) / 900, 1);
      const e = 1 - Math.pow(1 - k, 4);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`b3-num ${className ?? ''}`}>{shown.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
};

/** Strata loader: five soil/sky bands drawing out from the ground line. */
export const StrataLoader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="flex flex-col items-center gap-4 b3-fade">
    <div className="b3-strata">
      <span style={{ background: '#9ec4cf' }} />
      <span style={{ background: '#1f7a72' }} />
      <span style={{ background: '#1b3344', height: 3 }} />
      <span style={{ background: '#b49a72' }} />
      <span style={{ background: '#8d7a62' }} />
    </div>
    <div className="text-center">
      <div className="b3-serif text-lg text-[#1b3344]">{title}</div>
      {subtitle && <div className="text-xs text-[#5c6e7c] mt-1">{subtitle}</div>}
    </div>
  </div>
);

export const sourceChip = (src: string): { text: string; cls: string } => {
  if (src.startsWith('osm')) return { text: src === 'osm:height' ? 'Surveyed height · OSM' : src === 'osm:levels' ? 'Mapped floors · OSM' : 'OpenStreetMap', cls: 'b3-chip-real' };
  if (src.startsWith('edited') || src === 'surveyor') return { text: 'Edited by surveyor', cls: 'b3-chip-edit' };
  if (src.startsWith('ml')) return { text: 'AI-estimated · Depth Anything V2', cls: 'b3-chip-ai' };
  if (src.startsWith('ai:geoai')) return { text: 'AI-detected footprint · GeoAI', cls: 'b3-chip-ai' };
  if (src.startsWith('ai:')) return { text: 'AI-detected footprint · GroundingDINO + SAM', cls: 'b3-chip-ai' };
  if (src.startsWith('estimated')) return { text: 'Estimated from building type', cls: 'b3-chip-est' };
  return { text: 'Synthetic', cls: 'b3-chip-syn' };
};

export const SourceChip: React.FC<{ src: string }> = ({ src }) => {
  const c = sourceChip(src);
  return <span className={`b3-chip ${c.cls}`}>{c.text}</span>;
};

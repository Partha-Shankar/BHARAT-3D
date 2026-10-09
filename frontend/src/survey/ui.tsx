import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { areaThumbUrl, listScenes, listFindings } from '../world/api';
import type { SceneMeta } from '../world/sceneSpec';
import { CountUp } from '../world/ui';
import { useAuthStore } from '../stores/authStore';

/* ------------------------------------------------------------------ data hooks */
export const useScenes = () =>
  useQuery({ queryKey: ['realgen', 'scenes'], queryFn: listScenes, staleTime: 15_000 });

export const useFindings = (key?: string) =>
  useQuery({ queryKey: ['realgen', 'findings', key ?? 'all'], queryFn: () => listFindings(key), staleTime: 15_000 });

export const useCanEdit = () => {
  const { user } = useAuthStore();
  return ['SURVEYOR', 'ADMIN'].includes(String(user?.role));
};

/** Base path of the signed-in role's workspace. */
export const useRoleBase = () => {
  const { user } = useAuthStore();
  const r = String(user?.role);
  return r === 'MUNICIPALITY' ? '/municipality' : r === 'UTILITY_OPERATOR' ? '/utility' : r === 'CITIZEN' ? '/citizen' : '/surveyor';
};

export const placeOf = (m: Pick<SceneMeta, 'place'>) =>
  [m.place?.locality, m.place?.city].filter(Boolean).filter((v, i, xs) => xs.indexOf(v) === i).join(', ') || 'Survey area';

export const FINDING_LABEL: Record<string, string> = {
  UNAUTHORIZED_EXTRA_FLOORS: 'Extra floors',
  NO_SANCTION_ON_RECORD: 'No sanction on record',
  FOOTPATH_ENCROACHMENT: 'Footpath encroachment',
  ROAD_ENCROACHMENT: 'Road encroachment',
  SETBACK_SHORTFALL: 'Setback shortfall',
  UNPERMITTED_CONSTRUCTION: 'Unpermitted construction',
};

export const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: 'bg-[#c0392b] text-white border-[#c0392b]',
  HIGH: 'text-[#c0392b] bg-[#c0392b]/8 border-[#c0392b]/30',
  MEDIUM: 'text-[#8a5a12] bg-[#c8962e]/12 border-[#c8962e]/35',
  LOW: 'text-[#5c6e7c] bg-white/60 border-[#e4dccf]',
};

export const fmtWhen = (t?: number | null) =>
  t ? new Date(t * 1000).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const fmtAgo = (t?: number | null) => {
  if (!t) return '—';
  const s = Date.now() / 1000 - t;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return fmtWhen(t);
};

/* ------------------------------------------------------------------ layout */
export const Page: React.FC<{ children: React.ReactNode; wide?: boolean; className?: string }> = ({ children, wide, className = '' }) => (
  <div className={`b3-app w-full ${wide ? 'max-w-[1400px]' : 'max-w-6xl'} mx-auto px-6 lg:px-8 py-7 space-y-6 ${className}`}>{children}</div>
);

export const PageHeader: React.FC<{ eyebrow: string; title: React.ReactNode; lead?: React.ReactNode; actions?: React.ReactNode }> = ({
  eyebrow, title, lead, actions,
}) => (
  <div className="b3-head">
    <div className="min-w-0 max-w-3xl">
      <div className="b3-eyebrow b3-rise">{eyebrow}</div>
      <h1 className="b3-title mt-1.5 b3-rise b3-d1">{title}</h1>
      {lead && <p className="text-sm text-[#5c6e7c] mt-2 leading-relaxed b3-rise b3-d2">{lead}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2 shrink-0 b3-rise b3-d3">{actions}</div>}
  </div>
);

export const StatTile: React.FC<{
  label: string; value: number | null | undefined; decimals?: number; suffix?: string; hint?: React.ReactNode;
  icon?: React.ReactNode; accent?: string; onClick?: () => void;
}> = ({ label, value, decimals = 0, suffix, hint, icon, accent, onClick }) => (
  <div className={`b3-tile ${onClick ? 'cursor-pointer' : ''}`} style={accent ? ({ '--accent': accent } as React.CSSProperties) : undefined} onClick={onClick}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#5c6e7c]">{label}</span>
      {icon && <span className="text-[#7d8c97]">{icon}</span>}
    </div>
    <div className="mt-2 flex items-baseline gap-1">
      {value === null || value === undefined ? <span className="b3-skel inline-block h-7 w-16" />
        : <CountUp value={value} decimals={decimals} className="b3-serif text-[28px] leading-none text-[#1b3344]" />}
      {suffix && value !== null && value !== undefined && <span className="text-xs text-[#5c6e7c]">{suffix}</span>}
    </div>
    {hint && <div className="text-[11px] text-[#7d8c97] mt-1.5">{hint}</div>}
  </div>
);

export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div className={`b3-skel ${className}`} style={style} />
);

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }> = ({
  icon, title, children, action,
}) => (
  <div className="text-center border border-dashed border-[#d9cdb8] rounded-2xl px-8 py-12 bg-white/30 b3-pop">
    {icon && <div className="mx-auto w-12 h-12 rounded-full bg-[#1f7a72]/10 text-[#1f7a72] flex items-center justify-center mb-3 b3-float">{icon}</div>}
    <div className="b3-serif text-xl text-[#1b3344]">{title}</div>
    {children && <div className="text-sm text-[#5c6e7c] mt-1.5 max-w-lg mx-auto leading-relaxed">{children}</div>}
    {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
  </div>
);

/** Satellite thumbnail of a generated area, with the survey outline drawn over it. */
export const AreaThumb: React.FC<{ meta: SceneMeta; className?: string }> = ({ meta, className = '' }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const ring = meta.survey_polygon ?? [];
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const M = 0.0004; // the imagery extends this far (degrees) beyond the polygon's bounds (pipeline.MARGIN_DEG)
  const [x0, x1, y0, y1] = [Math.min(...xs) - M, Math.max(...xs) + M, Math.min(...ys) - M, Math.max(...ys) + M];
  // the svg gets the image's own aspect and is cropped like `object-fit: cover`, so the outline stays registered
  const W = 100 * Math.cos(((y0 + y1) / 2) * (Math.PI / 180)) * ((x1 - x0) / (y1 - y0 || 1));
  const pts = ring.map((p) => `${((p[0] - x0) / (x1 - x0 || 1)) * W},${(1 - (p[1] - y0) / (y1 - y0 || 1)) * 100}`).join(' ');
  return (
    <div className={`b3-thumb ${className}`}>
      {!loaded && !failed && <div className="absolute inset-0 b3-skel !rounded-none" />}
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-[#9aa6ae]"><MapPin className="w-6 h-6" /></div>
      ) : (
        <img src={areaThumbUrl(meta.key)} alt="" loading="lazy" onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
          style={{ opacity: loaded ? 1 : 0 }} />
      )}
      {ring.length > 2 && (
        <svg viewBox={`0 0 ${W.toFixed(2)} 100`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full pointer-events-none">
          <polygon points={pts} fill="rgba(31,122,114,0.10)" stroke="#fff6df" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
    </div>
  );
};

export const ProgressRing: React.FC<{ value: number; size?: number; stroke?: number; children?: React.ReactNode }> = ({
  value, size = 64, stroke = 5, children,
}) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="b3-ring -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e4dccf" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#b3ringgrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} />
        <defs>
          <linearGradient id="b3ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1e4d6b" /><stop offset="100%" stopColor="#1f7a72" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

/** A check mark that draws itself. */
export const Tick: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 24 24" className={`b3-tick ${className}`} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** Choose a generated area; "all" optional. */
export const AreaSelect: React.FC<{ value: string; onChange: (k: string) => void; allowAll?: boolean; scenes?: SceneMeta[] }> = ({
  value, onChange, allowAll, scenes,
}) => (
  <select className="b3-select min-w-[220px]" value={value} onChange={(e) => onChange(e.target.value)}>
    {allowAll && <option value="">All areas</option>}
    {(scenes ?? []).map((m) => (
      <option key={m.key} value={m.key}>{placeOf(m)} · {(m.area_m2 / 1e6).toFixed(2)} km²</option>
    ))}
  </select>
);

export const SeverityChip: React.FC<{ s: string }> = ({ s }) => (
  <span className={`b3-chip ${SEVERITY_STYLE[s] ?? SEVERITY_STYLE.LOW}`}>{s}</span>
);

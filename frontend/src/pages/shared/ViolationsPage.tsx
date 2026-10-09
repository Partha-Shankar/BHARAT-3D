import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Box, Building2, Gauge, Layers, Ruler, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { FindingRow } from '../../world/sceneSpec';
import {
  AreaSelect, EmptyState, FINDING_LABEL, Page, PageHeader, SeverityChip, Skeleton, StatTile, useFindings, useScenes,
} from '../../survey/ui';
import { Segmented } from '../../world/ui';

const TYPE_ICON: Record<string, React.FC<{ className?: string }>> = {
  UNAUTHORIZED_EXTRA_FLOORS: Layers, NO_SANCTION_ON_RECORD: ShieldAlert, FOOTPATH_ENCROACHMENT: Ruler, ROAD_ENCROACHMENT: Ruler,
  SETBACK_SHORTFALL: Ruler, UNPERMITTED_CONSTRUCTION: Building2,
};
const CONF: Record<string, string> = { high: 'High confidence', medium: 'Medium confidence', low: 'Low confidence' };

const FindingCard: React.FC<{ f: FindingRow; showPlace: boolean; onOpen: () => void; i: number }> = ({ f, showPlace, onOpen, i }) => {
  const Icon = TYPE_ICON[f.type] ?? ShieldAlert;
  const [open, setOpen] = useState(false);
  return (
    <article className="b3-card is-hoverable p-4 flex flex-col gap-3" style={{ animation: `b3-rise 0.55s cubic-bezier(.22,1,.36,1) ${Math.min(i, 14) * 0.03}s both` }}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${f.severity === 'CRITICAL' ? 'bg-[#c0392b] text-white' : 'bg-[#c0392b]/10 text-[#c0392b]'}`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[13.5px] text-[#1b3344]">{FINDING_LABEL[f.type] ?? f.type}</span>
            <SeverityChip s={f.severity} />
          </div>
          <div className="text-[12px] text-[#5c6e7c] truncate">
            {f.building_name ?? 'Construction site'}{f.building_id ? <span className="font-mono text-[10.5px]"> · {f.building_id}</span> : null}
            {showPlace && <> · {f.place}</>}
          </div>
        </div>
        <span className="font-mono text-[10.5px] text-[#9aa6ae] shrink-0">{f.id}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="b3-well p-2"><div className="text-[10px] uppercase tracking-wider text-[#7d8c97] font-bold">Required</div><div className="text-[#1b3344] leading-snug">{f.sanctioned}</div></div>
        <div className="b3-well p-2 !border-[#c0392b]/25 !bg-[#c0392b]/5"><div className="text-[10px] uppercase tracking-wider text-[#c0392b] font-bold">Observed</div><div className="text-[#1b3344] leading-snug">{f.observed}</div></div>
      </div>

      {open && (
        <div className="text-[11.5px] text-[#5c6e7c] space-y-1 b3-expand">
          {f.excess && <div><b className="text-[#33495a]">Excess:</b> {f.excess}</div>}
          {f.floors_flagged?.length > 0 && <div><b className="text-[#33495a]">Floors flagged:</b> {f.floors_flagged.map((x) => (x === 0 ? 'G' : x)).join(', ')}</div>}
          <div><b className="text-[#33495a]">Basis:</b> {f.basis}</div>
          {f.ulpin && <div><b className="text-[#33495a]">Parent ULPIN:</b> <span className="font-mono">{f.ulpin}</span></div>}
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto">
        <span className="text-[11px] text-[#7d8c97] flex items-center gap-1"><Gauge className="w-3.5 h-3.5" /> {CONF[f.measurement_confidence] ?? f.measurement_confidence}</span>
        <button className="ml-auto b3-btn b3-btn-ghost !py-1 !px-2 !text-[11.5px]" onClick={() => setOpen(!open)}>{open ? 'Less' : 'Details'}</button>
        <button className="b3-btn b3-btn-primary !py-1.5 !text-[12px]" onClick={onOpen}><Box className="w-3.5 h-3.5" /> Show in 3D</button>
      </div>
    </article>
  );
};

/** Compliance findings across every generated area: measured on real footprints and roads, checked against the registers. */
export const ViolationsPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const key = params.get('key') ?? '';
  const type = params.get('type') ?? '';
  const { data: scenes } = useScenes();
  const { data: findings, isLoading } = useFindings(key || undefined);
  const [sev, setSev] = useState('');
  const [q, setQ] = useState('');

  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v); else n.delete(k);
    setParams(n, { replace: true });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const t: Record<string, number> = {};
    (findings ?? []).forEach((f) => { c[f.severity] = (c[f.severity] ?? 0) + 1; t[f.type] = (t[f.type] ?? 0) + 1; });
    return { c, t };
  }, [findings]);

  const shown = useMemo(() => (findings ?? []).filter((f) =>
    (!type || f.type === type) && (!sev || f.severity === sev)
    && (!q || `${f.building_name} ${f.building_id} ${f.place} ${f.id} ${f.ulpin}`.toLowerCase().includes(q.toLowerCase()))), [findings, type, sev, q]);

  return (
    <Page wide>
      <PageHeader eyebrow="Compliance intelligence" title="Findings"
        lead="Six deterministic checks on every building and construction site: extra floors, missing sanctions, footpath and road encroachment, setbacks and unpermitted construction. Geometry is measured on real footprints and roads."
        actions={<AreaSelect allowAll value={key} scenes={scenes} onChange={(k) => setParam('key', k)} />} />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 b3-stagger">
        <StatTile label="Critical" value={findings ? counts.c.CRITICAL : undefined} accent="#c0392b" onClick={() => setSev(sev === 'CRITICAL' ? '' : 'CRITICAL')} hint="act first" />
        <StatTile label="High" value={findings ? counts.c.HIGH : undefined} accent="#c0392b" onClick={() => setSev(sev === 'HIGH' ? '' : 'HIGH')} />
        <StatTile label="Medium" value={findings ? counts.c.MEDIUM : undefined} accent="#c8962e" onClick={() => setSev(sev === 'MEDIUM' ? '' : 'MEDIUM')} />
        <StatTile label="All findings" value={findings?.length} icon={<ShieldAlert className="w-4 h-4" />} onClick={() => { setSev(''); setParam('type', ''); }}
          hint={scenes ? `${key ? 1 : scenes.length} area(s)` : undefined} />
      </section>

      <div className="flex flex-wrap gap-1.5 b3-rise b3-d3">
        <button onClick={() => setParam('type', '')} className={`b3-chip !text-[11.5px] !px-3 !py-1 transition-colors ${!type ? '!bg-[#1e4d6b] !text-white !border-[#1e4d6b]' : 'b3-chip-plain hover:!bg-white'}`}>All types</button>
        {Object.entries(FINDING_LABEL).map(([t, label]) => (
          <button key={t} onClick={() => setParam('type', type === t ? '' : t)}
            className={`b3-chip !text-[11.5px] !px-3 !py-1 transition-colors ${type === t ? '!bg-[#1e4d6b] !text-white !border-[#1e4d6b]' : 'b3-chip-plain hover:!bg-white'}`}>
            {label} <span className="opacity-70 b3-num">{counts.t[t] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 b3-rise b3-d4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#7d8c97] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Building, ULPIN, area or finding id" className="b3-input !pl-8" />
        </div>
        <Segmented value={sev} onChange={setSev} options={[
          { value: '', label: 'Any severity' }, { value: 'CRITICAL', label: 'Critical' }, { value: 'HIGH', label: 'High' }, { value: 'MEDIUM', label: 'Medium' },
        ]} />
        {findings && <span className="text-xs text-[#7d8c97] ml-auto b3-num">{shown.length} shown</span>}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52" />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState icon={<ShieldCheck className="w-6 h-6" />} title={findings?.length ? 'Nothing matches these filters' : 'No findings'}>
          {findings?.length ? 'Clear a filter to see more.' : 'No compliance issue was found in the generated areas.'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" key={`${key}${type}${sev}`}>
          {shown.slice(0, 120).map((f, i) => (
            <FindingCard key={`${f.key}-${f.id}`} f={f} i={i} showPlace={!key} onOpen={() => navigate(`/3d-world/${f.key}?finding=${f.id}`)} />
          ))}
        </div>
      )}
      {shown.length > 120 && (
        <p className="text-center text-xs text-[#7d8c97]">Showing the first 120 of {shown.length}. Choose an area or a type to narrow the list. <ArrowRight className="inline w-3 h-3" /></p>
      )}
    </Page>
  );
};

export default ViolationsPage;

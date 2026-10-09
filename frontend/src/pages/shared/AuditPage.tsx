import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Archive, Box, Building2, Fingerprint, FolderUp, GitBranch, History, Pencil, Route, ShieldCheck, Sparkles, Trash2, TrainFront, Plus } from 'lucide-react';
import { listActivity } from '../../world/api';
import type { ActivityEvent } from '../../world/sceneSpec';
import { AreaSelect, EmptyState, Page, PageHeader, Skeleton, StatTile, fmtAgo, useScenes } from '../../survey/ui';
import { Segmented } from '../../world/ui';
import { fmtBytes } from '../../survey/datasets';

const FIELD: Record<string, string> = {
  floors: 'floors', floor_height: 'floor height', min_height: 'base height', footprint: 'footprint', usage: 'use', name: 'name',
  sanctioned_floors: 'sanctioned floors', unit_overrides: 'units per floor', depth_m: 'depth', radius_m: 'radius', buffer_m: 'safety buffer',
  path: 'alignment', elevation_m: 'deck height', width_m: 'width', height: 'height',
};

const fmtVal = (k: string, v: any) =>
  k === 'footprint' || k === 'path' ? 'redrawn' : k === 'unit_overrides' ? Object.entries(v ?? {}).map(([f, n]) => `${f === 'all' ? 'all floors' : `F${f}`}: ${n}`).join(', ')
    : typeof v === 'number' ? (k.endsWith('_m') || k === 'floor_height' || k === 'min_height' ? `${v} m` : String(v)) : String(v);

/** One readable sentence for an edit operation. */
function describe(op: any): { icon: React.FC<{ className?: string }>; title: string; detail?: string } {
  const set = op?.set ?? {};
  const changes = Object.entries(set).map(([k, v]) => `${FIELD[k] ?? k} → ${fmtVal(k, v)}`).join(' · ');
  switch (op?.op) {
    case 'building.update': return { icon: Building2, title: `Building ${op.id} updated`, detail: changes };
    case 'building.add': return { icon: Plus, title: `Building added${op.building?.name ? `: ${op.building.name}` : ''}`, detail: `${op.building?.floors ?? '?'} floors · use ${op.building?.usage ?? 'R'}` };
    case 'building.delete': return { icon: Trash2, title: `Building ${op.id} removed` };
    case 'asset.add': return { icon: TrainFront, title: `${op.asset?.kind === 'metro' ? 'Metro tunnel' : 'Subsurface asset'} added`, detail: op.asset?.depth_m ? `depth ${op.asset.depth_m} m` : undefined };
    case 'asset.update': return { icon: TrainFront, title: `Asset ${op.id} updated`, detail: changes };
    case 'asset.delete': return { icon: Trash2, title: `Asset ${op.id} removed` };
    case 'road.add': return { icon: Route, title: 'Flyover added', detail: op.road?.elevation_m ? `deck ${op.road.elevation_m} m` : undefined };
    case 'road.update': return { icon: Route, title: `Road ${op.id} updated`, detail: changes };
    case 'road.delete': return { icon: Trash2, title: `Road ${op.id} removed` };
    default: return { icon: Pencil, title: op?.op ?? 'Edit' };
  }
}

const dayOf = (t: number | null) => (t ? new Date(t * 1000).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Undated');

const EventRow: React.FC<{ e: ActivityEvent; showPlace: boolean; onOpen: () => void }> = ({ e, showPlace, onOpen }) => {
  let icon: React.FC<{ className?: string }> = Sparkles;
  let title = '';
  let detail: React.ReactNode = null;
  let tone = 'bg-[#1f7a72] text-white';
  if (e.kind === 'generated') {
    title = '3D record generated';
    detail = `${e.detail?.buildings ?? 0} buildings · ${(e.detail?.vprids ?? 0).toLocaleString('en-IN')} 3D ULPINs · ${e.detail?.findings ?? 0} findings · ${((e.detail?.area_m2 ?? 0) / 1e6).toFixed(3)} km²`;
  } else if (e.kind === 'lifecycle') {
    const ev = e.detail?.event as string;
    icon = ev === 'MINT' ? Fingerprint : ev === 'VERSION' ? GitBranch : ev === 'CERTIFY' ? ShieldCheck : Archive;
    tone = ev === 'MINT' ? 'bg-[#8a5a12] text-white' : ev === 'CERTIFY' ? 'bg-[#1f7a72] text-white' : 'bg-[#5c6e7c] text-white';
    const verb: Record<string, string> = { MINT: 'minted', RETIRE: 'retired', DEMOLISH: 'marked demolished', VERSION: 'versioned', CERTIFY: 'certified as built' };
    title = `${(e.detail?.count ?? 0).toLocaleString('en-IN')} 3D ULPIN(s) ${verb[ev] ?? ev.toLowerCase()}`;
    detail = <span><span className="text-[#5c6e7c]">{e.detail?.reason}</span><span className="block font-mono text-[10.5px] text-[#8a5a12] mt-0.5 break-all">{(e.detail?.sample ?? []).join(' · ')}{(e.detail?.count ?? 0) > (e.detail?.sample?.length ?? 0) ? ' …' : ''}</span></span>;
  } else if (e.kind === 'ingested') {
    icon = FolderUp;
    tone = 'bg-[#1e4d6b] text-white';
    const ds: any[] = e.detail?.datasets ?? [];
    title = `Survey package attached · ${ds.length} datasets`;
    detail = (
      <span className="flex flex-wrap gap-1 mt-1">
        {ds.map((d) => <span key={d.slot} className="b3-chip b3-chip-plain" title={d.name}>{d.title} · {fmtBytes(d.size_bytes ?? 0)}</span>)}
      </span>
    );
  } else {
    const d = describe(e.detail);
    icon = d.icon;
    title = d.title;
    detail = d.detail;
    tone = 'bg-[#c8962e] text-white';
  }
  const Icon = icon;
  return (
    <li className="relative pl-12 pb-5 group">
      <span className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-[#f3efe6] ${tone} transition-transform duration-500 group-hover:scale-110`}>
        <Icon className="w-4 h-4" />
      </span>
      <div className="b3-card p-3.5 transition-transform duration-500 group-hover:translate-x-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold text-[13px] text-[#1b3344]">{title}</span>
          {e.seq !== undefined && <span className="font-mono text-[10.5px] text-[#9aa6ae]">#{e.seq}</span>}
          <span className="ml-auto text-[11px] text-[#7d8c97]" title={e.at ? new Date(e.at * 1000).toLocaleString('en-IN') : ''}>{fmtAgo(e.at)}</span>
        </div>
        <div className="text-[11.5px] text-[#5c6e7c] mt-0.5">
          {showPlace && <b className="text-[#33495a]">{e.place}</b>}{showPlace && ' · '}{e.by ? `by ${e.by}` : 'by the generator'}
        </div>
        {detail && <div className="text-[12px] text-[#33495a] mt-1.5">{detail}</div>}
        <button className="mt-2 text-[11.5px] font-semibold text-[#1f7a72] inline-flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity" onClick={onOpen}>
          <Box className="w-3.5 h-3.5" /> Open area in 3D
        </button>
      </div>
    </li>
  );
};

/** Append-only history: area generation, survey packages, and every surveyor edit, newest first. */
export const AuditPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const key = params.get('key') ?? '';
  const { data: scenes } = useScenes();
  const [kind, setKind] = useState('');
  const { data: events, isLoading } = useQuery({ queryKey: ['realgen', 'activity', key], queryFn: () => listActivity(key || undefined), staleTime: 10_000 });

  const shown = useMemo(() => (events ?? []).filter((e) => !kind || e.kind === kind), [events, kind]);
  const groups = useMemo(() => {
    const g: { day: string; items: ActivityEvent[] }[] = [];
    shown.forEach((e) => {
      const d = dayOf(e.at);
      const last = g[g.length - 1];
      if (last && last.day === d) last.items.push(e);
      else g.push({ day: d, items: [e] });
    });
    return g;
  }, [shown]);
  const n = (k: string) => (events ?? []).filter((e) => e.kind === k).length;

  return (
    <Page>
      <PageHeader eyebrow="Governance" title="Activity log"
        lead="Every change to the 3D land record is appended, never overwritten: who generated an area, which survey package was attached, and each surveyor edit. Undo removes the latest edit; the history of the rest stays."
        actions={<AreaSelect allowAll value={key} scenes={scenes} onChange={(k) => setParams(k ? { key: k } : {})} />} />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 b3-stagger">
        <StatTile label="Areas generated" value={events ? n('generated') : undefined} onClick={() => setKind(kind === 'generated' ? '' : 'generated')} />
        <StatTile label="Packages attached" value={events ? n('ingested') : undefined} accent="#1e4d6b" onClick={() => setKind(kind === 'ingested' ? '' : 'ingested')} />
        <StatTile label="Surveyor edits" value={events ? n('edit') : undefined} accent="#c8962e" onClick={() => setKind(kind === 'edit' ? '' : 'edit')} />
        <StatTile label="3D ULPIN lifecycle events" value={events ? n('lifecycle') : undefined} accent="#8a5a12" onClick={() => setKind(kind === 'lifecycle' ? '' : 'lifecycle')} />
      </section>

      <Segmented value={kind} onChange={setKind} className="b3-rise b3-d3" options={[
        { value: '', label: 'Everything' }, { value: 'edit', label: 'Edits' }, { value: 'lifecycle', label: '3D ULPIN lifecycle' }, { value: 'ingested', label: 'Survey packages' }, { value: 'generated', label: 'Generation' },
      ]} />

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : groups.length === 0 ? (
        <EmptyState icon={<History className="w-6 h-6" />} title="No activity yet">Generate an area or edit one in the 3D editor; each change is recorded here.</EmptyState>
      ) : (
        <div className="space-y-6" key={`${key}${kind}`}>
          {groups.map((g, gi) => (
            <section key={g.day} className="b3-rise" style={{ animationDelay: `${0.05 + gi * 0.06}s` }}>
              <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5c6e7c] mb-3">{g.day}</h3>
              <ol className="relative before:absolute before:left-4 before:top-2 before:bottom-4 before:w-px before:bg-[#d9cdb8] b3-stagger">
                {g.items.slice(0, 200).map((e, i) => (
                  <EventRow key={`${e.key}-${e.kind}-${e.seq ?? i}-${e.at}`} e={e} showPlace={!key} onOpen={() => navigate(`/3d-world/${e.key}`)} />
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
};

export default AuditPage;

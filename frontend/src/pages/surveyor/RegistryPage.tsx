import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Box, Check, Copy, Fingerprint, GitBranch, Loader2, Search, ShieldCheck, X } from 'lucide-react';
import { getLineage, searchAllRegistries, searchRegistry } from '../../world/api';
import type { RegistryHit } from '../../world/sceneSpec';
import { AreaSelect, EmptyState, Page, PageHeader, StatTile, fmtWhen, placeOf, useScenes } from '../../survey/ui';
import { Segmented } from '../../world/ui';
import { parseId, ppmToPct, statusOf, USAGE_CLASS } from '../../survey/norms';

const AXIOMS: Record<string, string> = {
  axiom1_closed_solid: 'Axiom 1 · closed solid, positive volume',
  axiom2_disjoint: 'Axiom 2 · no shared interior volume',
  axiom3_asset_conflict: 'Axiom 3 · INF envelope vs unit / basement / deck',
  axiom5_footprint_in_parcel: 'Axiom 5 · footprint inside its 2D parcel',
  axiom6_uds_closure: 'Axiom 6 · UDS sums to 1,000,000 ppm',
  identifier_syntax: 'Identifier syntax (Section 3 patterns)',
  uniqueness: 'Uniqueness · no ID issued twice',
};

/** An identifier split into its labelled segments. */
const IdAnatomy: React.FC<{ id: string; compact?: boolean }> = ({ id, compact }) => {
  const { segments } = parseId(id);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div>
      <div className="flex flex-wrap items-center font-mono text-[15px] font-semibold">
        {segments.map((s, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-[#c9bda8] px-0.5">-</span>}
            <span onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              className="rounded px-1 py-0.5 transition-all duration-300 cursor-default"
              style={{ color: s.color, background: hover === i ? `${s.color}1f` : 'transparent', transform: hover === i ? 'translateY(-2px)' : 'none' }}>
              {s.value}
            </span>
          </React.Fragment>
        ))}
      </div>
      {!compact && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1.5 mt-3">
          {segments.map((s, i) => (
            <div key={s.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              className={`text-[11px] leading-tight transition-opacity duration-300 ${hover !== null && hover !== i ? 'opacity-40' : ''}`}>
              <div className="font-bold" style={{ color: s.color }}>{s.label} · <span className="font-mono">{s.value}</span></div>
              <div className="text-[#7d8c97]">{s.note}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const useDebounced = <T,>(v: T, ms = 250) => {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
};

type View = 'register' | 'lifecycle' | 'integrity';

/** 3D ULPIN registry under the proposed norms: active identities, their lifecycle, and the integrity checks. */
export const RegistryPage: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const key = params.get('key') ?? '';
  const { data: scenes } = useScenes();
  const meta = scenes?.find((s) => s.key === key);
  const [view, setView] = useState<View>('register');
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState('');
  const [limit, setLimit] = useState(100);
  const [sel, setSel] = useState<RegistryHit | null>(null);
  const [copied, setCopied] = useState(false);
  const dq = useDebounced(q);

  useEffect(() => { setLimit(100); }, [dq, status, key]);
  useEffect(() => { if (!key && view !== 'register') setView('register'); }, [key, view]);

  const { data, isFetching, isLoading } = useQuery({
    queryKey: ['registry', key, dq, status, limit],
    queryFn: async () => {
      if (key) {
        const r = await searchRegistry(key, dq, limit, status);
        return { ...r, items: r.items.map((e) => ({ ...e, key, place: meta ? placeOf(meta) : key })) as RegistryHit[] };
      }
      return searchAllRegistries(dq, limit, status);
    },
    placeholderData: keepPreviousData,
  });
  const lineage = useQuery({
    queryKey: ['lineage', key, dq], queryFn: () => getLineage(key, dq, '', 300), enabled: !!key && view === 'lifecycle',
  });

  const by = data?.by_status ?? {};
  const example = useMemo(() => sel?.vprid ?? data?.items.find((e) => e.vprid && !e.vprid.startsWith('INF-'))?.vprid ?? '07K3M9P2Q7R4TZ-BL01-L08-U804', [sel, data]);
  const openUnit = (e: RegistryHit) => navigate(`/3d-world/${e.key}?building=${encodeURIComponent(e.building_id)}&floor=${e.floor}&unit=${e.unit_index}`);
  const copy = async (v: string) => {
    try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* clipboard blocked */ }
  };

  return (
    <Page wide>
      <PageHeader eyebrow="3D land record · proposed norms B3D-PROP-2026-ULPIN-01 Rev 3" title="3D ULPIN registry"
        lead={<>One legal 3D space = one 3D ULPIN, a child of the unmodified 2D ULPIN: <span className="font-mono text-[#1b3344]">ULPIN-BL01-L08-U804</span>. Single-title houses stay 2D; lifts, stairs and corridors go to the Common Space Registry; units with an open failure or unverified AI geometry are not minted; IDs are never reused.</>}
        actions={<AreaSelect allowAll value={key} scenes={scenes} onChange={(k) => { setSel(null); setParams(k ? { key: k } : {}); }} />} />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 b3-stagger">
        <StatTile label="3D ULPINs minted" value={data ? (by.PROVISIONAL ?? 0) + (by.CERTIFIED_AS_BUILT ?? 0) : undefined} accent="#c8962e"
          icon={<Fingerprint className="w-4 h-4" />} hint="incl. INF-PUB public assets" onClick={() => setStatus('PROVISIONAL')} />
        <StatTile label="Pending" value={data ? by.PENDING ?? 0 : undefined} accent="#c0392b" hint="open failure: not minted" onClick={() => setStatus('PENDING')} />
        <StatTile label="2D ULPIN suffices" value={data ? by.NOT_REQUIRED_2D ?? 0 : undefined} hint="2D-Sufficiency Rule" onClick={() => setStatus('NOT_REQUIRED_2D')} />
        <StatTile label="AI proposals" value={data ? by.PROPOSAL ?? 0 : undefined} accent="#1e4d6b" hint="await surveyor verification" onClick={() => setStatus('PROPOSAL')} />
      </section>

      <section className="b3-card p-5 b3-rise b3-d3">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#5c6e7c]">{sel?.vprid ? 'Selected identity' : 'How a 3D ULPIN reads'}</div>
          <span className="text-[11px] text-[#7d8c97]">Display only: software never derives owner, use or status from the ID</span>
        </div>
        <IdAnatomy key={example} id={example} />
      </section>

      {key && (
        <Segmented<View> value={view} onChange={setView} className="b3-rise b3-d4" options={[
          { value: 'register', label: <><Fingerprint className="w-3.5 h-3.5" /> Active register</> },
          { value: 'lifecycle', label: <><GitBranch className="w-3.5 h-3.5" /> Lifecycle &amp; lineage</> },
          { value: 'integrity', label: <><ShieldCheck className="w-3.5 h-3.5" /> Integrity axioms</> },
        ]} />
      )}

      {view === 'integrity' && meta ? (
        <section className="b3-card p-5 b3-fade">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="b3-serif text-xl text-[#1b3344]">Topology validation · {placeOf(meta)}</h2>
            <span className="text-[11px] text-[#7d8c97]">zone {meta.zone ?? '—'} · eps_vol 0.001 m³ · plan tolerance 0.05 m²</span>
          </div>
          <p className="text-[12.5px] text-[#5c6e7c] mt-1">Any failure sends the affected building's new units to review (Pending). No unit with an open failure is minted (Section 8.3, step 6).</p>
          <div className="mt-4 space-y-2 b3-stagger">
            {Object.entries(meta.integrity ?? {}).map(([k, v]) => (
              <div key={k} className="b3-well p-3 flex items-start gap-3">
                <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${v.failures ? 'bg-[#c0392b] text-white' : 'bg-[#1f7a72] text-white'}`}>
                  {v.failures ? <X className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#1b3344]">{AXIOMS[k] ?? k}</div>
                  <div className="text-[11.5px] text-[#5c6e7c]">{v.checked.toLocaleString('en-IN')} checked · {v.failures ? `${v.failures} raised for review` : 'all pass'}</div>
                  {v.sample.length > 0 && <div className="text-[11px] font-mono text-[#c0392b] mt-1 break-all">{v.sample.join(' · ')}{v.failures > v.sample.length ? ' …' : ''}</div>}
                </div>
              </div>
            ))}
            {!meta.integrity && <p className="text-sm text-[#7d8c97]">Open this area once to run the checks.</p>}
          </div>
        </section>
      ) : view === 'lifecycle' && key ? (
        <section className="b3-card overflow-hidden b3-fade">
          <div className="p-4 flex flex-wrap items-center gap-3 border-b border-[#e4dccf]">
            <div className="text-[12.5px] text-[#33495a]">Every ID ever minted here. Partition or merger retires IDs and mints fresh ones with their parents; demolition marks them historical. <b>Never reused.</b></div>
            <div className="ml-auto flex gap-1.5 flex-wrap">
              {Object.entries(lineage.data?.by_status ?? {}).map(([s, n]) => <span key={s} className={`b3-chip ${statusOf(s).cls}`}>{statusOf(s).label} · {n}</span>)}
            </div>
          </div>
          {lineage.isLoading ? <div className="p-4 space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="b3-skel h-8" />)}</div> : (
            <div className="max-h-[60vh] overflow-auto b3-scroll">
              <table className="b3-table">
                <thead><tr><th>3D ULPIN</th><th>Status</th><th>Minted</th><th>Retired</th><th>Parents (lineage)</th><th className="text-right">Version</th></tr></thead>
                <tbody>
                  {(lineage.data?.items ?? []).map((u) => (
                    <tr key={u.id}>
                      <td className={`font-mono text-[12px] font-semibold whitespace-nowrap ${u.status === 'PROVISIONAL' || u.status === 'CERTIFIED_AS_BUILT' ? 'text-[#8a5a12]' : 'text-[#9aa6ae] line-through decoration-1'}`}>{u.id}</td>
                      <td><span className={`b3-chip ${statusOf(u.status).cls}`} title={u.retire_reason}>{statusOf(u.status).label}</span></td>
                      <td className="text-[11.5px] text-[#5c6e7c] whitespace-nowrap">{fmtWhen(u.minted_at)}</td>
                      <td className="text-[11.5px] text-[#5c6e7c] whitespace-nowrap">{u.retired_at ? fmtWhen(u.retired_at) : '—'}</td>
                      <td className="font-mono text-[10.5px] text-[#5c6e7c] max-w-[340px] truncate" title={u.parents.join(', ')}>{u.parents.length ? u.parents.join(', ') : '—'}</td>
                      <td className="text-right b3-num">v{u.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 b3-rise b3-d4">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-[#7d8c97] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="3D ULPIN, 2D ULPIN, INF ID, building id or name" className="b3-input !pl-8" />
              {isFetching && <Loader2 className="w-4 h-4 animate-spin text-[#1f7a72] absolute right-2.5 top-1/2 -translate-y-1/2" />}
            </div>
            <Segmented value={status} onChange={setStatus} options={[
              { value: '', label: 'All' }, { value: 'PROVISIONAL', label: 'Minted' }, { value: 'PENDING', label: 'Pending' },
              { value: 'NOT_REQUIRED_2D', label: '2D suffices' }, { value: 'PROPOSAL', label: 'AI proposals' },
            ]} />
            {data && <span className="text-xs text-[#7d8c97] ml-auto b3-num">{data.matches.toLocaleString('en-IN')} of {data.total.toLocaleString('en-IN')} rows</span>}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_380px] items-start">
            <div className="b3-card overflow-hidden b3-rise b3-d5">
              {isLoading ? (
                <div className="p-4 space-y-2">{Array.from({ length: 8 }, (_, i) => <div key={i} className="b3-skel h-9" />)}</div>
              ) : !data || data.items.length === 0 ? (
                <div className="p-6"><EmptyState title="Nothing matches">Try a building name, a 2D ULPIN, or part of a 3D ULPIN.</EmptyState></div>
              ) : (
                <div className="max-h-[62vh] overflow-auto b3-scroll">
                  <table className="b3-table">
                    <thead>
                      <tr><th>3D ULPIN</th>{!key && <th>Area</th>}<th>Building</th><th>Level</th><th>Unit</th><th className="text-right">m²</th><th>Status</th></tr>
                    </thead>
                    <tbody className={isFetching ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                      {data.items.map((e, i) => {
                        const st = statusOf(e.status);
                        const active = sel && sel.key === e.key && sel.building_id === e.building_id && sel.floor === e.floor && sel.unit_index === e.unit_index;
                        return (
                          <tr key={`${e.key}-${e.building_id}-${e.floor}-${e.unit_index}`} onClick={() => setSel(e)} className={`cursor-pointer ${active ? 'is-active' : ''}`}
                            style={i < 30 ? { animation: `b3-rise 0.5s cubic-bezier(.22,1,.36,1) ${i * 0.012}s both` } : undefined}>
                            <td className="font-mono text-[12px] font-semibold text-[#8a5a12] whitespace-nowrap">{e.vprid ?? <span className="text-[#9aa6ae] font-normal">— not minted</span>}</td>
                            {!key && <td className="text-[#5c6e7c] whitespace-nowrap">{e.place}</td>}
                            <td><div className="font-medium truncate max-w-[220px]">{e.building_name}</div><div className="text-[10.5px] text-[#7d8c97] font-mono">{e.building_id}</div></td>
                            <td className="font-mono">{e.level ?? (e.floor === 0 ? 'L00' : `L${String(e.floor).padStart(2, '0')}`)}</td>
                            <td className="font-mono">{e.unit_code ?? '—'}</td>
                            <td className="text-right b3-num">{e.area_m2}</td>
                            <td><span className={`b3-chip ${st.cls}`} title={e.reason ?? st.hint}>{st.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {data.matches > data.items.length && (
                    <div className="p-3 text-center border-t border-[#e4dccf]">
                      <button className="b3-btn" disabled={isFetching || limit >= 500} onClick={() => setLimit((l) => Math.min(500, l + 100))}>
                        {limit >= 500 ? 'Refine the search to see more' : `Show more (${(data.matches - data.items.length).toLocaleString('en-IN')} left)`}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside className="xl:sticky xl:top-6">
              {sel ? (
                <div key={`${sel.key}${sel.building_id}${sel.floor}${sel.unit_index}`} className="b3-card p-5 space-y-3 b3-drawer">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="b3-eyebrow">{sel.place}</div>
                      <div className="b3-serif text-lg leading-tight mt-0.5">{sel.building_name}</div>
                      <div className="text-[11px] text-[#7d8c97] font-mono">{sel.building_id} · parent 2D ULPIN {sel.ulpin}</div>
                    </div>
                    <button onClick={() => setSel(null)} className="text-[#5c6e7c] hover:text-[#1b3344]"><X className="w-4 h-4" /></button>
                  </div>
                  {sel.vprid ? <IdAnatomy id={sel.vprid} compact /> : (
                    <div className="text-[12.5px] bg-[#c0392b]/5 border border-[#c0392b]/20 rounded-lg p-2.5 text-[#33495a]">
                      <b className="text-[#c0392b]">{statusOf(sel.status).label}.</b> {sel.reason ?? statusOf(sel.status).hint}
                    </div>
                  )}
                  <div>
                    {([
                      ['Status', <span className={`b3-chip ${statusOf(sel.status).cls}`}>{statusOf(sel.status).label}</span>],
                      ['Level', sel.level ?? '—'], ['Unit', sel.unit_code ?? '—'],
                      ['Usage class', sel.usage_class ? `${sel.usage_class} · ${USAGE_CLASS[sel.usage_class] ?? ''}` : '—'],
                      ['Built-up area', `${sel.area_m2} m²`], ['Undivided land share', ppmToPct(sel.undivided_share_ppm)],
                      ['Geometry version', sel.version ? `v${sel.version}` : '—'],
                    ] as [string, React.ReactNode][]).map(([k, v]) => (
                      <div key={k} className="b3-row"><span>{k}</span><span className="font-medium text-right">{v}</span></div>
                    ))}
                  </div>
                  <button className="w-full b3-btn b3-btn-primary !py-2.5" onClick={() => openUnit(sel)}><Box className="w-4 h-4" /> Open in 3D</button>
                  {sel.vprid && (
                    <button className="w-full b3-btn" onClick={() => copy(sel.vprid!)}>
                      {copied ? <><Check className="w-4 h-4 text-[#1f7a72] b3-pop" /> Copied</> : <><Copy className="w-4 h-4" /> Copy 3D ULPIN</>}
                    </button>
                  )}
                </div>
              ) : (
                <div className="b3-card p-5 text-[12.5px] text-[#5c6e7c] leading-relaxed b3-rise b3-d5 space-y-2">
                  <div className="b3-serif text-lg text-[#1b3344]">When a 3D ULPIN is minted</div>
                  <p>Only for a space that is <b>spatially definable</b> (a closed solid), <b>legally recognisable</b> and <b>persistent</b>, and not covered by the 2D-Sufficiency Rule.</p>
                  <p>Never for a change of owner, tenant or use, internal rooms, common areas, or an unverified AI proposal. Select a row to decode it and open it in 3D.</p>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </Page>
  );
};

export default RegistryPage;

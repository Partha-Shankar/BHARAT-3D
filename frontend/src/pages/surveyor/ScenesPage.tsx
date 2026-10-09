import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Box, Loader2, MapPin, Pencil, Plus, Trash2, RefreshCw, AlertTriangle, Search, Fingerprint, ShieldAlert, FolderUp, Check, ArrowRight,
} from 'lucide-react';
import { deleteScene } from '../../world/api';
import type { SceneMeta } from '../../world/sceneSpec';
import { useSurveyDraft, readyCount } from '../../survey/draft';
import { DATASET_SLOTS } from '../../survey/datasets';
import { AreaThumb, EmptyState, Page, PageHeader, Skeleton, fmtAgo, placeOf, useCanEdit, useRoleBase, useScenes } from '../../survey/ui';
import { Segmented } from '../../world/ui';

type Sort = 'recent' | 'buildings' | 'findings';

const Stage: React.FC<{ ok: boolean; label: string; hint?: string }> = ({ ok, label, hint }) => (
  <span title={hint} className={`inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-full px-2 py-0.5 border ${
    ok ? 'text-[#1d6a52] bg-[#1f7a72]/8 border-[#1f7a72]/25' : 'text-[#7d8c97] bg-white/50 border-[#e4dccf]'}`}>
    {ok && <Check className="w-3 h-3" />}{label}
  </span>
);

/** Survey register: every generated area, with its pipeline status and quick actions. */
export const ScenesPage: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const base = useRoleBase();
  const canEdit = useCanEdit();
  const { data: items, isLoading, error: loadError, refetch, isFetching } = useScenes();
  const draft = useSurveyDraft((s) => s.draft);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<SceneMeta | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('recent');

  const shown = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const xs = (items ?? []).filter((m) => !ql || placeOf(m).toLowerCase().includes(ql) || m.key.includes(ql)
      || String((m.place as any).state ?? '').toLowerCase().includes(ql));
    return [...xs].sort((a, b) => sort === 'buildings' ? b.buildings - a.buildings : sort === 'findings' ? b.violations - a.violations : b.updated_at - a.updated_at);
  }, [items, q, sort]);

  const remove = async (m: SceneMeta) => {
    setBusy(m.key);
    try {
      await deleteScene(m.key);
      qc.setQueryData<SceneMeta[]>(['realgen', 'scenes'], (xs) => (xs ?? []).filter((x) => x.key !== m.key));
      qc.invalidateQueries({ queryKey: ['realgen'] });
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Delete failed.');
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  };

  return (
    <Page wide>
      <PageHeader eyebrow="Survey register" title="Surveyed areas"
        lead="Every area modelled on this server, from the polygon to its 3D record. Open it in 3D, correct it in the editor, look up its 3D ULPINs or review its findings."
        actions={<>
          <button onClick={() => refetch()} className="b3-btn"><RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh</button>
          {canEdit && <button onClick={() => navigate('/surveyor/area')} className="b3-btn b3-btn-primary"><Plus className="w-4 h-4" /> New survey</button>}
        </>} />

      <div className="flex flex-wrap items-center gap-3 b3-rise b3-d3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#7d8c97] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by place, state or key" className="b3-input !pl-8" />
        </div>
        <Segmented<Sort> value={sort} onChange={setSort} options={[
          { value: 'recent', label: 'Recent' }, { value: 'buildings', label: 'Most buildings' }, { value: 'findings', label: 'Most findings' },
        ]} />
        {items && <span className="text-xs text-[#7d8c97] ml-auto b3-num">{shown.length} of {items.length} areas</span>}
      </div>

      {(error || loadError) && (
        <div className="text-sm text-[#c0392b] bg-[#c0392b]/5 border border-[#c0392b]/25 rounded-xl p-3 flex gap-2 b3-pop">
          <AlertTriangle className="w-4 h-4" /> {error || 'Could not load the register. Is the API running?'}
        </div>
      )}

      {canEdit && draft && (
        <div className="b3-card p-4 flex flex-wrap items-center gap-4 !border-[#c8962e]/40 bg-[#fffaf0] b3-pop">
          <div className="w-10 h-10 rounded-xl bg-[#c8962e]/15 text-[#8a5a12] flex items-center justify-center"><FolderUp className="w-5 h-5" /></div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold text-[#1b3344]">{draft.place || 'Selected area'} · awaiting survey data</div>
            <div className="text-xs text-[#5c6e7c]">{(draft.areaM2 / 1e6).toFixed(3)} km² · {readyCount(draft, DATASET_SLOTS.length)} of {DATASET_SLOTS.length} datasets attached</div>
          </div>
          <button className="b3-btn b3-btn-gold" onClick={() => navigate('/surveyor/upload')}>Continue ingestion <ArrowRight className="w-4 h-4" /></button>
        </div>
      )}

      {isLoading && <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-72" />)}</div>}

      {items && items.length === 0 && (
        <EmptyState icon={<MapPin className="w-6 h-6" />} title="No areas yet"
          action={canEdit ? <button className="b3-btn b3-btn-teal" onClick={() => navigate('/surveyor/area')}><Plus className="w-4 h-4" /> Survey an area</button> : undefined}>
          Draw an area anywhere in India, or click a spot on the map; its 3D record appears here.
        </EmptyState>
      )}
      {items && items.length > 0 && shown.length === 0 && <EmptyState title="No area matches" >Try another place name.</EmptyState>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 b3-stagger">
        {shown.map((m) => (
          <article key={m.key} className="b3-card is-hoverable overflow-hidden flex flex-col">
            <button className="relative block" onClick={() => navigate(`/3d-world/${m.key}`)} title="Open in 3D">
              <AreaThumb meta={m} className="h-36" />
              <span className="absolute top-2 left-2 b3-chip !bg-[#1b3344]/75 !text-white !border-transparent backdrop-blur-sm">{(m.area_m2 / 1e6).toFixed(3)} km²</span>
              {m.edits_count > 0 && <span className="absolute top-2 right-2 b3-chip b3-chip-edit !bg-[#fffaf0]">{m.edits_count} edit(s)</span>}
            </button>
            <div className="p-4 space-y-3 flex-1 flex flex-col">
              <div>
                <div className="b3-serif text-lg text-[#1b3344] leading-tight">{placeOf(m)}</div>
                <div className="text-[11px] text-[#7d8c97] font-mono">{m.origin.lat.toFixed(4)}°N {m.origin.lon.toFixed(4)}°E · {m.place.state_code ?? ''} · updated {fmtAgo(m.updated_at)}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Stage ok label="Delineated" />
                <Stage ok={(m.datasets ?? 0) > 0} label={(m.datasets ?? 0) > 0 ? `${m.datasets} datasets` : 'Open data only'}
                  hint={(m.datasets ?? 0) > 0 ? 'Survey package attached at ingestion' : 'Generated before ingestion was added'} />
                <Stage ok label="3D reconstructed" />
                <Stage ok={m.edits_count > 0} label={m.edits_count > 0 ? `${m.edits_count} surveyor edit(s)` : 'No edits yet'} />
              </div>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {([['Buildings', m.buildings], ['3D ULPINs', m.vprids_reserved], ['Subsurface', m.subsurface_assets], ['Findings', m.violations]] as [string, number][]).map(([k, v]) => (
                  <div key={k} className="b3-well py-1.5">
                    <div className={`font-bold b3-num text-[14px] ${k === 'Findings' && v ? 'text-[#c0392b]' : 'text-[#1b3344]'}`}>{(v ?? 0).toLocaleString('en-IN')}</div>
                    <div className="text-[9.5px] text-[#5c6e7c] uppercase tracking-wider">{k}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-auto pt-1">
                <button onClick={() => navigate(`/3d-world/${m.key}`)} className="flex-1 b3-btn b3-btn-primary"><Box className="w-4 h-4" /> Open 3D</button>
                {canEdit && <button onClick={() => navigate(`/3d-editor/${m.key}`)} className="b3-btn b3-btn-gold" title="Edit in 3D"><Pencil className="w-4 h-4" /></button>}
                <button onClick={() => navigate(`${base}/registry?key=${m.key}`)} className="b3-btn" title="3D ULPIN registry"><Fingerprint className="w-4 h-4" /></button>
                <button onClick={() => navigate(`${base}/violations?key=${m.key}`)} className="b3-btn" title="Findings"><ShieldAlert className="w-4 h-4" /></button>
                {canEdit && (
                  <button onClick={() => setConfirm(m)} disabled={busy === m.key} className="b3-btn b3-btn-danger" title="Delete">
                    {busy === m.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {confirm && (
        <div className="fixed inset-0 bg-[#1b3344]/35 backdrop-blur-sm z-50 flex items-center justify-center p-4 b3-fade" onClick={() => setConfirm(null)}>
          <div className="b3-card p-6 max-w-md w-full space-y-3 b3-pop" onClick={(e) => e.stopPropagation()}>
            <h3 className="b3-serif text-xl text-[#1b3344]">Delete {placeOf(confirm)}?</h3>
            <p className="text-sm text-[#5c6e7c] leading-relaxed">This permanently removes the 3D model, satellite imagery, OSM snapshot, survey package record,
              {' '}{confirm.edits_count} edit(s) and {confirm.vprids_reserved.toLocaleString('en-IN')} reserved 3D ULPINs for this area. Surveying the same area again rebuilds it from scratch.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="b3-btn">Cancel</button>
              <button onClick={() => remove(confirm)} className="b3-btn !bg-[#c0392b] !text-white !border-[#c0392b]">Delete permanently</button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
};

export default ScenesPage;

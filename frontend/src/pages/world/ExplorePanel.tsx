import React, { useMemo, useState } from 'react';
import { AlertTriangle, Building2, Construction, Fingerprint, Loader2, Search } from 'lucide-react';
import { resolveId, searchRegistry } from '../../world/api';
import { Segmented } from '../../world/ui';
import type { RegistryEntry, SceneSpec } from '../../world/sceneSpec';
import { statusOf } from '../../survey/norms';

const TYPE_LABEL: Record<string, string> = {
  UNAUTHORIZED_EXTRA_FLOORS: 'Extra floors',
  NO_SANCTION_ON_RECORD: 'No sanction on record',
  FOOTPATH_ENCROACHMENT: 'Footpath encroachment',
  ROAD_ENCROACHMENT: 'Road encroachment',
  SETBACK_SHORTFALL: 'Setback shortfall',
  UNPERMITTED_CONSTRUCTION: 'Unpermitted construction',
};

interface Props {
  scene: SceneSpec;
  onBuilding: (id: string) => void;
  onFinding: (violationId: string) => void;
  onSite: (siteId: string) => void;
  onUnit: (buildingId: string, floor: number, unitIndex: number) => void;
}

export const ExplorePanel: React.FC<Props> = ({ scene, onBuilding, onFinding, onSite, onUnit }) => {
  const [tab, setTab] = useState<'buildings' | 'findings' | 'vprid'>('buildings');
  const [q, setQ] = useState('');
  const [reg, setReg] = useState<{ total: number; matches: number; items: RegistryEntry[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const buildings = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return [...scene.buildings]
      .filter((b) => !ql || b.name.toLowerCase().includes(ql) || b.id.toLowerCase().includes(ql) || (b.ulpin ?? '').toLowerCase().includes(ql))
      .sort((a, b) => b.height - a.height);
  }, [scene, q]);

  const findings = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return scene.violations.filter((v) => !ql || (TYPE_LABEL[v.type] ?? v.type).toLowerCase().includes(ql) || (v.building_id ?? '').toLowerCase().includes(ql));
  }, [scene, q]);

  const runVprid = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (/^IN-[A-Z]{2}-/i.test(q.trim())) {
        const r = await resolveId(scene.key, q.trim().toUpperCase());
        if (r.kind === 'unit') onUnit(r.building_id, r.floor!, r.unit_index! - 1);
        else onBuilding(r.building_id);
        setMsg(`Found ${q.trim().toUpperCase()}`);
      }
      setReg(await searchRegistry(scene.key, q.trim(), 60));
    } catch (err: any) {
      setMsg(err?.response?.data?.detail || 'Not found');
    } finally {
      setBusy(false);
    }
  };

  const nameOf = (id: string | null) => (id ? scene.buildings.find((b) => b.id === id)?.name ?? id : 'Open site');

  return (
    <div className="space-y-2 text-xs">
      <Segmented value={tab} onChange={(v) => { setTab(v); setMsg(null); }} className="w-full [&>button]:flex-1 [&>button]:!px-1.5" options={[
        { value: 'buildings', label: 'Buildings' },
        { value: 'findings', label: `Findings ${scene.violations.length}` },
        { value: 'vprid', label: '3D ULPIN' },
      ]} />
      <form onSubmit={tab === 'vprid' ? runVprid : (e) => e.preventDefault()} className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[#5c6e7c]" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'vprid' ? '3D ULPIN, ULPIN or building name' : tab === 'findings' ? 'Filter findings' : 'Name, ID or ULPIN'}
          className="b3-input !pl-7 !text-xs" />
      </form>

      {tab === 'buildings' && (
        <div className="max-h-[46vh] overflow-y-auto space-y-0.5 pr-1 b3-scroll b3-stagger">
          <div className="text-[#7d8c97]">{buildings.length} of {scene.buildings.length} · tallest first</div>
          {buildings.map((b) => (
            <button key={b.id} onClick={() => onBuilding(b.id)} className="b3-list-item flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-[#1f7a72] shrink-0" />
              <span className="truncate flex-1 font-medium">{b.name}</span>
              <span className="font-mono text-[#5c6e7c]">{b.floors}F</span>
              <span title={b.identity_reason} className={`b3-chip !px-1.5 !text-[9px] ${b.identity_kind === 'STRATA' ? 'b3-chip-real' : b.identity_kind === 'SINGLE_TITLE' ? 'b3-chip-plain' : 'b3-chip-ai'}`}>
                {{ STRATA: '3D', SINGLE_TITLE: '2D', INF_PUB: 'INF', PROPOSAL: 'AI' }[b.identity_kind ?? ''] ?? b.identity ?? '3D'}
              </span>
              {b.violation_ids.length > 0 && <span className="b3-chip b3-chip-alert !px-1.5 !text-[9px]">{b.violation_ids.length}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === 'findings' && (
        <div className="max-h-[46vh] overflow-y-auto space-y-0.5 pr-1 b3-scroll b3-stagger">
          {Object.entries(scene.stats.violations_by_type ?? {}).map(([t, n]) => (
            <span key={t} className="b3-chip b3-chip-alert mr-1 mb-1">{TYPE_LABEL[t] ?? t}: {n as number}</span>
          ))}
          {findings.length === 0 && <div className="text-[#5c6e7c] py-2">No findings in this area.</div>}
          {findings.map((v) => (
            <button key={v.id} onClick={() => onFinding(v.id)} className="b3-list-item">
              <div className="flex items-center gap-1.5 font-semibold text-[#c0392b]"><AlertTriangle className="w-3.5 h-3.5" /> {TYPE_LABEL[v.type] ?? v.type} · {v.severity}</div>
              <div className="text-[#33495a] truncate">{nameOf(v.building_id)} — {v.observed}</div>
            </button>
          ))}
          {(scene.construction_sites ?? []).length > 0 && <div className="pt-2 text-[#5c6e7c] font-semibold uppercase tracking-wider text-[10px]">Construction sites (OSM)</div>}
          {(scene.construction_sites ?? []).map((s) => (
            <button key={s.id} onClick={() => onSite(s.id)} className="b3-list-item">
              <div className="flex items-center gap-1.5 font-semibold text-[#b4532a]"><Construction className="w-3.5 h-3.5" /> {s.name}</div>
              <div className="text-[#33495a]">{s.area_m2} m² · {s.permit_status === 'PERMITTED' ? `permit ${s.permit_no}` : 'no permit on record'}</div>
            </button>
          ))}
        </div>
      )}

      {tab === 'vprid' && (
        <div className="space-y-1.5">
          <p className="text-[#5c6e7c]">One legal 3D space = one 3D ULPIN (<span className="font-mono">ULPIN-BL01-L08-U804</span>). A single-title house or shop stays on its 2D ULPIN; tunnels, utilities, flyovers and public buildings get INF IDs.</p>
          <div className="grid grid-cols-4 gap-1 text-center">
            <div className="b3-well py-1.5"><div className="font-mono font-bold">{scene.stats.vprids_reserved ?? 0}</div><div className="text-[9px] text-[#5c6e7c]">3D ULPINs</div></div>
            <div className="b3-well py-1.5"><div className="font-mono font-bold">{scene.stats.volumes_on_hold ?? 0}</div><div className="text-[9px] text-[#5c6e7c]">pending</div></div>
            <div className="b3-well py-1.5"><div className="font-mono font-bold">{scene.stats.inf_assets ?? 0}</div><div className="text-[9px] text-[#5c6e7c]">INF IDs</div></div>
            <div className="b3-well py-1.5"><div className="font-mono font-bold">{(scene.stats.buildings_2d_only ?? 0) + (scene.stats.parcels_open_land ?? 0)}</div><div className="text-[9px] text-[#5c6e7c]">2D only</div></div>
          </div>
          <button onClick={() => runVprid()} className="w-full b3-btn b3-btn-primary">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Fingerprint className="w-3.5 h-3.5" />} Search registry
          </button>
          {msg && <div className="text-[#8a5a12]">{msg}</div>}
          {reg && (
            <div className="max-h-[34vh] overflow-y-auto space-y-0.5 pr-1 b3-scroll b3-stagger">
              <div className="text-[#7d8c97]">{reg.matches} match(es) of {reg.total} volumes</div>
              {reg.items.map((e, i) => (
                <button key={i} onClick={() => onUnit(e.building_id, e.floor, e.unit_index - 1)} className="b3-list-item !py-1.5">
                  <div className={`font-mono text-[10px] break-all ${e.vprid ? 'text-[#8a5a12]' : 'text-[#5c6e7c]'}`}>{e.vprid ?? `${statusOf(e.status).label}${e.status === 'NOT_REQUIRED_2D' ? ` · ${e.ulpin}` : ''}`}</div>
                  <div className="text-[#5c6e7c] truncate">{e.building_name} · {e.level ?? `floor ${e.floor}`} · {e.unit_code ?? e.unit_no} · {e.area_m2} m²</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExplorePanel;

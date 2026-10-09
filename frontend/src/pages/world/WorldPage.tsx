import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Box, Building2, ChevronDown, ChevronUp, Compass, Database, Eye, Info, Layers, Loader2, Mountain, Navigation2,
  Pickaxe, ScanLine, Sun, TrainFront, X, AlertTriangle, CheckCircle2, MapPin, Search, Pencil, Route, FolderOpen,
} from 'lucide-react';
import { applyEdits, checkExcavation, getBuildingDetail, getScene, resetEdits, textureUrl, undoEdit } from '../../world/api';
import type { BuildingDetail, EditOp, ExcavationResult, SceneSpec, XY } from '../../world/sceneSpec';
import { LayerState, Preset, ViewMode, ViewState, WorldViewer } from '../../world/viewer';
import { ASSET_STYLE } from '../../world/buildWorld';
import { ExplorePanel } from './ExplorePanel';
import { EditSel, EditorPanel } from './EditorPanel';
import { FloorPlanSvg } from './FloorPlanSvg';
import { useAuthStore } from '../../stores/authStore';
import { CountUp, Segmented, SourceChip, StrataLoader } from '../../world/ui';
import { useRoleBase } from '../../survey/ui';
import { IDENTITY, USAGE_CLASS, ppmToPct, statusOf } from '../../survey/norms';

const USAGE: Record<string, string> = { R: 'Residential', C: 'Commercial', M: 'Mixed use', I: 'Industrial', P: 'Public / institutional' };

const Badge: React.FC<{ src: string }> = ({ src }) => <SourceChip src={src} />;

const Row: React.FC<{ k: string; v: React.ReactNode; mono?: boolean }> = ({ k, v, mono }) => (
  <div className="b3-row">
    <span>{k}</span>
    <span className={`text-right ${mono ? 'font-mono text-[11px] break-all' : 'font-medium'}`}>{v}</span>
  </div>
);

const TYPE_LABEL: Record<string, string> = {
  UNAUTHORIZED_EXTRA_FLOORS: 'Extra floors', NO_SANCTION_ON_RECORD: 'No sanction on record', FOOTPATH_ENCROACHMENT: 'Footpath encroachment',
  ROAD_ENCROACHMENT: 'Road encroachment', SETBACK_SHORTFALL: 'Setback shortfall', UNPERMITTED_CONSTRUCTION: 'Unpermitted construction',
};

export const WorldPage: React.FC<{ editor?: boolean }> = ({ editor = false }) => {
  const { key = '' } = useParams();
  const [params] = useSearchParams();
  const projectId = params.get('project_id') || 'proj-001';
  const navigate = useNavigate();
  const location = useLocation();
  const roleBase = useRoleBase();
  const backToRegister = () => (location.key !== 'default' ? navigate(-1) : navigate(`${roleBase}/projects`));
  const { user } = useAuthStore();
  const canEdit = ['SURVEYOR', 'ADMIN'].includes(String(user?.role));
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<WorldViewer | null>(null);
  const viewState = useRef<ViewState | null>(null);

  const [scene, setScene] = useState<SceneSpec | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [viewerGen, setViewerGen] = useState(0);
  // opens in X-ray with the ground at 40% and an early-morning sun (06:30), so the subsurface reads at once
  const [mode, setMode] = useState<ViewMode>('xray');
  const [layers, setLayers] = useState<LayerState>({
    buildings: true, trees: true, decks: true, parcels: false, footpaths: true, boundary: true, subsurface: true, violations: false, labels: true,
  });
  const [groundOpacity, setGroundOpacity] = useState(0.4);
  const [cut, setCut] = useState(1);
  const [hour, setHour] = useState(6.5);
  const [heading, setHeading] = useState(0);
  const [depth, setDepth] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<'explore' | 'layers'>('explore');
  const [sel, setSel] = useState<EditSel>(null);
  const [detail, setDetail] = useState<BuildingDetail | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [unit, setUnit] = useState<number | null>(null);
  const [digOn, setDigOn] = useState(false);
  const [digDepth, setDigDepth] = useState(2.0);
  const [trench, setTrench] = useState<XY[] | null>(null);
  const [dig, setDig] = useState<ExcavationResult | null>(null);
  const [digBusy, setDigBusy] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [rightTab, setRightTab] = useState<'edit' | 'inspect'>('edit');
  const pendingFocus = useRef<{ x: number; y: number; h: number } | null>(null);
  const deepLinked = useRef(false);

  useEffect(() => {
    getScene(key).then(setScene).catch((e) => setError(e?.response?.data?.detail || 'Could not load the generated scene.'));
  }, [key]);

  // (Re)create the 3D world whenever the scene changes (initial load and after every edit), keeping the camera.
  useEffect(() => {
    if (!scene || !host.current) return;
    setReady(false);
    const v = new WorldViewer(host.current, scene, {
      onPick: (p) => {
        if (!p) {
          setSel(null);
          return;
        }
        if (p.kind === 'unit') {
          setUnit(p.unit);
          return;
        }
        setFloor(null);
        setUnit(null);
        setDetail(null);
        if (p.kind === 'building') setSel({ kind: 'building', id: scene.buildings[p.index].id });
        else if (p.kind === 'subsurface') setSel({ kind: 'subsurface', id: scene.subsurface[p.index].id });
        else if (p.kind === 'road') setSel({ kind: 'road', id: p.id });
      },
      onTrench: (poly) => setTrench(poly),
      onCamera: (h, d) => {
        setHeading(Math.round(h));
        setDepth(Math.round(d * 10) / 10);
      },
      onReady: () => {
        setReady(true);
        setViewerGen((g) => g + 1);
      },
    });
    viewer.current = v;
    if (import.meta.env.DEV) (window as any).__b3d = v;
    v.load(textureUrl(scene, 'texture'), scene.context_texture ? textureUrl(scene, 'context') : undefined)
      .then(() => {
        if (viewState.current) v.setView(viewState.current);
        v.setMode(mode);
      })
      .catch((e) => setError(`3D scene failed to load: ${e?.message || e}`));
    return () => {
      const vs = v.getView();
      if (vs) viewState.current = vs;
      v.dispose();
      viewer.current = null;
    };
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (ready) viewer.current?.setLayers(layers); }, [layers, ready, mode, viewerGen]);
  useEffect(() => { if (ready) viewer.current?.setSectionCut(cut); }, [cut, ready, viewerGen]);
  useEffect(() => { if (ready) viewer.current?.setSunTime(hour); }, [hour, ready, viewerGen]);

  const changeMode = (m: ViewMode) => {
    setMode(m);
    viewer.current?.setMode(m);
    setGroundOpacity(m === 'surface' ? 1 : m === 'xray' ? 0.4 : 0.16);
    if (m === 'underground') viewer.current?.preset('underground');
    if (m !== 'surface') setLayers((l) => ({ ...l, subsurface: true, labels: true }));
  };

  const bIndex = sel?.kind === 'building' && scene ? scene.buildings.findIndex((b) => b.id === sel.id) : -1;
  const building = bIndex >= 0 && scene ? scene.buildings[bIndex] : null;
  const asset = sel?.kind === 'subsurface' && scene ? scene.subsurface.find((a) => a.id === sel.id) ?? null : null;
  const road = sel?.kind === 'road' && scene ? scene.roads.find((r) => r.id === sel.id) ?? scene.railways.find((r) => r.id === sel.id) as any : null;

  // Building selection -> highlight + floors/units/plans
  useEffect(() => {
    if (!ready || !viewer.current) return;
    if (!building) {
      viewer.current.clearSelection();
      setDetail(null);
      return;
    }
    viewer.current.highlightBuilding(bIndex);
    if (pendingFocus.current) {
      viewer.current.focusOn(pendingFocus.current.x, pendingFocus.current.y, pendingFocus.current.h);
      pendingFocus.current = null;
    }
    let alive = true;
    getBuildingDetail(key, building.id).then((d) => alive && setDetail(d)).catch(() => undefined);
    return () => { alive = false; };
  }, [building?.id, scene, ready, viewerGen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!viewer.current || !building || !detail || detail.building.id !== building.id) return;
    if (floor === null) viewer.current.highlightBuilding(bIndex);
    else viewer.current.openBuilding(bIndex, detail, floor, unit);
  }, [floor, unit, detail]); // eslint-disable-line react-hooks/exhaustive-deps

  const violations = useMemo(() => (building && scene ? scene.violations.filter((v) => v.building_id === building.id) : []), [building, scene]);
  const floorData = detail?.floors.find((f) => f.floor === floor) ?? null;
  const unitData = floorData && unit !== null ? floorData.units[unit] : null;

  // ---------------- navigation helpers from Explore
  const goBuilding = (id: string, f: number | null = null, u: number | null = null) => {
    const b = scene?.buildings.find((x) => x.id === id);
    if (!b) return;
    pendingFocus.current = { x: b.centroid[0], y: b.centroid[1], h: b.height };
    if (sel?.kind === 'building' && sel.id === id) {
      viewer.current?.focusOn(b.centroid[0], b.centroid[1], b.height);
      pendingFocus.current = null;
    } else {
      setDetail(null);
    }
    setSel({ kind: 'building', id });
    setFloor(f);
    setUnit(u);
    if (mode === 'underground') changeMode('surface');
  };
  const goFinding = (vid: string) => {
    const v = scene?.violations.find((x) => x.id === vid);
    if (!v) return;
    setLayers((l) => ({ ...l, violations: true }));
    if (v.building_id) goBuilding(v.building_id, v.floors_flagged.length ? v.floors_flagged[0] : null, null);
    else if (v.location) viewer.current?.focusOn(v.location[0], v.location[1], 30);
  };
  const goSite = (sid: string) => {
    const s = scene?.construction_sites?.find((x) => x.id === sid);
    if (!s) return;
    setLayers((l) => ({ ...l, violations: true }));
    const c = s.polygon.reduce((a, p) => [a[0] + p[0] / s.polygon.length, a[1] + p[1] / s.polygon.length], [0, 0]);
    viewer.current?.focusOn(c[0], c[1], 35);
  };

  // ---------------- editing
  const runOps = async (ops: EditOp[]) => {
    setEditBusy(true);
    try {
      const prevIds = new Set(scene?.buildings.map((b) => b.id));
      const next = await applyEdits(key, ops);
      setScene(next);
      const added = next.buildings.find((b) => !prevIds.has(b.id));
      if (added) setSel({ kind: 'building', id: added.id });
      const addedAsset = ops.find((o) => o.op === 'asset.add') && next.subsurface[next.subsurface.length - 1];
      if (addedAsset) setSel({ kind: 'subsurface', id: addedAsset.id });
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Edit failed');
    } finally {
      setEditBusy(false);
    }
  };
  const runUndo = async () => { setEditBusy(true); try { setScene(await undoEdit(key)); } finally { setEditBusy(false); } };
  const runReset = async () => {
    if (!window.confirm('Discard every edit made to this area?')) return;
    setEditBusy(true);
    try { setScene(await resetEdits(key)); } finally { setEditBusy(false); }
  };
  useEffect(() => {
    if (editor && mode === 'surface' && sel?.kind === 'subsurface') changeMode('xray');
  }, [sel, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------- dig check
  const runDig = useCallback(async () => {
    if (!trench) return;
    setDigBusy(true);
    try {
      const r = await checkExcavation(key, trench, digDepth);
      setDig(r);
      viewer.current?.showTrench(trench, digDepth, r.clashes.filter((c) => c.clash_severity !== 'MEDIUM_RISK').map((c) => c.asset_id));
    } finally {
      setDigBusy(false);
    }
  }, [trench, digDepth, key]);
  useEffect(() => { if (trench) runDig(); }, [trench, digDepth]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDig = () => {
    const on = !digOn;
    setDigOn(on);
    viewer.current?.setDigMode(on);
    if (!on) {
      setTrench(null);
      setDig(null);
      viewer.current?.clearTrench();
    } else if (mode === 'surface') changeMode('xray');
  };

  // Deep links from the registry, findings and atlas: ?building=&floor=&unit=, ?finding=, ?vprid=, ?dig=1
  useEffect(() => {
    if (!ready || !scene || deepLinked.current) return;
    deepLinked.current = true;
    const b = params.get('building');
    const f = params.get('finding');
    if (f) goFinding(f);
    else if (b) {
      const fl = params.get('floor');
      const u = params.get('unit');
      goBuilding(b, fl !== null ? +fl : null, u !== null ? Math.max(0, +u - 1) : null); // unit_index is 1-based
    }
    if (params.get('dig') === '1' && !editor) toggleDig();
  }, [ready, scene]); // eslint-disable-line react-hooks/exhaustive-deps

  const goPreset = (p: Preset) => {
    if (p === 'selected' && building) {
      viewer.current?.preset('selected', 1200, { centroid: building.centroid, height: building.height, base: building.base_z });
    } else if (p === 'underground' && mode === 'surface') changeMode('underground');
    else viewer.current?.preset(p);
  };

  if (error && !scene) {
    return (
      <div className="h-screen bg-[#f3efe6] text-[#1b3344] b3-app flex flex-col items-center justify-center gap-4 p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-[#c8962e]" />
        <p className="max-w-md">{error}</p>
        <button className="b3-btn b3-btn-primary" onClick={() => navigate(`${roleBase}/projects`)}>Surveyed areas</button>
      </div>
    );
  }

  const stats = scene?.stats;
  const showRight = editor ? true : !!(building || asset || road || dig || digOn);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f3efe6] text-[#1b3344] b3-app relative select-none">
      <div ref={host} className="absolute inset-0" />

      {(!scene || !ready) && (
        <div className={`absolute inset-0 flex items-center justify-center z-30 ${scene ? 'bg-[#f3efe6]/70 backdrop-blur-sm' : 'bg-[#f3efe6]'} b3-fade`}>
          <StrataLoader title={scene ? 'Rebuilding the 3D world' : 'Assembling the survey area'}
            subtitle={scene ? 'Applying your edits, re-checking compliance and re-reserving 3D ULPINs' : 'Satellite terrain, buildings, flyovers and the subsurface network'} />
        </div>
      )}

      {/* top bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 b3-panel px-3 py-2 b3-rise">
          <button onClick={backToRegister} className="p-1 rounded hover:bg-white transition-transform duration-300 hover:-translate-x-0.5" title="Back"><ArrowLeft className="w-4 h-4" /></button>
          <div className="leading-tight">
            <div className="b3-serif text-[15px] flex items-center gap-2">
              {scene?.place.locality ?? 'Survey area'}{scene?.place.city ? `, ${scene.place.city}` : ''}
              {editor && <span className="text-[10px] bg-[#c8962e] text-white rounded px-1.5 py-0.5 font-bold">EDITOR</span>}
            </div>
            <div className="text-[10px] text-[#5c6e7c] font-mono">
              {scene ? `${scene.origin.lat.toFixed(5)}°N ${scene.origin.lon.toFixed(5)}°E · ${(stats?.area_m2 / 1e6).toFixed(3)} km² · ground ${scene.terrain.datum_msl_m} m MSL` : ''}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto b3-panel p-1 b3-rise b3-d1">
          <Segmented value={mode} onChange={changeMode} className="!bg-transparent" options={[
            { value: 'surface', label: <><Mountain className="w-3.5 h-3.5" /> Surface</> },
            { value: 'xray', label: <><ScanLine className="w-3.5 h-3.5" /> X-ray</> },
            { value: 'underground', label: <><TrainFront className="w-3.5 h-3.5" /> Underground</> },
          ]} />
        </div>

        <div className="pointer-events-auto flex b3-panel p-1 b3-rise b3-d2">
          {([['overview', 'Overview'], ['top', 'Top'], ['street', 'Street'], ['underground', 'Below ground']] as [Preset, string][]).map(([p, label]) => (
            <button key={p} onClick={() => goPreset(p)} className="b3-btn b3-btn-ghost !py-1.5 !px-2.5 !text-xs">{label}</button>
          ))}
        </div>

        {!editor && (
          <button onClick={toggleDig}
            className={`pointer-events-auto b3-btn !rounded-xl !py-2 b3-rise b3-d3 ${digOn ? '!bg-[#c0392b] !border-[#c0392b] !text-white' : '!bg-[#f7f4ed]/90'}`}>
            <Pickaxe className="w-3.5 h-3.5" /> Dig check
          </button>
        )}
        {canEdit && (
          <button onClick={() => navigate(editor ? `/3d-world/${key}` : `/3d-editor/${key}`, { replace: true })}
            className={`pointer-events-auto b3-btn !rounded-xl !py-2 b3-rise b3-d3 ${editor ? 'b3-btn-gold' : '!bg-[#f7f4ed]/90'}`}>
            <Pencil className="w-3.5 h-3.5" /> {editor ? 'Exit editor' : 'Edit area'}
          </button>
        )}

        {stats && (
          <div className="pointer-events-auto hidden xl:flex items-center gap-4 ml-auto b3-panel px-4 py-2 text-[11px] b3-rise b3-d4">
            {([['Buildings', stats.buildings, ''], ['3D ULPINs', stats.vprids_reserved ?? 0, ''], ['Subsurface', stats.subsurface_assets, ''], ['Findings', stats.violations, 'text-[#c0392b]']] as [string, number, string][]).map(([l, v, c]) => (
              <div key={l} className="leading-tight text-center">
                <CountUp value={v} className={`block text-sm font-bold ${c}`} />
                <span className="text-[10px] uppercase tracking-wider text-[#5c6e7c]">{l}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* left: explore / layers */}
      <div className="absolute left-3 top-24 z-20 w-72 b3-slide-l b3-d2">
        <div className="b3-panel">
          <div className="flex items-center justify-between px-2 pt-2">
            <div className="flex gap-1 text-xs font-bold">
              <Segmented value={leftTab} onChange={(v) => { setLeftTab(v); setPanelOpen(true); }} options={[
                { value: 'explore', label: <><Search className="w-3.5 h-3.5" /> Explore</> },
                { value: 'layers', label: <><Layers className="w-3.5 h-3.5" /> Layers & view</> },
              ]} />
            </div>
            <button onClick={() => setPanelOpen(!panelOpen)} className="p-1 text-[#5c6e7c]">{panelOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</button>
          </div>
          {panelOpen && scene && (
            <div className="p-3 b3-fade" key={leftTab}>
              {leftTab === 'explore' ? (
                <ExplorePanel scene={scene} onBuilding={(id) => goBuilding(id)} onFinding={goFinding} onSite={goSite}
                  onUnit={(id, f, u) => goBuilding(id, f, u)} />
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="space-y-1">
                    {([
                      ['buildings', 'Buildings'], ['trees', 'Trees'], ['decks', 'Flyovers & viaducts'], ['footpaths', 'Footpaths'], ['boundary', 'Survey boundary'],
                      ['parcels', 'Parcels (synthetic)'], ['violations', 'Findings & construction sites'], ['subsurface', 'Subsurface assets'], ['labels', 'Labels'],
                    ] as [keyof LayerState, string][]).map(([k, label]) => (
                      <label key={k} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} className="b3-check" />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <div>
                    <div className="flex justify-between text-[#5c6e7c]"><span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Ground opacity</span><span>{Math.round(groundOpacity * 100)}%</span></div>
                    <input type="range" min={0.05} max={1} step={0.01} value={groundOpacity}
                      onChange={(e) => { const o = +e.target.value; setGroundOpacity(o); viewer.current?.setGroundOpacity(o); }} className="b3-range" />
                  </div>
                  <div>
                    <div className="flex justify-between text-[#5c6e7c]"><span className="flex items-center gap-1"><ScanLine className="w-3 h-3" /> Section cut</span><span>{cut >= 0.999 ? 'off' : `${Math.round((1 - cut) * 100)}%`}</span></div>
                    <input type="range" min={0} max={1} step={0.005} value={cut} onChange={(e) => setCut(+e.target.value)} className="b3-range" style={{ direction: 'rtl' }} />
                  </div>
                  <div>
                    <div className="flex justify-between text-[#5c6e7c]"><span className="flex items-center gap-1"><Sun className="w-3 h-3" /> Time of day</span>
                      <span>{String(Math.floor(hour)).padStart(2, '0')}:{String(Math.round((hour % 1) * 60)).padStart(2, '0')}</span></div>
                    <input type="range" min={6.5} max={18.5} step={0.25} value={hour} onChange={(e) => setHour(+e.target.value)} className="b3-range" />
                  </div>
                  {mode !== 'surface' && (
                    <div className="space-y-1 pt-1 border-t border-[#e4dccf]">
                      {Object.entries(ASSET_STYLE).filter(([k]) => scene.subsurface.some((a) => a.kind === k)).map(([k, s]) => (
                        <div key={k} className="flex items-center gap-2 text-[11px]">
                          <span className="w-3 h-3 rounded-sm" style={{ background: s.color }} /> {s.label}
                          <span className="ml-auto text-[#7d8c97] font-mono">{scene.subsurface.filter((a) => a.kind === k).length}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* right panel */}
      {showRight && scene && (
        <div key={editor ? 'editor' : `${sel?.kind}-${sel?.id}-${digOn}`} className="absolute right-3 top-24 bottom-16 z-20 w-[380px] b3-panel flex flex-col overflow-hidden b3-slide-r">
          {editor && (
            <div className="p-2 border-b border-[#e4dccf]">
              <Segmented value={rightTab} onChange={(v) => setRightTab(v as "edit" | "inspect")} className="w-full [&>button]:flex-1" options={[
                { value: 'edit', label: <><Pencil className="w-3.5 h-3.5" /> Edit</> },
                { value: 'inspect', label: <><Info className="w-3.5 h-3.5" /> Inspect</> },
              ]} />
            </div>
          )}
          <div className="overflow-y-auto flex-1 b3-scroll">
            {editor && rightTab === 'edit' ? (
              <div className="p-4">
                <EditorPanel scene={scene} viewer={viewer.current} sel={sel} floor={floor} busy={editBusy}
                  onOps={runOps} onUndo={runUndo} onReset={runReset} onClearSel={() => setSel(null)} />
              </div>
            ) : digOn ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2"><Pickaxe className="w-4 h-4 text-[#c0392b]" /> Excavation dig check</h3>
                  <button onClick={toggleDig}><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-[#5c6e7c]">Click two points on the ground to lay a 1.5 m wide trench. Its depth is tested against every registered subsurface asset with its safety buffer.</p>
                <div>
                  <div className="flex justify-between text-xs text-[#5c6e7c]"><span>Trench depth</span><span className="font-mono">{digDepth.toFixed(1)} m</span></div>
                  <input type="range" min={0.5} max={20} step={0.1} value={digDepth} onChange={(e) => setDigDepth(+e.target.value)} className="b3-range" />
                </div>
                {digBusy && <p className="text-xs text-[#5c6e7c] flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Checking…</p>}
                {dig && (
                  <div className="space-y-2">
                    <div className={`rounded-lg p-3 text-sm font-bold ${dig.overall_risk_level === 'CRITICAL_RISK' ? 'bg-[#c0392b]/12 text-[#c0392b]' : dig.overall_risk_level === 'LOW_RISK' ? 'bg-[#1f7a72]/12 text-[#1d6a52]' : 'bg-[#c8962e]/15 text-[#8a5a12]'}`}>
                      {dig.overall_risk_level.replace('_', ' ')} · {dig.clashes_detected_count} asset(s) nearby
                    </div>
                    <p className="text-xs text-[#33495a]">{dig.recommendation}</p>
                    {dig.clashes.map((c) => (
                      <div key={c.asset_id} className="text-xs bg-white/55 rounded-lg p-2 space-y-0.5">
                        <div className="flex justify-between gap-2"><b className="truncate">{c.asset_name}</b><span className="shrink-0">{c.clash_severity.replace('_RISK', '')}</span></div>
                        <div className="text-[#5c6e7c] font-mono text-[10px]">depth {c.depth_meters} m · plan gap {c.plan_distance_meters} m · vertical {c.vertical_clearance_meters} m</div>
                        <Badge src={c.source} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : building ? (
              <>
                <div className="p-4 border-b border-[#e4dccf]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="b3-eyebrow mb-1">{USAGE_CLASS[building.usage_class ?? ''] ?? USAGE[building.usage]}</div>
                      <h3 className="b3-serif text-lg leading-tight flex items-center gap-2"><Building2 className="w-4 h-4 text-[#1f7a72] shrink-0" /> {building.name}</h3>
                      <p className="text-[11px] text-[#5c6e7c] font-mono mt-0.5">{building.id} · {building.osm_id === 'surveyor' ? 'added by surveyor' : building.osm_id === 'ai' ? 'AI-extracted' : `OSM ${building.osm_id}`}</p>
                    </div>
                    <button onClick={() => setSel(null)}><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge src={building.height_source} />
                    <Badge src={building.footprint_source} />
                    <span className={`b3-chip ${IDENTITY[building.identity_kind ?? '']?.cls ?? 'b3-chip-real'}`} title={building.identity_reason}>
                      {IDENTITY[building.identity_kind ?? '']?.label ?? (building.identity === '2D' ? '2D ULPIN suffices' : '3D ULPIN per unit')}
                    </span>
                    {violations.length > 0 && <span className="b3-chip b3-chip-alert">{violations.length} finding(s)</span>}
                  </div>
                </div>
                <div className="p-4 space-y-4 b3-stagger">
                  <div>
                    <Row k="Usage class" v={`${building.usage_class ?? building.usage} · ${USAGE_CLASS[building.usage_class ?? ''] ?? USAGE[building.usage]} (${building.building_type})`} />
                    <Row k="Height" v={`${building.height.toFixed(1)} m · ${building.floors} floor(s) × ${building.floor_height} m`} />
                    <Row k="Footprint" v={`${building.area_m2.toLocaleString()} m²`} />
                    <Row k="Parent 2D ULPIN" v={building.parent_parcel_ulpin ?? building.ulpin ?? '—'} mono />
                    {building.inf_id && <Row k="Public asset ID" v={building.inf_id} mono />}
                    {building.identity_kind === 'STRATA' && <Row k="Building number" v={building.building_no ?? `BL${String(building.block_no ?? 1).padStart(2, '0')}`} mono />}
                    <Row k="Identity rule" v={<span className="text-[11.5px]">{building.identity_reason ?? '—'}</span>} />
                    <Row k="Sanction" v={building.sanction_status === 'NOT_ON_RECORD' ? <span className="text-[#c0392b]">Not on record</span> : `G+${building.sanctioned_floors - 1} · ${building.sanctioned_height} m · ${building.permit_no}`} />
                    <Row k="Units / floor" v={building.units_per_floor} />
                    {building.basement_levels > 0 && <Row k="Basement" v={`${building.basement_levels} level(s)`} />}
                  </div>
                  {violations.map((v) => (
                    <div key={v.id} className="rounded-lg border border-[#c0392b]/30 bg-[#c0392b]/5 p-2.5 text-xs space-y-1">
                      <div className="font-bold text-[#c0392b] flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {TYPE_LABEL[v.type] ?? v.type} · {v.severity}</div>
                      <div>Required: {v.sanctioned}</div>
                      <div>Observed: {v.observed}</div>
                      <div className="text-[#5c6e7c]">Confidence: {v.measurement_confidence} · {v.basis}</div>
                    </div>
                  ))}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#33495a]">Floors · open the building</h4>
                      <button className="text-[11px] text-[#1f7a72]" onClick={() => goPreset('selected')}>Fly to</button>
                    </div>
                    {!detail ? <p className="text-xs text-[#7d8c97] flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading floors…</p> : (
                      <div className="grid grid-cols-6 gap-1">
                        {[...detail.floors].reverse().map((f) => (
                          <button key={f.floor} onClick={() => { setFloor(floor === f.floor ? null : f.floor); setUnit(null); }}
                            className={`text-[11px] py-1 rounded font-mono border ${floor === f.floor ? 'bg-[#1f7a72] border-[#1f7a72] text-white' : f.status === 'PENDING' ? 'bg-[#c0392b]/10 border-[#c0392b]/35 text-[#c0392b]' : 'bg-white/55 border-[#e4dccf] hover:bg-white'}`}>
                            {f.floor === 0 ? 'G' : f.floor}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {floorData && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#33495a]">{floorData.label} plan · {floorData.units.length} unit(s) · {floorData.h_min ?? floorData.z_min}–{floorData.h_max ?? floorData.z_max} m</h4>
                      <FloorPlanSvg footprint={building.footprint} floor={floorData} selected={unit} onSelect={setUnit} />
                      <div className="grid grid-cols-4 gap-1">
                        {floorData.units.map((u, i) => (
                          <button key={i} onClick={() => setUnit(i)}
                            className={`text-[11px] py-1 rounded font-mono border ${unit === i ? 'bg-[#c8962e] text-white border-[#c8962e]' : u.status === 'PENDING' ? 'bg-[#c0392b]/10 border-[#c0392b]/30' : 'bg-white/55 border-[#e4dccf]'}`}>
                            {u.unit_no}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {unitData && (
                    <div className="rounded-lg bg-white/55 border border-[#e4dccf] p-3">
                      <div className="text-[10px] uppercase tracking-wider text-[#5c6e7c] mb-1">{unitData.vprid ? '3D ULPIN' : 'Identity'}</div>
                      <div className={`font-mono text-[12px] break-all mb-1 ${unitData.vprid ? 'text-[#8a5a12]' : unitData.status === 'PENDING' ? 'text-[#c0392b]' : 'text-[#1b3344]'}`}>
                        {unitData.vprid ?? (unitData.status === 'NOT_REQUIRED_2D' ? `2D ULPIN ${building.ulpin}` : unitData.status === 'PART_OF_INF_PUB' ? building.inf_id : 'Not minted')}
                      </div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`b3-chip ${statusOf(unitData.status).cls}`}>{statusOf(unitData.status).label}</span>
                        <span className="text-[10.5px] text-[#7d8c97]">{unitData.reason ?? statusOf(unitData.status).hint}</span>
                      </div>
                      <Row k="Level · unit" v={`${unitData.level ?? ''} · ${unitData.unit_code ?? unitData.unit_no}`} mono />
                      <Row k="Built-up / carpet" v={`${unitData.built_up_m2} / ${unitData.carpet_m2} m²`} />
                      <Row k="Rooms" v={unitData.rooms.map((r) => r.name).join(', ') || '—'} />
                      <Row k="Volume" v={`${unitData.volume_m3} m³`} />
                      <Row k="Height band" v={`${unitData.h_min ?? unitData.z_min} – ${unitData.h_max ?? unitData.z_max} m above ground`} />
                      <Row k="Undivided land share" v={ppmToPct(unitData.uds_ppm)} />
                      <Row k="Owner" v={unitData.owner} />
                      <Row k="Occupancy" v={unitData.occupancy.replace(/_/g, ' ')} />
                      <Row k="Annual tax" v={`₹${unitData.annual_tax_inr.toLocaleString('en-IN')}`} />
                      <div className="mt-2"><Badge src="synthetic" /></div>
                    </div>
                  )}
                  {detail?.common_spaces && detail.common_spaces.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#33495a] mb-1">Common Space Registry · no 3D ULPIN</h4>
                      {detail.common_spaces.map((c) => (
                        <div key={c.id} className="b3-row"><span className="font-mono text-[10.5px] break-all">{c.id}</span><span className="text-right text-[11px]">{c.label} · {c.levels}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : asset ? (
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold flex items-center gap-2"><span className="w-3 h-3 rounded-sm shrink-0" style={{ background: ASSET_STYLE[asset.kind]?.color }} /> {asset.name}</h3>
                  <button onClick={() => setSel(null)}><X className="w-4 h-4" /></button>
                </div>
                <Badge src={asset.source} />
                {asset.inf_id ? <Row k="3D ULPIN (INF)" v={asset.inf_id} mono /> : <Row k="Asset ID" v={asset.id} mono />}
                <Row k="Type" v={ASSET_STYLE[asset.kind]?.label ?? asset.kind} />
                <Row k="Depth" v={asset.kind === 'basement' ? `${asset.depth_top_m} – ${asset.depth_m} m below ground` : `${asset.depth_m} m below ground (centre)`} />
                {asset.radius_m !== undefined && <Row k="Radius" v={`${asset.radius_m} m`} />}
                <Row k={asset.kind === 'metro' || asset.kind.endsWith('tunnel') ? 'Clearance envelope' : 'Buffer'} v={`${asset.buffer_m} m (configurable default)`} />
                {asset.tunnel_group && <Row k="Tunnel group" v={asset.tunnel_group} />}
                {asset.operator && <Row k="Operator" v={asset.operator} />}
                {asset.kind === 'basement' && <Row k="Register" v="Common parking (Common Space Registry), or part of the 2D column" />}
                {asset.affected_ulpins && asset.affected_ulpins.length > 0 && (
                  <Row k="Easement on" v={<span className="font-mono text-[10.5px]">{asset.affected_ulpins.length} parcel(s): {asset.affected_ulpins.slice(0, 3).join(', ')}{asset.affected_ulpins.length > 3 ? '…' : ''}</span>} />
                )}
                {asset.source === 'synthetic' && <p className="text-[11px] text-[#7a4f86] pt-1">Illustrative asset generated along the mapped road network; not a surveyed utility record.</p>}
                {asset.source === 'osm' && <p className="text-[11px] text-[#1d6a52] pt-1">Reconstructed from OpenStreetMap ({asset.kind === 'metro' ? 'railway=subway / tunnel' : 'tunnel=yes'}); depth estimated from the OSM layer.</p>}
              </div>
            ) : road ? (
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold flex items-center gap-2"><Route className="w-4 h-4 text-[#1f7a72]" /> {road.name || (road.is_bridge ? 'Flyover' : 'Road')}</h3>
                  <button onClick={() => setSel(null)}><X className="w-4 h-4" /></button>
                </div>
                <Badge src={road.source} />
                {road.inf_id ? <Row k="3D ULPIN (INF)" v={road.inf_id} mono /> : <Row k="ID" v={road.id} mono />}
                <Row k="Class" v={road.kind} />
                <Row k="Deck height" v={`${road.elevation_m} m above ground`} />
                {road.width_m && <Row k="Width" v={`${road.width_m} m`} />}
                {road.affected_ulpins && road.affected_ulpins.length > 0 && (
                  <Row k="Airspace easement on" v={<span className="font-mono text-[10.5px]">{road.affected_ulpins.length} parcel(s): {road.affected_ulpins.slice(0, 3).join(', ')}{road.affected_ulpins.length > 3 ? '…' : ''}</span>} />
                )}
                <p className="text-[11px] text-[#1d6a52] pt-1">Reconstructed from OpenStreetMap bridge/layer tags.</p>
              </div>
            ) : (
              <div className="p-4 text-xs text-[#5c6e7c]">Select something in the 3D world or from Explore.</div>
            )}
          </div>
        </div>
      )}

      {/* bottom-left: compass, depth, help */}
      <div className="absolute left-3 bottom-3 z-20 flex items-end gap-2 b3-rise b3-d4">
        <button onClick={() => viewer.current?.resetNorth()} title="Reset north"
          className="w-14 h-14 rounded-full b3-panel !rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
          <div style={{ transform: `rotate(${-heading}deg)` }}>
            <Navigation2 className="w-6 h-6 text-[#c0392b]" fill="currentColor" />
          </div>
        </button>
        <div className="b3-panel px-3 py-2 text-[11px] shadow-xl space-y-0.5">
          <div className="flex items-center gap-1.5"><Compass className="w-3 h-3" /> Heading <b className="font-mono">{heading}°</b></div>
          <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {depth > 0 ? <span className="text-[#8a5a12]">Camera <b className="font-mono">{depth} m</b> below ground</span> : 'Camera above ground'}</div>
        </div>
        <div className="hidden lg:block b3-panel px-3 py-2 text-[10px] text-[#5c6e7c] shadow-xl leading-relaxed">
          Drag pan · Right-drag rotate · Scroll zoom · Double-click fly to<br />
          W A S D move · Q E turn · R / F rise / dive underground
        </div>
      </div>

      {/* bottom-right: sources */}
      <div className="absolute right-3 bottom-3 z-20 max-w-md text-right b3-rise b3-d5">
        {showSources && scene && (
          <div className="mb-2 b3-panel p-3 text-left text-[11px] space-y-1.5 shadow-xl">
            <p className="text-[#33495a]">{scene.summary}</p>
            {scene.sources.map((s) => (
              <div key={s.layer} className="flex gap-2">
                {s.kind === 'real' ? <CheckCircle2 className="w-3.5 h-3.5 text-[#1f7a72] shrink-0" /> : s.kind === 'estimated' ? <Info className="w-3.5 h-3.5 text-[#c8962e] shrink-0" /> : <Box className="w-3.5 h-3.5 text-[#7a4f86] shrink-0" />}
                <span><b>{s.layer}:</b> <span className="text-[#5c6e7c]">{s.source}</span></span>
              </div>
            ))}
            {stats?.ml && <div className="text-[#7d8c97]">AI heights: {stats.ml.applied ? `applied to ${stats.ml.buildings_estimated} buildings (R² ${stats.ml.r2})` : `not applied — ${stats.ml.reason}`}</div>}
            {(scene.footpaths?.length ?? 0) > 0 && (
              <div className="text-[#7d8c97]">Footpaths: {scene.footpaths!.filter((f) => f.source === 'mapped').length} mapped in OpenStreetMap, {scene.footpaths!.filter((f) => f.source === 'assumed').length} assumed beside major roads · {Math.round(scene.footpaths!.reduce((a, f) => a + f.area_m2, 0)).toLocaleString('en-IN')} m²</div>
            )}
            <div className="text-[#7d8c97]">3D ULPIN: {stats?.vprids_reserved ?? 0} VPRIDs reserved in {stats?.buildings_3d_ulpin ?? 0} buildings · {stats?.buildings_2d_only ?? 0} buildings and {stats?.parcels_open_land ?? 0} open parcels stay 2D</div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={() => navigate(`${roleBase}/projects`)} className="b3-panel !rounded-lg px-2.5 py-1.5 text-[10px] text-[#33495a] shadow-xl inline-flex items-center gap-1.5">
            <FolderOpen className="w-3 h-3" /> Areas
          </button>
          <button onClick={() => setShowSources(!showSources)} className="b3-panel !rounded-lg px-2.5 py-1.5 text-[10px] text-[#33495a] shadow-xl inline-flex items-center gap-1.5">
            <Database className="w-3 h-3" /> Data sources · © OpenStreetMap contributors · {scene?.texture.attribution}
          </button>
        </div>
      </div>

      {error && scene && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 bg-[#c0392b] text-white text-xs b3-pop rounded-lg px-3 py-2 shadow-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error} <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
};

export default WorldPage;

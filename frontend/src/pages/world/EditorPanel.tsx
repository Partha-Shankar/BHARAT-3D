import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Building2, Check, Loader2, PenLine, Plus, RotateCcw, RotateCw, Route, Trash2,
  TrainFront, Undo2, X, Maximize2, Minimize2, ShieldCheck, BadgeCheck,
} from 'lucide-react';
import type { Building, EditOp, Road, SceneSpec, SubsurfaceAsset, XY } from '../../world/sceneSpec';
import type { WorldViewer } from '../../world/viewer';
import { FootprintTransform, IDENTITY, footprintSize, isIdentity, rectAround, transformFootprint, translatePath } from '../../world/editing';

export type EditSel = { kind: 'building'; id: string } | { kind: 'subsurface'; id: string } | { kind: 'road'; id: string } | null;

type Tool = null | 'add-building' | 'draw-tunnel' | 'add-flyover' | 'redraw';

interface Props {
  scene: SceneSpec;
  viewer: WorldViewer | null;
  sel: EditSel;
  floor: number | null;
  busy: boolean;
  onOps: (ops: EditOp[]) => Promise<void>;
  onUndo: () => void;
  onReset: () => void;
  onClearSel: () => void;
}

const Num: React.FC<{ label: string; value: number; step?: number; min?: number; max?: number; onChange: (v: number) => void; suffix?: string }> = ({
  label, value, step = 1, min, max, onChange, suffix,
}) => (
  <label className="flex items-center justify-between gap-2 text-xs">
    <span className="text-[#5c6e7c]">{label}</span>
    <span className="flex items-center gap-1">
      <input type="number" value={Number.isFinite(value) ? value : 0} step={step} min={min} max={max}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="b3-input !w-20 !py-1 !px-2 text-right b3-num" />
      {suffix && <span className="text-[#7d8c97] w-5">{suffix}</span>}
    </span>
  </label>
);

const Nudge: React.FC<{ onMove: (dx: number, dy: number) => void }> = ({ onMove }) => {
  const [step, setStep] = useState(2);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[#5c6e7c] w-12">Move</span>
      <div className="grid grid-cols-3 gap-0.5">
        <span />
        <button className="b3-btn !p-1 !rounded-md" title="North" onClick={() => onMove(0, step)}><ArrowUp className="w-3 h-3" /></button>
        <span />
        <button className="b3-btn !p-1 !rounded-md" title="West" onClick={() => onMove(-step, 0)}><ArrowLeft className="w-3 h-3" /></button>
        <span className="text-[9px] text-center text-[#5c6e7c] self-center">{step}m</span>
        <button className="b3-btn !p-1 !rounded-md" title="East" onClick={() => onMove(step, 0)}><ArrowRight className="w-3 h-3" /></button>
        <span />
        <button className="b3-btn !p-1 !rounded-md" title="South" onClick={() => onMove(0, -step)}><ArrowDown className="w-3 h-3" /></button>
        <span />
      </div>
      <select value={step} onChange={(e) => setStep(+e.target.value)} className="b3-input !w-auto !py-0.5 !px-1.5">
        {[0.5, 1, 2, 5, 10, 25].map((s) => <option key={s} value={s}>{s} m</option>)}
      </select>
    </div>
  );
};

export const EditorPanel: React.FC<Props> = ({ scene, viewer, sel, floor, busy, onOps, onUndo, onReset, onClearSel }) => {
  const [tool, setTool] = useState<Tool>(null);
  const [points, setPoints] = useState<XY[]>([]);
  const [tunnelDepth, setTunnelDepth] = useState(16);
  const [deckHeight, setDeckHeight] = useState(7);

  const building = sel?.kind === 'building' ? scene.buildings.find((b) => b.id === sel.id) ?? null : null;
  const asset = sel?.kind === 'subsurface' ? scene.subsurface.find((a) => a.id === sel.id) ?? null : null;
  const road = sel?.kind === 'road' ? scene.roads.find((r) => r.id === sel.id) ?? null : null;

  // ---------------- point tools (add building / draw tunnel / add flyover / redraw alignment)
  useEffect(() => {
    if (!viewer) return;
    if (!tool) {
      viewer.setPointTool(null);
      return;
    }
    viewer.setPointTool((p) => {
      if (tool === 'add-building') {
        setTool(null);
        onOps([{ op: 'building.add', building: { footprint: rectAround(p), floors: 4, usage: 'R', name: 'New building' } }]);
        return;
      }
      setPoints((pts) => [...pts, p]);
    });
    return () => viewer.setPointTool(null);
  }, [tool, viewer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!viewer || !tool || tool === 'add-building') return;
    viewer.showDraft(points, { color: tool === 'draw-tunnel' || (tool === 'redraw' && asset) ? '#facc15' : '#22d3ee' });
  }, [points, tool, viewer, asset]);

  const startTool = (t: Tool) => {
    setPoints([]);
    setTool(tool === t ? null : t);
  };

  const finishPath = async () => {
    if (points.length < 2) return;
    const pts = points;
    const t = tool;
    setTool(null);
    setPoints([]);
    if (t === 'draw-tunnel') await onOps([{ op: 'asset.add', asset: { kind: 'metro', path: pts, depth_m: tunnelDepth, radius_m: 3.1, buffer_m: 5, name: 'New metro alignment' } }]);
    if (t === 'add-flyover') await onOps([{ op: 'road.add', road: { kind: 'primary', path: pts, elevation_m: deckHeight, width_m: 12, name: 'New flyover' } }]);
    if (t === 'redraw' && asset) await onOps([{ op: 'asset.update', id: asset.id, set: { path: pts } }]);
    if (t === 'redraw' && road) await onOps([{ op: 'road.update', id: road.id, set: { path: pts } }]);
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-3 gap-1">
        <button onClick={() => startTool('add-building')} className={`b3-btn flex-col !py-2.5 ${tool === 'add-building' ? 'b3-btn-gold' : ''}`}>
          <Plus className="w-4 h-4" /> Building
        </button>
        <button onClick={() => startTool('draw-tunnel')} className={`b3-btn flex-col !py-2.5 ${tool === 'draw-tunnel' ? 'b3-btn-gold' : ''}`}>
          <TrainFront className="w-4 h-4" /> Metro tunnel
        </button>
        <button onClick={() => startTool('add-flyover')} className={`b3-btn flex-col !py-2.5 ${tool === 'add-flyover' ? 'b3-btn-gold' : ''}`}>
          <Route className="w-4 h-4" /> Flyover
        </button>
      </div>

      {tool === 'add-building' && <p className="text-[#8a5a12]">Click on the ground where the new building should stand (16 × 12 m, 4 floors; edit it after).</p>}
      {(tool === 'draw-tunnel' || tool === 'add-flyover' || tool === 'redraw') && (
        <div className="space-y-2 bg-[#c8962e]/10 border border-[#c8962e]/30 rounded-lg p-2">
          <p className="text-[#8a5a12]">Click points on the ground along the alignment ({points.length} so far), then Finish.</p>
          {tool === 'draw-tunnel' && <Num label="Depth below ground" value={tunnelDepth} step={0.5} min={3} max={40} suffix="m" onChange={setTunnelDepth} />}
          {tool === 'add-flyover' && <Num label="Deck height" value={deckHeight} step={0.5} min={4} max={30} suffix="m" onChange={setDeckHeight} />}
          <div className="flex gap-1">
            <button onClick={finishPath} disabled={points.length < 2} className="flex-1 b3-btn b3-btn-gold !py-1"><Check className="w-3.5 h-3.5 inline" /> Finish</button>
            <button onClick={() => setPoints((p) => p.slice(0, -1))} className="b3-btn !px-2 !py-1">Undo point</button>
            <button onClick={() => { setTool(null); setPoints([]); }} className="b3-btn !px-2 !py-1"><X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      <div className="flex gap-1">
        <button onClick={onUndo} disabled={busy || !scene.edits_count} className="flex-1 b3-btn"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
        <button onClick={onReset} disabled={busy || !scene.edits_count} className="flex-1 b3-btn"><RotateCcw className="w-3.5 h-3.5" /> Reset all</button>
        <span className="px-2 self-center text-[#5c6e7c]">{scene.edits_count ?? 0} edit(s)</span>
      </div>
      {busy && <p className="flex items-center gap-1.5 text-[#8a5a12]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving, then re-checking compliance and re-reserving VPRIDs…</p>}
      {(scene.edit_errors ?? []).length > 0 && <p className="text-[#c0392b]">{scene.edit_errors!.length} edit(s) could not be applied (object no longer exists).</p>}

      {!sel && !tool && <p className="text-[#5c6e7c]">Select a building, an underground asset (X-ray/Underground mode) or a flyover deck to edit it.</p>}
      {building && <BuildingForm key={`${building.id}-${scene.edits_count}`} b={building} floor={floor} viewer={viewer} busy={busy} onOps={onOps} onDone={onClearSel} />}
      {asset && <AssetForm key={`${asset.id}-${scene.edits_count}`} a={asset} viewer={viewer} busy={busy} onOps={onOps} onRedraw={() => startTool('redraw')} onDone={onClearSel} />}
      {road && <RoadForm key={`${road.id}-${scene.edits_count}`} r={road} viewer={viewer} busy={busy} onOps={onOps} onRedraw={() => startTool('redraw')} onDone={onClearSel} />}
    </div>
  );
};

// ------------------------------------------------------------------------------------------- building form
const USAGES: [string, string][] = [['R', 'Residential'], ['C', 'Commercial'], ['M', 'Mixed use'], ['I', 'Industrial'], ['P', 'Public']];

const BuildingForm: React.FC<{ b: Building; floor: number | null; viewer: WorldViewer | null; busy: boolean; onOps: Props['onOps']; onDone: () => void }> = ({
  b, floor, viewer, busy, onOps, onDone,
}) => {
  const [name, setName] = useState(b.name);
  const [usage, setUsage] = useState<string>(b.usage);
  const [floors, setFloors] = useState(b.floors);
  const [fh, setFh] = useState(b.floor_height);
  const [base, setBase] = useState(b.min_height);
  const [sanctioned, setSanctioned] = useState(b.sanctioned_floors);
  const [tenure, setTenure] = useState<string>(b.tenure ?? '');
  const [unitsAll, setUnitsAll] = useState<number>(b.unit_overrides?.all ?? b.units_per_floor);
  const [unitsFloor, setUnitsFloor] = useState<number | null>(floor !== null ? b.unit_overrides?.[String(floor)] ?? null : null);
  const [t, setT] = useState<FootprintTransform>(IDENTITY);
  const newFp = useMemo(() => transformFootprint(b.footprint, t), [b.footprint, t]);
  const [len, wid] = footprintSize(newFp);
  const height = Math.round((base + floors * fh + 0.6) * 100) / 100;

  useEffect(() => {
    viewer?.showDraft(isIdentity(t) ? [] : newFp, { closed: true, color: '#f59e0b' });
    return () => viewer?.showDraft([]);
  }, [newFp, t, viewer]);

  const apply = async () => {
    const set: Record<string, any> = {};
    if (name !== b.name) set.name = name;
    if (usage !== b.usage) set.usage = usage;
    if (floors !== b.floors) set.floors = Math.max(1, Math.round(floors));
    if (fh !== b.floor_height) set.floor_height = fh;
    if (base !== b.min_height) set.min_height = base;
    if (sanctioned !== b.sanctioned_floors) set.sanctioned_floors = Math.max(1, Math.round(sanctioned));
    if (tenure !== (b.tenure ?? '')) set.tenure = tenure || undefined;
    const overrides = { ...(b.unit_overrides ?? {}) };
    if (unitsAll !== (b.unit_overrides?.all ?? b.units_per_floor)) overrides.all = Math.max(1, Math.round(unitsAll));
    if (floor !== null && unitsFloor) overrides[String(floor)] = Math.max(1, Math.round(unitsFloor));
    if (JSON.stringify(overrides) !== JSON.stringify(b.unit_overrides ?? {})) set.unit_overrides = overrides;
    if (!isIdentity(t)) set.footprint = newFp;
    if (Object.keys(set).length) await onOps([{ op: 'building.update', id: b.id, set }]);
  };

  return (
    <div className="space-y-2 border-t border-[#e4dccf] pt-3 b3-fade">
      <div className="b3-serif text-base flex items-center gap-1.5"><Building2 className="w-4 h-4 text-[#c8962e]" /> Edit {b.id}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} className="b3-input" />
      <label className="flex items-center justify-between"><span className="text-[#5c6e7c]">Use</span>
        <select value={usage} onChange={(e) => setUsage(e.target.value)} className="b3-input !w-auto !py-1">
          {USAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <div className="b3-eyebrow pt-2">Measurements</div>
      <Num label="Floors" value={floors} min={1} max={150} onChange={setFloors} />
      <Num label="Floor-to-floor height" value={fh} step={0.1} min={2.6} max={8} suffix="m" onChange={setFh} />
      <Num label="Base height (stilts/podium)" value={base} step={0.5} min={0} max={60} suffix="m" onChange={setBase} />
      <div className="flex justify-between"><span className="text-[#5c6e7c]">Total height</span><b className="font-mono">{height} m</b></div>
      <div className="flex justify-between"><span className="text-[#5c6e7c]">Footprint (L × W)</span><b className="font-mono">{len.toFixed(1)} × {wid.toFixed(1)} m</b></div>
      <Nudge onMove={(dx, dy) => setT((s) => ({ ...s, dx: s.dx + dx, dy: s.dy + dy }))} />
      <div className="flex items-center gap-1">
        <span className="text-[#5c6e7c] w-12">Rotate</span>
        <button className="b3-btn !px-2 !py-1" onClick={() => setT((s) => ({ ...s, rot: s.rot + 5 }))}><RotateCcw className="w-3 h-3" /></button>
        <button className="b3-btn !px-2 !py-1" onClick={() => setT((s) => ({ ...s, rot: s.rot - 5 }))}><RotateCw className="w-3 h-3" /></button>
        <span className="font-mono text-[#5c6e7c]">{t.rot}°</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-[#5c6e7c] w-12">Length</span>
        <button className="b3-btn !px-2 !py-1" onClick={() => setT((s) => ({ ...s, sl: +(s.sl * 0.9).toFixed(3) }))}><Minimize2 className="w-3 h-3" /></button>
        <button className="b3-btn !px-2 !py-1" onClick={() => setT((s) => ({ ...s, sl: +(s.sl * 1.1).toFixed(3) }))}><Maximize2 className="w-3 h-3" /></button>
        <span className="text-[#5c6e7c] w-10 text-right">Width</span>
        <button className="b3-btn !px-2 !py-1" onClick={() => setT((s) => ({ ...s, sw: +(s.sw * 0.9).toFixed(3) }))}><Minimize2 className="w-3 h-3" /></button>
        <button className="b3-btn !px-2 !py-1" onClick={() => setT((s) => ({ ...s, sw: +(s.sw * 1.1).toFixed(3) }))}><Maximize2 className="w-3 h-3" /></button>
      </div>
      {!isIdentity(t) && <button className="text-[11px] text-[#5c6e7c] underline" onClick={() => setT(IDENTITY)}>Discard shape changes</button>}
      <div className="b3-eyebrow pt-2">Floors inside</div>
      <Num label="Units on every floor" value={unitsAll} min={1} max={40} onChange={setUnitsAll} />
      {floor !== null
        ? <Num label={`Units on ${floor === 0 ? 'ground' : `floor ${floor}`} only`} value={unitsFloor ?? unitsAll} min={1} max={40} onChange={setUnitsFloor} />
        : <p className="text-[#7d8c97]">Open a floor in the inspector to set that floor's units separately.</p>}
      <div className="b3-eyebrow pt-2">Sanction register</div>
      <Num label="Sanctioned floors" value={sanctioned} min={1} max={150} onChange={setSanctioned} />
      <div className="b3-eyebrow pt-2">Title (3D ULPIN norms)</div>
      <label className="flex items-center justify-between gap-2"><span className="text-[#5c6e7c]">Title type</span>
        <select value={tenure} onChange={(e) => setTenure(e.target.value)} className="b3-input !w-auto !py-1">
          <option value="">Inferred · {b.identity_kind === 'STRATA' ? 'separate units' : b.identity_kind === 'INF_PUB' ? 'public asset' : b.identity_kind === 'PROPOSAL' ? 'AI proposal' : 'single title'}</option>
          <option value="strata">Separately titled units (3D ULPIN each)</option>
          <option value="single">Single title over the parcel (2D suffices)</option>
          <option value="public">Public asset (INF-PUB)</option>
        </select>
      </label>
      <p className="text-[10.5px] text-[#7d8c97] leading-snug">{b.identity_reason}</p>
      {b.identity_kind === 'PROPOSAL' && (
        <button onClick={() => onOps([{ op: 'building.update', id: b.id, set: { verified: true } }])} disabled={busy}
          className="w-full b3-btn !border-[#1e4d6b] !text-[#1e4d6b]">
          <ShieldCheck className="w-4 h-4" /> Verify this AI-extracted footprint
        </button>
      )}
      {b.identity_kind === 'STRATA' && !b.certified && (
        <button onClick={() => onOps([{ op: 'building.update', id: b.id, set: { certified: true } }])} disabled={busy} className="w-full b3-btn">
          <BadgeCheck className="w-4 h-4" /> Certify units as built (ID strings unchanged)
        </button>
      )}
      <div className="flex gap-1 pt-1">
        <button onClick={apply} disabled={busy} className="flex-1 b3-btn b3-btn-teal !py-2"><Check className="w-4 h-4 inline" /> Apply changes</button>
        <button onClick={async () => { await onOps([{ op: 'building.delete', id: b.id }]); onDone(); }} disabled={busy} className="b3-btn b3-btn-danger" title="Delete building"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------- asset form
const AssetForm: React.FC<{ a: SubsurfaceAsset; viewer: WorldViewer | null; busy: boolean; onOps: Props['onOps']; onRedraw: () => void; onDone: () => void }> = ({
  a, viewer, busy, onOps, onRedraw, onDone,
}) => {
  const [name, setName] = useState(a.name);
  const [depth, setDepth] = useState(a.depth_m);
  const [radius, setRadius] = useState(a.radius_m ?? 0.3);
  const [buffer, setBuffer] = useState(a.buffer_m);
  const [off, setOff] = useState<[number, number]>([0, 0]);
  const moved = a.path ? translatePath(a.path, off[0], off[1]) : a.footprint ? translatePath(a.footprint, off[0], off[1]) : [];
  useEffect(() => {
    viewer?.highlightAsset(a.id);
    viewer?.showDraft(off[0] || off[1] ? moved : [], { closed: !a.path, color: '#facc15' });
    return () => viewer?.showDraft([]);
  }, [off, viewer]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    const set: Record<string, any> = {};
    if (name !== a.name) set.name = name;
    if (depth !== a.depth_m) set.depth_m = depth;
    if (radius !== a.radius_m) set.radius_m = radius;
    if (buffer !== a.buffer_m) set.buffer_m = buffer;
    if (off[0] || off[1]) set[a.path ? 'path' : 'footprint'] = moved;
    if (Object.keys(set).length) await onOps([{ op: 'asset.update', id: a.id, set }]);
  };
  return (
    <div className="space-y-2 border-t border-[#e4dccf] pt-3 b3-fade">
      <div className="b3-serif text-base flex items-center gap-1.5"><TrainFront className="w-4 h-4 text-[#c8962e]" /> Edit {a.id}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} className="b3-input" />
      <Num label="Depth below ground" value={depth} step={0.5} min={0.3} max={60} suffix="m" onChange={setDepth} />
      {a.path && <Num label="Radius" value={radius} step={0.1} min={0.05} max={8} suffix="m" onChange={setRadius} />}
      <Num label="Safety buffer" value={buffer} step={0.5} min={0} max={20} suffix="m" onChange={setBuffer} />
      <Nudge onMove={(dx, dy) => setOff(([x, y]) => [x + dx, y + dy])} />
      {a.path && <button onClick={onRedraw} className="w-full b3-btn"><PenLine className="w-3.5 h-3.5" /> Redraw alignment on the ground</button>}
      <div className="flex gap-1 pt-1">
        <button onClick={apply} disabled={busy} className="flex-1 b3-btn b3-btn-teal !py-2"><Check className="w-4 h-4 inline" /> Apply changes</button>
        <button onClick={async () => { await onOps([{ op: 'asset.delete', id: a.id }]); onDone(); }} disabled={busy} className="b3-btn b3-btn-danger"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------- road / flyover form
const RoadForm: React.FC<{ r: Road; viewer: WorldViewer | null; busy: boolean; onOps: Props['onOps']; onRedraw: () => void; onDone: () => void }> = ({
  r, viewer, busy, onOps, onRedraw, onDone,
}) => {
  const [name, setName] = useState(r.name ?? '');
  const [elev, setElev] = useState(r.elevation_m);
  const [width, setWidth] = useState(r.width_m);
  const [off, setOff] = useState<[number, number]>([0, 0]);
  const moved = translatePath(r.path, off[0], off[1]);
  useEffect(() => {
    viewer?.showDraft(off[0] || off[1] ? moved : [], { color: '#22d3ee' });
    return () => viewer?.showDraft([]);
  }, [off, viewer]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = async () => {
    const set: Record<string, any> = {};
    if (name !== (r.name ?? '')) set.name = name;
    if (elev !== r.elevation_m) set.elevation_m = elev;
    if (width !== r.width_m) set.width_m = width;
    if (off[0] || off[1]) set.path = moved;
    if (Object.keys(set).length) await onOps([{ op: 'road.update', id: r.id, set }]);
  };
  return (
    <div className="space-y-2 border-t border-[#e4dccf] pt-3 b3-fade">
      <div className="b3-serif text-base flex items-center gap-1.5"><Route className="w-4 h-4 text-[#1f7a72]" /> Edit {r.is_bridge ? 'flyover' : 'road'} {r.id}</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="b3-input" />
      <Num label="Deck height above ground" value={elev} step={0.5} min={0} max={40} suffix="m" onChange={setElev} />
      <Num label="Width" value={width} step={0.5} min={3} max={40} suffix="m" onChange={setWidth} />
      <Nudge onMove={(dx, dy) => setOff(([x, y]) => [x + dx, y + dy])} />
      <button onClick={onRedraw} className="w-full b3-btn"><PenLine className="w-3.5 h-3.5" /> Redraw alignment</button>
      <div className="flex gap-1 pt-1">
        <button onClick={apply} disabled={busy} className="flex-1 b3-btn b3-btn-teal !py-2"><Check className="w-4 h-4 inline" /> Apply changes</button>
        <button onClick={async () => { await onOps([{ op: 'road.delete', id: r.id }]); onDone(); }} disabled={busy} className="b3-btn b3-btn-danger"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

export default EditorPanel;

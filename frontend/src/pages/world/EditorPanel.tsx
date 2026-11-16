/**
 * The surveyor's 3D editor: build new objects with the tool palette and correct the selected one with its form.
 *
 * Tools work by clicking on the ground in the 3D view: a single click (place a building, plant a tree, remove trees
 * or a footpath) or a series of clicks finished with Enter (tunnels, pipes, flyovers, roads, footpaths, rows of trees,
 * drawn footprints and basements). Every change is sent as an edit operation; the server re-derives floor plans,
 * 3D ULPINs and compliance findings, and every edit can be undone.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, BadgeCheck, Building2, Cable, Car, Check, Compass, Crosshair, Droplets,
  Eraser, Flame, Footprints, Layers, Loader2, Move, PenLine, PenTool, Plus, RotateCcw, Route, ShieldCheck, Spline,
  Trash2, TrainFront, TreeDeciduous, Trees, Undo2, Waves, X, Zap,
} from 'lucide-react';
import type { Building, BuildingDetail, EditOp, Road, SceneSpec, SubsurfaceAsset, XY } from '../../world/sceneSpec';
import type { WorldViewer } from '../../world/viewer';
import {
  FootprintTransform, IDENTITY, alignRotation, centroid, footprintSize, isIdentity, nearestRoadAngle, pathLength,
  pointInRing, pointsAlong, rectAt, transformFootprint, translatePath,
} from '../../world/editing';
import { ASSET_STYLE } from '../../world/buildWorld';
import { Segmented } from '../../world/ui';
import { FloorPlanSvg } from './FloorPlanSvg';

export type EditSel = { kind: 'building'; id: string } | { kind: 'subsurface'; id: string } | { kind: 'road'; id: string } | null;

// ------------------------------------------------------------------------------------------------ tools
type LineKind = 'metro' | 'road_tunnel' | 'water' | 'sewer' | 'gas' | 'power' | 'telecom' | 'flyover' | 'road' | 'footpath' | 'tree_row';
type Tool =
  | { t: 'place-building' }
  | { t: 'draw-building' }
  | { t: 'draw-basement' }
  | { t: 'line'; kind: LineKind }
  | { t: 'plant-trees' }
  | { t: 'remove-trees' }
  | { t: 'remove-footpath' }
  | { t: 'move-building' }
  | { t: 'redraw' };
type Group = 'buildings' | 'networks' | 'streets';

type LineSpec = { label: string; icon: LucideIcon; color: string; depth?: number; radius?: number; buffer?: number; width?: number; elevation?: number; spacing?: number };
const LINES: Record<LineKind, LineSpec> = {
  metro: { label: 'Metro tunnel', icon: TrainFront, color: ASSET_STYLE.metro.color, depth: 16, radius: 3.1, buffer: 5 },
  road_tunnel: { label: 'Road tunnel', icon: Car, color: ASSET_STYLE.road_tunnel.color, depth: 8, radius: 4.5, buffer: 3 },
  water: { label: 'Water main', icon: Droplets, color: ASSET_STYLE.water.color, depth: 1.2, radius: 0.3, buffer: 1.5 },
  sewer: { label: 'Sewer line', icon: Waves, color: ASSET_STYLE.sewer.color, depth: 2.5, radius: 0.5, buffer: 2 },
  gas: { label: 'Gas pipeline', icon: Flame, color: ASSET_STYLE.gas.color, depth: 1.0, radius: 0.15, buffer: 2 },
  power: { label: 'Power cable', icon: Zap, color: ASSET_STYLE.power.color, depth: 1.0, radius: 0.1, buffer: 1 },
  telecom: { label: 'Telecom duct', icon: Cable, color: ASSET_STYLE.telecom.color, depth: 0.8, radius: 0.1, buffer: 0.5 },
  flyover: { label: 'Flyover', icon: Route, color: '#22d3ee', elevation: 7, width: 12 },
  road: { label: 'Road', icon: Spline, color: '#94a3b8', width: 9 },
  footpath: { label: 'Footpath', icon: Footprints, color: '#e7d8b8', width: 2 },
  tree_row: { label: 'Row of trees', icon: Trees, color: '#4ade80', spacing: 8 },
};
const UNDERGROUND: LineKind[] = ['metro', 'road_tunnel', 'water', 'sewer', 'gas', 'power', 'telecom'];

type ToolButton = { key: string; label: string; icon: LucideIcon; tool: Tool };
const PALETTE: Record<Group, ToolButton[]> = {
  buildings: [
    { key: 'place-building', label: 'Place a house', icon: Plus, tool: { t: 'place-building' } },
    { key: 'draw-building', label: 'Draw a footprint', icon: PenTool, tool: { t: 'draw-building' } },
    { key: 'draw-basement', label: 'Basement', icon: Layers, tool: { t: 'draw-basement' } },
  ],
  networks: UNDERGROUND.map((k) => ({ key: k, label: LINES[k].label, icon: LINES[k].icon, tool: { t: 'line', kind: k } as Tool })),
  streets: [
    { key: 'flyover', label: 'Flyover', icon: Route, tool: { t: 'line', kind: 'flyover' } },
    { key: 'road', label: 'Road', icon: Spline, tool: { t: 'line', kind: 'road' } },
    { key: 'footpath', label: 'Footpath', icon: Footprints, tool: { t: 'line', kind: 'footpath' } },
    { key: 'remove-footpath', label: 'Remove footpath', icon: Eraser, tool: { t: 'remove-footpath' } },
    { key: 'plant-trees', label: 'Plant trees', icon: TreeDeciduous, tool: { t: 'plant-trees' } },
    { key: 'tree_row', label: 'Row of trees', icon: Trees, tool: { t: 'line', kind: 'tree_row' } },
    { key: 'remove-trees', label: 'Remove trees', icon: Eraser, tool: { t: 'remove-trees' } },
  ],
};
const toolKey = (tool: Tool | null) => (!tool ? '' : tool.t === 'line' ? tool.kind : tool.t);

/** Multi-click tools collect points and finish with Enter; single-click tools act on each click. */
const collects = (tool: Tool | null) => !!tool && ['line', 'draw-building', 'draw-basement', 'plant-trees', 'redraw'].includes(tool.t);
const minPoints = (tool: Tool | null) => (tool?.t === 'draw-building' || tool?.t === 'draw-basement' ? 3 : tool?.t === 'plant-trees' ? 1 : 2);

const USAGES: [string, string][] = [['R', 'Residential'], ['C', 'Commercial'], ['M', 'Mixed use'], ['I', 'Industrial'], ['P', 'Public']];
const typing = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
};

// ------------------------------------------------------------------------------------------------ small controls
const Num: React.FC<{ label: string; value: number; step?: number; min?: number; max?: number; onChange: (v: number) => void; suffix?: string }> = ({
  label, value, step = 1, min, max, onChange, suffix,
}) => (
  <label className="flex items-center justify-between gap-2 text-xs">
    <span className="text-[#5c6e7c]">{label}</span>
    <span className="flex items-center gap-1">
      <input type="number" value={Number.isFinite(value) ? value : 0} step={step} min={min} max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isFinite(v)) return;
          onChange(Math.min(max ?? v, Math.max(min ?? v, v)));
        }}
        className="b3-input !w-[5.5rem] !py-1 !px-2 text-right b3-num" />
      <span className="text-[#7d8c97] w-5">{suffix ?? ''}</span>
    </span>
  </label>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2 pt-3 border-t border-[#e4dccf]">
    <div className="b3-eyebrow">{title}</div>
    {children}
  </section>
);

const Nudge: React.FC<{ onMove: (dx: number, dy: number) => void }> = ({ onMove }) => {
  const [step, setStep] = useState(1);
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-[#5c6e7c] w-14">Nudge</span>
      <div className="grid grid-cols-3 gap-0.5">
        <span />
        <button type="button" className="b3-btn !p-1.5 !rounded-md" title="Move north" aria-label="Move north" onClick={() => onMove(0, step)}><ArrowUp className="w-3.5 h-3.5" /></button>
        <span />
        <button type="button" className="b3-btn !p-1.5 !rounded-md" title="Move west" aria-label="Move west" onClick={() => onMove(-step, 0)}><ArrowLeft className="w-3.5 h-3.5" /></button>
        <span className="text-[9.5px] text-center text-[#5c6e7c] self-center">{step} m</span>
        <button type="button" className="b3-btn !p-1.5 !rounded-md" title="Move east" aria-label="Move east" onClick={() => onMove(step, 0)}><ArrowRight className="w-3.5 h-3.5" /></button>
        <span />
        <button type="button" className="b3-btn !p-1.5 !rounded-md" title="Move south" aria-label="Move south" onClick={() => onMove(0, -step)}><ArrowDown className="w-3.5 h-3.5" /></button>
        <span />
      </div>
      <select value={step} onChange={(e) => setStep(+e.target.value)} className="b3-input !w-auto !py-1 !px-1.5" aria-label="Nudge step">
        {[0.25, 0.5, 1, 2, 5, 10].map((s) => <option key={s} value={s}>{s} m</option>)}
      </select>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ panel
interface Props {
  scene: SceneSpec;
  viewer: WorldViewer | null;
  sel: EditSel;
  floor: number | null;
  /** floors and units of the selected building (for the floor-planning preview) */
  detail: BuildingDetail | null;
  busy: boolean;
  onOps: (ops: EditOp[]) => Promise<void>;
  onUndo: () => void;
  onReset: () => void;
  onClearSel: () => void;
  /** open a floor of the selected building (also shown in 3D) */
  onFloor: (floor: number | null) => void;
}

export const EditorPanel: React.FC<Props> = ({ scene, viewer, sel, floor, detail, busy, onOps, onUndo, onReset, onClearSel, onFloor }) => {
  const [group, setGroup] = useState<Group>('buildings');
  const [tool, setTool] = useState<Tool | null>(null);
  const [points, setPoints] = useState<XY[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // settings of the active tool
  const [depth, setDepth] = useState(16);
  const [diameter, setDiameter] = useState(6.2);
  const [buffer, setBuffer] = useState(5);
  const [width, setWidth] = useState(12);
  const [elevation, setElevation] = useState(7);
  const [spacing, setSpacing] = useState(8);
  const [bLen, setBLen] = useState(16);
  const [bWid, setBWid] = useState(12);
  const [bFloors, setBFloors] = useState(4);
  const [bUsage, setBUsage] = useState('R');
  const [alignToStreet, setAlignToStreet] = useState(true);
  const [moveTo, setMoveTo] = useState<XY | null>(null); // the spot picked by "Move to a clicked spot"

  const building = sel?.kind === 'building' ? scene.buildings.find((b) => b.id === sel.id) ?? null : null;
  const asset = sel?.kind === 'subsurface' ? scene.subsurface.find((a) => a.id === sel.id) ?? null : null;
  const road = sel?.kind === 'road' ? scene.roads.find((r) => r.id === sel.id) ?? null : null;

  const startTool = (next: Tool) => {
    setPoints([]);
    setNote(null);
    if (toolKey(next) === toolKey(tool)) {
      setTool(null);
      return;
    }
    if (next.t === 'line') {
      const spec = LINES[next.kind];
      if (spec.depth !== undefined) setDepth(spec.depth);
      if (spec.radius !== undefined) setDiameter(+(spec.radius * 2).toFixed(2));
      if (spec.buffer !== undefined) setBuffer(spec.buffer);
      if (spec.width !== undefined) setWidth(spec.width);
      if (spec.elevation !== undefined) setElevation(spec.elevation);
      if (spec.spacing !== undefined) setSpacing(spec.spacing);
    }
    if (next.t === 'draw-basement') setDepth(7);
    setTool(next);
  };
  const cancel = useCallback(() => { setTool(null); setPoints([]); }, []);

  // ---------------- clicks on the ground while a tool is active
  useEffect(() => {
    if (!viewer) return;
    if (!tool) {
      viewer.setPointTool(null);
      return;
    }
    viewer.setPointTool((p) => {
      setNote(null);
      const single = tool.t === 'place-building' || tool.t === 'remove-trees' || tool.t === 'remove-footpath';
      if (single && busy) {
        setNote('Saving the previous change. Click again in a moment.'); // one edit at a time keeps the history exact
        return;
      }
      if (tool.t === 'place-building') { // stays active, so a whole street of houses can be placed one after another
        const angle = alignToStreet ? nearestRoadAngle(scene.roads, p) ?? 0 : 0;
        onOps([{ op: 'building.add', building: { footprint: rectAt(p, bLen, bWid, angle), floors: bFloors, usage: bUsage, name: 'New building' } }]);
        return;
      }
      if (tool.t === 'remove-trees') {
        onOps([{ op: 'tree.remove', at: p, radius_m: 6 }]);
        return;
      }
      if (tool.t === 'remove-footpath') {
        const hit = (scene.footpaths ?? []).find((f) => f.rings[0] && pointInRing(p, f.rings[0]));
        if (!hit) {
          setNote('No footpath at that spot. Click on a footpath (the paved strip beside a road).');
          return;
        }
        onOps([hit.source === 'surveyor' ? { op: 'footpath.delete', id: hit.id } : { op: 'footpath.remove', at: p }]);
        return;
      }
      if (tool.t === 'move-building') {
        setMoveTo(p);
        setTool(null);
        return;
      }
      setPoints((pts) => [...pts, p]);
    });
    return () => viewer.setPointTool(null);
  }, [tool, viewer, alignToStreet, bLen, bWid, bFloors, bUsage, scene, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------- draft preview of the points collected so far
  useEffect(() => {
    if (!viewer || !collects(tool)) return;
    const closed = tool?.t === 'draw-building' || tool?.t === 'draw-basement';
    const color = tool?.t === 'line' ? LINES[tool.kind].color : tool?.t === 'plant-trees' ? '#4ade80' : tool?.t === 'draw-basement' ? ASSET_STYLE.basement.color : '#f59e0b';
    const preview = tool?.t === 'line' && tool.kind === 'tree_row' && points.length > 1 ? pointsAlong(points, spacing) : points;
    viewer.showDraft(preview, {
      closed, color, dots: tool?.t === 'plant-trees' || (tool?.t === 'line' && tool.kind === 'tree_row' && points.length > 1),
    });
  }, [points, tool, viewer, spacing]);

  const finish = useCallback(async () => {
    if (!tool || busy || points.length < minPoints(tool)) return;
    const pts = points;
    const current = tool;
    cancel();
    if (current.t === 'draw-building') {
      await onOps([{ op: 'building.add', building: { footprint: pts, floors: bFloors, usage: bUsage, name: 'New building' } }]);
    } else if (current.t === 'draw-basement') {
      await onOps([{ op: 'asset.add', asset: { kind: 'basement', footprint: pts, depth_m: depth, depth_top_m: 0.5, buffer_m: 2, name: 'New basement' } }]);
    } else if (current.t === 'plant-trees') {
      await onOps([{ op: 'tree.add', points: pts }]);
    } else if (current.t === 'redraw') {
      if (asset) await onOps([{ op: 'asset.update', id: asset.id, set: { path: pts } }]);
      if (road) await onOps([{ op: 'road.update', id: road.id, set: { path: pts } }]);
    } else if (current.t === 'line') {
      const k = current.kind;
      const spec = LINES[k];
      if (UNDERGROUND.includes(k)) {
        await onOps([{ op: 'asset.add', asset: { kind: k as SubsurfaceAsset['kind'], path: pts, depth_m: depth, radius_m: diameter / 2, buffer_m: buffer, name: `New ${spec.label.toLowerCase()}` } }]);
      } else if (k === 'flyover') {
        await onOps([{ op: 'road.add', road: { kind: 'primary', path: pts, elevation_m: elevation, width_m: width, name: 'New flyover' } }]);
      } else if (k === 'road') {
        await onOps([{ op: 'road.add', road: { kind: 'residential', path: pts, elevation_m: 0, width_m: width, name: 'New road' } }]);
      } else if (k === 'footpath') {
        await onOps([{ op: 'footpath.add', footpath: { path: pts, width_m: width } }]);
      } else if (k === 'tree_row') {
        await onOps([{ op: 'tree.add', points: pointsAlong(pts, spacing) }]);
      }
    }
  }, [tool, busy, points, cancel, onOps, bFloors, bUsage, depth, diameter, buffer, elevation, width, spacing, asset, road]);

  // ---------------- keyboard: Enter finishes, Backspace removes the last point, Escape cancels
  useEffect(() => {
    if (!tool) return;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e)) return;
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      else if (e.key === 'Enter' && collects(tool)) { e.preventDefault(); finish(); }
      else if (e.key === 'Backspace' && collects(tool)) { e.preventDefault(); setPoints((p) => p.slice(0, -1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, cancel, finish]);

  useEffect(() => { // a pending reset confirmation lapses after a few seconds
    if (!confirmReset) return;
    const t = window.setTimeout(() => setConfirmReset(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmReset]);

  const active = toolKey(tool);
  const instructions = !tool ? '' : tool.t === 'place-building' ? 'Click on the ground where each house should stand. Press Done when finished.'
    : tool.t === 'draw-building' ? 'Click the corners of the footprint, then press Finish (Enter).'
      : tool.t === 'draw-basement' ? 'Click the corners of the basement outline, then press Finish (Enter).'
        : tool.t === 'plant-trees' ? 'Click on the ground to place each tree, then press Finish (Enter).'
          : tool.t === 'remove-trees' ? 'Click where trees should go: every tree within 6 m of the click is removed.'
            : tool.t === 'remove-footpath' ? 'Click on a footpath to remove it.'
              : tool.t === 'move-building' ? 'Click the spot where the building should stand.'
                : tool.t === 'redraw' ? 'Click points along the new alignment, then press Finish (Enter).'
                  : tool.kind === 'tree_row' ? 'Click points along the row, then press Finish (Enter). Trees are spaced evenly.'
                    : `Click points along the ${LINES[tool.kind].label.toLowerCase()}, then press Finish (Enter).`;

  return (
    <div className="space-y-3 text-xs">
      {/* tool palette */}
      <div className="space-y-2">
        <Segmented<Group> value={group} onChange={setGroup} className="w-full [&>button]:flex-1" options={[
          { value: 'buildings', label: <><Building2 className="w-3.5 h-3.5" /> Buildings</> },
          { value: 'networks', label: <><Waves className="w-3.5 h-3.5" /> Pipes &amp; tunnels</> },
          { value: 'streets', label: <><Trees className="w-3.5 h-3.5" /> Streets &amp; trees</> },
        ]} />
        <div className="grid grid-cols-3 gap-1.5">
          {PALETTE[group].map((b) => {
            const Icon = b.icon;
            const on = active === b.key;
            return (
              <button key={b.key} type="button" onClick={() => startTool(b.tool)} aria-pressed={on} disabled={busy}
                className={`b3-btn flex-col !gap-1 !py-2 !px-1 !text-[11px] leading-tight text-center ${on ? 'b3-btn-gold' : ''}`}>
                <Icon className="w-4 h-4" /> {b.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* the active tool: what to do, its settings, finish / undo point / cancel */}
      {tool && (
        <div className="space-y-2 bg-[#c8962e]/10 border border-[#c8962e]/35 rounded-xl p-2.5 b3-fade" role="status" aria-live="polite">
          <p className="text-[#7a5212] font-medium leading-snug">{instructions}</p>
          {tool.t === 'place-building' && (
            <div className="space-y-1.5">
              <Num label="Length" value={bLen} step={1} min={4} max={120} suffix="m" onChange={setBLen} />
              <Num label="Width" value={bWid} step={1} min={4} max={120} suffix="m" onChange={setBWid} />
              <Num label="Floors" value={bFloors} min={1} max={60} onChange={(v) => setBFloors(Math.round(v))} />
              <label className="flex items-center justify-between"><span className="text-[#5c6e7c]">Use</span>
                <select value={bUsage} onChange={(e) => setBUsage(e.target.value)} className="b3-input !w-auto !py-1">
                  {USAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="b3-check" checked={alignToStreet} onChange={(e) => setAlignToStreet(e.target.checked)} />
                <span>Square it to the nearest street</span>
              </label>
            </div>
          )}
          {tool.t === 'draw-building' && (
            <div className="space-y-1.5">
              <Num label="Floors" value={bFloors} min={1} max={60} onChange={(v) => setBFloors(Math.round(v))} />
              <label className="flex items-center justify-between"><span className="text-[#5c6e7c]">Use</span>
                <select value={bUsage} onChange={(e) => setBUsage(e.target.value)} className="b3-input !w-auto !py-1">
                  {USAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
            </div>
          )}
          {tool.t === 'draw-basement' && <Num label="Depth of the floor below ground" value={depth} step={0.5} min={2} max={30} suffix="m" onChange={setDepth} />}
          {tool.t === 'line' && UNDERGROUND.includes(tool.kind) && (
            <div className="space-y-1.5">
              <Num label="Depth below ground (centre)" value={depth} step={0.1} min={0.3} max={60} suffix="m" onChange={setDepth} />
              <Num label={tool.kind === 'metro' || tool.kind === 'road_tunnel' ? 'Bore diameter' : 'Pipe diameter'} value={diameter} step={0.05} min={0.05} max={16} suffix="m" onChange={setDiameter} />
              <Num label="Safety buffer" value={buffer} step={0.5} min={0} max={20} suffix="m" onChange={setBuffer} />
            </div>
          )}
          {tool.t === 'line' && tool.kind === 'flyover' && (
            <div className="space-y-1.5">
              <Num label="Deck height above ground" value={elevation} step={0.5} min={4} max={30} suffix="m" onChange={setElevation} />
              <Num label="Deck width" value={width} step={0.5} min={4} max={40} suffix="m" onChange={setWidth} />
            </div>
          )}
          {tool.t === 'line' && (tool.kind === 'road' || tool.kind === 'footpath') && (
            <Num label="Width" value={width} step={0.5} min={tool.kind === 'footpath' ? 1 : 3} max={tool.kind === 'footpath' ? 8 : 40} suffix="m" onChange={setWidth} />
          )}
          {tool.t === 'line' && tool.kind === 'tree_row' && <Num label="Spacing between trees" value={spacing} step={1} min={3} max={40} suffix="m" onChange={setSpacing} />}
          {collects(tool) && (
            <>
              <div className="flex items-center justify-between text-[#7a5212]">
                <span>{tool.t === 'plant-trees' ? `${points.length} tree(s) placed` : `${points.length} point(s)`}
                  {tool.t === 'line' && points.length > 1 ? ` · ${Math.round(pathLength(points))} m` : ''}
                  {tool.t === 'line' && tool.kind === 'tree_row' && points.length > 1 ? ` · ${pointsAlong(points, spacing).length} trees` : ''}</span>
                <span className="text-[10px] text-[#9a7a3a]">Enter finish · ⌫ undo · Esc cancel</span>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={finish} disabled={points.length < minPoints(tool) || busy} className="flex-1 b3-btn b3-btn-gold !py-1.5">
                  <Check className="w-3.5 h-3.5" /> Finish
                </button>
                <button type="button" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length} className="b3-btn !px-2 !py-1.5">Undo point</button>
                <button type="button" onClick={cancel} className="b3-btn !px-2 !py-1.5" aria-label="Cancel the tool"><X className="w-3.5 h-3.5" /></button>
              </div>
            </>
          )}
          {!collects(tool) && <button type="button" onClick={cancel} className="w-full b3-btn !py-1"><X className="w-3.5 h-3.5" /> Done</button>}
        </div>
      )}
      {note && <p className="text-[#8a5a12] bg-[#c8962e]/10 rounded-lg px-2 py-1.5">{note}</p>}

      {/* history */}
      <div className="flex items-center gap-1">
        <button type="button" onClick={onUndo} disabled={busy || !scene.edits_count} className="flex-1 b3-btn"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
        <button type="button" onClick={() => { if (confirmReset) { setConfirmReset(false); onReset(); } else setConfirmReset(true); }}
          disabled={busy || !scene.edits_count} className={`flex-1 b3-btn ${confirmReset ? 'b3-btn-danger !bg-[#c0392b] !text-white' : ''}`}>
          <RotateCcw className="w-3.5 h-3.5" /> {confirmReset ? 'Click to confirm' : 'Reset all'}
        </button>
        <span className="px-1.5 text-[#5c6e7c] whitespace-nowrap">{scene.edits_count ?? 0} edit(s)</span>
      </div>
      {confirmReset && <p className="text-[#c0392b]">This discards every edit made to this area. Click again to confirm.</p>}
      {busy && <p className="flex items-center gap-1.5 text-[#8a5a12]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving, then re-checking compliance and re-reserving 3D ULPINs…</p>}
      {(scene.edit_errors ?? []).length > 0 && <p className="text-[#c0392b]">{scene.edit_errors!.length} earlier edit(s) could not be applied (the object no longer exists).</p>}

      {!sel && !tool && (
        <p className="text-[#5c6e7c] leading-relaxed">
          Pick a tool above to build something new, or click an object in the 3D view to change it: a building, a flyover
          or road, or (in X-ray or Underground view) a tunnel, pipe or basement.
        </p>
      )}
      {building && (
        <BuildingForm key={`${building.id}-${scene.edits_count}`} b={building} scene={scene} floor={floor} detail={detail} viewer={viewer}
          busy={busy} onOps={onOps} onDone={onClearSel} onFloor={onFloor} moveTo={moveTo} onPickSpot={() => startTool({ t: 'move-building' })}
          onMoved={() => setMoveTo(null)} />
      )}
      {asset && <AssetForm key={`${asset.id}-${scene.edits_count}`} a={asset} viewer={viewer} busy={busy} onOps={onOps} onRedraw={() => startTool({ t: 'redraw' })} onDone={onClearSel} />}
      {road && <RoadForm key={`${road.id}-${scene.edits_count}`} r={road} viewer={viewer} busy={busy} onOps={onOps} onRedraw={() => startTool({ t: 'redraw' })} onDone={onClearSel} />}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ building form
const BuildingForm: React.FC<{
  b: Building; scene: SceneSpec; floor: number | null; detail: BuildingDetail | null; viewer: WorldViewer | null; busy: boolean;
  onOps: Props['onOps']; onDone: () => void; onFloor: Props['onFloor']; moveTo: XY | null; onPickSpot: () => void; onMoved: () => void;
}> = ({ b, scene, floor, detail, viewer, busy, onOps, onDone, onFloor, moveTo, onPickSpot, onMoved }) => {
  const [name, setName] = useState(b.name);
  const [usage, setUsage] = useState<string>(b.usage);
  const [floors, setFloors] = useState(b.floors);
  const [fh, setFh] = useState(b.floor_height);
  const [base, setBase] = useState(b.min_height);
  const [basements, setBasements] = useState(b.basement_levels ?? 0);
  const [sanctioned, setSanctioned] = useState(b.sanctioned_floors);
  const [tenure, setTenure] = useState<string>(b.tenure ?? '');
  const [unitsAll, setUnitsAll] = useState<number>(b.unit_overrides?.all ?? b.units_per_floor);
  const [unitsFloor, setUnitsFloor] = useState<number | null>(floor !== null ? b.unit_overrides?.[String(floor)] ?? null : null);
  const [t, setT] = useState<FootprintTransform>(IDENTITY);
  const [len0, wid0] = useMemo(() => footprintSize(b.footprint), [b.footprint]);
  const newFp = useMemo(() => transformFootprint(b.footprint, t), [b.footprint, t]);
  const [len, wid] = footprintSize(newFp);
  const height = Math.round((base + floors * fh + 0.6) * 100) / 100;
  const floorData = detail && detail.building.id === b.id && floor !== null ? detail.floors.find((f) => f.floor === floor) ?? null : null;

  useEffect(() => { setUnitsFloor(floor !== null ? b.unit_overrides?.[String(floor)] ?? null : null); }, [floor, b.unit_overrides]);
  useEffect(() => {
    viewer?.showDraft(isIdentity(t) ? [] : newFp, { closed: true, color: '#f59e0b' });
    return () => viewer?.showDraft([]);
  }, [newFp, t, viewer]);
  useEffect(() => { // "Move to a clicked spot": shift the footprint so its centre lands on the picked spot
    if (!moveTo) return;
    const [cx, cy] = centroid(b.footprint);
    setT((s) => ({ ...s, dx: Math.round((moveTo[0] - cx) * 100) / 100, dy: Math.round((moveTo[1] - cy) * 100) / 100 }));
    onMoved();
  }, [moveTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const alignWithStreet = () => {
    const angle = nearestRoadAngle(scene.roads, centroid(b.footprint), 80);
    if (angle === null) return;
    setT((s) => ({ ...s, rot: alignRotation(b.footprint, angle) }));
  };

  const apply = async () => {
    const set: Record<string, any> = {};
    if (name.trim() && name !== b.name) set.name = name.trim();
    if (usage !== b.usage) set.usage = usage;
    if (floors !== b.floors) set.floors = Math.max(1, Math.round(floors));
    if (fh !== b.floor_height) set.floor_height = fh;
    if (base !== b.min_height) set.min_height = base;
    if (basements !== (b.basement_levels ?? 0)) set.basement_levels = Math.max(0, Math.round(basements));
    if (sanctioned !== b.sanctioned_floors) set.sanctioned_floors = Math.max(1, Math.round(sanctioned));
    if (tenure !== (b.tenure ?? '')) set.tenure = tenure || undefined;
    const overrides = { ...(b.unit_overrides ?? {}) };
    if (unitsAll !== (b.unit_overrides?.all ?? b.units_per_floor)) overrides.all = Math.max(1, Math.round(unitsAll));
    if (floor !== null && unitsFloor) overrides[String(floor)] = Math.max(1, Math.round(unitsFloor));
    if (JSON.stringify(overrides) !== JSON.stringify(b.unit_overrides ?? {})) set.unit_overrides = overrides;
    if (!isIdentity(t)) set.footprint = newFp;
    if (Object.keys(set).length) await onOps([{ op: 'building.update', id: b.id, set }]);
  };
  const changed = !isIdentity(t) || name !== b.name || usage !== b.usage || floors !== b.floors || fh !== b.floor_height
    || base !== b.min_height || basements !== (b.basement_levels ?? 0) || sanctioned !== b.sanctioned_floors || tenure !== (b.tenure ?? '')
    || unitsAll !== (b.unit_overrides?.all ?? b.units_per_floor) || (floor !== null && !!unitsFloor && unitsFloor !== b.unit_overrides?.[String(floor)]);

  return (
    <div className="space-y-2 b3-fade">
      <div className="b3-serif text-base flex items-center gap-1.5 pt-1"><Building2 className="w-4 h-4 text-[#c8962e]" /> {b.name} <span className="font-mono text-[10.5px] text-[#7d8c97]">{b.id}</span></div>

      <Section title="Identity">
        <input value={name} onChange={(e) => setName(e.target.value)} className="b3-input" aria-label="Building name" />
        <label className="flex items-center justify-between"><span className="text-[#5c6e7c]">Use</span>
          <select value={usage} onChange={(e) => setUsage(e.target.value)} className="b3-input !w-auto !py-1">
            {USAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </Section>

      <Section title="Height">
        <Num label="Floors above ground" value={floors} min={1} max={150} onChange={(v) => setFloors(Math.round(v))} />
        <Num label="Floor-to-floor height" value={fh} step={0.1} min={2.6} max={8} suffix="m" onChange={setFh} />
        <Num label="Base height (stilts or podium)" value={base} step={0.5} min={0} max={60} suffix="m" onChange={setBase} />
        <div className="flex justify-between"><span className="text-[#5c6e7c]">Total height</span><b className="font-mono">{height} m</b></div>
      </Section>

      <Section title="Position and shape">
        <div className="grid grid-cols-2 gap-1">
          <button type="button" className="b3-btn !py-1.5" onClick={onPickSpot}><Crosshair className="w-3.5 h-3.5" /> Move to a spot</button>
          <button type="button" className="b3-btn !py-1.5" onClick={alignWithStreet}><Compass className="w-3.5 h-3.5" /> Align with street</button>
        </div>
        <Nudge onMove={(dx, dy) => setT((s) => ({ ...s, dx: +(s.dx + dx).toFixed(2), dy: +(s.dy + dy).toFixed(2) }))} />
        <div className="flex items-center gap-1">
          <span className="text-[#5c6e7c] w-14">Rotate</span>
          {[-15, -1].map((d) => <button key={d} type="button" className="b3-btn !px-1.5 !py-1" onClick={() => setT((s) => ({ ...s, rot: +(s.rot + d).toFixed(1) }))}>{d}°</button>)}
          <input type="number" step={0.5} value={t.rot} onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) setT((s) => ({ ...s, rot: v })); }}
            className="b3-input !w-16 !py-1 !px-1.5 text-right b3-num" aria-label="Rotation in degrees" />
          {[1, 15].map((d) => <button key={d} type="button" className="b3-btn !px-1.5 !py-1" onClick={() => setT((s) => ({ ...s, rot: +(s.rot + d).toFixed(1) }))}>+{d}°</button>)}
        </div>
        <Num label="Length" value={+len.toFixed(1)} step={0.5} min={2} max={300} suffix="m" onChange={(v) => setT((s) => ({ ...s, sl: +(v / (len0 || 1)).toFixed(4) }))} />
        <Num label="Width" value={+wid.toFixed(1)} step={0.5} min={2} max={300} suffix="m" onChange={(v) => setT((s) => ({ ...s, sw: +(v / (wid0 || 1)).toFixed(4) }))} />
        {!isIdentity(t) && (
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[#8a5a12]">Moved {Math.hypot(t.dx, t.dy).toFixed(1)} m · turned {t.rot}° (preview in orange)</span>
            <button type="button" className="text-[#5c6e7c] underline" onClick={() => setT(IDENTITY)}>Discard</button>
          </div>
        )}
      </Section>

      <Section title="Floor planning">
        <label className="flex items-center justify-between"><span className="text-[#5c6e7c]">Floor</span>
          <select value={floor ?? ''} onChange={(e) => onFloor(e.target.value === '' ? null : +e.target.value)} className="b3-input !w-auto !py-1" aria-label="Floor to plan">
            <option value="">All floors</option>
            {Array.from({ length: b.floors }, (_, f) => <option key={f} value={f}>{f === 0 ? 'Ground floor' : `Floor ${f}`}</option>)}
          </select>
        </label>
        <Num label="Units on every floor" value={unitsAll} min={1} max={40} onChange={(v) => setUnitsAll(Math.round(v))} />
        {floor !== null && (
          <Num label={`Units on ${floor === 0 ? 'the ground floor' : `floor ${floor}`}`} value={unitsFloor ?? unitsAll} min={1} max={40} onChange={(v) => setUnitsFloor(Math.round(v))} />
        )}
        {floorData && (
          <div className="rounded-lg bg-white/60 border border-[#e4dccf] p-1.5">
            <FloorPlanSvg footprint={b.footprint} floor={floorData} selected={null} onSelect={() => undefined} />
            <p className="text-[10.5px] text-[#7d8c97] text-center mt-1">Current plan: {floorData.units.length} unit(s); apply to re-plan with the new count</p>
          </div>
        )}
        <Num label="Basement levels" value={basements} min={0} max={6} onChange={(v) => setBasements(Math.round(v))} />
      </Section>

      <Section title="Sanction and title">
        <Num label="Sanctioned floors" value={sanctioned} min={1} max={150} onChange={(v) => setSanctioned(Math.round(v))} />
        <label className="flex items-center justify-between gap-2"><span className="text-[#5c6e7c]">Title type</span>
          <select value={tenure} onChange={(e) => setTenure(e.target.value)} className="b3-input !w-auto !py-1 max-w-[12rem]">
            <option value="">Inferred · {b.identity_kind === 'STRATA' ? 'separate units' : b.identity_kind === 'INF_PUB' ? 'public asset' : b.identity_kind === 'PROPOSAL' ? 'AI proposal' : 'single title'}</option>
            <option value="strata">Separately titled units (3D ULPIN each)</option>
            <option value="single">Single title over the parcel (2D suffices)</option>
            <option value="public">Public asset (INF-PUB)</option>
          </select>
        </label>
        <p className="text-[10.5px] text-[#7d8c97] leading-snug">{b.identity_reason}</p>
        {b.identity_kind === 'PROPOSAL' && (
          <button type="button" onClick={() => onOps([{ op: 'building.update', id: b.id, set: { verified: true } }])} disabled={busy}
            className="w-full b3-btn !border-[#1e4d6b] !text-[#1e4d6b]">
            <ShieldCheck className="w-4 h-4" /> Verify this AI-extracted footprint
          </button>
        )}
        {b.identity_kind === 'STRATA' && !b.certified && (
          <button type="button" onClick={() => onOps([{ op: 'building.update', id: b.id, set: { certified: true } }])} disabled={busy} className="w-full b3-btn">
            <BadgeCheck className="w-4 h-4" /> Certify units as built (ID strings unchanged)
          </button>
        )}
      </Section>

      <div className="flex gap-1 pt-2 sticky bottom-0 bg-[#f7f4ed]/95 backdrop-blur py-2 -mx-1 px-1">
        <button type="button" onClick={apply} disabled={busy || !changed} className="flex-1 b3-btn b3-btn-teal !py-2"><Check className="w-4 h-4" /> Apply changes</button>
        <button type="button" onClick={async () => { await onOps([{ op: 'building.delete', id: b.id }]); onDone(); }} disabled={busy}
          className="b3-btn b3-btn-danger" title="Delete this building" aria-label="Delete this building"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ asset form
const AssetForm: React.FC<{ a: SubsurfaceAsset; viewer: WorldViewer | null; busy: boolean; onOps: Props['onOps']; onRedraw: () => void; onDone: () => void }> = ({
  a, viewer, busy, onOps, onRedraw, onDone,
}) => {
  const [name, setName] = useState(a.name);
  const [depth, setDepth] = useState(a.depth_m);
  const [diameter, setDiameter] = useState(+((a.radius_m ?? 0.3) * 2).toFixed(2));
  const [buffer, setBuffer] = useState(a.buffer_m);
  const [off, setOff] = useState<[number, number]>([0, 0]);
  const moved = a.path ? translatePath(a.path, off[0], off[1]) : a.footprint ? translatePath(a.footprint, off[0], off[1]) : [];
  const label = ASSET_STYLE[a.kind]?.label ?? a.kind;
  useEffect(() => {
    viewer?.highlightAsset(a.id);
    viewer?.showDraft(off[0] || off[1] ? moved : [], { closed: !a.path, color: '#facc15' });
    return () => viewer?.showDraft([]);
  }, [off, viewer]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    const set: Record<string, any> = {};
    if (name.trim() && name !== a.name) set.name = name.trim();
    if (depth !== a.depth_m) set.depth_m = depth;
    if (a.path && diameter / 2 !== a.radius_m) set.radius_m = diameter / 2;
    if (buffer !== a.buffer_m) set.buffer_m = buffer;
    if (off[0] || off[1]) set[a.path ? 'path' : 'footprint'] = moved;
    if (Object.keys(set).length) await onOps([{ op: 'asset.update', id: a.id, set }]);
  };
  return (
    <div className="space-y-2 b3-fade">
      <div className="b3-serif text-base flex items-center gap-1.5 pt-1">
        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: ASSET_STYLE[a.kind]?.color }} /> {label}
        <span className="font-mono text-[10.5px] text-[#7d8c97]">{a.id}</span>
      </div>
      <input value={name} onChange={(e) => setName(e.target.value)} className="b3-input" aria-label="Name" />
      <Section title="Depth and size">
        <Num label={a.footprint ? 'Depth of the lowest floor' : 'Depth below ground (centre)'} value={depth} step={0.1} min={0.3} max={60} suffix="m" onChange={setDepth} />
        {a.path && <Num label={a.kind === 'metro' || a.kind.endsWith('tunnel') ? 'Bore diameter' : 'Pipe diameter'} value={diameter} step={0.05} min={0.05} max={16} suffix="m" onChange={setDiameter} />}
        <Num label="Safety buffer" value={buffer} step={0.5} min={0} max={20} suffix="m" onChange={setBuffer} />
      </Section>
      <Section title="Position">
        <Nudge onMove={(dx, dy) => setOff(([x, y]) => [+(x + dx).toFixed(2), +(y + dy).toFixed(2)])} />
        {a.path && <button type="button" onClick={onRedraw} className="w-full b3-btn"><PenLine className="w-3.5 h-3.5" /> Redraw the alignment on the ground</button>}
      </Section>
      <div className="flex gap-1 pt-2">
        <button type="button" onClick={apply} disabled={busy} className="flex-1 b3-btn b3-btn-teal !py-2"><Check className="w-4 h-4" /> Apply changes</button>
        <button type="button" onClick={async () => { await onOps([{ op: 'asset.delete', id: a.id }]); onDone(); }} disabled={busy}
          className="b3-btn b3-btn-danger" title={`Delete this ${label.toLowerCase()}`} aria-label={`Delete this ${label.toLowerCase()}`}><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------------------------------------------ road / flyover form
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
    <div className="space-y-2 b3-fade">
      <div className="b3-serif text-base flex items-center gap-1.5 pt-1"><Route className="w-4 h-4 text-[#1f7a72]" /> {r.is_bridge ? 'Flyover' : 'Road'} <span className="font-mono text-[10.5px] text-[#7d8c97]">{r.id}</span></div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="b3-input" aria-label="Name" />
      <Section title="Deck">
        <Num label="Height above ground (0 = at street level)" value={elev} step={0.5} min={0} max={40} suffix="m" onChange={setElev} />
        <Num label="Width" value={width} step={0.5} min={3} max={40} suffix="m" onChange={setWidth} />
      </Section>
      <Section title="Position">
        <Nudge onMove={(dx, dy) => setOff(([x, y]) => [+(x + dx).toFixed(2), +(y + dy).toFixed(2)])} />
        <button type="button" onClick={onRedraw} className="w-full b3-btn"><Move className="w-3.5 h-3.5" /> Redraw the alignment</button>
      </Section>
      <div className="flex gap-1 pt-2">
        <button type="button" onClick={apply} disabled={busy} className="flex-1 b3-btn b3-btn-teal !py-2"><Check className="w-4 h-4" /> Apply changes</button>
        <button type="button" onClick={async () => { await onOps([{ op: 'road.delete', id: r.id }]); onDone(); }} disabled={busy}
          className="b3-btn b3-btn-danger" title="Delete" aria-label="Delete"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

export default EditorPanel;

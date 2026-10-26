import api from '../lib/api';
import { trackAction } from '../lib/track';

// area names for readable analytics messages
const names = new Map<string, string>();
const nameOf = (key: string) => names.get(key) || `area ${key}`;
const remember = (key: string, place?: { locality?: string; city?: string }) => {
  const n = [place?.locality, place?.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  if (n) names.set(key, n);
};
const describeOps = (ops: EditOp[]) => ops.map((o: any) => `${o.op}${o.id ? ` ${o.id}` : ''}${o.set ? ` (${Object.keys(o.set).join(', ')})` : ''}`).join('; ');
import type { SceneSpec, BuildingDetail, ExcavationResult, GenerationJob, SceneMeta, RegistryEntry, EditOp, FindingRow, RegistryHit, ActivityEvent, DatasetManifest } from './sceneSpec';

export const apiOrigin = (): string => {
  const base = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '') : '';
  return base;
};

export async function startGeneration(polygon: GeoJSON.Polygon, projectId?: string, force = false, datasets?: DatasetManifest[]) {
  memo.clear(); // a regenerated area must not show its old scene
  trackAction('generation_started', `started a 3D reconstruction${datasets?.length ? ` with ${datasets.length} survey datasets` : ''}${force ? ' (forced rebuild)' : ''}`,
    { datasets: datasets?.map((d) => d.title), force });
  const { data } = await api.post<{ job_id: string; key: string; status: string }>('/realgen/generate', {
    polygon,
    project_id: projectId,
    force,
    datasets,
  });
  return data;
}

export async function getJob(jobId: string) {
  const { data } = await api.get<GenerationJob>(`/realgen/jobs/${jobId}`);
  return data;
}

// Session cache for the heavier per-area reads (the API is far away on free hosting). Any write to an area clears
// that area's entries, so an edited area is always re-read.
const memo = new Map<string, Promise<any>>();
const cached = <T,>(k: string, load: () => Promise<T>): Promise<T> => {
  if (!memo.has(k)) memo.set(k, load().catch((e) => { memo.delete(k); throw e; }));
  return memo.get(k) as Promise<T>;
};
export const forgetArea = (key: string) => { [...memo.keys()].filter((k) => k.includes(`|${key}|`)).forEach((k) => memo.delete(k)); };

export async function getScene(key: string) {
  const scene = await cached(`scene|${key}|`, async () => (await api.get<SceneSpec>(`/realgen/scenes/${key}`)).data);
  remember(key, scene.place);
  trackAction('area_opened', `opened the 3D world of ${nameOf(key)} (${scene.stats?.buildings ?? 0} buildings)`, { key });
  return scene;
}

export async function getBuildingDetail(key: string, buildingId: string) {
  const d = await cached(`bld|${key}|${buildingId}`, async () => (await api.get<BuildingDetail>(`/realgen/scenes/${key}/buildings/${buildingId}`)).data);
  trackAction('building_inspected', `inspected ${d.building?.name || buildingId} (${buildingId}) in ${nameOf(key)}`, { key, building: buildingId });
  return d;
}

export async function checkExcavation(key: string, polygonLocal: [number, number][], depth: number) {
  const { data } = await api.post<ExcavationResult>(`/realgen/scenes/${key}/excavation`, {
    polygon_local: polygonLocal,
    depth_meters: depth,
  });
  trackAction('dig_check', `ran a dig check ${depth.toFixed(1)} m deep in ${nameOf(key)}: ${data.overall_risk_level.replace('_', ' ').toLowerCase()} (${data.clashes_detected_count} asset(s) nearby)`,
    { key, depth, risk: data.overall_risk_level });
  return data;
}

export const textureUrl = (scene: SceneSpec, name: 'texture' | 'context' = 'texture') => {
  const path = name === 'texture' ? scene.texture.url : scene.context_texture?.url;
  return `${apiOrigin()}${path}`;
};

/** Shoelace area in m² for a lon/lat ring (equirectangular, fine below a few km). */
export function ringAreaM2(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const lat0 = (ring.reduce((s, p) => s + p[1], 0) / ring.length) * (Math.PI / 180);
  const kx = 111320 * Math.cos(lat0);
  const ky = 110540;
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    a += x1 * kx * (y2 * ky) - x2 * kx * (y1 * ky);
  }
  return Math.abs(a) / 2;
}

export const MAX_AREA_M2 = 500_000;
export const MIN_AREA_M2 = 2_000;

export async function listScenes() {
  const { data } = await api.get<SceneMeta[]>('/realgen/scenes');
  data.forEach((m) => remember(m.key, m.place));
  return data;
}

export async function listFindings(key?: string) {
  const { data } = await api.get<FindingRow[]>('/realgen/findings', { params: key ? { key } : {} });
  return data;
}

export async function searchAllRegistries(q: string, limit = 50, status = '') {
  trackSearch(q, ' (all areas)');
  const { data } = await api.get<RegistryPage<RegistryHit>>('/realgen/registry', { params: { q, limit, status } });
  return data;
}

export interface LedgerUnit {
  id: string; anchor: string; bkey: string; building_id: string; floor: number; unit_index: number; unit_code: string;
  status: string; usage_class: string; version: number; minted_at: number; retired_at?: number; retire_reason?: string; parents: string[];
}

export async function getLineage(key: string, q = '', status = '', limit = 200) {
  const { data } = await api.get<{ total: number; by_status: Record<string, number>; items: LedgerUnit[] }>(`/realgen/scenes/${key}/lineage`, { params: { q, status, limit } });
  return data;
}

export async function listActivity(key?: string) {
  const { data } = await api.get<ActivityEvent[]>('/realgen/activity', { params: key ? { key } : {} });
  return data;
}

/** Public satellite image of a generated area (used as a thumbnail). */
export const areaThumbUrl = (key: string) => `${apiOrigin()}/api/realgen/scenes/${key}/texture.jpg`;

export async function deleteScene(key: string) {
  trackAction('area_deleted', `deleted ${nameOf(key)} and all its data`, { key });
  forgetArea(key);
  await api.delete(`/realgen/scenes/${key}`);
}

export async function applyEdits(key: string, ops: EditOp[]) {
  trackAction('edit_applied', `applied ${ops.length} edit(s) to ${nameOf(key)}: ${describeOps(ops)}`, { key, ops });
  forgetArea(key);
  const { data } = await api.post<SceneSpec>(`/realgen/scenes/${key}/edits`, { ops }, { timeout: 120000 });
  forgetArea(key);
  memo.set(`scene|${key}|`, Promise.resolve(data));
  return data;
}

export async function undoEdit(key: string) {
  trackAction('edit_undone', `undid the last edit in ${nameOf(key)}`, { key });
  forgetArea(key);
  const { data } = await api.post<SceneSpec>(`/realgen/scenes/${key}/edits/undo`, {}, { timeout: 120000 });
  forgetArea(key);
  memo.set(`scene|${key}|`, Promise.resolve(data));
  return data;
}

export async function resetEdits(key: string) {
  trackAction('edits_reset', `reset all edits in ${nameOf(key)}`, { key });
  forgetArea(key);
  const { data } = await api.delete<SceneSpec>(`/realgen/scenes/${key}/edits`, { timeout: 120000 });
  forgetArea(key);
  memo.set(`scene|${key}|`, Promise.resolve(data));
  return data;
}

export type RegistryPage<T> = { total: number; matches: number; by_status?: Record<string, number>; items: T[] };

let lastSearch = '';
const trackSearch = (q: string, where: string) => {
  const t = q.trim();
  if (t.length >= 3 && t !== lastSearch) { lastSearch = t; trackAction('registry_search', `searched the 3D ULPIN registry${where} for "${t.slice(0, 60)}"`, { q: t }); }
};

export async function searchRegistry(key: string, q: string, limit = 50, status = '') {
  trackSearch(q, ` of ${nameOf(key)}`);
  const { data } = await api.get<RegistryPage<RegistryEntry>>(`/realgen/scenes/${key}/registry`, { params: { q, limit, status } });
  return data;
}

export async function resolveId(key: string, id: string) {
  const { data } = await api.get<{ kind: 'unit' | 'building'; building_id: string; floor?: number; unit_index?: number; vprid?: string }>(
    `/realgen/scenes/${key}/resolve/${encodeURIComponent(id)}`,
  );
  return data;
}

/** Is this lon/lat inside India? (Nominatim reverse; the server re-checks before generating.) */
export async function isInIndia(lon: number, lat: number): Promise<boolean | null> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=5&lat=${lat}&lon=${lon}`);
    const d = await r.json();
    const cc = d?.address?.country_code;
    return cc ? cc === 'in' : null;
  } catch {
    return null;
  }
}

export const INDIA_BOUNDS: [[number, number], [number, number]] = [[66.5, 5.5], [99.0, 38.0]];
export const DRAW_MIN_ZOOM = 15;
export const DRAW_MAX_ZOOM = 19;

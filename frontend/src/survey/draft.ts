import { create } from 'zustand';
import type { DatasetManifest } from '../world/sceneSpec';

/**
 * The survey being prepared: the polygon the surveyor drew, its place name, and the datasets attached to it in the
 * ingestion step. Kept in localStorage so a reload, or a detour to another page, does not lose the work.
 */
export type SlotState = {
  status: 'idle' | 'uploading' | 'validating' | 'ready' | 'error';
  progress: number; // 0–100 while uploading
  file?: { name: string; size: number; sample: boolean };
  checks: string[]; // validation lines shown once ready
  error?: string;
};

export interface SurveyDraft {
  id: string;
  polygon: GeoJSON.Polygon;
  areaM2: number;
  centre: [number, number];
  place?: string;
  createdAt: number;
  slots: Record<string, SlotState>;
}

const KEY = 'bharat3d_survey_draft';

const load = (): SurveyDraft | null => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SurveyDraft) : null;
  } catch {
    return null;
  }
};

const save = (d: SurveyDraft | null) => {
  try {
    if (d) localStorage.setItem(KEY, JSON.stringify(d));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the draft lives for this session only */
  }
};

interface DraftStore {
  draft: SurveyDraft | null;
  start: (polygon: GeoJSON.Polygon, areaM2: number, place?: string) => SurveyDraft;
  setPlace: (place: string) => void;
  setSlot: (slot: string, s: Partial<SlotState>) => void;
  resetSlots: () => void;
  clear: () => void;
}

export const useSurveyDraft = create<DraftStore>((set, get) => ({
  draft: load(),
  start: (polygon, areaM2, place) => {
    const ring = polygon.coordinates[0].slice(0, -1);
    const centre: [number, number] = [
      ring.reduce((a, p) => a + p[0], 0) / ring.length,
      ring.reduce((a, p) => a + p[1], 0) / ring.length,
    ];
    const d: SurveyDraft = { id: Math.random().toString(36).slice(2, 10), polygon, areaM2, centre, place, createdAt: Date.now(), slots: {} };
    save(d);
    set({ draft: d });
    return d;
  },
  setPlace: (place) => {
    const d = get().draft;
    if (!d) return;
    const n = { ...d, place };
    save(n);
    set({ draft: n });
  },
  setSlot: (slot, s) => {
    const d = get().draft;
    if (!d) return;
    const prev = d.slots[slot] ?? { status: 'idle', progress: 0, checks: [] };
    const n = { ...d, slots: { ...d.slots, [slot]: { ...prev, ...s } } };
    // uploads in flight do not survive a reload; only finished ones are persisted (and only on a status change)
    if (s.status) save({ ...n, slots: Object.fromEntries(Object.entries(n.slots).filter(([, v]) => v.status === 'ready')) });
    set({ draft: n });
  },
  resetSlots: () => {
    const d = get().draft;
    if (!d) return;
    const n = { ...d, slots: {} };
    save(n);
    set({ draft: n });
  },
  clear: () => {
    save(null);
    set({ draft: null });
  },
}));

export const readyCount = (d: SurveyDraft | null, total: number) =>
  d ? Math.min(total, Object.values(d.slots).filter((s) => s.status === 'ready').length) : 0;

/** Place name for a lon/lat (OSM Nominatim). */
export async function reversePlace(lon: number, lat: number): Promise<string | undefined> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&lat=${lat}&lon=${lon}`);
    const d = await r.json();
    const a = d?.address ?? {};
    const local = a.neighbourhood || a.suburb || a.quarter || a.village || a.town || a.road;
    const city = a.city || a.town || a.county || a.state_district || a.state;
    return [local, city].filter(Boolean).filter((v, i, xs) => xs.indexOf(v) === i).join(', ') || undefined;
  } catch {
    return undefined;
  }
}

export type { DatasetManifest };

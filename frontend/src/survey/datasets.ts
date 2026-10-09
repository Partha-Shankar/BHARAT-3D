import type { LucideIcon } from 'lucide-react';
import { Plane, ScanLine, LandPlot, FileBadge2, LayoutPanelTop, Cable } from 'lucide-react';
import type { DatasetManifest } from '../world/sceneSpec';
import type { SlotState, SurveyDraft } from './draft';

/** The six datasets of a survey package, and which part of the 3D record each one feeds. */
export interface DatasetSlot {
  id: string;
  title: string;
  icon: LucideIcon;
  formats: string[]; // shown and accepted
  feeds: string; // what it is used for in the 3D record
  mbPerHa: number; // typical size per hectare, for sample files
  checks: (draft: SurveyDraft, sample: boolean) => string[];
}

const ha = (d: SurveyDraft) => d.areaM2 / 10_000;
const zone = (d: SurveyDraft) => 32600 + Math.floor((d.centre[0] + 180) / 6) + 1; // UTM north zone EPSG

export const DATASET_SLOTS: DatasetSlot[] = [
  {
    id: 'ortho',
    title: 'Drone orthomosaic',
    icon: Plane,
    formats: ['.tif', '.tiff', '.jp2', '.jpg', '.png'],
    feeds: 'Roof outlines and ground imagery',
    mbPerHa: 52,
    checks: (d) => [`Georeferenced · EPSG:${zone(d)} → EPSG:4326`, 'Ground sample distance 3.1 cm/px', 'Covers 100% of the survey polygon'],
  },
  {
    id: 'lidar',
    title: 'LiDAR point cloud',
    icon: ScanLine,
    formats: ['.las', '.laz'],
    feeds: 'Building heights and floor counts',
    mbPerHa: 24,
    checks: (d) => [`${Math.round(ha(d) * 1.9).toLocaleString('en-IN')} M points · 42 pts/m²`, 'ASPRS classes 2, 6, 17 present', 'Vertical datum checked'],
  },
  {
    id: 'cadastre',
    title: 'Cadastral parcels (2D ULPIN)',
    icon: LandPlot,
    formats: ['.geojson', '.json', '.shp', '.zip', '.kml', '.gpkg'],
    feeds: 'Parent parcels and their ULPINs',
    mbPerHa: 0.06,
    checks: (d) => [`${Math.max(4, Math.round(ha(d) * 2.4))} parcel polygons · closed rings`, '14-character ULPIN on every parcel', 'No overlaps above 0.05 m²'],
  },
  {
    id: 'sanctions',
    title: 'Building sanction register',
    icon: FileBadge2,
    formats: ['.csv', '.xlsx', '.xls'],
    feeds: 'Sanctioned floors and permits for compliance checks',
    mbPerHa: 0.012,
    checks: (d) => [`${Math.max(3, Math.round(ha(d) * 5.6))} permit rows · ULPIN matched`, 'Columns: permit no., floors, height, date', 'Dates parsed (DD-MM-YYYY)'],
  },
  {
    id: 'plans',
    title: 'Floor plans / BIM',
    icon: LayoutPanelTop,
    formats: ['.dxf', '.dwg', '.ifc', '.pdf'],
    feeds: 'Units, cores and room layouts per floor',
    mbPerHa: 3.4,
    checks: (d) => [`${Math.max(2, Math.round(ha(d) * 1.3))} buildings · ${Math.max(6, Math.round(ha(d) * 9))} floor sheets`, 'Layers: walls, doors, units', 'Scale 1:100 confirmed'],
  },
  {
    id: 'utilities',
    title: 'Utility & subsurface records',
    icon: Cable,
    formats: ['.geojson', '.dxf', '.csv', '.shp', '.zip'],
    feeds: 'Pipes, cables and tunnels for the dig check',
    mbPerHa: 0.3,
    checks: () => ['Water, sewer, power, telecom networks', 'Depths recorded in metres below ground', 'Operator and safety buffer per asset'],
  },
];

const slug = (s?: string) =>
  (s ?? 'survey').split(',')[0].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'survey';

/** A realistic file for the sample survey package, sized to the area. */
export function sampleFile(slot: DatasetSlot, d: SurveyDraft) {
  const ext = slot.formats[0].replace('.', '');
  const names: Record<string, string> = {
    ortho: `${slug(d.place)}_ortho_3cm.${ext}`,
    lidar: `${slug(d.place)}_aerial_lidar.laz`,
    cadastre: `${slug(d.place)}_ulpin_parcels.geojson`,
    sanctions: `${slug(d.place)}_building_sanctions.xlsx`,
    plans: `${slug(d.place)}_floor_plans.dxf`,
    utilities: `${slug(d.place)}_utility_network.geojson`,
  };
  const size = Math.max(0.04, slot.mbPerHa * ha(d)) * 1024 * 1024;
  return { name: names[slot.id] ?? `${slot.id}.${ext}`, size: Math.round(size), sample: true };
}

export function acceptsFile(slot: DatasetSlot, name: string) {
  const n = name.toLowerCase();
  return slot.formats.some((f) => n.endsWith(f));
}

export const fmtBytes = (b: number) =>
  b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

/**
 * Simulated transfer: progress follows an eased curve whose duration grows with file size, then a short validation
 * pass. Returns a cancel function.
 */
export function simulateUpload(
  slot: DatasetSlot,
  draft: SurveyDraft,
  file: { name: string; size: number; sample: boolean },
  update: (s: Partial<SlotState>) => void,
  delayMs = 0,
): () => void {
  let raf = 0;
  let t1 = 0;
  let t0 = 0;
  const mb = file.size / 1024 / 1024;
  const duration = Math.min(5200, 1100 + Math.sqrt(mb) * 260);
  const start = window.setTimeout(() => {
    update({ status: 'uploading', progress: 0, file, checks: [], error: undefined });
    const begin = performance.now();
    const tick = (t: number) => {
      const k = Math.min((t - begin) / duration, 1);
      // ease-in-out with a little hesitation in the middle, like a real transfer
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      update({ progress: Math.round(e * 100) });
      if (k < 1) raf = requestAnimationFrame(tick);
      else {
        update({ status: 'validating', progress: 100 });
        t1 = window.setTimeout(() => update({ status: 'ready', checks: slot.checks(draft, file.sample) }), 900 + Math.random() * 500);
      }
    };
    raf = requestAnimationFrame(tick);
  }, delayMs);
  t0 = start;
  return () => {
    window.clearTimeout(t0);
    window.clearTimeout(t1);
    cancelAnimationFrame(raf);
  };
}

export function manifest(d: SurveyDraft): DatasetManifest[] {
  return DATASET_SLOTS.flatMap((slot) => {
    const s = d.slots[slot.id];
    if (!s || s.status !== 'ready' || !s.file) return [];
    return [{
      slot: slot.id, title: slot.title, name: s.file.name, size_bytes: s.file.size,
      format: s.file.name.split('.').pop()?.toUpperCase() ?? '', checks: s.checks, sample: s.file.sample,
    }];
  });
}

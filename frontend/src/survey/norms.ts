/**
 * 3D ULPIN norms (B3D-PROP-2026-ULPIN-01 Rev 3) on the client: status vocabulary, identity kinds, usage classes and
 * an identifier parser. Software never derives owner, use or status from the ID string; parsing is for display only.
 */

export const UNIT_RE = /^([0-9A-Z]{14}|INF-(PUB|PRK|AIR|MAR)-[A-Z]{2}[0-9]{2}-[0-9]{4})-BL[0-9]{2,3}-(L[0-9]{2}|S[0-9]{2}|RF)-(U[0-9]{3,4}|UFLR)$/;
export const INF_RE = /^INF-(TUN|FLY|AIR|PUB|PRK|MAR)-[A-Z]{2}[0-9]{2}-[0-9]{4}$/;
export const UTL_RE = /^INF-UTL-(GAS|PWR|WAT|SEW|TEL)-[A-Z]{2}[0-9]{2}-[0-9]{6}$/;

/** Status of a registry row. PROVISIONAL / CERTIFIED_AS_BUILT carry a minted ID; the others do not. */
export const STATUS: Record<string, { label: string; cls: string; minted: boolean; hint: string }> = {
  PROVISIONAL: { label: 'Provisional', cls: 'b3-chip-real', minted: true, hint: 'Minted from the model; awaiting as-built certification' },
  CERTIFIED_AS_BUILT: { label: 'Certified as built', cls: 'b3-chip-real', minted: true, hint: 'Surveyor-certified; the ID string is unchanged' },
  PENDING: { label: 'Pending', cls: 'b3-chip-alert', minted: false, hint: 'Open failure (sanction, integrity axiom): not minted' },
  NOT_REQUIRED_2D: { label: '2D ULPIN suffices', cls: 'b3-chip-plain', minted: false, hint: '2D-Sufficiency Rule: one title over the whole parcel column' },
  PROPOSAL: { label: 'AI proposal', cls: 'b3-chip-ai', minted: false, hint: 'AI-extracted; no ULPIN until a surveyor verifies it' },
  PART_OF_INF_PUB: { label: 'Inside public asset', cls: 'b3-chip-ai', minted: false, hint: 'Part of an INF-PUB volume' },
  RETIRED: { label: 'Retired', cls: 'b3-chip-plain', minted: false, hint: 'Partitioned or merged; never reused' },
  HISTORICAL_DEMOLISHED: { label: 'Demolished', cls: 'b3-chip-plain', minted: false, hint: 'Volume ceased to exist; never reused' },
  CANCELLED: { label: 'Cancelled', cls: 'b3-chip-plain', minted: false, hint: 'Provisional ID of an abandoned design' },
};
export const statusOf = (s?: string | null) => STATUS[s ?? ''] ?? { label: (s ?? '').replace(/_/g, ' ').toLowerCase(), cls: 'b3-chip-plain', minted: false, hint: '' };

export const IDENTITY: Record<string, { label: string; cls: string }> = {
  STRATA: { label: '3D ULPIN per unit', cls: 'b3-chip-real' },
  SINGLE_TITLE: { label: '2D ULPIN suffices', cls: 'b3-chip-plain' },
  INF_PUB: { label: 'Public asset · INF-PUB', cls: 'b3-chip-ai' },
  PROPOSAL: { label: 'AI proposal · unverified', cls: 'b3-chip-ai' },
};

export const USAGE_CLASS: Record<string, string> = {
  R: 'Residential', C: 'Commercial', I: 'Industrial', M: 'Mixed', U: 'Utility / institutional', P: 'Parking',
};

export const INF_CLASS: Record<string, string> = {
  TUN: 'Tunnel bore', FLY: 'Flyover / viaduct', PUB: 'Public asset', PRK: 'Public parking', AIR: 'Air-rights envelope', MAR: 'Marine lease',
  'UTL-GAS': 'Gas corridor', 'UTL-PWR': 'Power corridor', 'UTL-WAT': 'Water corridor', 'UTL-SEW': 'Sewer corridor', 'UTL-TEL': 'Telecom corridor',
};

export type IdSegment = { label: string; value: string; color: string; note: string };

/** Split an identifier into labelled segments for the decoder. */
export function parseId(id: string): { kind: 'unit' | 'inf' | 'utl' | 'unknown'; segments: IdSegment[] } {
  const level = (v: string) => (v === 'RF' ? 'Volume above the roof slab' : v.startsWith('S') ? `Basement ${+v.slice(1)} (counted down)` : v === 'L00' ? 'Ground floor (incl. stilt)' : `Floor ${+v.slice(1)}`);
  if (UNIT_RE.test(id)) {
    const parts = id.split('-');
    const tail = parts.slice(-3);
    const anchor = parts.slice(0, -3).join('-');
    return {
      kind: 'unit',
      segments: [
        { label: 'Anchor', value: anchor, color: '#1e4d6b', note: anchor.startsWith('INF-') ? 'Host public asset (INF)' : 'Base 2D ULPIN, unmodified (opaque)' },
        { label: 'Building', value: tail[0], color: '#1f7a72', note: 'Building on the anchor; never reassigned' },
        { label: 'Level', value: tail[1], color: '#c8962e', note: level(tail[1]) },
        { label: 'Unit', value: tail[2], color: '#c0392b', note: tail[2] === 'UFLR' ? 'Whole level under one deed' : 'Unit number; never reused' },
      ],
    };
  }
  if (UTL_RE.test(id)) {
    const [, , type, zone, seq] = id.split('-');
    return {
      kind: 'utl',
      segments: [
        { label: 'Class', value: 'INF-UTL', color: '#1e4d6b', note: 'Subsurface utility corridor' },
        { label: 'Type', value: type, color: '#1f7a72', note: INF_CLASS[`UTL-${type}`] ?? type },
        { label: 'Zone', value: zone, color: '#c8962e', note: 'State code + local zone' },
        { label: 'Sequence', value: seq, color: '#c0392b', note: 'Six-digit sequence' },
      ],
    };
  }
  if (INF_RE.test(id)) {
    const [, cls, zone, seq] = id.split('-');
    return {
      kind: 'inf',
      segments: [
        { label: 'Class', value: `INF-${cls}`, color: '#1e4d6b', note: INF_CLASS[cls] ?? cls },
        { label: 'Zone', value: zone, color: '#c8962e', note: 'State code + local zone' },
        { label: 'Sequence', value: seq, color: '#c0392b', note: 'Never reused' },
      ],
    };
  }
  return { kind: 'unknown', segments: [{ label: 'ID', value: id, color: '#1b3344', note: '' }] };
}

/** Undivided share in ppm, shown as a percentage. */
export const ppmToPct = (ppm?: number | null) => (ppm === null || ppm === undefined ? '—' : `${(ppm / 10_000).toFixed(4)} % (${ppm.toLocaleString('en-IN')} ppm)`);

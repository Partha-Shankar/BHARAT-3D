/**
 * Copy and pacing for the generation screens.
 *
 * The server reports which of the 13 pipeline stages is running (and, for downloads, how far it has got). Between
 * those reports the page moves the bar on by time, using the typical length of each stage on the free server, and
 * cycles through the messages below, so the user always sees the work going on.
 */

/** Typical seconds per pipeline stage on the free server (same order as pipeline.STAGES). */
export const STAGE_WEIGHTS = [3, 12, 8, 18, 6, 4, 4, 6, 10, 5, 4, 6, 20];

/** What each stage is doing, in plain words. */
export const STAGE_THOUGHTS: string[][] = [
  ['Locating the survey area on the map…', 'Looking up the locality, city and state…', 'Confirming the area lies inside India…'],
  ['Asking OpenStreetMap what is inside the boundary…', 'Collecting building footprints…', 'Tracing road centre-lines and junctions…',
    'Looking for rail lines, stations and metro entrances…', 'Finding parks, water bodies and trees…', 'Checking power lines and pipelines…'],
  ['Downloading elevation tiles…', 'Decoding terrain heights…', 'Filling small gaps in the elevation model…', 'Building the ground surface…'],
  ['Downloading satellite imagery tiles…', 'Choosing the sharpest zoom with real imagery…', 'Stitching tiles into one mosaic…',
    'Fetching a wider ring of imagery so the city reaches the horizon…'],
  ['Measuring every building footprint…', 'Estimating heights from tags and building type…', 'Checking floor counts against footprint size…'],
  ['Scanning the imagery for buildings missing from the map…', 'Comparing detections with mapped footprints…', 'Keeping only confident detections as proposals…'],
  ['Estimating building heights from the imagery…', 'Calibrating heights against surveyed buildings…'],
  ['Laying out road widths and footpaths…', 'Separating flyovers, bridges and tunnels…', 'Placing rail lines and underground sections…'],
  ['Dividing the land into parcels…', 'Splitting buildings into floors and units…', 'Reserving a 3D ULPIN for every volume…'],
  ['Checking setbacks and floor limits…', 'Looking for road and footpath encroachments…', 'Comparing floors with sanctioned plans…'],
  ['Modelling water, sewer and power lines below ground…', 'Adding metro and utility corridors…'],
  ['Naming buildings and streets…', 'Writing a short summary of the area…'],
  ['Assembling the 3D scene…', 'Packing floors, units and identities…', 'Running integrity checks on every ID…',
    'Saving the area so it opens instantly next time…'],
];

/** Messages while an area is checked before the survey continues. */
export const CHECK_THOUGHTS = [
  'Checking the boundary and the area size…',
  'Confirming the area is inside India…',
  'Asking OpenStreetMap what is inside the boundary…',
  'Counting buildings and road segments…',
  'Estimating how long the 3D build will take…',
];

/**
 * Overall progress in percent (0..98.5) for a running job: finished stages count by their typical length, and the
 * running stage fills by the server's own fraction or by elapsed time, whichever is further, without ever reaching
 * the next stage on time alone.
 */
export function overallProgress(stageIndex: number, stageCount: number, inStageSeconds: number, serverFraction = 0): number {
  if (stageCount <= 0) return 0;
  if (stageIndex >= stageCount) return 98.5;
  const w = Array.from({ length: stageCount }, (_, i) => STAGE_WEIGHTS[i] ?? 6);
  const total = w.reduce((a, b) => a + b, 0);
  const before = w.slice(0, stageIndex).reduce((a, b) => a + b, 0);
  const span = w[stageIndex];
  const t = Math.max(0, inStageSeconds);
  // fast at first, then slower and slower: about 55 % of the stage after its typical length, never 100 %
  const byTime = 0.82 * (1 - Math.exp(-t / span)) + 0.12 * (1 - Math.exp(-t / (span * 8)));
  const f = Math.min(0.94, Math.max(byTime, serverFraction));
  return Math.min(98.5, ((before + span * f) / total) * 98);
}

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const durationText = (seconds: number) =>
  seconds < 90 ? 'about a minute' : `about ${Math.round(seconds / 60)} minutes`;

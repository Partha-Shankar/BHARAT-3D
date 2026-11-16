import type { XY } from './sceneSpec';

export const centroid = (pts: XY[]): XY => [
  pts.reduce((a, p) => a + p[0], 0) / pts.length,
  pts.reduce((a, p) => a + p[1], 0) / pts.length,
];

/** Angle (radians) of the longest edge: the building's main axis. */
export function mainAxis(fp: XY[]): number {
  let best = 0, ang = 0;
  fp.forEach((p, i) => {
    const q = fp[(i + 1) % fp.length];
    const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l > best) {
      best = l;
      ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    }
  });
  return ang;
}

export interface FootprintTransform {
  dx: number; // metres east
  dy: number; // metres north
  rot: number; // degrees, counter-clockwise
  sl: number; // scale along the main axis
  sw: number; // scale across it
}

export const IDENTITY: FootprintTransform = { dx: 0, dy: 0, rot: 0, sl: 1, sw: 1 };
export const isIdentity = (t: FootprintTransform) => t.dx === 0 && t.dy === 0 && t.rot === 0 && t.sl === 1 && t.sw === 1;

export function transformFootprint(fp: XY[], t: FootprintTransform): XY[] {
  const [cx, cy] = centroid(fp);
  const a = mainAxis(fp);
  const r = (t.rot * Math.PI) / 180;
  return fp.map(([x, y]) => {
    const vx = x - cx, vy = y - cy;
    let u = vx * Math.cos(-a) - vy * Math.sin(-a);
    let w = vx * Math.sin(-a) + vy * Math.cos(-a);
    u *= t.sl;
    w *= t.sw;
    const b = a + r;
    return [
      Math.round((cx + t.dx + u * Math.cos(b) - w * Math.sin(b)) * 100) / 100,
      Math.round((cy + t.dy + u * Math.sin(b) + w * Math.cos(b)) * 100) / 100,
    ];
  });
}

export const translatePath = (path: XY[], dx: number, dy: number): XY[] => path.map(([x, y]) => [x + dx, y + dy]);

/** Edge lengths of the footprint's oriented box (length, width) in metres. */
export function footprintSize(fp: XY[]): [number, number] {
  const a = mainAxis(fp);
  const us = fp.map(([x, y]) => x * Math.cos(-a) - y * Math.sin(-a));
  const ws = fp.map(([x, y]) => x * Math.sin(-a) + y * Math.cos(-a));
  return [Math.max(...us) - Math.min(...us), Math.max(...ws) - Math.min(...ws)];
}

export function rectAround([x, y]: XY, length = 16, width = 12): XY[] {
  return [[x - length / 2, y - width / 2], [x + length / 2, y - width / 2], [x + length / 2, y + width / 2], [x - length / 2, y + width / 2]];
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** A `length` × `width` rectangle centred on a point, its long side at `angle` radians from east. */
export function rectAt([x, y]: XY, length: number, width: number, angle = 0): XY[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return ([[-length / 2, -width / 2], [length / 2, -width / 2], [length / 2, width / 2], [-length / 2, width / 2]] as XY[])
    .map(([u, w]) => [round2(x + u * c - w * s), round2(y + u * s + w * c)]);
}

/** Direction (radians from east) of the road segment nearest to a point within `maxDist` metres, or null. */
export function nearestRoadAngle(roads: { path: XY[]; kind?: string }[], [x, y]: XY, maxDist = 60): number | null {
  let best = maxDist;
  let angle: number | null = null;
  for (const r of roads) {
    if (r.kind === 'footway') continue;
    for (let i = 1; i < r.path.length; i++) {
      const [ax, ay] = r.path[i - 1];
      const [bx, by] = r.path[i];
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
      if (d < best) {
        best = d;
        angle = Math.atan2(dy, dx);
      }
    }
  }
  return angle;
}

/** Degrees to turn a footprint so its walls run parallel to a street at `roadAngle` (the smallest turn, ±45°). */
export function alignRotation(fp: XY[], roadAngle: number): number {
  let deg = ((roadAngle - mainAxis(fp)) * 180) / Math.PI;
  deg = ((deg % 90) + 90) % 90; // walls are square, so any multiple of 90° lines up
  if (deg > 45) deg -= 90;
  return Math.round(deg * 10) / 10;
}

export const pathLength = (path: XY[]): number =>
  path.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]) : 0), 0);

/** Points every `spacing` metres along a polyline, starting at its first point (for rows of trees). */
export function pointsAlong(path: XY[], spacing: number): XY[] {
  const out: XY[] = [];
  if (!path.length || spacing <= 0) return out;
  let carry = 0;
  out.push([round2(path[0][0]), round2(path[0][1])]);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const len = Math.hypot(bx - ax, by - ay);
    let d = spacing - carry;
    while (d <= len) {
      out.push([round2(ax + ((bx - ax) * d) / len), round2(ay + ((by - ay) * d) / len)]);
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  return out;
}

/** Even-odd point-in-polygon test for a ring of scene-local points. */
export function pointInRing([x, y]: XY, ring: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

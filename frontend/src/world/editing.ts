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

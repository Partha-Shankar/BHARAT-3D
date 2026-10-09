import * as THREE from 'three';
import type { Building, SceneSpec, SubsurfaceAsset, XY } from './sceneSpec';
import { BAY_M, EARTH_DEPTH_M, FacadeSet, TILE_BAYS, TILE_FLOORS } from './textures';

/** Scene local (x = east, y = north, h = up) -> three.js (X east, Y up, Z south). */
export const v3 = (x: number, y: number, h: number) => new THREE.Vector3(x, h, -y);

// ----------------------------------------------------------------------------- terrain sampling
export class TerrainSampler {
  constructor(private spec: SceneSpec) {}

  heightAt(x: number, y: number): number {
    const { extent, n, heights } = this.spec.terrain;
    const u = Math.min(Math.max((x - extent[0]) / (extent[2] - extent[0]), 0), 1) * (n - 1);
    const v = Math.min(Math.max((extent[3] - y) / (extent[3] - extent[1]), 0), 1) * (n - 1);
    const x0 = Math.floor(u), y0 = Math.floor(v);
    const x1 = Math.min(x0 + 1, n - 1), y1 = Math.min(y0 + 1, n - 1);
    const fx = u - x0, fy = v - y0;
    const top = heights[y0][x0] * (1 - fx) + heights[y0][x1] * fx;
    const bot = heights[y1][x0] * (1 - fx) + heights[y1][x1] * fx;
    return top * (1 - fy) + bot * fy;
  }

  get minHeight() {
    return Math.min(...this.spec.terrain.heights.flat());
  }
}

// ----------------------------------------------------------------------------- buffer builder
/** Non-indexed triangle soup that fixes winding against a desired normal and records per-object ranges. */
export class Soup {
  pos: number[] = [];
  nrm: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  ranges: { startTri: number; index: number }[] = [];
  private color = [1, 1, 1];

  begin(index: number, color?: THREE.Color) {
    this.ranges.push({ startTri: this.pos.length / 9, index });
    this.color = color ? [color.r, color.g, color.b] : [1, 1, 1];
  }

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ua: number[], ub: number[], uc: number[], want: THREE.Vector3) {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-10) return;
    if (n.dot(want) < 0) {
      [b, c] = [c, b];
      [ub, uc] = [uc, ub];
    }
    for (const [p, t] of [[a, ua], [b, ub], [c, uc]] as [THREE.Vector3, number[]][]) {
      this.pos.push(p.x, p.y, p.z);
      this.nrm.push(want.x, want.y, want.z);
      this.uv.push(t[0], t[1]);
      this.col.push(...this.color);
    }
  }

  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, uvs: number[][], want: THREE.Vector3) {
    this.tri(a, b, c, uvs[0], uvs[1], uvs[2], want);
    this.tri(a, c, d, uvs[0], uvs[2], uvs[3], want);
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  /** Object index for a raycast faceIndex (binary search over ranges). */
  static lookup(ranges: { startTri: number; index: number }[], faceIndex: number): number {
    let lo = 0, hi = ranges.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ranges[mid].startTri <= faceIndex) {
        ans = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return ans >= 0 ? ranges[ans].index : -1;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

function triangulate(ring: XY[]): number[][] {
  const contour = ring.map(([x, y]) => new THREE.Vector2(x, y));
  return THREE.ShapeUtils.triangulateShape(contour, []);
}

/** Closed prism of a footprint between two heights (absolute three.js Y). */
export function addPrism(soup: Soup, ring: XY[], y0: number, y1: number, uvScale = 1, roofUv?: (x: number, y: number) => number[]) {
  let perim = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % ring.length];
    const len = Math.hypot(bx - ax, by - ay);
    if (len < 0.01) continue;
    const out = new THREE.Vector3(by - ay, 0, bx - ax).normalize();
    const u0 = perim / uvScale, u1 = (perim + len) / uvScale;
    soup.quad(v3(ax, ay, y0), v3(bx, by, y0), v3(bx, by, y1), v3(ax, ay, y1),
      [[u0, 0], [u1, 0], [u1, (y1 - y0) / uvScale], [u0, (y1 - y0) / uvScale]], out);
    perim += len;
  }
  const tris = triangulate(ring);
  const uvf = roofUv ?? (() => [0, 0]);
  for (const [a, b, c] of tris) {
    const [pa, pb, pc] = [ring[a], ring[b], ring[c]];
    soup.tri(v3(pa[0], pa[1], y1), v3(pb[0], pb[1], y1), v3(pc[0], pc[1], y1), uvf(...pa), uvf(...pb), uvf(...pc), UP);
    soup.tri(v3(pa[0], pa[1], y0), v3(pb[0], pb[1], y0), v3(pc[0], pc[1], y0), uvf(...pa), uvf(...pb), uvf(...pc), DOWN);
  }
}

// ----------------------------------------------------------------------------- terrain & context
/**
 * Satellite imagery already contains real-world lighting. Rendering it ~55% self-lit keeps its true
 * colours, while the lit share still darkens under building shadows and responds to time of day.
 */
export function imageryMaterial(tex: THREE.Texture, opts: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({
    map: tex, color: new THREE.Color(0.62, 0.62, 0.62), emissiveMap: tex, emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0.58, roughness: 1, metalness: 0, ...opts,
  });
}

export function buildTerrain(spec: SceneSpec, sat: THREE.Texture): THREE.Mesh {
  const { extent, n, heights } = spec.terrain;
  const w = extent[2] - extent[0], d = extent[3] - extent[1];
  const g = new THREE.PlaneGeometry(w, d, n - 1, n - 1);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) pos.setY(r * n + c, heights[r][c]);
  g.translate((extent[0] + extent[2]) / 2, 0, -(extent[1] + extent[3]) / 2);
  g.computeVertexNormals();
  const mat = imageryMaterial(sat, { transparent: true, opacity: 1 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  mesh.renderOrder = 1;
  return mesh;
}

export function buildContext(spec: SceneSpec, tex: THREE.Texture, y: number): THREE.Mesh | null {
  const ext = spec.context_texture?.extent;
  if (!ext) return null;
  const g = new THREE.PlaneGeometry(ext[2] - ext[0], ext[3] - ext[1]);
  g.rotateX(-Math.PI / 2);
  g.translate((ext[0] + ext[2]) / 2, y, -(ext[1] + ext[3]) / 2);
  const mesh = new THREE.Mesh(g, imageryMaterial(tex, { emissiveIntensity: 0.62 }));
  mesh.receiveShadow = true;
  mesh.name = 'context';
  return mesh;
}

/** Soil block under the survey extent: strata on the sides, depth labels painted in. */
export function buildEarthBlock(spec: SceneSpec, sampler: TerrainSampler, strata: THREE.Texture): THREE.Mesh {
  const [x0, y0, x1, y1] = spec.terrain.extent;
  const soup = new Soup();
  soup.begin(0);
  const bottom = -EARTH_DEPTH_M;
  const edges: [XY, XY, THREE.Vector3][] = [
    [[x0, y0], [x1, y0], new THREE.Vector3(0, 0, 1)], // south face
    [[x1, y0], [x1, y1], new THREE.Vector3(1, 0, 0)],
    [[x1, y1], [x0, y1], new THREE.Vector3(0, 0, -1)],
    [[x0, y1], [x0, y0], new THREE.Vector3(-1, 0, 0)],
  ];
  const steps = 40;
  let u = 0;
  for (const [[ax, ay], [bx, by], out] of edges) {
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const px0 = ax + (bx - ax) * t0, py0 = ay + (by - ay) * t0;
      const px1 = ax + (bx - ax) * t1, py1 = ay + (by - ay) * t1;
      const h0 = sampler.heightAt(px0, py0), h1 = sampler.heightAt(px1, py1);
      const seg = Math.hypot(px1 - px0, py1 - py0);
      const uA = u / 12, uB = (u + seg) / 12;
      soup.quad(v3(px0, py0, bottom), v3(px1, py1, bottom), v3(px1, py1, h1), v3(px0, py0, h0),
        [[uA, 0], [uB, 0], [uB, (h1 - bottom) / EARTH_DEPTH_M], [uA, (h0 - bottom) / EARTH_DEPTH_M]], out);
      u += seg;
    }
  }
  const mesh = new THREE.Mesh(soup.geometry(), new THREE.MeshStandardMaterial({
    map: strata, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false,
  }));
  mesh.name = 'earth';
  mesh.renderOrder = 0;
  return mesh;
}

// ----------------------------------------------------------------------------- buildings
export type FacadeKind = keyof FacadeSet;

const PLASTER_TINTS = ['#fff6dc', '#f3dfc0', '#ffe2d9', '#fff0bf', '#eeeeea', '#e8b394', '#dde6f0', '#e2f0e0', '#f6e7cf', '#ffffff'];

export function facadeFor(b: Building): { kind: FacadeKind; tint: THREE.Color } {
  const s = b.seed;
  // unverified AI-extracted footprint: pale blue glass, so a proposal is never mistaken for a recorded building
  if (b.identity_kind === 'PROPOSAL') return { kind: 'glass', tint: new THREE.Color('#9cc3ff') };
  if (b.usage === 'I' || /warehouse|industrial|hangar/.test(b.building_type)) return { kind: 'industrial', tint: new THREE.Color('#ffffff') };
  if (b.usage === 'P' && s % 10 < 6) return { kind: 'sandstone', tint: new THREE.Color(s % 2 ? '#ffffff' : '#ffe9c8') };
  if ((b.usage === 'C' || b.usage === 'M' || b.building_type === 'office') && b.height >= 18 && s % 10 < 7) {
    return { kind: 'glass', tint: new THREE.Color(['#ffffff', '#e2f3ff', '#e8fff2'][s % 3]) };
  }
  return { kind: 'plaster', tint: new THREE.Color(PLASTER_TINTS[s % PLASTER_TINTS.length]) };
}

export interface BuildingMeshes {
  walls: Record<FacadeKind, { mesh: THREE.Mesh; ranges: Soup['ranges'] }>;
  roofs: { mesh: THREE.Mesh; ranges: Soup['ranges'] };
  /** triangle ranges per building in each mesh, used to hide a building while it is "opened" */
  spans: Map<number, { mesh: THREE.Mesh; start: number; end: number }[]>;
}

export function buildBuildings(spec: SceneSpec, sat: THREE.Texture, facades: FacadeSet): BuildingMeshes {
  const [ex0, ey0, ex1, ey1] = spec.terrain.extent;
  const roofUv = (x: number, y: number) => [(x - ex0) / (ex1 - ex0), (y - ey0) / (ey1 - ey0)];
  const wallSoups: Record<FacadeKind, Soup> = { plaster: new Soup(), glass: new Soup(), sandstone: new Soup(), industrial: new Soup() };
  const roofSoup = new Soup();
  const spanSrc = new Map<number, { kind: FacadeKind | 'roof'; start: number; end: number }[]>();

  spec.buildings.forEach((b, i) => {
    const ring = b.footprint;
    if (ring.length < 3) return;
    const { kind, tint } = facadeFor(b);
    const base = b.base_z + b.min_height;
    const y0 = b.min_height > 0 ? base : b.base_z - 1.2;
    const y1 = b.base_z + b.height;
    const tileW = BAY_M * TILE_BAYS;
    const tileH = b.floor_height * TILE_FLOORS;

    const ws = wallSoups[kind];
    const wStart = ws.pos.length / 9;
    ws.begin(i, tint);
    let perim = 0;
    for (let k = 0; k < ring.length; k++) {
      const [ax, ay] = ring[k];
      const [bx, by] = ring[(k + 1) % ring.length];
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 0.05) continue;
      const out = new THREE.Vector3(by - ay, 0, bx - ax).normalize();
      const u0 = perim / tileW, u1 = (perim + len) / tileW;
      const vb = (y0 - base) / tileH, vt = (y1 - base) / tileH;
      ws.quad(v3(ax, ay, y0), v3(bx, by, y0), v3(bx, by, y1), v3(ax, ay, y1), [[u0, vb], [u1, vb], [u1, vt], [u0, vt]], out);
      perim += len;
    }
    const spans: { kind: FacadeKind | 'roof'; start: number; end: number }[] = [{ kind, start: wStart, end: ws.pos.length / 9 }];

    const rStart = roofSoup.pos.length / 9;
    roofSoup.begin(i);
    for (const [a, bb, c] of triangulate(ring)) {
      const [pa, pb, pc] = [ring[a], ring[bb], ring[c]];
      roofSoup.tri(v3(pa[0], pa[1], y1), v3(pb[0], pb[1], y1), v3(pc[0], pc[1], y1), roofUv(...pa), roofUv(...pb), roofUv(...pc), UP);
    }
    spans.push({ kind: 'roof', start: rStart, end: roofSoup.pos.length / 9 });
    spanSrc.set(i, spans);
  });

  const mk = (soup: Soup, mat: THREE.Material, name: string) => {
    const mesh = new THREE.Mesh(soup.geometry(), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    mesh.renderOrder = 2;
    return { mesh, ranges: soup.ranges };
  };
  const walls = {
    plaster: mk(wallSoups.plaster, new THREE.MeshStandardMaterial({ map: facades.plaster, vertexColors: true, roughness: 0.88, metalness: 0 }), 'walls-plaster'),
    glass: mk(wallSoups.glass, new THREE.MeshStandardMaterial({ map: facades.glass, vertexColors: true, roughness: 0.12, metalness: 0.65, envMapIntensity: 1.3 }), 'walls-glass'),
    sandstone: mk(wallSoups.sandstone, new THREE.MeshStandardMaterial({ map: facades.sandstone, vertexColors: true, roughness: 0.9 }), 'walls-sandstone'),
    industrial: mk(wallSoups.industrial, new THREE.MeshStandardMaterial({ map: facades.industrial, vertexColors: true, roughness: 0.55, metalness: 0.35 }), 'walls-industrial'),
  };
  const roofs = mk(roofSoup, imageryMaterial(sat), 'roofs');

  const spans = new Map<number, { mesh: THREE.Mesh; start: number; end: number }[]>();
  spanSrc.forEach((list, i) => {
    spans.set(i, list.map((s) => ({ mesh: s.kind === 'roof' ? roofs.mesh : walls[s.kind].mesh, start: s.start, end: s.end })));
  });
  return { walls, roofs, spans };
}

// ----------------------------------------------------------------------------- elevated decks (flyovers, metro viaducts)
function offsetPath(path: XY[], half: number): { left: XY[]; right: XY[] } {
  const left: XY[] = [], right: XY[] = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    const prev = path[Math.max(i - 1, 0)], next = path[Math.min(i + 1, path.length - 1)];
    let dx = next[0] - prev[0], dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    left.push([p[0] - dy * half, p[1] + dx * half]);
    right.push([p[0] + dy * half, p[1] - dx * half]);
  }
  return { left, right };
}

export function buildDecks(spec: SceneSpec, sampler: TerrainSampler) {
  const deck = new Soup();
  const pierPositions: { x: number; y: number; ground: number; top: number; r: number }[] = [];
  const decks: { kind: 'road' | 'rail'; path: XY[]; width: number; elev: number; id: string }[] = [
    ...spec.roads.filter((r) => r.is_bridge && r.elevation_m > 0 && !['footway', 'path', 'steps', 'cycleway'].includes(r.kind))
      .map((r) => ({ kind: 'road' as const, path: r.path, width: Math.max(r.width_m, 6), elev: r.elevation_m, id: r.id })),
    ...spec.railways.filter((r) => r.is_bridge && r.elevation_m > 0)
      .map((r) => ({ kind: 'rail' as const, path: r.path, width: 9, elev: r.elevation_m, id: r.id })),
  ];
  const THICK = 1.5, RAIL = 1.1;
  decks.forEach((dk, idx) => {
    if (dk.path.length < 2) return;
    deck.begin(idx);
    const { left, right } = offsetPath(dk.path, dk.width / 2);
    const top = dk.path.map(([x, y]) => sampler.heightAt(x, y) + dk.elev);
    let dist = 0;
    for (let i = 0; i < dk.path.length - 1; i++) {
      const seg = Math.hypot(dk.path[i + 1][0] - dk.path[i][0], dk.path[i + 1][1] - dk.path[i][1]);
      const [l0, l1, r0, r1] = [left[i], left[i + 1], right[i], right[i + 1]];
      const [t0, t1] = [top[i], top[i + 1]];
      const uv4 = [[0, dist / 10], [1, dist / 10], [1, (dist + seg) / 10], [0, (dist + seg) / 10]];
      deck.quad(v3(l0[0], l0[1], t0), v3(r0[0], r0[1], t0), v3(r1[0], r1[1], t1), v3(l1[0], l1[1], t1), uv4, UP);
      deck.quad(v3(l0[0], l0[1], t0 - THICK), v3(r0[0], r0[1], t0 - THICK), v3(r1[0], r1[1], t1 - THICK), v3(l1[0], l1[1], t1 - THICK), uv4, DOWN);
      for (const [a, b, sign] of [[l0, l1, 1], [r0, r1, -1]] as [XY, XY, number][]) {
        const out = new THREE.Vector3(b[1] - a[1], 0, b[0] - a[0]).normalize().multiplyScalar(-sign);
        deck.quad(v3(a[0], a[1], t0 - THICK), v3(b[0], b[1], t1 - THICK), v3(b[0], b[1], t1 + RAIL), v3(a[0], a[1], t0 + RAIL), uv4, out);
      }
      // piers every ~24 m
      const nP = Math.max(1, Math.floor(seg / 24));
      for (let k = 0; k < nP; k++) {
        const t = (k + 0.5) / nP;
        const px = dk.path[i][0] + (dk.path[i + 1][0] - dk.path[i][0]) * t;
        const py = dk.path[i][1] + (dk.path[i + 1][1] - dk.path[i][1]) * t;
        const ground = sampler.heightAt(px, py);
        const ttop = t0 + (t1 - t0) * t - THICK;
        if (ttop - ground > 2.5) pierPositions.push({ x: px, y: py, ground, top: ttop, r: dk.kind === 'rail' ? 1.1 : 0.85 });
      }
      dist += seg;
    }
  });
  const deckMesh = new THREE.Mesh(deck.geometry(), new THREE.MeshStandardMaterial({ color: '#b9b5ad', roughness: 0.85 }));
  deckMesh.castShadow = deckMesh.receiveShadow = true;
  deckMesh.name = 'decks';

  const pierGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  pierGeo.translate(0, 0.5, 0);
  const piers = new THREE.InstancedMesh(pierGeo, new THREE.MeshStandardMaterial({ color: '#a8a39a', roughness: 0.9 }), Math.max(pierPositions.length, 1));
  const m = new THREE.Matrix4();
  pierPositions.forEach((p, i) => {
    m.compose(v3(p.x, p.y, p.ground), new THREE.Quaternion(), new THREE.Vector3(p.r, p.top - p.ground, p.r));
    piers.setMatrixAt(i, m);
  });
  piers.count = pierPositions.length;
  piers.castShadow = true;
  piers.name = 'piers';
  return { deckMesh, piers, decks, ranges: deck.ranges };
}

// ----------------------------------------------------------------------------- trees
/** Tree positions: OSM tree nodes plus vegetation detected in the satellite image (green-dominant pixels). */
export function treePositions(spec: SceneSpec, image: HTMLImageElement | null, maxTrees = 1400): XY[] {
  const pts: XY[] = spec.trees.map((t) => [t.x, t.y]);
  const [ex0, ey0, ex1, ey1] = spec.terrain.extent;
  // spatial hash of footprints so trees never sprout through roofs
  const cell = 25;
  const grid = new Map<string, XY[][]>();
  for (const b of spec.buildings) {
    const xs = b.footprint.map((p) => p[0]), ys = b.footprint.map((p) => p[1]);
    for (let gx = Math.floor(Math.min(...xs) / cell); gx <= Math.floor(Math.max(...xs) / cell); gx++)
      for (let gy = Math.floor(Math.min(...ys) / cell); gy <= Math.floor(Math.max(...ys) / cell); gy++) {
        const k = `${gx},${gy}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k)!.push(b.footprint);
      }
  }
  const inside = (x: number, y: number, ring: XY[]) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const blocked = (x: number, y: number) => {
    const list = grid.get(`${Math.floor(x / cell)},${Math.floor(y / cell)}`);
    return !!list && list.some((r) => inside(x, y, r));
  };
  const nearRoad = (x: number, y: number) =>
    spec.roads.some((r) => r.kind !== 'footway' && r.path.some((p, i) => {
      if (i === 0) return false;
      const [ax, ay] = r.path[i - 1];
      const [bx, by] = p;
      const dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(ax + dx * t - x, ay + dy * t - y) < r.width_m / 2;
    }));

  if (image) {
    const canvas = document.createElement('canvas');
    const W = 512, H = Math.round((512 * image.height) / image.width);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      try {
        ctx.drawImage(image, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;
        const step = 8; // metres
        let s = 1;
        const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
        for (let y = ey0 + step / 2; y < ey1; y += step)
          for (let x = ex0 + step / 2; x < ex1; x += step) {
            const jx = x + (rnd() - 0.5) * step * 0.8, jy = y + (rnd() - 0.5) * step * 0.8;
            const px = Math.floor(((jx - ex0) / (ex1 - ex0)) * (W - 1));
            const py = Math.floor(((ey1 - jy) / (ey1 - ey0)) * (H - 1));
            const o = (py * W + px) * 4;
            const r = data[o], g = data[o + 1], b = data[o + 2];
            const greenness = (g - Math.max(r, b)) / (g + 1);
            if (g > 40 && g < 170 && greenness > 0.1 && rnd() < 0.55 && !blocked(jx, jy)) pts.push([jx, jy]);
          }
      } catch {
        // tainted canvas (CORS) — fall back to OSM trees only
      }
    }
  }
  const filtered = pts.filter(([x, y]) => x > ex0 && x < ex1 && y > ey0 && y < ey1 && !blocked(x, y));
  const thinned = filtered.length > maxTrees ? filtered.filter((_, i) => i % Math.ceil(filtered.length / maxTrees) === 0) : filtered;
  return thinned.filter(([x, y]) => !nearRoad(x, y));
}

export function buildTrees(points: XY[], sampler: TerrainSampler, leaf: THREE.Texture) {
  const group = new THREE.Group();
  group.name = 'trees';
  if (!points.length) return group;
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(1, 2);
  const pos = crownGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) { // lumpy canopy
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const k = 1 + 0.18 * Math.sin(v.x * 5.1 + v.y * 3.7) * Math.cos(v.z * 4.3);
    pos.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k);
  }
  crownGeo.computeVertexNormals();
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#5b4632', roughness: 1 }), points.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ map: leaf, roughness: 1, color: '#9aa88a' }), points.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
  points.forEach(([x, y], i) => {
    const h = 6 + ((i * 7919) % 60) / 10; // 6–12 m (neem, peepal, gulmohar canopy heights)
    const r = h * (0.36 + ((i * 104729) % 12) / 100);
    const g = sampler.heightAt(x, y);
    m.compose(v3(x, y, g), q, new THREE.Vector3(1, h * 0.55, 1));
    trunks.setMatrixAt(i, m);
    q.setFromAxisAngle(UP, (i * 2.399) % (Math.PI * 2));
    m.compose(v3(x, y, g + h * 0.66), q, new THREE.Vector3(r, r * 0.62, r));
    crowns.setMatrixAt(i, m);
    c.setHSL(0.2 + ((i * 31) % 8) / 100, 0.22 + ((i * 17) % 14) / 100, 0.2 + ((i * 13) % 9) / 100);
    crowns.setColorAt(i, c);
    q.identity();
  });
  trunks.castShadow = crowns.castShadow = true;
  crowns.receiveShadow = true;
  group.add(trunks, crowns);
  return group;
}

// ----------------------------------------------------------------------------- subsurface
export const ASSET_STYLE: Record<SubsurfaceAsset['kind'], { color: string; label: string; minR: number }> = {
  metro: { color: '#facc15', label: 'Metro tunnel', minR: 3.1 },
  rail_tunnel: { color: '#eab308', label: 'Rail tunnel', minR: 3.1 },
  road_tunnel: { color: '#94a3b8', label: 'Road tunnel / underpass', minR: 1.5 },
  water: { color: '#3b82f6', label: 'Water main', minR: 0.3 },
  sewer: { color: '#a16207', label: 'Sewer', minR: 0.5 },
  telecom: { color: '#f97316', label: 'Telecom duct', minR: 0.22 },
  power: { color: '#ef4444', label: 'Power cable', minR: 0.22 },
  gas: { color: '#fde047', label: 'Gas pipeline', minR: 0.3 },
  basement: { color: '#f59e0b', label: 'Basement', minR: 0 },
};

export function buildSubsurface(spec: SceneSpec, sampler: TerrainSampler) {
  const group = new THREE.Group();
  group.name = 'subsurface';
  const pickables: THREE.Object3D[] = [];
  spec.subsurface.forEach((a, idx) => {
    const style = ASSET_STYLE[a.kind] ?? ASSET_STYLE.water;
    let obj: THREE.Object3D | null = null;
    if (a.path && a.path.length >= 2) {
      const pts = a.path.map(([x, y]) => v3(x, y, sampler.heightAt(x, y) - a.depth_m));
      const curve = new THREE.CurvePath<THREE.Vector3>();
      for (let i = 0; i < pts.length - 1; i++) curve.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
      const length = curve.getLength();
      const r = Math.max(a.radius_m ?? 0.2, style.minR);
      const big = a.kind === 'metro' || a.kind === 'rail_tunnel' || a.kind === 'road_tunnel';
      const geo = new THREE.TubeGeometry(curve, Math.max(4, Math.min(400, Math.round(length / (big ? 3 : 6)))), r, big ? 20 : 8, false);
      const mat = new THREE.MeshStandardMaterial({
        color: style.color, roughness: big ? 0.7 : 0.4, metalness: big ? 0.1 : 0.3,
        emissive: new THREE.Color(style.color), emissiveIntensity: big ? 0.08 : 0.35,
        transparent: big, opacity: big ? 0.72 : 1, side: big ? THREE.DoubleSide : THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      if (big && a.kind !== 'road_tunnel') { // rails inside the bore
        const railMat = new THREE.MeshStandardMaterial({ color: '#d4d4d8', metalness: 0.9, roughness: 0.3, emissive: '#71717a', emissiveIntensity: 0.4 });
        for (const off of [-0.75, 0.75]) {
          const railPts = pts.map((p, i) => {
            const nxt = pts[Math.min(i + 1, pts.length - 1)], prv = pts[Math.max(i - 1, 0)];
            const dir = new THREE.Vector3().subVectors(nxt, prv).setY(0).normalize();
            const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(off);
            return p.clone().add(side).add(new THREE.Vector3(0, -r * 0.72, 0));
          });
          const rc = new THREE.CurvePath<THREE.Vector3>();
          for (let i = 0; i < railPts.length - 1; i++) rc.add(new THREE.LineCurve3(railPts[i], railPts[i + 1]));
          mesh.add(new THREE.Mesh(new THREE.TubeGeometry(rc, Math.max(4, Math.round(length / 4)), 0.07, 4, false), railMat));
        }
      }
      obj = mesh;
    } else if (a.footprint && a.footprint.length >= 3) {
      const soup = new Soup();
      soup.begin(idx);
      const g = sampler.heightAt(...(a.footprint[0] as XY));
      addPrism(soup, a.footprint, g - a.depth_m, g - (a.depth_top_m ?? 0.5), 3);
      const mat = new THREE.MeshStandardMaterial({ color: style.color, transparent: true, opacity: 0.45, roughness: 0.6,
        emissive: new THREE.Color(style.color), emissiveIntensity: 0.12, side: THREE.DoubleSide, depthWrite: false });
      obj = new THREE.Mesh(soup.geometry(), mat);
      // parking level slabs
      const levels = Math.max(1, Math.round((a.depth_m - (a.depth_top_m ?? 0.5)) / 3.3));
      for (let l = 1; l < levels; l++) {
        const slab = new Soup();
        slab.begin(0);
        const yy = g - (a.depth_top_m ?? 0.5) - l * 3.3;
        addPrism(slab, a.footprint, yy - 0.25, yy, 3);
        obj.add(new THREE.Mesh(slab.geometry(), new THREE.MeshStandardMaterial({ color: '#d6a24a', transparent: true, opacity: 0.6 })));
      }
    }
    if (obj) {
      obj.userData = { kind: 'subsurface', index: idx };
      obj.name = a.id;
      group.add(obj);
      pickables.push(obj);
    }
  });
  return { group, pickables };
}

/** Vertical depth gauge at the south-west corner of the earth block. */
export function buildDepthRuler(spec: SceneSpec, sampler: TerrainSampler) {
  const [x0, y0] = spec.terrain.extent;
  const g = sampler.heightAt(x0, y0);
  const group = new THREE.Group();
  group.name = 'ruler';
  const mat = new THREE.MeshBasicMaterial({ color: '#f8fafc' });
  const pole = new THREE.Mesh(new THREE.BoxGeometry(0.6, EARTH_DEPTH_M, 0.6), mat);
  pole.position.copy(v3(x0 - 1.5, y0 - 1.5, g - EARTH_DEPTH_M / 2));
  group.add(pole);
  for (let d = 0; d <= EARTH_DEPTH_M; d += 5) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(4, 0.35, 0.35), mat);
    tick.position.copy(v3(x0 - 3, y0 - 1.5, g - d));
    tick.userData.depth = d;
    group.add(tick);
  }
  return group;
}

// ----------------------------------------------------------------------------- overlays
export function buildBoundary(spec: SceneSpec, sampler: TerrainSampler) {
  const ring = spec.survey_polygon.local;
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= ring.length; i++) {
    const [ax, ay] = ring[i % ring.length];
    const [bx, by] = ring[(i + 1) % ring.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
    for (let s = 0; s < steps; s++) {
      const x = ax + ((bx - ax) * s) / steps, y = ay + ((by - ay) * s) / steps;
      pts.push(v3(x, y, sampler.heightAt(x, y) + 0.6));
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0);
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 2, 0.45, 6, true),
    new THREE.MeshBasicMaterial({ color: '#facc15', transparent: true, opacity: 0.85 }));
  mesh.name = 'boundary';
  return mesh;
}

export function buildParcels(spec: SceneSpec, sampler: TerrainSampler) {
  const positions: number[] = [];
  for (const p of spec.parcels) {
    for (let i = 0; i < p.footprint.length; i++) {
      const [ax, ay] = p.footprint[i];
      const [bx, by] = p.footprint[(i + 1) % p.footprint.length];
      const a = v3(ax, ay, sampler.heightAt(ax, ay) + 0.35), b = v3(bx, by, sampler.heightAt(bx, by) + 0.35);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.8 }));
  lines.name = 'parcels';
  return lines;
}

// ----------------------------------------------------------------------------- footpaths
/** Split long edges so a draped surface follows the terrain instead of cutting through it. */
function densify(ring: XY[], maxSeg = 4): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / maxSeg));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  return out;
}

/**
 * Footpaths draped on the terrain: mapped OSM sidewalks (solid pavers) and assumed footpaths beside major roads
 * (lighter). These are the same surfaces the footpath-encroachment check measures against.
 */
export function buildFootpaths(spec: SceneSpec, sampler: TerrainSampler, pavers: THREE.Texture, kerbTex?: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'footpaths';
  const bySource: Record<string, { pos: number[]; uv: number[] }> = { mapped: { pos: [], uv: [] }, assumed: { pos: [], uv: [] } };
  const kerb = { pos: [] as number[], uv: [] as number[] };
  const TOP = 0.18; // footpath surface above the road
  const KW = 0.32; // kerb width
  const KH = 0.3; // kerb top above the road
  for (const fp of spec.footpaths ?? []) {
    const rings = fp.rings.map((r) => densify(r));
    if (rings[0].length < 3) continue;
    // kerb: a raised black-and-yellow strip along every edge, top face plus the outer face
    for (const ring of rings) {
      let along = 0;
      for (let i = 0; i < ring.length; i++) {
        const [x0, y0] = ring[i];
        const [x1, y1] = ring[(i + 1) % ring.length];
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (len < 0.05) continue;
        const nx = (-(y1 - y0) / len) * (KW / 2), ny = ((x1 - x0) / len) * (KW / 2);
        const g0 = sampler.heightAt(x0, y0), g1 = sampler.heightAt(x1, y1);
        const a = v3(x0 + nx, y0 + ny, g0 + KH), b = v3(x1 + nx, y1 + ny, g1 + KH);
        const c = v3(x1 - nx, y1 - ny, g1 + KH), d = v3(x0 - nx, y0 - ny, g0 + KH);
        const e = v3(x0 + nx, y0 + ny, g0 - 0.05), f = v3(x1 + nx, y1 + ny, g1 - 0.05);
        const u0 = along / 1.0, u1 = (along + len) / 1.0; // one black + yellow pair per metre
        [[a, b, c, u0, u1], [a, c, d, u0, u1]].forEach(([p, q, r]: any) => {
          kerb.pos.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
        });
        kerb.uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
        kerb.pos.push(e.x, e.y, e.z, f.x, f.y, f.z, b.x, b.y, b.z, e.x, e.y, e.z, b.x, b.y, b.z, a.x, a.y, a.z);
        kerb.uv.push(u0, 0, u1, 0, u1, 1, u0, 0, u1, 1, u0, 1);
        along += len;
      }
    }
    const contour = rings[0].map(([x, y]) => new THREE.Vector2(x, y));
    const holes = rings.slice(1).map((r) => r.map(([x, y]) => new THREE.Vector2(x, y)));
    const flat = [...rings[0], ...rings.slice(1).flat()];
    const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
    const tgt = bySource[fp.source] ?? bySource.assumed;
    for (const t of tris) {
      for (const idx of t) {
        const [x, y] = flat[idx];
        const p = v3(x, y, sampler.heightAt(x, y) + TOP);
        tgt.pos.push(p.x, p.y, p.z);
        tgt.uv.push(x / 2.4, y / 2.4); // one 8 × 8 paver tile ≈ 2.4 m (0.3 m blocks)
      }
    }
  }
  for (const [src, { pos, uv }] of Object.entries(bySource)) {
    if (!pos.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: pavers, color: src === 'mapped' ? '#ffffff' : '#ece4d6', roughness: 0.9, side: THREE.DoubleSide,
      transparent: src !== 'mapped', opacity: src === 'mapped' ? 1 : 0.88,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true;
    m.renderOrder = 3;
    m.userData.source = src;
    group.add(m);
  }
  if (kerb.pos.length && kerbTex) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(kerb.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(kerb.uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.75, side: THREE.DoubleSide }));
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.source = 'kerb';
    group.add(m);
  }
  return group;
}

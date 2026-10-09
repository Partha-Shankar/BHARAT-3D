import * as THREE from 'three';

/**
 * Procedural facade textures. One tile = BAYS window bays x FLOORS storeys, so UVs can be expressed in
 * metres along the wall (u) and height (v) and the window grid lines up with real floor heights.
 */
export const BAY_M = 3.6;
export const TILE_BAYS = 4;
export const TILE_FLOORS = 4;

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, rnd: () => number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function make(painter: Painter, seed: number, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  painter(ctx, size, size, rng(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  return tex;
}

// Indian residential: near-white plaster (tinted per building via vertex colour), recessed windows,
// balcony slabs, grilles, occasional AC units and water stains.
const plaster: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = '#d8d1c3';
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 22, rnd);
  for (let i = 0; i < 60; i++) { // patchy weathering
    ctx.fillStyle = `rgba(${90 + rnd() * 40},${80 + rnd() * 30},${60 + rnd() * 30},${0.03 + rnd() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 60, 6 + rnd() * 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const bw = w / TILE_BAYS;
  const fh = h / TILE_FLOORS;
  for (let f = 0; f < TILE_FLOORS; f++) {
    const y0 = f * fh;
    // floor band / balcony slab
    ctx.fillStyle = 'rgba(120,110,100,0.35)';
    ctx.fillRect(0, y0 + fh - 7, w, 7);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, y0 + fh - 9, w, 2);
    for (let b = 0; b < TILE_BAYS; b++) {
      const x0 = b * bw;
      const kind = rnd();
      const ww = bw * (kind < 0.25 ? 0.62 : 0.46);
      const wh = fh * (kind < 0.25 ? 0.62 : 0.5);
      const wx = x0 + (bw - ww) / 2;
      const wy = y0 + fh * 0.2;
      ctx.fillStyle = 'rgba(70,60,50,0.35)'; // reveal shadow
      ctx.fillRect(wx - 3, wy - 3, ww + 6, wh + 8);
      const g = ctx.createLinearGradient(wx, wy, wx, wy + wh);
      g.addColorStop(0, '#5d7286');
      g.addColorStop(1, '#2c3a47');
      ctx.fillStyle = g;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.strokeStyle = 'rgba(230,230,225,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.stroke();
      if (kind > 0.55) { // window grille
        ctx.strokeStyle = 'rgba(40,40,40,0.55)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(wx, wy + (wh * i) / 5);
          ctx.lineTo(wx + ww, wy + (wh * i) / 5);
          ctx.stroke();
        }
      }
      if (kind > 0.82) { // split AC unit
        ctx.fillStyle = '#e6e6e2';
        ctx.fillRect(wx + ww + 4, wy + wh * 0.55, bw * 0.16, fh * 0.13);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(wx + ww + 4, wy + wh * 0.55 + fh * 0.13, bw * 0.16, 2);
      }
      if (rnd() < 0.3) { // monsoon streak
        const sx = x0 + rnd() * bw;
        const sg = ctx.createLinearGradient(sx, y0 + fh * 0.75, sx, y0 + fh * 1.15);
        sg.addColorStop(0, 'rgba(90,85,75,0.18)');
        sg.addColorStop(1, 'rgba(90,85,75,0)');
        ctx.fillStyle = sg;
        ctx.fillRect(sx, y0 + fh * 0.75, 6 + rnd() * 8, fh * 0.4);
      }
    }
  }
};

// Commercial glass curtain wall: reflective tinted glass with mullions and spandrels.
const glass: Painter = (ctx, w, h, rnd) => {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#5b7f96');
  g.addColorStop(0.5, '#3f6176');
  g.addColorStop(1, '#6d8fa3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  const cols = TILE_BAYS * 2;
  const fh = h / TILE_FLOORS;
  for (let i = 0; i < cols; i++) {
    for (let f = 0; f < TILE_FLOORS; f++) {
      const shade = 0.85 + rnd() * 0.3;
      ctx.fillStyle = `rgba(${Math.round(70 * shade)},${Math.round(105 * shade)},${Math.round(125 * shade)},0.55)`;
      ctx.fillRect((i * w) / cols + 2, f * fh + 2, w / cols - 4, fh * 0.78);
    }
  }
  ctx.fillStyle = '#2a3036';
  for (let f = 0; f < TILE_FLOORS; f++) ctx.fillRect(0, f * fh + fh * 0.8, w, fh * 0.2); // spandrel
  ctx.fillStyle = '#c9ced3';
  for (let i = 0; i <= cols; i++) ctx.fillRect((i * w) / cols - 1.5, 0, 3, h);
  for (let f = 0; f <= TILE_FLOORS; f++) ctx.fillRect(0, f * fh - 1.5, w, 3);
};

// Institutional red/buff sandstone (common in Delhi public buildings).
const sandstone: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = '#b5704f';
  ctx.fillRect(0, 0, w, h);
  noise(ctx, w, h, 26, rnd);
  ctx.strokeStyle = 'rgba(80,40,25,0.25)';
  for (let y = 0; y < h; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const bw = w / TILE_BAYS;
  const fh = h / TILE_FLOORS;
  for (let f = 0; f < TILE_FLOORS; f++) {
    for (let b = 0; b < TILE_BAYS; b++) {
      const wx = b * bw + bw * 0.3;
      const wy = f * fh + fh * 0.22;
      const ww = bw * 0.4;
      const wh = fh * 0.55;
      ctx.fillStyle = '#e9dcc6';
      ctx.beginPath();
      ctx.moveTo(wx - 4, wy + wh + 4);
      ctx.lineTo(wx - 4, wy + ww / 2);
      ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2 + 4, Math.PI, 0);
      ctx.lineTo(wx + ww + 4, wy + wh + 4);
      ctx.fill();
      ctx.fillStyle = '#2f2a26';
      ctx.beginPath();
      ctx.moveTo(wx, wy + wh);
      ctx.lineTo(wx, wy + ww / 2);
      ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, 0);
      ctx.lineTo(wx + ww, wy + wh);
      ctx.fill();
    }
  }
};

// Industrial / warehouse: profiled metal sheeting with a few high windows.
const industrial: Painter = (ctx, w, h, rnd) => {
  ctx.fillStyle = '#9aa2a8';
  ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) {
    ctx.fillStyle = x % 16 === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, 0, 4, h);
  }
  noise(ctx, w, h, 14, rnd);
  ctx.fillStyle = 'rgba(30,40,50,0.6)';
  for (let b = 0; b < TILE_BAYS; b++) ctx.fillRect(b * (w / TILE_BAYS) + 12, 10, w / TILE_BAYS - 24, h * 0.06);
};

export interface FacadeSet {
  plaster: THREE.CanvasTexture;
  glass: THREE.CanvasTexture;
  sandstone: THREE.CanvasTexture;
  industrial: THREE.CanvasTexture;
}

export function makeFacades(): FacadeSet {
  return {
    plaster: make(plaster, 11),
    glass: make(glass, 23),
    sandstone: make(sandstone, 37),
    industrial: make(industrial, 41),
  };
}

/** Soil cross-section for the walls of the earth block; v=1 at ground, v=0 at DEPTH_M below. */
export const EARTH_DEPTH_M = 30;
export function makeStrata(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const rnd = rng(7);
  const layers: [number, string][] = [
    [0, '#4a3a2a'],   // topsoil / fill
    [1.2, '#7a5a3c'], // alluvial silty clay
    [5.5, '#9c7a52'], // sandy silt
    [11, '#b49a72'],  // fine sand with kankar
    [19, '#8d8478'],  // dense sand / weathered rock
  ];
  const pxPerM = canvas.height / EARTH_DEPTH_M;
  layers.forEach(([top, color], i) => {
    const bottom = i + 1 < layers.length ? layers[i + 1][0] : EARTH_DEPTH_M;
    ctx.fillStyle = color;
    ctx.fillRect(0, top * pxPerM, canvas.width, (bottom - top) * pxPerM);
  });
  noise(ctx, canvas.width, canvas.height, 34, rnd);
  for (let i = 0; i < 900; i++) { // pebbles / kankar
    ctx.fillStyle = `rgba(${200 + rnd() * 40},${190 + rnd() * 40},${170 + rnd() * 30},${0.25 + rnd() * 0.35})`;
    const y = canvas.height * (0.25 + rnd() * 0.75);
    ctx.beginPath();
    ctx.ellipse(rnd() * canvas.width, y, 1 + rnd() * 3, 1 + rnd() * 2, rnd() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Soft radial blob used for tree canopies seen from above. */
export function makeLeafTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const rnd = rng(5);
  ctx.fillStyle = '#3f5226';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 700; i++) {
    const g = 60 + rnd() * 70;
    ctx.fillStyle = `rgba(${g * 0.62},${g},${g * 0.38},0.55)`;
    ctx.beginPath();
    ctx.arc(rnd() * 128, rnd() * 128, 2 + rnd() * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Interlocking pavers as laid on Indian footpaths: terracotta and grey blocks in a herringbone-like checker. */
export function makePavers(): THREE.CanvasTexture {
  return make((ctx, w, h, rnd) => {
    ctx.fillStyle = '#8f8476';
    ctx.fillRect(0, 0, w, h);
    const n = 8;
    const s = w / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const red = (i + j) % 4 === 0 || (i * 3 + j) % 5 === 0;
        const v = Math.floor(rnd() * 18);
        ctx.fillStyle = red ? `rgb(${178 + v}, ${92 + v}, ${70 + v})` : `rgb(${196 + v}, ${190 + v}, ${180 + v})`;
        ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
      }
    }
    noise(ctx, w, h, 0.06, rnd);
  }, 41, 256);
}

/** Kerb stones painted in alternating black and yellow, as on Indian roads. */
export function makeKerb(): THREE.CanvasTexture {
  return make((ctx, w, h) => {
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = '#1d1d1b';
    ctx.fillRect(w / 2, 0, w / 2, h);
  }, 7, 64);
}

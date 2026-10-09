import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { BuildingDetail, SceneSpec, XY } from './sceneSpec';
import {
  buildFootpaths,
  ASSET_STYLE, BuildingMeshes, Soup, TerrainSampler, addPrism, buildBoundary, buildBuildings, buildContext, buildDecks,
  buildDepthRuler, buildEarthBlock, buildParcels, buildSubsurface, buildTerrain, buildTrees, treePositions, v3,
} from './buildWorld';
import { EARTH_DEPTH_M, makeFacades, makeKerb, makeLeafTexture, makePavers, makeStrata } from './textures';

export type ViewMode = 'surface' | 'xray' | 'underground';
export type Preset = 'overview' | 'top' | 'street' | 'underground' | 'selected';
export type Pick =
  | { kind: 'building'; index: number }
  | { kind: 'unit'; floor: number; unit: number }
  | { kind: 'subsurface'; index: number }
  | { kind: 'road'; id: string }
  | null;

export interface ViewState { pos: [number, number, number]; target: [number, number, number] }

const ROOM_COLORS: Record<string, string> = {
  living: '#fde68a', bed: '#bfdbfe', kitchen: '#fecaca', bath: '#a5f3fc', shop: '#ddd6fe', store: '#e5e7eb',
  work: '#d9f99d', office: '#c7d2fe', hall: '#fbcfe8',
};

export interface LayerState {
  buildings: boolean;
  trees: boolean;
  decks: boolean;
  parcels: boolean;
  footpaths: boolean;
  boundary: boolean;
  subsurface: boolean;
  violations: boolean;
  labels: boolean;
}

interface Callbacks {
  onPick?: (p: Pick) => void;
  onTrench?: (polygonLocal: XY[]) => void;
  onCamera?: (headingDeg: number, depthBelowGround: number) => void;
  onReady?: () => void;
}

const SKY_FOG = new THREE.Color('#b8c6d3');
const EARTH_BG = new THREE.Color('#1a140f');

export class WorldViewer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: MapControls;
  private labels: CSS2DRenderer;
  private sky = new Sky();
  private sun = new THREE.DirectionalLight('#fff1dc', 2.0);
  private hemi = new THREE.HemisphereLight('#cfe0f0', '#6d5f4c', 0.4);
  private pmrem: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private sampler: TerrainSampler;
  private clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e6);
  private keys = new Set<string>();
  private tween: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t0: number; ms: number } | null = null;
  private frame = 0;
  private disposed = false;
  private resizeObs: ResizeObserver;
  private timer = new THREE.Timer();

  terrain!: THREE.Mesh;
  context: THREE.Mesh | null = null;
  earth!: THREE.Mesh;
  buildings!: BuildingMeshes;
  decks!: THREE.Group;
  trees = new THREE.Group();
  subsurface!: THREE.Group;
  subsurfacePickables: THREE.Object3D[] = [];
  ruler!: THREE.Group;
  boundary!: THREE.Mesh;
  footpaths!: THREE.Group;
  parcels!: THREE.LineSegments;
  violationShells = new THREE.Group();
  selection = new THREE.Group();
  trench = new THREE.Group();
  labelGroup = new THREE.Group();
  findings = new THREE.Group();
  draft = new THREE.Group();
  private deckMesh: THREE.Mesh | null = null;
  private deckRanges: { startTri: number; index: number }[] = [];
  private deckIds: string[] = [];
  private pointTool: ((p: XY) => void) | null = null;
  mode: ViewMode = 'surface';
  digMode = false;
  private digStart: THREE.Vector3 | null = null;
  private hidden: { mesh: THREE.Mesh; start: number; end: number; backup: Float32Array }[] = [];
  private unitPickables: THREE.Mesh[] = [];
  private center = new THREE.Vector3();
  private loaded = false;
  private radius = 300;

  constructor(private host: HTMLElement, private spec: SceneSpec, private cb: Callbacks = {}) {
    this.sampler = new TerrainSampler(spec);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.localClippingEnabled = true;
    host.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(host.clientWidth, host.clientHeight);
    // own stacking context: CSS2DRenderer gives each label a distance-based z-index, which must stay below the UI panels
    Object.assign(this.labels.domElement.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none', zIndex: '1', isolation: 'isolate' });
    host.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.3, 30000);
    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.maxPolarAngle = Math.PI * 0.98;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 4000;
    this.controls.zoomToCursor = true;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.fog = new THREE.FogExp2(SKY_FOG.clone(), 0.00032);

    const [x0, y0, x1, y1] = spec.terrain.extent;
    this.center.copy(v3((x0 + x1) / 2, (y0 + y1) / 2, 0));
    this.radius = Math.max(x1 - x0, y1 - y0) / 2;

    this.setupEnvironment();
    this.bindInput();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
  }

  // ------------------------------------------------------------------------- setup
  private setupEnvironment() {
    this.sky.scale.setScalar(20000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 3.2; // light urban haze
    u.rayleigh.value = 2.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;
    this.scene.add(this.sky, this.hemi, this.sun, this.sun.target);

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const r = this.radius + 120;
    Object.assign(this.sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 4000 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    this.setSunTime(15.5);
  }

  /** Hour of day (6–19) drives sun elevation/azimuth for Delhi-like latitudes. */
  setSunTime(hour: number) {
    const t = (hour - 6) / 13; // 0 at sunrise, 1 at sunset
    const elevation = Math.max(4, Math.sin(Math.PI * t) * 72);
    const azimuth = 95 + t * 170; // east → south → west
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const theta = THREE.MathUtils.degToRad(azimuth);
    const dir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    dir.z = -dir.z; // azimuth measured from north (−Z) clockwise
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    this.sun.position.copy(this.center).addScaledVector(dir, 1500);
    this.sun.target.position.copy(this.center);
    const warm = 1 - Math.min(elevation / 35, 1);
    this.sun.color.setRGB(1, 0.95 - warm * 0.25, 0.88 - warm * 0.45);
    this.sun.intensity = 0.8 + 1.4 * Math.min(elevation / 40, 1);
    this.hemi.intensity = 0.25 + 0.2 * Math.min(elevation / 40, 1);
    // environment lighting from the same sky
    const skyScene = new THREE.Scene();
    const s2 = new Sky();
    s2.scale.setScalar(1000);
    Object.entries(this.sky.material.uniforms).forEach(([k, v]) => ((s2.material.uniforms as any)[k].value = (v as any).value));
    skyScene.add(s2);
    this.envRT?.dispose();
    this.envRT = this.pmrem.fromScene(skyScene, 0, 0.1, 1000);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.35;
    if (this.mode !== 'underground') {
      (this.scene.fog as THREE.FogExp2).color.copy(SKY_FOG).lerp(new THREE.Color('#e7b98a'), warm * 0.5);
    }
  }

  async load(satUrl: string, contextUrl?: string) {
    const loader = new THREE.TextureLoader().setCrossOrigin('anonymous');
    const loadTex = (url: string) => new Promise<THREE.Texture>((res, rej) => loader.load(url, res, undefined, rej));
    const sat = await loadTex(satUrl);
    sat.colorSpace = THREE.SRGBColorSpace;
    sat.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const facades = makeFacades();

    this.terrain = buildTerrain(this.spec, sat);
    this.earth = buildEarthBlock(this.spec, this.sampler, makeStrata());
    this.earth.visible = false;
    this.buildings = buildBuildings(this.spec, sat, facades);
    const { deckMesh, piers, decks, ranges } = buildDecks(this.spec, this.sampler);
    this.decks = new THREE.Group();
    this.decks.add(deckMesh, piers);
    this.deckMesh = deckMesh;
    this.deckRanges = ranges;
    this.deckIds = decks.map((d) => d.id);
    const sub = buildSubsurface(this.spec, this.sampler);
    this.subsurface = sub.group;
    this.subsurfacePickables = sub.pickables;
    this.subsurface.visible = false;
    this.ruler = buildDepthRuler(this.spec, this.sampler);
    this.ruler.visible = false;
    this.boundary = buildBoundary(this.spec, this.sampler);
    this.parcels = buildParcels(this.spec, this.sampler);
    this.parcels.visible = false;
    const pavers = makePavers();
    pavers.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.footpaths = buildFootpaths(this.spec, this.sampler, pavers, makeKerb());

    this.scene.add(this.terrain, this.earth, this.decks, this.subsurface, this.ruler, this.boundary, this.parcels, this.footpaths,
      this.violationShells, this.selection, this.trench, this.labelGroup, this.findings, this.draft);
    Object.values(this.buildings.walls).forEach((w) => this.scene.add(w.mesh));
    this.scene.add(this.buildings.roofs.mesh);
    this.buildViolationShells();
    this.buildFindings();
    this.buildLabels();
    this.applyClipping();

    if (contextUrl) {
      loadTex(contextUrl).then((ctxTex) => {
        if (this.disposed) return;
        ctxTex.colorSpace = THREE.SRGBColorSpace;
        ctxTex.anisotropy = 8;
        this.context = buildContext(this.spec, ctxTex, this.sampler.minHeight - 0.6);
        if (this.context) {
          (this.context.material as THREE.MeshStandardMaterial).clippingPlanes = [this.clip];
          this.context.visible = this.mode === 'surface';
          this.scene.add(this.context);
        }
      }).catch(() => undefined);
    }

    // Trees: OSM nodes + vegetation detected in the satellite image (needs the decoded image).
    const pts = treePositions(this.spec, sat.image as HTMLImageElement);
    this.trees = buildTrees(pts, this.sampler, makeLeafTexture());
    this.scene.add(this.trees);

    this.preset('overview', 0);
    this.loaded = true;
    this.animate();
    this.cb.onReady?.();
    return { trees: pts.length };
  }

  private buildViolationShells() {
    const soup = new Soup();
    const flagged = new Map<string, number[]>();
    this.spec.violations.forEach((v) => {
      if (v.floors_flagged.length) flagged.set(v.building_id, v.floors_flagged);
    });
    this.spec.buildings.forEach((b, i) => {
      const floors = flagged.get(b.id);
      if (!floors) return;
      soup.begin(i);
      const z0 = b.base_z + b.min_height + Math.min(...floors) * b.floor_height;
      const z1 = b.base_z + b.height + 0.15;
      const grown = this.inflate(b.footprint, 0.25);
      addPrism(soup, grown, z0, z1, 3);
    });
    const mesh = new THREE.Mesh(soup.geometry(), new THREE.MeshStandardMaterial({
      color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.55, transparent: true, opacity: 0.55, depthWrite: false,
    }));
    mesh.name = 'violations';
    mesh.renderOrder = 5;
    this.violationShells.add(mesh);
    this.violationShells.visible = false;
  }

  /** Ground patches for geometric findings, construction sites with cranes, and a pin per finding. */
  private buildFindings() {
    const patch = new Soup();
    let k = 0;
    this.spec.violations.forEach((v) => (v.geometry ?? []).forEach((ring) => {
      if (ring.length < 3) return;
      patch.begin(k++);
      const h = this.sampler.heightAt(ring[0][0], ring[0][1]);
      addPrism(patch, ring, h + 0.05, h + 0.55, 3);
    }));
    if (patch.pos.length) {
      const m = new THREE.Mesh(patch.geometry(), new THREE.MeshStandardMaterial({
        color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 0.6, transparent: true, opacity: 0.75, depthWrite: false,
      }));
      m.renderOrder = 6;
      this.findings.add(m);
    }
    const site = new Soup();
    const crane = new THREE.Group();
    const yellow = new THREE.MeshStandardMaterial({ color: '#f5b301', roughness: 0.6, metalness: 0.3 });
    (this.spec.construction_sites ?? []).forEach((st, i) => {
      if (st.polygon.length < 3) return;
      site.begin(i);
      const h = this.sampler.heightAt(st.polygon[0][0], st.polygon[0][1]);
      addPrism(site, st.polygon, h + 0.05, h + 0.35, 3);
      const c = st.polygon.reduce((a, p) => [a[0] + p[0] / st.polygon.length, a[1] + p[1] / st.polygon.length], [0, 0]);
      const H = 32;
      const mast = new THREE.Mesh(new THREE.BoxGeometry(1.6, H, 1.6), yellow);
      mast.position.copy(v3(c[0], c[1], h + H / 2));
      const jib = new THREE.Mesh(new THREE.BoxGeometry(34, 1.2, 1.2), yellow);
      jib.position.copy(v3(c[0] + 10, c[1], h + H));
      const counter = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 3), new THREE.MeshStandardMaterial({ color: '#6b7280' }));
      counter.position.copy(v3(c[0] - 8, c[1], h + H - 1));
      [mast, jib, counter].forEach((o) => { o.castShadow = true; crane.add(o); });
    });
    if (site.pos.length) {
      this.findings.add(new THREE.Mesh(site.geometry(), new THREE.MeshStandardMaterial({
        color: '#f97316', transparent: true, opacity: 0.55, depthWrite: false, emissive: '#f97316', emissiveIntensity: 0.25,
      })));
    }
    this.findings.add(crane);
    const pinGeo = new THREE.ConeGeometry(1.4, 4, 12);
    pinGeo.rotateX(Math.PI);
    const pinMat = new THREE.MeshBasicMaterial({ color: '#ef4444' });
    this.spec.violations.forEach((v) => {
      const loc = v.location ?? (v.building_id ? this.spec.buildings.find((b) => b.id === v.building_id)?.centroid : undefined);
      if (!loc) return;
      const b = v.building_id ? this.spec.buildings.find((x) => x.id === v.building_id) : undefined;
      const top = (b ? b.base_z + b.height : this.sampler.heightAt(loc[0], loc[1])) + 5;
      const pin = new THREE.Mesh(pinGeo, pinMat);
      pin.position.copy(v3(loc[0], loc[1], top));
      this.findings.add(pin);
    });
    this.findings.visible = false;
  }

  private inflate(ring: XY[], d: number): XY[] {
    const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    return ring.map(([x, y]) => {
      const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1;
      return [x + (dx / l) * d, y + (dy / l) * d];
    });
  }

  private label(text: string, cls: string, pos: THREE.Vector3) {
    const el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.copy(pos);
    return obj;
  }

  private buildLabels() {
    const seen = new Set<string>();
    this.spec.subsurface.forEach((a) => {
      if (!['metro', 'rail_tunnel', 'road_tunnel', 'basement'].includes(a.kind)) return;
      const key = `${a.kind}:${a.name}`;
      if (seen.has(key) || seen.size > 14) return;
      seen.add(key);
      const pts = a.path ?? a.footprint ?? [];
      if (!pts.length) return;
      const [x, y] = pts[Math.floor(pts.length / 2)];
      const g = this.sampler.heightAt(x, y);
      this.labelGroup.add(this.label(`${a.name} · −${a.depth_m} m${a.source === 'synthetic' ? ' (synthetic)' : ''}`,
        'b3d-label b3d-label-under', v3(x, y, g - a.depth_m + 4)));
    });
    this.ruler.children.forEach((t) => {
      if (t.userData.depth !== undefined) {
        const p = t.position.clone().add(new THREE.Vector3(-4, 0, 0));
        this.labelGroup.add(this.label(t.userData.depth === 0 ? 'Ground 0 m' : `−${t.userData.depth} m`, 'b3d-label b3d-label-ruler', p));
      }
    });
    this.labelGroup.visible = false;
  }

  private applyClipping() {
    const mats: THREE.Material[] = [
      this.terrain.material as THREE.Material,
      this.earth.material as THREE.Material,
      ...Object.values(this.buildings.walls).map((w) => w.mesh.material as THREE.Material),
      this.buildings.roofs.mesh.material as THREE.Material,
      ...this.footpaths.children.map((c) => (c as THREE.Mesh).material as THREE.Material),
    ];
    mats.forEach((m) => (m.clippingPlanes = [this.clip]));
  }

  // ------------------------------------------------------------------------- modes & layers
  setMode(mode: ViewMode) {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    this.mode = mode;
    const under = mode !== 'surface';
    const tm = this.terrain.material as THREE.MeshStandardMaterial;
    tm.opacity = mode === 'surface' ? 1 : mode === 'xray' ? 0.4 : 0.16;
    tm.depthWrite = mode === 'surface';
    this.earth.visible = under;
    (this.earth.material as THREE.MeshStandardMaterial).opacity = mode === 'underground' ? 0.3 : 0.6;
    this.subsurface.visible = under;
    this.ruler.visible = under;
    this.labelGroup.visible = under;
    if (this.context) this.context.visible = mode === 'surface';
    this.setBuildingOpacity(mode === 'underground' ? 0.28 : 1);
    this.sky.visible = mode !== 'underground';
    this.scene.background = mode === 'underground' ? EARTH_BG : null;
    const fog = this.scene.fog as THREE.FogExp2;
    if (mode === 'underground') {
      fog.color.copy(EARTH_BG);
      fog.density = 0.0018;
    } else {
      fog.color.copy(SKY_FOG);
      fog.density = 0.00032;
    }
  }

  setGroundOpacity(o: number) {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    const tm = this.terrain.material as THREE.MeshStandardMaterial;
    tm.opacity = o;
    tm.depthWrite = o > 0.95;
  }

  private setBuildingOpacity(o: number) {
    [...Object.values(this.buildings.walls).map((w) => w.mesh), this.buildings.roofs.mesh].forEach((m) => {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.transparent = o < 1;
      mat.opacity = o;
      mat.depthWrite = o >= 1;
      mat.needsUpdate = true;
      m.castShadow = o >= 1;
    });
  }

  /** t in [0,1]: 1 = no cut, 0 = everything removed; cuts west→east through ground, block and buildings. */
  setSectionCut(t: number) {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    const [x0, , x1] = this.spec.terrain.extent;
    this.clip.constant = t >= 0.999 ? 1e6 : x0 + (x1 - x0) * t;
  }

  setLayers(l: LayerState) {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    Object.values(this.buildings.walls).forEach((w) => (w.mesh.visible = l.buildings));
    this.buildings.roofs.mesh.visible = l.buildings;
    this.trees.visible = l.trees;
    this.decks.visible = l.decks;
    this.parcels.visible = l.parcels;
    this.footpaths.visible = l.footpaths && this.mode !== 'underground';
    this.boundary.visible = l.boundary;
    this.violationShells.visible = l.violations;
    this.findings.visible = l.violations;
    if (this.mode !== 'surface') this.subsurface.visible = l.subsurface;
    this.labelGroup.visible = l.labels && this.mode !== 'surface';
  }

  // ------------------------------------------------------------------------- camera
  private flyTo(pos: THREE.Vector3, target: THREE.Vector3, ms = 1200) {
    if (ms <= 0) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
      this.controls.update();
      return;
    }
    this.tween = { from: [this.camera.position.clone(), this.controls.target.clone()], to: [pos, target], t0: performance.now(), ms };
  }

  preset(p: Preset, ms = 1400, focus?: { centroid: XY; height: number; base: number }) {
    const c = this.center.clone();
    const r = this.radius;
    switch (p) {
      case 'overview':
        this.flyTo(c.clone().add(new THREE.Vector3(r * 0.9, r * 1.05, r * 1.25)), c, ms);
        break;
      case 'top':
        this.flyTo(c.clone().add(new THREE.Vector3(0, r * 2.4, 0.01)), c, ms);
        break;
      case 'street': {
        const t = c.clone().add(new THREE.Vector3(0, 2, -40));
        this.flyTo(c.clone().add(new THREE.Vector3(-6, 1.8 + this.sampler.heightAt(c.x, -c.z), 35)), t, ms);
        break;
      }
      case 'underground': {
        // Stay inside the earth block: look along the deepest mapped tunnel from ~60 m away, ~8 m below ground.
        const [x0, y0, x1, y1] = this.spec.terrain.extent;
        const tunnels = this.spec.subsurface.filter((a) => a.path && ['metro', 'rail_tunnel', 'road_tunnel'].includes(a.kind));
        const main = tunnels.sort((a, b) => b.depth_m - a.depth_m || (b.path!.length - a.path!.length))[0];
        let tgt = c.clone().setY(this.sampler.heightAt(c.x, -c.z) - 10);
        if (main?.path) {
          const [x, y] = main.path[Math.floor(main.path.length / 2)];
          tgt = v3(x, y, this.sampler.heightAt(x, y) - main.depth_m);
        }
        const toCenter = new THREE.Vector3(c.x - tgt.x, 0, c.z - tgt.z);
        if (toCenter.lengthSq() < 100) toCenter.set(1, 0, 1);
        toCenter.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
        const pos = tgt.clone().addScaledVector(toCenter, Math.min(140, r * 1.1));
        pos.x = THREE.MathUtils.clamp(pos.x, x0 + 5, x1 - 5);
        pos.z = THREE.MathUtils.clamp(pos.z, -y1 + 5, -y0 - 5);
        pos.y = this.sampler.heightAt(pos.x, -pos.z) - 2.5; // just under the surface, looking down into the cutaway
        this.flyTo(pos, tgt, ms);
        break;
      }
      case 'selected':
        if (focus) {
          const t = v3(focus.centroid[0], focus.centroid[1], focus.base + focus.height * 0.5);
          const d = Math.max(40, focus.height * 2.2);
          this.flyTo(t.clone().add(new THREE.Vector3(d * 0.7, d * 0.45, d * 0.8)), t, ms);
        }
        break;
    }
  }

  resetNorth() {
    const t = this.controls.target;
    const off = this.camera.position.clone().sub(t);
    const horiz = Math.hypot(off.x, off.z);
    this.flyTo(t.clone().add(new THREE.Vector3(0, off.y, horiz)), t.clone(), 700);
  }

  /** Raise/lower the orbit target and camera together (dive underground / climb up). */
  dive(dy: number) {
    this.camera.position.y += dy;
    this.controls.target.y += dy;
  }

  // ------------------------------------------------------------------------- picking
  private ray = new THREE.Raycaster();
  private ndc(e: MouseEvent | PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  }

  private pick(e: MouseEvent): Pick {
    this.ray.setFromCamera(this.ndc(e), this.camera);
    if (this.unitPickables.length) {
      const hit = this.ray.intersectObjects(this.unitPickables, false)[0];
      if (hit) return { kind: 'unit', floor: hit.object.userData.floor, unit: hit.object.userData.unit };
    }
    const targets: THREE.Object3D[] = [];
    if (this.buildings.roofs.mesh.visible) targets.push(this.buildings.roofs.mesh, ...Object.values(this.buildings.walls).map((w) => w.mesh));
    if (this.subsurface.visible) targets.push(...this.subsurfacePickables);
    if (this.deckMesh && this.decks.visible) targets.push(this.deckMesh);
    if (this.mode === 'surface') targets.push(this.terrain);
    const hit = this.ray.intersectObjects(targets, false)[0];
    if (!hit) return null;
    let o: THREE.Object3D | null = hit.object;
    while (o && o.userData.kind !== 'subsurface' && o.parent) o = o.parent;
    if (o?.userData.kind === 'subsurface') return { kind: 'subsurface', index: o.userData.index };
    if (hit.object === this.terrain) return null;
    if (hit.object === this.deckMesh && hit.faceIndex != null) {
      const di = Soup.lookup(this.deckRanges, hit.faceIndex);
      return di >= 0 ? { kind: 'road', id: this.deckIds[di] } : null;
    }
    const mesh = hit.object as THREE.Mesh;
    const ranges = mesh === this.buildings.roofs.mesh ? this.buildings.roofs.ranges
      : Object.values(this.buildings.walls).find((w) => w.mesh === mesh)?.ranges;
    if (!ranges || hit.faceIndex == null) return null;
    const index = Soup.lookup(ranges, hit.faceIndex);
    return index >= 0 ? { kind: 'building', index } : null;
  }

  private groundPoint(e: MouseEvent): THREE.Vector3 | null {
    this.ray.setFromCamera(this.ndc(e), this.camera);
    const hit = this.ray.intersectObject(this.terrain, false)[0];
    return hit ? hit.point : null;
  }

  // ------------------------------------------------------------------------- selection / opened building
  clearSelection() {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    this.selection.clear();
    this.unitPickables = [];
    this.restoreHidden();
  }

  private restoreHidden() {
    this.hidden.forEach(({ mesh, start, backup }) => {
      const arr = (mesh.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
      arr.set(backup, start * 9);
      mesh.geometry.attributes.position.needsUpdate = true;
    });
    this.hidden = [];
  }

  /** Collapse a building's triangles in the merged meshes so its opened floors can be shown in place. */
  private hideBuilding(index: number) {
    this.restoreHidden();
    (this.buildings.spans.get(index) ?? []).forEach(({ mesh, start, end }) => {
      const attr = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      const backup = arr.slice(start * 9, end * 9);
      for (let i = start * 9; i < end * 9; i += 3) {
        arr[i] = arr[start * 9];
        arr[i + 1] = arr[start * 9 + 1];
        arr[i + 2] = arr[start * 9 + 2];
      }
      attr.needsUpdate = true;
      this.hidden.push({ mesh, start, end, backup });
    });
  }

  highlightBuilding(index: number) {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    this.clearSelection();
    const b = this.spec.buildings[index];
    if (!b) return;
    const pts: number[] = [];
    const bottom = b.base_z + b.min_height;
    for (let f = 0; f <= b.floors; f++) {
      const z = Math.min(bottom + f * b.floor_height, b.base_z + b.height);
      b.footprint.forEach(([ax, ay], i) => {
        const [bx, by] = b.footprint[(i + 1) % b.footprint.length];
        const p = v3(ax, ay, z), q = v3(bx, by, z);
        pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
      });
    }
    b.footprint.forEach(([x, y]) => {
      const p = v3(x, y, bottom), q = v3(x, y, b.base_z + b.height);
      pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#22d3ee', transparent: true, opacity: 0.95 }));
    lines.renderOrder = 10;
    this.selection.add(lines);
  }

  /** Opened view: building becomes a glass shell; selected floor shows its unit volumes (pickable). */
  openBuilding(index: number, detail: BuildingDetail, floor: number | null, unit: number | null) {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    this.clearSelection();
    this.hideBuilding(index);
    const b = this.spec.buildings[index];
    const shell = new Soup();
    shell.begin(0);
    addPrism(shell, b.footprint, b.base_z + b.min_height, b.base_z + b.height, 3);
    const shellMesh = new THREE.Mesh(shell.geometry(), new THREE.MeshPhysicalMaterial({
      color: '#bae6fd', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, depthWrite: false, side: THREE.DoubleSide,
    }));
    shellMesh.renderOrder = 8;
    this.selection.add(shellMesh);

    detail.floors.forEach((f) => {
      const slab = new Soup();
      slab.begin(0);
      addPrism(slab, b.footprint, f.z_min - 0.25, f.z_min, 3);
      const color = f.unauthorized ? '#ef4444' : floor === f.floor ? '#22d3ee' : '#e2e8f0';
      const m = new THREE.Mesh(slab.geometry(), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: f.unauthorized ? 0.75 : 0.55 }));
      m.castShadow = true;
      this.selection.add(m);
    });

    const target = detail.floors.find((f) => f.floor === floor);
    if (target) this.drawFloorPlan(target, unit);
  }

  /** Rooms as coloured floors with interior walls, the stair/lift core, corridor, and pickable unit volumes. */
  private drawFloorPlan(target: BuildingDetail['floors'][number], unit: number | null) {
    const z0 = target.z_min + 0.06;
    const wallH = Math.max(target.z_max - target.z_min - 0.35, 2.4);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.9, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    const walls = new Soup();
    walls.begin(0);
    const addWalls = (ring: XY[], h: number) => {
      for (let i = 0; i < ring.length; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[(i + 1) % ring.length];
        const out = new THREE.Vector3(by - ay, 0, bx - ax).normalize();
        walls.quad(v3(ax, ay, z0), v3(bx, by, z0), v3(bx, by, z0 + h), v3(ax, ay, z0 + h), [[0, 0], [1, 0], [1, 1], [0, 1]], out);
      }
    };
    const tiles = new Map<string, Soup>();
    target.units.forEach((u, ui) => {
      addWalls(u.polygon, wallH);
      u.rooms.forEach((r) => {
        addWalls(r.polygon, wallH * 0.92);
        const color = ROOM_COLORS[r.type] ?? '#e5e7eb';
        if (!tiles.has(color)) tiles.set(color, new Soup());
        const t = tiles.get(color)!;
        t.begin(0);
        addPrism(t, r.polygon, z0 - 0.04, z0, 2);
      });
      const hold = u.status === 'PENDING';
      const active = unit === ui;
      const vol = new Soup();
      vol.begin(0);
      addPrism(vol, this.inflate(u.polygon, -0.2), z0, z0 + wallH, 3);
      const mesh = new THREE.Mesh(vol.geometry(), new THREE.MeshStandardMaterial({
        color: hold ? '#ef4444' : active ? '#facc15' : '#38bdf8', transparent: true, opacity: active ? 0.32 : 0.08,
        depthWrite: false, emissive: active ? '#facc15' : '#000000', emissiveIntensity: active ? 0.3 : 0,
      }));
      mesh.userData = { floor: target.floor, unit: ui };
      mesh.renderOrder = 9;
      this.unitPickables.push(mesh);
      this.selection.add(mesh);
      const c = u.polygon.reduce((acc, p) => [acc[0] + p[0] / u.polygon.length, acc[1] + p[1] / u.polygon.length], [0, 0]);
      if (target.units.length <= 12 || active) this.selection.add(this.label(u.unit_no, 'b3d-label b3d-label-unit', v3(c[0], c[1], z0 + wallH + 0.8)));
      if (active) {
        u.rooms.forEach((r) => {
          const rc = r.polygon.reduce((acc, p) => [acc[0] + p[0] / r.polygon.length, acc[1] + p[1] / r.polygon.length], [0, 0]);
          this.selection.add(this.label(`${r.name} · ${r.area_m2} m²`, 'b3d-label b3d-label-room', v3(rc[0], rc[1], z0 + 0.6)));
        });
      }
    });
    tiles.forEach((soup, color) => this.selection.add(new THREE.Mesh(soup.geometry(), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))));
    if (target.corridor) {
      const cs = new Soup();
      cs.begin(0);
      addPrism(cs, target.corridor, z0 - 0.04, z0 + 0.01, 2);
      this.selection.add(new THREE.Mesh(cs.geometry(), new THREE.MeshStandardMaterial({ color: '#cbd5e1' })));
    }
    if (target.core) {
      const core = new Soup();
      core.begin(0);
      addPrism(core, target.core, z0, z0 + wallH, 3);
      this.selection.add(new THREE.Mesh(core.geometry(), new THREE.MeshStandardMaterial({ color: '#64748b', roughness: 0.7 })));
      const cc = target.core.reduce((acc, p) => [acc[0] + p[0] / target.core!.length, acc[1] + p[1] / target.core!.length], [0, 0]);
      this.selection.add(this.label('Stair + lift', 'b3d-label b3d-label-room', v3(cc[0], cc[1], z0 + wallH + 0.4)));
    }
    const wm = new THREE.Mesh(walls.geometry(), wallMat);
    wm.castShadow = true;
    this.selection.add(wm);
  }

  // ------------------------------------------------------------------------- editor helpers
  /** While set, left-clicks on the ground deliver scene-local points instead of picking. */
  setPointTool(fn: ((p: XY) => void) | null) {
    this.pointTool = fn;
    this.renderer.domElement.style.cursor = fn ? 'crosshair' : '';
    if (!fn) this.showDraft([]);
  }

  showDraft(points: XY[], opts: { closed?: boolean; depth?: number; color?: string } = {}) {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    this.draft.clear();
    if (!points.length) return;
    const color = opts.color ?? '#22d3ee';
    const pts = points.map(([x, y]) => v3(x, y, this.sampler.heightAt(x, y) + 0.8 - (opts.depth ?? 0)));
    if (opts.closed && pts.length > 2) pts.push(pts[0].clone());
    const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
    pts.forEach((p) => {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), mat);
      dot.position.copy(p);
      dot.renderOrder = 20;
      this.draft.add(dot);
    });
    if (pts.length > 1) {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false }));
      line.renderOrder = 20;
      this.draft.add(line);
    }
  }

  highlightAsset(id: string | null) {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    this.subsurfacePickables.forEach((o) => {
      const a = this.spec.subsurface[o.userData.index];
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (a.id === id) {
        mat.emissive.set('#22d3ee');
        mat.emissiveIntensity = 1.0;
      }
    });
  }

  getView(): ViewState | null {
    if (!this.loaded) return null;
    const p = this.camera.position, t = this.controls.target;
    return { pos: [p.x, p.y, p.z], target: [t.x, t.y, t.z] };
  }

  setView(v: ViewState) {
    this.flyTo(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target), 0);
  }

  focusOn(x: number, y: number, height = 20, ms = 1100) {
    // Come in from above at ~50 degrees so neighbouring buildings do not block the view.
    const t = v3(x, y, this.sampler.heightAt(x, y) + height * 0.5);
    const d = Math.max(75, height * 3);
    const dir = this.camera.position.clone().sub(this.controls.target).setY(0);
    if (dir.lengthSq() < 1) dir.set(0.6, 0, 0.8);
    dir.normalize().multiplyScalar(d * 0.62);
    this.flyTo(t.clone().add(new THREE.Vector3(dir.x, d * 0.82, dir.z)), t, ms);
  }

  // ------------------------------------------------------------------------- excavation tool
  setDigMode(on: boolean) {
    this.digMode = on;
    this.digStart = null;
    this.renderer.domElement.style.cursor = on ? 'crosshair' : '';
  }

  showTrench(poly: XY[], depth: number, clashIds: string[]) {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    this.trench.clear();
    const s = new Soup();
    s.begin(0);
    const g = this.sampler.heightAt(...poly[0]);
    addPrism(s, poly, g - depth, g + 0.3, 2);
    const mesh = new THREE.Mesh(s.geometry(), new THREE.MeshStandardMaterial({
      color: '#f43f5e', transparent: true, opacity: 0.5, emissive: '#f43f5e', emissiveIntensity: 0.4, depthWrite: false,
    }));
    mesh.renderOrder = 6;
    this.trench.add(mesh);
    this.highlightAssets(clashIds);
  }

  private highlightAssets(ids: string[]) {
    this.subsurfacePickables.forEach((o) => {
      const a = this.spec.subsurface[o.userData.index];
      const mat = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      const style = ASSET_STYLE[a.kind] ?? ASSET_STYLE.water;
      const big = a.kind === 'metro' || a.kind === 'rail_tunnel' || a.kind === 'road_tunnel';
      if (ids.includes(a.id)) {
        mat.emissive.set('#ff0040');
        mat.emissiveIntensity = 1.2;
      } else {
        mat.emissive.set(style.color);
        mat.emissiveIntensity = a.kind === 'basement' ? 0.12 : big ? 0.08 : 0.35;
      }
    });
  }

  clearTrench() {
    if (!this.loaded) return; // effects can fire before the world finishes loading
    this.trench.clear();
    this.highlightAssets([]);
  }

  // ------------------------------------------------------------------------- input & loop
  private bindInput() {
    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || e.button !== 0) return;
      down = null;
      if (this.pointTool) {
        const p = this.groundPoint(e);
        if (p) this.pointTool([p.x, -p.z]);
        return;
      }
      if (this.digMode) {
        const p = this.groundPoint(e);
        if (!p) return;
        if (!this.digStart) {
          this.digStart = p;
          return;
        }
        const a: XY = [this.digStart.x, -this.digStart.z];
        const b: XY = [p.x, -p.z];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = (-(b[1] - a[1]) / len) * 0.75, ny = ((b[0] - a[0]) / len) * 0.75;
        this.digStart = null;
        this.cb.onTrench?.([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
        return;
      }
      this.cb.onPick?.(this.pick(e));
    });
    el.addEventListener('dblclick', (e) => {
      const p = this.groundPoint(e) ?? (() => {
        this.ray.setFromCamera(this.ndc(e), this.camera);
        const hit = this.ray.intersectObjects([this.buildings.roofs.mesh, ...Object.values(this.buildings.walls).map((w) => w.mesh)], false)[0];
        return hit?.point ?? null;
      })();
      if (!p) return;
      const off = this.camera.position.clone().sub(this.controls.target).multiplyScalar(0.45);
      this.flyTo(p.clone().add(off), p, 900);
    });
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.key.toLowerCase());
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    this.unbindKeys = () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
    };
  }
  private unbindKeys = () => undefined as void;

  private handleKeys(dt: number) {
    if (!this.keys.size) return;
    const dist = this.camera.position.distanceTo(this.controls.target);
    const speed = Math.max(15, dist * 0.9) * dt;
    const fwd = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3();
    if (this.keys.has('w') || this.keys.has('arrowup')) move.add(fwd);
    if (this.keys.has('s') || this.keys.has('arrowdown')) move.sub(fwd);
    if (this.keys.has('d') || this.keys.has('arrowright')) move.add(right);
    if (this.keys.has('a') || this.keys.has('arrowleft')) move.sub(right);
    if (move.lengthSq()) {
      move.normalize().multiplyScalar(speed);
      this.camera.position.add(move);
      this.controls.target.add(move);
    }
    if (this.keys.has('r') || this.keys.has('pageup')) this.dive(speed * 0.5);
    if (this.keys.has('f') || this.keys.has('pagedown')) this.dive(-speed * 0.5);
    const rot = (this.keys.has('q') ? 1 : 0) - (this.keys.has('e') ? 1 : 0);
    if (rot) {
      const off = this.camera.position.clone().sub(this.controls.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot * dt * 1.2);
      this.camera.position.copy(this.controls.target).add(off);
    }
  }

  private animate = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.animate);
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    if (this.tween) {
      const k = Math.min((performance.now() - this.tween.t0) / this.tween.ms, 1);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      this.camera.position.lerpVectors(this.tween.from[0], this.tween.to[0], e);
      this.controls.target.lerpVectors(this.tween.from[1], this.tween.to[1], e);
      if (k >= 1) this.tween = null;
    }
    this.handleKeys(dt);
    this.controls.update();
    const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position);
    const heading = (THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z)) + 360) % 360;
    const groundH = this.sampler.heightAt(this.camera.position.x, -this.camera.position.z);
    this.cb.onCamera?.(heading, Math.max(0, groundH - this.camera.position.y));
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  };

  private resize() {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObs.disconnect();
    this.unbindKeys();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mat: THREE.Material) => {
        Object.values(mat).forEach((v) => (v instanceof THREE.Texture ? v.dispose() : undefined));
        mat.dispose();
      });
    });
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labels.domElement.remove();
  }

  static get depthLimit() {
    return EARTH_DEPTH_M;
  }
}

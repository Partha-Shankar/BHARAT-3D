import * as THREE from 'three';

/** Plan positions for the Ashok Place / Gol Dakkhana mock (X east, Z south). */
export const ASHOK = {
  tower: [-48, 0, 18] as [number, number, number],
  metro: [-24, -13.2, 0] as [number, number, number],
  parking: [36, -6, -28] as [number, number, number],
  violation: [-68, 6, 24] as [number, number, number],
  flyoverAshoka: [40, 9, 42] as [number, number, number],
  flyoverBangla: [20, 12.4, -48] as [number, number, number],
  footbridge: [24, 6.2, 4] as [number, number, number],
};

type BuildOpts = {
  isUnderground: boolean;
  hideSurface: boolean;
  selectedFloor: number;
  selectedUnit: number;
};

const meta = (data: Record<string, unknown>) => data;

export function buildAshokPlaceWorld(scene: THREE.Scene, opts: BuildOpts) {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3c424a, roughness: 0.92 });
  const roadEdgeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const pathMat = new THREE.MeshStandardMaterial({
    color: 0xe7e5e4,
    roughness: 0.85,
    transparent: opts.isUnderground,
    opacity: opts.isUnderground ? 0.2 : 1,
  });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x3d6b38, roughness: 1 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x2c6e86,
    roughness: 0.15,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92,
  });

  addGround(scene, opts);
  addRoundabout(scene, roadMat, grassMat, roadEdgeMat);
  addRoads(scene, roadMat, roadEdgeMat, pathMat);
  addParksAndWater(scene, grassMat, waterMat);
  addFlooredBlocks(scene, opts);
  addIllegalConstruction(scene);
  addFlyover(
    scene,
    [
      [-28, 22],
      [8, 26],
      [42, 44],
      [88, 60],
    ],
    8.8,
    8.2,
    0xd6d3d1,
    meta({
      id: 'INFRA-FLYOVER-01',
      category: 'flyover',
      name: 'Ashoka Road Flyover',
      tagline: 'Elevated carriageway over Ashoka Road',
      ulpin: 'INF-FLY-DL01-0004',
      ulpinType: 'INFRA_3D_ULPIN',
      heightMeters: 8.8,
      status: 'Flyover 1 · grade-separated over Ashoka Road',
      centroid: ASHOK.flyoverAshoka,
    })
  );
  addFlyover(
    scene,
    [
      [-72, -58],
      [-22, -42],
      [16, -50],
      [58, -62],
      [92, -40],
    ],
    12.4,
    8.2,
    0xa8a29e,
    meta({
      id: 'INFRA-FLYOVER-02',
      category: 'flyover',
      name: 'Bangla Sahib Road Flyover',
      tagline: 'Second elevated carriageway, north-east of Gol Dakkhana',
      ulpin: 'INF-FLY-DL01-0005',
      ulpinType: 'INFRA_3D_ULPIN',
      heightMeters: 12.4,
      status: 'Flyover 2 · grade-separated over Bangla Sahib Road',
      centroid: ASHOK.flyoverBangla,
    })
  );
  addFootOverBridge(scene);
  addMetro(scene, opts);
  addBasementParking(scene, opts);
  addTrees(scene);
  addCars(scene);
}

let cachedSatelliteTex: THREE.CanvasTexture | null = null;

function satelliteTexture() {
  if (cachedSatelliteTex) return cachedSatelliteTex;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#6a754c';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 2800; i++) {
    const shade = Math.random();
    ctx.fillStyle = shade > 0.66 ? 'rgba(58,78,40,0.45)' : shade > 0.33 ? 'rgba(120,108,72,0.35)' : 'rgba(90,98,62,0.3)';
    ctx.fillRect(Math.random() * 1024, Math.random() * 1024, Math.random() * 18 + 2, Math.random() * 12 + 2);
  }
  for (let i = 0; i < 180; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#3e6a38' : '#2f522c';
    ctx.beginPath();
    ctx.arc(Math.random() * 1024, Math.random() * 1024, Math.random() * 7 + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  cachedSatelliteTex = new THREE.CanvasTexture(canvas);
  cachedSatelliteTex.colorSpace = THREE.SRGBColorSpace;
  cachedSatelliteTex.wrapS = THREE.RepeatWrapping;
  cachedSatelliteTex.wrapT = THREE.RepeatWrapping;
  return cachedSatelliteTex;
}

function addGround(scene: THREE.Scene, opts: BuildOpts) {
  const tex = satelliteTexture();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    roughness: 0.96,
    transparent: true,
    opacity: opts.hideSurface ? 0 : opts.isUnderground ? 0.08 : 1,
    visible: !opts.hideSurface,
  });
  // Quads that leave open trenches for the yellow line, blue line, and basement.
  const rects: [number, number, number, number][] = [
    [-100, -29.6, -100, 33.6],
    [-100, -29.6, 46.4, 100],
    [-100, -62, 34.2, 45.8],
    [-18.4, 100, -100, -36],
    [-18.4, 27.2, -35.2, -20.2],
    [44.8, 100, -35.2, -20.2],
    [-18.4, 100, -19.6, 33.6],
    [-18.4, 100, 46.4, 100],
    [76, 100, 34.2, 45.8],
  ];
  rects.forEach(([x0, x1, z0, z1]) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);
  });

  if (!opts.hideSurface) {
    excavation(scene, -24, 0, 11.2, 150, 14.6, 0xa5f3fc, 'YELLOW LINE METRO  ·  −13 m');
    excavation(scene, 7, 40, 138, 11.2, 17.2, 0x93c5fd, 'BLUE LINE METRO  ·  −16 m');
    excavation(scene, 36, -28, 17.4, 15.2, 8.4, 0xfcd34d, 'YUSUF SADAN BASEMENT  ·  B1 / B2');
  }
}

function excavation(
  scene: THREE.Scene,
  x: number,
  z: number,
  w: number,
  d: number,
  depth: number,
  tint: number,
  label: string
) {
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({
      color: tint,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      roughness: 0.05,
    })
  );
  glass.rotation.x = -Math.PI / 2;
  glass.position.set(x, 0.04, z);
  glass.renderOrder = 2;
  scene.add(glass);

  const soil = new THREE.MeshStandardMaterial({ color: 0x8d7356, roughness: 1 });
  const rims: [number, number, number, number, number, number][] = [
    [w, depth, 0.4, 0, -depth / 2, d / 2],
    [w, depth, 0.4, 0, -depth / 2, -d / 2],
    [0.4, depth, d, -w / 2, -depth / 2, 0],
    [0.4, depth, d, w / 2, -depth / 2, 0],
  ];
  rims.forEach(([ww, hh, dd, px, py, pz]) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), soil);
    wall.position.set(x + px, py, z + pz);
    scene.add(wall);
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.3, d - 0.3),
    new THREE.MeshStandardMaterial({ color: 0x4a3b2e, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(x, -depth + 0.08, z);
  scene.add(floor);

  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(15,23,42,0.8)';
  ctx.fillRect(0, 0, 768, 128);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 384, 64);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false })
  );
  sprite.position.set(x, 1.6, z);
  sprite.scale.set(14, 2.4, 1);
  scene.add(sprite);
}

function addRoundabout(
  scene: THREE.Scene,
  roadMat: THREE.Material,
  grassMat: THREE.Material,
  edgeMat: THREE.Material
) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(9.5, 17.5, 64), roadMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  ring.receiveShadow = true;
  scene.add(ring);
  const island = new THREE.Mesh(new THREE.CircleGeometry(9.2, 48), grassMat);
  island.rotation.x = -Math.PI / 2;
  island.position.y = 0.1;
  scene.add(island);
  const dash = new THREE.Mesh(new THREE.RingGeometry(13.1, 13.35, 64), edgeMat);
  dash.rotation.x = -Math.PI / 2;
  dash.position.y = 0.12;
  scene.add(dash);
}

function addRoad(
  scene: THREE.Scene,
  mat: THREE.Material,
  edge: THREE.Material,
  path: THREE.Material,
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  width: number
) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const rot = Math.atan2(-dz, dx);
  const cx = (x1 + x2) / 2;
  const cz = (z1 + z2) / 2;
  const sidewalk = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, width + 3.4), path);
  sidewalk.position.set(cx, 0.04, cz);
  sidewalk.rotation.y = rot;
  scene.add(sidewalk);
  const road = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, width), mat);
  road.position.set(cx, 0.1, cz);
  road.rotation.y = rot;
  scene.add(road);
  [-width / 2 + 0.15, width / 2 - 0.15].forEach((offset) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.18), edge);
    line.position.set(cx, 0.18, cz);
    line.rotation.y = rot;
    line.translateZ(offset);
    scene.add(line);
  });
}

function addRoads(
  scene: THREE.Scene,
  road: THREE.Material,
  edge: THREE.Material,
  path: THREE.Material
) {
  const spokes: [number, number, number, number, number][] = [
    [-90, 8, -18, 5, 8],
    [18, 2, 96, 6, 8],
    [-16, -8, -82, -52, 7],
    [14, -12, 74, -64, 7],
    [6, 18, 78, 64, 8],
    [-72, 42, -12, 16, 6.5],
    [0, -18, 2, -78, 6],
  ];
  spokes.forEach(([x1, z1, x2, z2, w]) => addRoad(scene, road, edge, path, x1, z1, x2, z2, w));
}

function addParksAndWater(scene: THREE.Scene, grass: THREE.Material, water: THREE.Material) {
  const park = new THREE.Mesh(new THREE.PlaneGeometry(26, 16), grass);
  park.rotation.x = -Math.PI / 2;
  park.position.set(-2, 0.12, -42);
  scene.add(park);

  const sarovar = new THREE.Mesh(new THREE.PlaneGeometry(28, 20), water);
  sarovar.rotation.x = -Math.PI / 2;
  sarovar.position.set(58, 0.15, 2);
  scene.add(sarovar);
  const coping = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.35, 22),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.8 })
  );
  coping.position.set(58, 0.2, 2);
  scene.add(coping);
  const waterTop = new THREE.Mesh(new THREE.PlaneGeometry(27, 19), water);
  waterTop.rotation.x = -Math.PI / 2;
  waterTop.position.set(58, 0.4, 2);
  scene.add(waterTop);
}

const facadeTexCache = new Map<number, THREE.CanvasTexture>();

function facadeTexture(hex: number) {
  const existing = facadeTexCache.get(hex);
  if (existing) return existing;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  const wall = `#${hex.toString(16).padStart(6, '0')}`;
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 128, 192);
  ctx.fillStyle = '#2a3340';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      const x = 12 + col * 28;
      const y = 14 + row * 36;
      ctx.fillRect(x, y, 16, 22);
      ctx.fillStyle = 'rgba(186, 220, 236, 0.55)';
      ctx.fillRect(x + 1, y + 1, 14, 8);
      ctx.fillStyle = '#2a3340';
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  facadeTexCache.set(hex, tex);
  return tex;
}

function addBlock(
  scene: THREE.Scene,
  o: {
    id: string;
    name: string;
    category: string;
    x: number;
    z: number;
    w: number;
    d: number;
    floors: number;
    color: number;
    ulpin: string;
    ulpinType?: string;
    extra?: Record<string, unknown>;
  }
) {
  const group = new THREE.Group();
  group.position.set(o.x, 0, o.z);
  const data = meta({
    id: o.id,
    category: o.category,
    name: o.name,
    tagline: `${o.floors} floored block on the Ashok Place plan`,
    ulpin: o.ulpin,
    ulpinType: o.ulpinType || '3D_ULPIN',
    floors: o.floors,
    heightMeters: o.floors * 3,
    centroid: [o.x, (o.floors * 3) / 2, o.z],
    status: 'Mock cadastral volume',
    ...o.extra,
  });
  group.userData = data;
  scene.add(group);
  const floorH = 3;
  for (let f = 1; f <= o.floors; f++) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(o.w, 0.28, o.d),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.7 })
    );
    slab.position.y = (f - 1) * floorH;
    slab.castShadow = true;
    slab.userData = data;
    group.add(slab);
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(o.w - 0.4, floorH - 0.35, o.d - 0.4),
      new THREE.MeshStandardMaterial({ map: facadeTexture(o.color), roughness: 0.62, metalness: 0.04 })
    );
    wall.position.y = (f - 1) * floorH + floorH / 2;
    wall.castShadow = true;
    wall.userData = data;
    group.add(wall);
  }
  return group;
}

function addFlooredBlocks(scene: THREE.Scene, opts: BuildOpts) {
  addBlock(scene, {
    id: 'CATHEDRAL-01',
    name: 'Sacred Heart Catholic Cathedral',
    category: 'amenity',
    x: -4,
    z: -62,
    w: 16,
    d: 11,
    floors: 2,
    color: 0xf5f5f4,
    ulpin: 'IN-DL-01-ASHOK-CATH',
    ulpinType: '2D_ULPIN',
  });
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 8, 4),
    new THREE.MeshStandardMaterial({ color: 0xe7e5e4 })
  );
  spire.position.set(-4, 10, -62);
  scene.add(spire);

  addBlock(scene, {
    id: 'BISHOPS-01',
    name: "Catholic Bishops' Conference of India Centre",
    category: 'amenity',
    x: -54,
    z: -30,
    w: 18,
    d: 12,
    floors: 4,
    color: 0xd6d3d1,
    ulpin: 'IN-DL-01-ASHOK-CBCI',
  });

  const tower = addBlock(scene, {
    id: 'BLD-01-01',
    name: 'Ashok Place Residency',
    category: 'tower',
    x: ASHOK.tower[0],
    z: ASHOK.tower[2],
    w: 14,
    d: 12,
    floors: 8,
    color: 0xd6d3d1,
    ulpin: 'IN-DL-01-849201-B01',
    extra: {
      base2dUlpin: 'IN-DL-01-849201',
      plotNumber: 'Ashok Place Plot',
      units: 32,
      owner: 'Ashok Place Residents Welfare Association',
      tagline: 'Mock multi-floor residential block west of Gol Dakkhana',
    },
  });
  // Replace solid floors with selectable flats on the inspected building.
  while (tower.children.length) tower.remove(tower.children[0]);
  const floorH = 3;
  for (let f = 1; f <= 8; f++) {
    const inspected = f === opts.selectedFloor;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: inspected ? 0xf59e0b : 0x9ca3af, roughness: 0.6 })
    );
    slab.position.y = (f - 1) * floorH + 0.2;
    slab.castShadow = true;
    slab.userData = { ...tower.userData, floorNumber: f, isTowerSlab: true };
    tower.add(slab);
    const units = [
      { u: 1, x: -3.2, z: -2.6 },
      { u: 2, x: 3.2, z: -2.6 },
      { u: 3, x: -3.2, z: 2.6 },
      { u: 4, x: 3.2, z: 2.6 },
    ];
    units.forEach((u) => {
      const target = inspected && u.u === opts.selectedUnit;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(5.6, 2.5, 4.8),
        new THREE.MeshStandardMaterial({
          map: target || inspected ? undefined : facadeTexture(0xd9d3c7),
          color: target ? 0xfbbf24 : inspected ? 0xc4b5a0 : 0xffffff,
          roughness: 0.55,
        })
      );
      mesh.position.set(u.x, (f - 1) * floorH + 1.55, u.z);
      mesh.castShadow = true;
      mesh.userData = {
        ...tower.userData,
        floorNumber: f,
        unitNumber: u.u,
        isTowerUnit: true,
        centroid: [ASHOK.tower[0] + u.x, (f - 1) * floorH + 1.55, ASHOK.tower[2] + u.z],
      };
      tower.add(mesh);
    });
  }

  addBlock(scene, {
    id: 'YUSUF-SADAN',
    name: 'Yusuf Sadan',
    category: 'tower',
    x: 36,
    z: -28,
    w: 12,
    d: 10,
    floors: 5,
    color: 0xe5e7eb,
    ulpin: 'IN-DL-01-ASHOK-YUSUF',
    extra: { tagline: 'Five-floor block above the basement parking cut' },
  });
  addBlock(scene, {
    id: 'GURUDWARA-01',
    name: 'Gurudwara Bangla Sahib',
    category: 'amenity',
    x: 64,
    z: 28,
    w: 18,
    d: 14,
    floors: 2,
    color: 0xfafaf9,
    ulpin: 'IN-DL-01-ASHOK-GSB',
    ulpinType: '2D_ULPIN',
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf5d061, metalness: 0.35, roughness: 0.35 })
  );
  dome.position.set(64, 6.2, 28);
  scene.add(dome);

  addBlock(scene, {
    id: 'CLINIC-01',
    name: 'Guru Harkrishan Polyclinic',
    category: 'hospital',
    x: 84,
    z: 8,
    w: 12,
    d: 10,
    floors: 4,
    color: 0xfecaca,
    ulpin: 'INF-HSP-DL01-0001',
    ulpinType: 'INFRA_3D_ULPIN',
  });
  addBlock(scene, {
    id: 'YOGA-01',
    name: 'Morarji Desai National Institute of Yoga',
    category: 'amenity',
    x: 8,
    z: 52,
    w: 20,
    d: 11,
    floors: 3,
    color: 0xe5e7eb,
    ulpin: 'IN-DL-01-ASHOK-YOGA',
  });
  addBlock(scene, {
    id: 'GPO-01',
    name: 'New Delhi GPO',
    category: 'amenity',
    x: -62,
    z: 40,
    w: 14,
    d: 11,
    floors: 3,
    color: 0xd6c4a8,
    ulpin: 'IN-DL-01-ASHOK-GPO',
  });

  const fillers: [number, number, number, number, number][] = [
    [-72, -8, 10, 8, 3],
    [-28, -58, 11, 8, 4],
    [48, -52, 10, 8, 3],
    [-36, 52, 12, 8, 2],
    [16, 72, 10, 8, 4],
    [78, 48, 9, 8, 3],
    [-88, 48, 8, 8, 2],
  ];
  fillers.forEach(([x, z, w, d, floors], i) => {
    addBlock(scene, {
      id: `MOCK-BLK-${i + 1}`,
      name: `Ashok Place Block ${i + 1}`,
      category: 'tower',
      x,
      z,
      w,
      d,
      floors,
      color: 0xd4d4d8,
      ulpin: `IN-DL-01-ASHOK-B${i + 1}`,
    });
  });
}

export function updateAshokTowerSelection(scene: THREE.Scene, selectedFloor: number, selectedUnit: number) {
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.userData) {
      if (obj.userData.isTowerSlab) {
        const inspected = obj.userData.floorNumber === selectedFloor;
        const mat = obj.material as THREE.MeshStandardMaterial;
        mat.color.setHex(inspected ? 0xf59e0b : 0x9ca3af);
      } else if (obj.userData.isTowerUnit) {
        const inspected = obj.userData.floorNumber === selectedFloor;
        const target = inspected && obj.userData.unitNumber === selectedUnit;
        const mat = obj.material as THREE.MeshStandardMaterial;
        mat.color.setHex(target ? 0xfbbf24 : inspected ? 0xc4b5a0 : 0xffffff);
        if (target || inspected) {
          mat.map = null;
        } else {
          mat.map = facadeTexture(0xd9d3c7);
        }
        mat.needsUpdate = true;
      }
    }
  });
}

function addIllegalConstruction(scene: THREE.Scene) {
  const data = meta({
    id: 'BLD-01-SHARMA',
    category: 'violation',
    name: 'Illegal construction on Baba Kharak Singh Marg',
    tagline: 'Extra floors and footpath encroachment',
    ulpin: 'IN-DL-01-849205-B07-F05-UNAUTHORIZED',
    ulpinType: 'VIOLATION',
    base2dUlpin: 'IN-DL-01-849205',
    plotNumber: 'Ashoka Road edge',
    floors: 5,
    heightMeters: 16.5,
    owner: 'Unauthorised vertical addition',
    centroid: ASHOK.violation,
    violations: [
      {
        type: '1. Unauthorized vertical construction',
        description: 'Sanctioned G+2. Floors 4 and 5 are built beyond the permit and shown in red.',
        penalty: 'Demolition notice and penalty',
        status: 'RED ALERT',
      },
      {
        type: '2. Public footpath encroachment',
        description: 'Ground-floor frontage extends about 3.5 m into the Baba Kharak Singh Marg sidewalk.',
        penalty: 'Sealing of encroached bay',
        status: 'PHYSICAL OVERLAP',
      },
    ],
    status: 'Illegal floors and footpath overlap',
  });
  const group = new THREE.Group();
  group.position.set(-68, 0, 24);
  group.userData = data;
  scene.add(group);
  for (let f = 1; f <= 5; f++) {
    const illegal = f >= 4;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.28, 9),
      new THREE.MeshStandardMaterial({ color: illegal ? 0x991b1b : 0x9ca3af })
    );
    slab.position.y = (f - 1) * 3.1;
    slab.userData = data;
    group.add(slab);
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(11.4, 2.6, 8.4),
      new THREE.MeshStandardMaterial({
        color: illegal ? 0xef4444 : 0xd6d3d1,
        transparent: illegal,
        opacity: illegal ? 0.92 : 1,
      })
    );
    wall.position.y = (f - 1) * 3.1 + 1.45;
    wall.castShadow = true;
    wall.userData = data;
    group.add(wall);
    if (illegal) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(wall.geometry),
        new THREE.LineBasicMaterial({ color: 0xff0000 })
      );
      edges.position.copy(wall.position);
      group.add(edges);
    }
  }

  const pathData = meta({
    id: 'PED-SHARMA-01',
    category: 'footpath',
    name: 'Illegal footpath encroachment — Baba Kharak Singh Marg',
    tagline: 'Shopfront occupying the public sidewalk',
    ulpin: 'INF-ROW-DL01-PED-SHARMA-01',
    ulpinType: 'INFRA_3D_ULPIN',
    widthMeters: 3.5,
    status: 'ACTIVE ENCROACHMENT DETECTED (3.5m OVERLAP)',
    centroid: [-68, 0.4, 16],
    jurisdiction: 'Municipal Corporation',
  });
  const legalPath = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.16, 3.2),
    new THREE.MeshStandardMaterial({ color: 0xe7e5e4 })
  );
  legalPath.position.set(-68, 0.2, 16.2);
  legalPath.userData = pathData;
  scene.add(legalPath);
  const encroachment = new THREE.Mesh(
    new THREE.BoxGeometry(9, 0.35, 3.4),
    new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xbe123c, emissiveIntensity: 0.25 })
  );
  encroachment.position.set(-68, 0.45, 16.4);
  encroachment.castShadow = true;
  encroachment.userData = pathData;
  scene.add(encroachment);
}

function addFlyover(
  scene: THREE.Scene,
  pts: [number, number][],
  y: number,
  width: number,
  deckColor: number,
  userData: Record<string, unknown>
) {
  const group = new THREE.Group();
  group.userData = userData;
  scene.add(group);
  const deckMat = new THREE.MeshStandardMaterial({ color: deckColor, roughness: 0.65 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.4 });
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7 });
  const laneMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });

  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const rot = Math.atan2(-dz, dx);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.55, width), deckMat);
    deck.position.set(cx, y, cz);
    deck.rotation.y = rot;
    deck.castShadow = true;
    deck.userData = userData;
    group.add(deck);
    [-width / 2, width / 2].forEach((side) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.7, 0.18), railMat);
      rail.position.set(cx, y + 0.6, cz);
      rail.rotation.y = rot;
      rail.translateZ(side);
      rail.userData = userData;
      group.add(rail);
    });
    const lane = new THREE.Mesh(new THREE.BoxGeometry(len * 0.92, 0.02, 0.16), laneMat);
    lane.position.set(cx, y + 0.3, cz);
    lane.rotation.y = rot;
    lane.userData = userData;
    group.add(lane);
  }
  pts.forEach(([x, z]) => {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.1, y - 0.2, 1.1), pierMat);
    pier.position.set(x, (y - 0.2) / 2, z);
    pier.castShadow = true;
    pier.userData = userData;
    group.add(pier);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 0.4, 0.45, 1.6), pierMat);
    cap.position.set(x, y - 0.35, z);
    cap.userData = userData;
    group.add(cap);
  });
}

function addFootOverBridge(scene: THREE.Scene) {
  const data = meta({
    id: 'FOB-ASHOK-01',
    category: 'amenity',
    name: 'Foot over bridge — west of Gol Dakkhana',
    tagline: 'Pedestrian bridge across Baba Kharak Singh Marg',
    ulpin: 'INF-FOB-DL01-0001',
    ulpinType: 'INFRA_3D_ULPIN',
    heightMeters: 6.2,
    status: 'Pedestrian only · narrower than the two road flyovers',
    centroid: ASHOK.footbridge,
  });
  const group = new THREE.Group();
  group.position.set(24, 0, 4);
  group.userData = data;
  scene.add(group);
  const steel = new THREE.MeshStandardMaterial({ color: 0x0f766e, metalness: 0.35, roughness: 0.4 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 14), steel);
  deck.position.y = 6.2;
  deck.userData = data;
  deck.castShadow = true;
  group.add(deck);
  [-1.5, 1.5].forEach((x) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 14), steel);
    rail.position.set(x, 6.85, 0);
    rail.userData = data;
    group.add(rail);
  });
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 8; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.22, 0.85), steel);
      step.position.set(0, 5.7 - i * 0.75, side * (7.4 + i * 0.9));
      step.userData = data;
      group.add(step);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.85), steel);
      rail.position.set(1.5, 6.15 - i * 0.75, side * (7.4 + i * 0.9));
      group.add(rail);
    }
  });
}

function addMetro(scene: THREE.Scene, opts: BuildOpts) {
  const show = opts.isUnderground ? 0.95 : 0.9;
  const station = meta({
    id: 'METRO-STN-01',
    category: 'metro',
    name: 'Gol Dakkhana Underground Metro',
    tagline: 'Yellow line north–south and blue line east–west',
    ulpin: 'INF-TUN-DL01-0012',
    ulpinType: 'INFRA_3D_ULPIN',
    depthMeters: 13.2,
    owner: 'Delhi Metro Rail Corporation (DMRC)',
    status: 'Two underground metro lines visible in the earth cuts',
    centroid: [-24, -13.2, 0],
  });

  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: show,
  });
  const yellow = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.3, 148, 24, 1, true), yellowMat);
  yellow.rotation.x = Math.PI / 2;
  yellow.position.set(-24, -13.2, 0);
  yellow.userData = station;
  scene.add(yellow);

  const blue = new THREE.Mesh(
    new THREE.CylinderGeometry(3.1, 3.1, 136, 24, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: show,
    })
  );
  blue.rotation.z = Math.PI / 2;
  blue.position.set(7, -16.2, 40);
  blue.userData = { ...station, id: 'METRO-LINE-BLUE', name: 'Blue Line Metro Tunnel', centroid: [7, -16.2, 40] };
  scene.add(blue);

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.8, 36),
    new THREE.MeshStandardMaterial({ color: 0x1e293b })
  );
  platform.position.set(-24, -11.4, -6);
  platform.userData = station;
  scene.add(platform);
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.12, 36),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.4 })
  );
  edge.position.set(-21.2, -10.9, -6);
  edge.userData = station;
  scene.add(edge);

  const concourse = new THREE.Mesh(
    new THREE.BoxGeometry(12, 2.4, 18),
    new THREE.MeshStandardMaterial({ color: 0x0e7490, transparent: true, opacity: 0.8 })
  );
  concourse.position.set(-24, -7.2, -4);
  concourse.userData = station;
  scene.add(concourse);

  const pickMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const yellowPick = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 146), pickMat);
  yellowPick.position.set(-24, -10, 0);
  yellowPick.userData = station;
  scene.add(yellowPick);
  const bluePick = new THREE.Mesh(new THREE.BoxGeometry(136, 8, 14), pickMat.clone());
  bluePick.position.set(7, -14, 40);
  bluePick.userData = blue.userData;
  scene.add(bluePick);
}

function addBasementParking(scene: THREE.Scene, opts: BuildOpts) {
  const data = meta({
    id: 'UTIL-PARKING-B1-B2',
    category: 'parking',
    name: 'Yusuf Sadan basement parking',
    tagline: 'Two underground parking levels under Yusuf Sadan',
    ulpin: 'INF-BSM-849201-B02',
    ulpinType: 'INFRA_3D_ULPIN',
    floors: 2,
    depthMeters: 7.6,
    parkingStalls: 86,
    status: 'B1 and B2 visible through the basement cut',
    centroid: [36, -5.5, -28],
  });
  const opacity = opts.isUnderground ? 0.95 : 0.88;
  [-3.6, -7.2].forEach((depth, level) => {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(15.5, 0.28, 13.2),
      new THREE.MeshStandardMaterial({
        color: level === 0 ? 0xf59e0b : 0xd97706,
        emissive: 0xb45309,
        emissiveIntensity: 0.15,
        transparent: true,
        opacity,
      })
    );
    slab.position.set(36, depth, -28);
    slab.userData = data;
    scene.add(slab);
    for (let x = -5; x <= 5; x += 5) {
      for (let z = -4; z <= 4; z += 4) {
        const col = new THREE.Mesh(
          new THREE.BoxGeometry(0.45, 3.1, 0.45),
          new THREE.MeshStandardMaterial({ color: 0x44403c })
        );
        col.position.set(36 + x, depth + 1.6, -28 + z);
        col.userData = data;
        scene.add(col);
      }
    }
    [-4, 0, 4].forEach((x) => {
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 0.7, 1.1),
        new THREE.MeshStandardMaterial({ color: x === 0 ? 0x2563eb : 0xdc2626 })
      );
      car.position.set(36 + x, depth + 0.6, -28);
      car.userData = data;
      scene.add(car);
    });
  });
  const pick = new THREE.Mesh(
    new THREE.BoxGeometry(16, 8, 14),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
  );
  pick.position.set(36, -5, -28);
  pick.userData = data;
  scene.add(pick);
}

function addTrees(scene: THREE.Scene) {
  const spots: [number, number][] = [
    [-10, -40],
    [6, -44],
    [-8, -36],
    [4, -36],
    [-70, 4],
    [80, -10],
    [40, 58],
    [-20, 60],
  ];
  spots.forEach(([x, z]) => {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.35, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b4f3a })
    );
    trunk.position.set(x, 1.1, z);
    scene.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(1.5, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0x3f7d32, roughness: 0.9 })
    );
    crown.position.set(x, 2.8, z);
    scene.add(crown);
  });
}

function addCars(scene: THREE.Scene) {
  const cars: [number, number, number, number][] = [
    [-55, 7, 0, 0xdc2626],
    [40, 4, 0, 0x2563eb],
    [24, 9.2, 30, 0xf8fafc],
    [-10, 12.8, -40, 0xfbbf24],
  ];
  cars.forEach(([x, y, z, color]) => {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.7, 1.5),
      new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 })
    );
    body.position.set(x, y, z);
    scene.add(body);
  });
}

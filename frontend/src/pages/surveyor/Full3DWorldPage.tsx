import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import {
  ArrowLeft,
  Building2,
  AlertTriangle,
  Train,
  ShoppingBag,
  HeartPulse,
  X,
  RotateCcw,
  Car,
  Home,
  Droplet,
  Construction,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Compass,
  Layers,
  Info
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ASHOK, buildAshokPlaceWorld, updateAshokTowerSelection } from './ashokPlaceWorld';

// ===========================================================================
// MoHUA B3D-STD-2026-ULPIN-01 NATIONAL STANDARD DATA TYPES
// ===========================================================================
export type UlpinAllocationType = '3D_ULPIN' | '2D_ULPIN' | 'INFRA_3D_ULPIN' | 'VIOLATION';

export interface SelectedObjectData {
  id: string;
  category: 'tower' | 'hospital' | 'mall' | 'villa' | 'violation' | 'flyover' | 'metro' | 'railway' | 'utility' | 'parking' | 'footpath' | 'amenity';
  name: string;
  tagline: string;
  ulpin: string;
  ulpinType: UlpinAllocationType;
  base2dUlpin?: string;
  vprid?: string;
  plotNumber?: string;
  floors?: number;
  units?: number;
  heightMeters?: number;
  depthMeters?: number;
  zRange?: string;
  builtUpArea?: string;
  carpetArea?: string;
  volumeM3?: string;
  udsPercentage?: string;
  owner?: string;
  occupant?: string;
  titleDeed?: string;
  propertyTax?: string;
  municipalTaxId?: string;
  status?: string;
  standardNormRef?: string;
  normRationale?: string;
  departments?: string[];
  storesCount?: number;
  leasedCount?: number;
  vacantCount?: number;
  parkingStalls?: number;
  evPoints?: number;
  widthMeters?: number;
  surfaceMaterial?: string;
  violations?: {
    type: string;
    description: string;
    penalty: string;
    status: string;
  }[];
  utilityType?: string;
  diameter?: string;
  material?: string;
  jurisdiction?: string;
  centroid?: [number, number, number];
}

const AREA_TITLES: Record<string, { name: string; ward: string; desc: string }> = {
  area_01: { name: 'Ashok Place', ward: 'Gol Dakkhana', desc: 'Bangla Sahib roundabout, metro lines, two flyovers' },
  area_02: { name: 'Metro District', ward: 'Ward 22', desc: 'Dual Metro Transit Hub & Commercial Arcade' },
  area_03: { name: 'Civic Square', ward: 'Ward 08', desc: 'Administrative District & Strata High-Rises' },
  area_04: { name: 'Transit Quarter', ward: 'Ward 31', desc: 'Intermodal Transit & Subterranean Rail Sector' },
  area_05: { name: 'Urban Heights', ward: 'Ward 14', desc: 'Mixed-Use Towers & Curved Flyover Bypass' },
  area_06: { name: 'Central Market Zone', ward: 'Ward 19', desc: 'Retail Hub, Shopping Complex & Villa Enclave' },
  area_07: { name: 'Civic Transit Zone', ward: 'Ward 05', desc: 'Healthcare Campus & Subterranean Rail Corridor' },
  area_08: { name: 'Integrated Urban Zone', ward: 'Ward 27', desc: 'Smart Eco-District & Arterial Viaduct' },
  area_09: { name: 'Vertical City District', ward: 'Ward 11', desc: 'High-Density Skyscraper & Multi-Level Parking' },
  area_10: { name: 'Central Urban Core', ward: 'Ward 01', desc: 'Urban Core Redevelopment & Plotted Lands' },
};

export const Full3DWorldPage: React.FC = () => {
  const navigate = useNavigate();
  const { areaId: paramAreaId } = useParams();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || 'proj-001';
  const activeArea = paramAreaId || 'area_01';
  const areaInfo = AREA_TITLES[activeArea] || AREA_TITLES['area_01'];


  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animFrameId = useRef<number | null>(null);
  const beaconMeshRef = useRef<THREE.Group | null>(null);

  // View & Environment Modes
  const [isUnderground, setIsUnderground] = useState<boolean>(false);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [hideSurfaceCompletely, setHideSurfaceCompletely] = useState<boolean>(false);
  const [cameraView, setCameraView] = useState<'perspective' | 'top' | 'front' | 'violation' | 'underground_metro' | 'underground_parking'>('perspective');
  const [showViolationList, setShowViolationList] = useState(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Selected Object State - ONLY opens when an object is clicked
  const [selectedObject, setSelectedObject] = useState<SelectedObjectData | null>(null);

  const [selectedFloor, setSelectedFloor] = useState<number>(8);
  const [selectedUnit, setSelectedUnit] = useState<number>(4);
  const [selectedHospitalDept, setSelectedHospitalDept] = useState<string>('Level 4: Intensive Care Unit (ICU) & CCU');

  // 360° Spherical Camera Orbit — desired pose is eased every frame (inertia + damping)
  const focusId = searchParams.get('focus');
  const isDragging = useRef<boolean>(false);
  const pointerDownPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const previousMousePosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const orbitVelocity = useRef<{ theta: number; phi: number }>({ theta: 0, phi: 0 });
  const pointerDown = useRef<boolean>(false);
  const cameraSpherical = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 132,
    theta: 0.62,
    phi: 0.98,
  });
  const cameraTarget = useRef<THREE.Vector3>(new THREE.Vector3(8, 2, 2));
  const desiredSpherical = useRef({ ...cameraSpherical.current });
  const desiredTarget = useRef(cameraTarget.current.clone());
  const isRotatingRef = useRef(isRotating);
  const flyToRef = useRef<(data: SelectedObjectData) => void>(() => {});
  const undergroundRef = useRef(isUnderground);
  const [sceneEpoch, setSceneEpoch] = useState(0);

  // =========================================================================
  // DYNAMIC COMPUTATION OF ACTIVE 3D / 2D ULPIN DETAILS (MoHUA STANDARD)
  // =========================================================================
  const getActiveUlpinDetails = () => {
    if (!selectedObject) {
      return null;
    }

    if (selectedObject.id === 'BLD-01-01') {
      const fStr = selectedFloor.toString().padStart(2, '0');
      const uNoStr = `${selectedFloor}0${selectedUnit}`;
      const code = `IN-DL-01-849201-B01-F${fStr}-U${uNoStr}-R`;
      const zMin = (2.5 + (selectedFloor - 1) * 3.1).toFixed(1);
      const zMax = (2.5 + selectedFloor * 3.1).toFixed(1);
      const vols = ['282.2 m³', '360.0 m³', '294.4 m³', '347.2 m³'];
      const carpets = ['88.2 sq.m', '112.5 sq.m', '92.0 sq.m', '108.5 sq.m'];
      const owners = ['Meera Nambiar', 'Aditya Sengupta', 'Gaurav Bhatia', 'Rajesh K. Sharma'];

      return {
        code,
        base2d: 'IN-DL-01-849201',
        type: '3D_ULPIN' as UlpinAllocationType,
        typeLabel: '3D ULPIN (VOLUMETRIC UNIT - VPRID)',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 (ISO 19152 LADM) • Section 4.1',
        normRationale: `Condominium Flat ${uNoStr}: Discrete watertight 3D polyhedral volume. Holds separate registered title deed, property tax ID, and 2.083% Undivided Land Share (UDS %).`,
        volume: vols[selectedUnit - 1] || '347.2 m³',
        carpetArea: carpets[selectedUnit - 1] || '108.5 sq.m',
        heightRange: `Z: +${zMin}m to +${zMax}m MSL (Thickness: 3.10m)`,
        uds: '2.083% (1/48 Share of Base Parcel)',
        owner: owners[selectedUnit - 1] || 'Title Holder',
        titleStatus: 'Independently Registered Title Deed (LA_RRR Level 2)'
      };
    }

    if (selectedObject.category === 'villa') {
      return {
        code: selectedObject.ulpin,
        base2d: selectedObject.ulpin,
        type: '2D_ULPIN' as UlpinAllocationType,
        typeLabel: '2D BASE ULPIN (FREEHOLD PLOTTED PROPERTY)',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.1 & Section 8',
        normRationale: 'Independent Plotted Villa: Retains Base 2D ULPIN. Parcel and superstructure are coterminous under unified freehold title (center of earth to sky). No separate 3D ULPIN is created unless basement or rooftop rights are legally severed.',
        volume: '786.5 m³ (Accessory Superstructure)',
        heightRange: 'Z: 0.0m to +7.2m (Unified Plotted Column)',
        uds: '100.00% (Sole Freehold Title)',
        owner: selectedObject.owner || 'Freehold Owner',
        titleStatus: 'Unified Freehold Deed (LA_RRR)'
      };
    }

    if (selectedObject.category === 'violation') {
      return {
        code: 'IN-DL-01-849205-B07-F05-UNAUTHORIZED',
        base2d: 'IN-DL-01-849205',
        type: 'VIOLATION' as UlpinAllocationType,
        typeLabel: '🚨 3D COMPLIANCE REJECTION (AIRSPACE VIOLATION)',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 5 Edge Case 2 & Section 8',
        normRationale: 'CRITICAL AIRSPACE VIOLATION: Floors 5 & 6 (Z: +14.5m to +22.8m) exceed approved G+4 municipal sanction. 3D Spatial Compliance Engine rejects 3D ULPIN issuance and halts occupancy certificate.',
        volume: '1,420 m³ (Unsanctioned Volumetric Excess)',
        heightRange: 'Z: +14.5m to +22.8m (Exceeds 14.5m Ceiling)',
        uds: 'INVALID (Breach of Sanctioned Envelope)',
        owner: 'Sharma Properties & Constructions LLP',
        titleStatus: 'Demolition & Sealing Notice #MCD-2024-9912 Active'
      };
    }

    if (selectedObject.category === 'hospital') {
      return {
        code: selectedObject.ulpin,
        base2d: selectedObject.base2dUlpin || 'IN-DL-01-849204',
        type: 'INFRA_3D_ULPIN' as UlpinAllocationType,
        typeLabel: 'INSTITUTIONAL INFRASTRUCTURE 3D ULPIN',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.4 & Section 8',
        normRationale: 'Public Healthcare Asset: Unified Institutional ULPIN. Clinical wards, ICUs & Operation Theatres DO NOT receive separate 3D ULPINs (Negative Invariant). Commercial pharmacies/cafes receive distinct 3D commercial ULPINs.',
        volume: '51,120 m³ (Full Healthcare Envelope)',
        heightRange: 'Z: 0.0m to +24.5m (G+6 & Helipad)',
        uds: '100.0% (Public Healthcare Reservation)',
        owner: selectedObject.owner || 'Health Department / Apollo Trust',
        titleStatus: 'Government Institutional Title'
      };
    }

    if (selectedObject.category === 'mall') {
      return {
        code: 'IN-DL-01-849203-B04-F01-S102-C',
        base2d: 'IN-DL-01-849203',
        type: '3D_ULPIN' as UlpinAllocationType,
        typeLabel: '3D COMMERCIAL RETAIL ULPIN (VPRID)',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.2',
        normRationale: 'Commercial Retail Unit S-102: Distinct 3D ULPIN per demarcated retail bay. Commercial brand leases (LA_Party) attach dynamically to this persistent 3D spatial space.',
        volume: '445.0 m³',
        heightRange: 'Z: 0.0m to +4.2m MSL',
        uds: '2.38% (Commercial Strata Share)',
        owner: 'Civic Infrastructure & Retail Holdings Ltd.',
        titleStatus: 'Active Commercial Strata Title'
      };
    }

    if (selectedObject.category === 'flyover') {
      return {
        code: 'INF-FLY-DL01-0004',
        base2d: 'IN-DL-01-ROW-MEDIAN',
        type: 'INFRA_3D_ULPIN' as UlpinAllocationType,
        typeLabel: 'INFRASTRUCTURE 3D ULPIN (AIR RIGHTS CORRIDOR)',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 3 & Section 4.3',
        normRationale: 'Elevated Arterial Flyover: Single Infrastructure ULPIN (INF-FLY) for elevated roadway deck occupying sovereign public airspace at +8.5m grade separation.',
        volume: '18,500 m³ elevated polyhedral sweep',
        heightRange: 'Z: +6.4m to +8.5m (Clearance: +6.4m)',
        uds: 'Public Highway Air Rights RoW',
        owner: 'NHAI / Public Works Department (PWD)',
        titleStatus: 'Statutory Infrastructure RoW'
      };
    }

    if (selectedObject.category === 'metro') {
      return {
        code: 'INF-TUN-DL01-0012',
        base2d: 'IN-DL-01-MULTIPLE-PARCELS',
        type: 'INFRA_3D_ULPIN' as UlpinAllocationType,
        typeLabel: 'INFRASTRUCTURE 3D ULPIN (SUBTERRANEAN TUNNEL)',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.3 & Section 5 Edge Case 1',
        normRationale: 'Subsurface Transit Tunnel: 3D Polyhedral cylinder with mandatory statutory 5.0m safety clearance buffer traversing subterranean parcels without surface acquisition.',
        volume: '31,800 m³ Subsurface Bore',
        heightRange: 'Z: -6.0m to -14.2m Depth Datum',
        uds: 'Subsurface Statutory Easement',
        owner: 'Delhi Metro Rail Corporation (DMRC)',
        titleStatus: 'Subterranean Statutory Reservation'
      };
    }

    if (selectedObject.category === 'parking') {
      return {
        code: 'INF-BSM-849201-B02',
        base2d: 'IN-DL-01-849201',
        type: 'INFRA_3D_ULPIN' as UlpinAllocationType,
        typeLabel: 'INFRASTRUCTURE 3D ULPIN (UNDERGROUND BASEMENT)',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 3 & Section 4.1',
        normRationale: 'Subterranean Parking Facility: Infrastructure basement ULPIN (INF-BSM) per structural subterranean level (B1 & B2). Independently surveyed sub-surface envelope.',
        volume: '4,860 m³ per level',
        heightRange: 'Z: -4.2m (B1) & -7.8m (B2)',
        uds: 'Society Common Utility Accessory',
        owner: 'Aarav Heights Condominium RWA / MCD',
        titleStatus: 'Subterranean Structural NOC'
      };
    }

    if (selectedObject.category === 'utility') {
      return {
        code: selectedObject.ulpin,
        base2d: 'IN-DL-01-PUBLIC-ROW',
        type: 'INFRA_3D_ULPIN' as UlpinAllocationType,
        typeLabel: 'INFRASTRUCTURE 3D ULPIN (SUBSURFACE UTILITY)',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 3 & Section 4.3',
        normRationale: `Subsurface Utility Conduit (${selectedObject.utilityType}): Modeled as LineStringZ spatial corridor with mandatory statutory clearance buffer (1.5m). Prevents excavation damage.`,
        volume: '600mm / 900mm Continuous Pipe Grid',
        heightRange: `Z: -${selectedObject.depthMeters}m MSL`,
        uds: 'Public Utility RoW Easement',
        owner: selectedObject.jurisdiction || 'Delhi Jal Board (DJB)',
        titleStatus: 'Municipal Utility Asset Registry'
      };
    }

    if (selectedObject.category === 'footpath') {
      return {
        code: selectedObject.ulpin,
        base2d: 'IN-DL-01-STREET-ROW',
        type: 'INFRA_3D_ULPIN' as UlpinAllocationType,
        typeLabel: 'INFRASTRUCTURE 3D ULPIN (PEDESTRIAN RoW)',
        normRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.3',
        normRationale: 'Public Pedestrian Sidewalk RoW: Dedicated surface pedestrian transit envelope. Encroachments are spatial-topological intersections against this public polygon.',
        volume: '3.5m Continuous Surface Corridor',
        heightRange: 'Z: +0.0m to +0.2m (Surface Level)',
        uds: 'Municipal Pedestrian RoW',
        owner: selectedObject.jurisdiction || 'Municipal Corporation of Delhi',
        titleStatus: 'Public Non-Alienable Highway RoW'
      };
    }

    return {
      code: selectedObject.ulpin,
      base2d: selectedObject.base2dUlpin || 'IN-DL-01-849200',
      type: selectedObject.ulpinType || '3D_ULPIN',
      typeLabel: '3D CADASTRAL PROPERTY',
      normRef: selectedObject.standardNormRef || 'MoHUA Standard B3D-STD-2026-ULPIN-01',
      normRationale: selectedObject.normRationale || 'Registered 3D Cadastral Unit in Sovereign Spatial Database.',
      volume: selectedObject.volumeM3 || 'Custom Volume',
      heightRange: selectedObject.zRange || '3D Coordinates Surveyed',
      uds: selectedObject.udsPercentage || 'N/A',
      owner: selectedObject.owner || 'Verified Owner',
      titleStatus: 'Active Cadastral Registration'
    };
  };

  const activeUlpinData = getActiveUlpinDetails();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  useEffect(() => {
    undergroundRef.current = isUnderground;
  }, [isUnderground]);
  // =========================================================================
  // INITIALIZE PHOTOREALISTIC SATELLITE 3D DIGITAL TWIN
  // =========================================================================
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || window.innerWidth;
    const height = mountRef.current.clientHeight || window.innerHeight;

    // 1. Scene & Photorealistic Lighting
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    if (isUnderground) {
      scene.background = new THREE.Color(0x071018);
      scene.fog = new THREE.FogExp2(0x071018, 0.004);
    } else {
      const skyCanvas = document.createElement('canvas');
      skyCanvas.width = 8;
      skyCanvas.height = 256;
      const skyCtx = skyCanvas.getContext('2d')!;
      const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256);
      skyGrad.addColorStop(0, '#5aa6d6');
      skyGrad.addColorStop(0.42, '#b7daf0');
      skyGrad.addColorStop(1, '#e4efe4');
      skyCtx.fillStyle = skyGrad;
      skyCtx.fillRect(0, 0, 8, 256);
      const skyTex = new THREE.CanvasTexture(skyCanvas);
      scene.background = skyTex;
      scene.fog = new THREE.FogExp2(0xd5e7ef, 0.0016);
    }

    // 2. Camera with Full Subterranean Clipping Range
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1500);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. WebGL Renderer (Optimized for 60 FPS across desktop and mobile)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // 4. Natural Directional Sunlight + Sky Ambient
    const hemi = new THREE.HemisphereLight(0xc5e4f7, 0x6b7a45, isUnderground ? 0.35 : 0.85);
    scene.add(hemi);
    const ambientLight = new THREE.AmbientLight(0xffffff, isUnderground ? 0.55 : 0.45);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff4e0, isUnderground ? 0.35 : 1.85);
    sunLight.position.set(75, 110, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 320;
    sunLight.shadow.camera.left = -110;
    sunLight.shadow.camera.right = 110;
    sunLight.shadow.camera.top = 110;
    sunLight.shadow.camera.bottom = -110;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    const skyFill = new THREE.DirectionalLight(0x64748b, isUnderground ? 0.25 : 0.7);
    skyFill.position.set(-60, 50, -50);
    scene.add(skyFill);

    // Subterranean Dedicated Lights for Underground 360° Exploration
    if (isUnderground) {
      const xrayMetro = new THREE.PointLight(0x06b6d4, 6, 120);
      xrayMetro.position.set(ASHOK.metro[0], ASHOK.metro[1], ASHOK.metro[2]);
      scene.add(xrayMetro);

      const xrayPark = new THREE.PointLight(0x3b82f6, 5, 110);
      xrayPark.position.set(ASHOK.parking[0], ASHOK.parking[1], ASHOK.parking[2]);
      scene.add(xrayPark);

      const xrayTunnel = new THREE.PointLight(0x10b981, 4, 100);
      xrayTunnel.position.set(20, -14, 16);
      scene.add(xrayTunnel);

      const xrayUtils = new THREE.PointLight(0xf59e0b, 3, 90);
      xrayUtils.position.set(0, -3, 0);
      scene.add(xrayUtils);
    }

    // =======================================================================
    // 0. 3D CENTROID SPATIAL BEACON & HIGHLIGHT LOCATOR (CENTER PIN)
    // =======================================================================
    const beaconGroup = new THREE.Group();
    beaconMeshRef.current = beaconGroup;

    // Outer Target Rings
    const ringGeo = new THREE.RingGeometry(3.5, 3.8, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    beaconGroup.add(ringMesh);

    const innerRingGeo = new THREE.RingGeometry(1.8, 2.0, 32);
    const innerRingMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    beaconGroup.add(innerRing);

    // Vertical Holographic Laser Pointer Line
    const laserGeo = new THREE.CylinderGeometry(0.08, 0.08, 25, 8);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.6 });
    const laser = new THREE.Mesh(laserGeo, laserMat);
    laser.position.y = 12.5;
    beaconGroup.add(laser);

    // Top Glowing Diamond Marker
    const diamondGeo = new THREE.OctahedronGeometry(1.2, 0);
    const diamondMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: false });
    const diamond = new THREE.Mesh(diamondGeo, diamondMat);
    diamond.position.y = 25.5;
    beaconGroup.add(diamond);

    scene.add(beaconGroup);

    // Position Beacon at selected object centroid
    if (selectedObject?.id === 'BLD-01-01') {
      const uOffsets: Record<number, [number, number]> = {
        1: [-3.2, -3.0],
        2: [3.2, -3.0],
        3: [-3.2, 3.0],
        4: [3.2, 3.0]
      };
      const [ox, oz] = uOffsets[selectedUnit] || [0, 0];
      const targetY = 2.5 + (selectedFloor - 1) * 3.1 + 1.5;
      beaconGroup.position.set(ASHOK.tower[0] + ox, targetY, ASHOK.tower[2] + oz);
      beaconGroup.visible = true;
    } else if (selectedObject?.centroid) {
      beaconGroup.position.set(...selectedObject.centroid);
      beaconGroup.visible = true;
    } else {
      beaconGroup.visible = false;
    }

    // =======================================================================
    buildAshokPlaceWorld(scene, {
      isUnderground,
      hideSurface: hideSurfaceCompletely,
      selectedFloor,
      selectedUnit,
    });
    setSceneEpoch((n) => n + 1);

    // 10. UNRESTRICTED 360° RAYCASTING & TOUCH/MOUSE ORBIT
    // =======================================================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      pointerDown.current = true;
      isDragging.current = false;
      orbitVelocity.current = { theta: 0, phi: 0 };
      pointerDownPos.current = { x: event.clientX, y: event.clientY };
      previousMousePosition.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerMove = (event: MouseEvent) => {
      const deltaX = event.clientX - previousMousePosition.current.x;
      const deltaY = event.clientY - previousMousePosition.current.y;
      if (event.buttons === 1 || event.buttons === 2) {
        const moved = Math.hypot(event.clientX - pointerDownPos.current.x, event.clientY - pointerDownPos.current.y);
        if (moved > 4) isDragging.current = true;
      }
      if (event.buttons === 2 || (event.buttons === 1 && event.shiftKey)) {
        const pan = desiredSpherical.current.radius * 0.0014;
        const th = desiredSpherical.current.theta;
        desiredTarget.current.x -= (deltaX * Math.cos(th) + deltaY * Math.sin(th)) * pan;
        desiredTarget.current.z -= (-deltaX * Math.sin(th) + deltaY * Math.cos(th)) * pan;
      } else if (event.buttons === 1) {
        const maxPhi = undergroundRef.current ? Math.PI * 0.92 : Math.PI * 0.78;
        desiredSpherical.current.theta -= deltaX * 0.005;
        desiredSpherical.current.phi = Math.max(0.14, Math.min(maxPhi, desiredSpherical.current.phi - deltaY * 0.004));
        orbitVelocity.current.theta = -deltaX * 0.00035;
        orbitVelocity.current.phi = -deltaY * 0.00028;
      }
      previousMousePosition.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerUp = (event: MouseEvent) => {
      pointerDown.current = false;
      if (isDragging.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      let chosen: THREE.Object3D | null = null;
      let foundFloor: number | null = null;
      let foundUnit: number | null = null;
      for (const hit of intersects) {
        if (hit.object.userData?.unitNumber) foundUnit = hit.object.userData.unitNumber;
        if (hit.object.userData?.floorNumber) foundFloor = hit.object.userData.floorNumber;
        let curr: THREE.Object3D | null = hit.object;
        while (curr && !curr.userData?.id) curr = curr.parent;
        if (curr?.userData?.id) {
          chosen = curr;
          break;
        }
      }
      if (chosen?.userData?.id) {
        const data = chosen.userData as SelectedObjectData;
        setShowViolationList(false);
        setSelectedObject(data);
        if (foundFloor !== null) setSelectedFloor(foundFloor);
        if (foundUnit !== null) setSelectedUnit(foundUnit);
        flyToRef.current(data);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const dy = Math.max(-80, Math.min(80, event.deltaY));
      desiredSpherical.current.radius = Math.max(22, Math.min(240, desiredSpherical.current.radius + dy * 0.04));
    };

    const handleContext = (event: MouseEvent) => event.preventDefault();

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handlePointerDown);
    dom.addEventListener('mousemove', handlePointerMove);
    dom.addEventListener('mouseup', handlePointerUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });
    dom.addEventListener('contextmenu', handleContext);

    // =======================================================================
    // 11. ANIMATION RENDER LOOP & 3D CENTROID BEACON PULSE
    // =======================================================================
    let clock = new THREE.Clock();
    let lastTick = performance.now();
    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTick) / 1000);
      lastTick = now;

      if (beaconMeshRef.current && beaconMeshRef.current.visible) {
        beaconMeshRef.current.rotation.y = elapsedTime * 1.5;
        const scale = 1 + Math.sin(elapsedTime * 4) * 0.08;
        beaconMeshRef.current.scale.set(scale, 1, scale);
      }

      const maxPhi = undergroundRef.current ? Math.PI * 0.92 : Math.PI * 0.78;
      const desired = desiredSpherical.current;
      if (!pointerDown.current) {
        desired.theta += orbitVelocity.current.theta;
        desired.phi += orbitVelocity.current.phi;
        const damp = Math.exp(-3.4 * dt);
        orbitVelocity.current.theta *= damp;
        orbitVelocity.current.phi *= damp;
        if (isRotatingRef.current) desired.theta += dt * 0.22;
      }
      desired.phi = Math.max(0.14, Math.min(maxPhi, desired.phi));
      desired.radius = Math.max(22, Math.min(240, desired.radius));
      const ease = 1 - Math.exp(-8 * dt);
      const pose = cameraSpherical.current;
      pose.theta += (desired.theta - pose.theta) * ease;
      pose.phi += (desired.phi - pose.phi) * ease;
      pose.radius += (desired.radius - pose.radius) * ease;
      cameraTarget.current.lerp(desiredTarget.current, ease);
      updateCameraPosition();

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', handlePointerDown);
      dom.removeEventListener('mousemove', handlePointerMove);
      dom.removeEventListener('mouseup', handlePointerUp);
      dom.removeEventListener('wheel', handleWheel);
      dom.removeEventListener('contextmenu', handleContext);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      renderer.dispose();
    };
  }, [isUnderground, hideSurfaceCompletely]);

  // Instant floor & unit selection without freezing or rebuilding the 3D scene
  useEffect(() => {
    if (sceneRef.current) {
      updateAshokTowerSelection(sceneRef.current, selectedFloor, selectedUnit);
    }
  }, [selectedFloor, selectedUnit, sceneEpoch]);

  useEffect(() => {
    const beacon = beaconMeshRef.current;
    if (!beacon) return;
    if (selectedObject?.id === 'BLD-01-01') {
      const uOffsets: Record<number, [number, number]> = {
        1: [-3.2, -2.6],
        2: [3.2, -2.6],
        3: [-3.2, 2.6],
        4: [3.2, 2.6],
      };
      const [ox, oz] = uOffsets[selectedUnit] || [0, 0];
      beacon.position.set(ASHOK.tower[0] + ox, (selectedFloor - 1) * 3 + 2.2, ASHOK.tower[2] + oz);
      beacon.visible = true;
    } else if (selectedObject?.centroid) {
      beacon.position.set(selectedObject.centroid[0], selectedObject.centroid[1], selectedObject.centroid[2]);
      beacon.visible = true;
    } else {
      beacon.visible = false;
    }
  }, [selectedObject, selectedFloor, selectedUnit, sceneEpoch]);

  const didAutoFocus = useRef(false);
  useEffect(() => {
    if (didAutoFocus.current || !focusId || !sceneRef.current) return;
    let found: SelectedObjectData | null = null;
    sceneRef.current.traverse((obj) => {
      if (!found && obj.userData?.id === focusId) found = obj.userData as SelectedObjectData;
    });
    if (found) {
      didAutoFocus.current = true;
      setSelectedObject(found);
    }
  }, [sceneEpoch, focusId]);

  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = cameraSpherical.current;
    const x = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    const z = radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(
      cameraTarget.current.x + x,
      cameraTarget.current.y + y,
      cameraTarget.current.z + z
    );
    cameraRef.current.lookAt(cameraTarget.current);
  };

  const setQuickView = (view: 'perspective' | 'top' | 'front' | 'violation' | 'underground_metro' | 'underground_parking') => {
    setCameraView(view);
    setShowViolationList(false);
    if (view === 'top') {
      desiredTarget.current.set(8, 0, 0);
      desiredSpherical.current = { radius: 150, theta: 0.001, phi: 0.08 };
    } else if (view === 'front') {
      desiredTarget.current.set(0, 6, 0);
      desiredSpherical.current = { radius: 110, theta: 0.4, phi: Math.PI / 2.4 };
    } else if (view === 'underground_metro') {
      setIsUnderground(true);
      desiredTarget.current.set(ASHOK.metro[0], -8, ASHOK.metro[2]);
      desiredSpherical.current = { radius: 52, theta: 0.7, phi: Math.PI * 0.72 };
      setSelectedObject({
        id: 'METRO-STN-01',
        category: 'metro',
        name: 'Gol Dakkhana Underground Metro',
        tagline: 'Yellow line and blue line under Ashok Place',
        ulpin: 'INF-TUN-DL01-0012',
        ulpinType: 'INFRA_3D_ULPIN',
        base2dUlpin: 'IN-DL-01-METRO-ZONE',
        depthMeters: 14.2,
        owner: 'Delhi Metro Rail Corporation (DMRC)',
        status: 'Active Underground Rapid Transit • 4 Subsurface Levels',
        standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.3 & Section 5 Edge Case 1',
        normRationale: 'Subsurface Transit Tunnel: 3D Polyhedral cylinder with mandatory 5.0m statutory safety clearance corridor.',
        centroid: [ASHOK.metro[0], ASHOK.metro[1], ASHOK.metro[2]]
      });
    } else if (view === 'underground_parking') {
      setIsUnderground(true);
      desiredTarget.current.set(ASHOK.parking[0], -4, ASHOK.parking[2]);
      desiredSpherical.current = { radius: 42, theta: 0.8, phi: Math.PI * 0.7 };
      setSelectedObject({
        id: 'UTIL-PARKING-B1-B2',
        category: 'parking',
        name: 'Yusuf Sadan basement parking',
        tagline: 'B1 and B2 under Yusuf Sadan',
        ulpin: 'INF-BSM-849201-B02',
        ulpinType: 'INFRA_3D_ULPIN',
        base2dUlpin: 'IN-DL-01-849201',
        plotNumber: 'Plot #101 Basement',
        floors: 2,
        depthMeters: 7.8,
        parkingStalls: 180,
        evPoints: 24,
        jurisdiction: 'Municipal Corporation (MCD) / Building Ops',
        status: 'Subterranean 3D Cadastre Active • 180 Stalls Digitized',
        standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 3 & Section 4.1',
        normRationale: 'Subterranean Parking: Infrastructure basement ULPIN (INF-BSM) per structural subterranean level.',
        centroid: [ASHOK.parking[0], ASHOK.parking[1], ASHOK.parking[2]]
      });
    } else if (view === 'violation') {
      setShowViolationList(true);
      setSelectedObject(null);
      desiredTarget.current.set(ASHOK.violation[0], 6, ASHOK.violation[2]);
      desiredSpherical.current = { radius: 70, theta: 0.7, phi: 0.95 };
    } else {
      setShowViolationList(false);
      desiredTarget.current.set(6, 2, 4);
      desiredSpherical.current = { radius: 128, theta: 0.58, phi: 0.96 };
    }
  };

  const rotateCamera360 = (deltaTheta: number, deltaPhi: number = 0) => {
    desiredSpherical.current.theta += deltaTheta;
    if (deltaPhi !== 0) {
      const maxPhi = undergroundRef.current ? Math.PI * 0.92 : Math.PI * 0.78;
      desiredSpherical.current.phi = Math.max(0.14, Math.min(maxPhi, desiredSpherical.current.phi + deltaPhi));
    }
  };

  const zoomCamera = (deltaR: number) => {
    desiredSpherical.current.radius = Math.max(22, Math.min(240, desiredSpherical.current.radius + deltaR));
  };

  const flyToSelection = (data: SelectedObjectData) => {
    const c = data.centroid || [0, 4, 0];
    const pose = desiredSpherical.current;
    if (data.category === 'metro') {
      desiredTarget.current.set(c[0], -6, c[2]);
      pose.radius = 50;
      pose.phi = 1.18;
    } else if (data.category === 'parking') {
      desiredTarget.current.set(c[0], -3, c[2]);
      pose.radius = 42;
      pose.phi = 1.15;
    } else if (data.category === 'flyover' || data.category === 'amenity') {
      desiredTarget.current.set(c[0], 6, c[2]);
      pose.radius = 48;
      pose.phi = 0.92;
    } else {
      desiredTarget.current.set(c[0], 5, c[2]);
      pose.radius = 42;
      pose.phi = 0.95;
    }
  };
  flyToRef.current = flyToSelection;

  const violationItems: SelectedObjectData[] = [
    {
      id: 'BLD-01-SHARMA',
      category: 'violation',
      name: 'Illegal extra floors',
      tagline: 'Floors 4 and 5 are beyond the sanctioned G+2',
      ulpin: 'IN-DL-01-849205-B07-F05-UNAUTHORIZED',
      ulpinType: 'VIOLATION',
      base2dUlpin: 'IN-DL-01-849205',
      plotNumber: 'Baba Kharak Singh Marg',
      floors: 5,
      heightMeters: 16.5,
      owner: 'Unauthorised vertical addition',
      centroid: [ASHOK.violation[0], ASHOK.violation[1], ASHOK.violation[2]],
      violations: [
        {
          type: 'Unauthorized vertical construction',
          description: 'Approved sanction is G+2. Floors 4 and 5 are built beyond the permit and shown in red.',
          penalty: 'Demolition notice and penalty',
          status: 'Open',
        },
      ],
    },
    {
      id: 'PED-SHARMA-01',
      category: 'footpath',
      name: 'Illegal footpath encroachment',
      tagline: 'Frontage occupying the public sidewalk',
      ulpin: 'INF-ROW-DL01-PED-SHARMA-01',
      ulpinType: 'INFRA_3D_ULPIN',
      widthMeters: 3.5,
      status: 'ACTIVE ENCROACHMENT DETECTED (3.5m OVERLAP)',
      centroid: [-68, 0.4, 16],
      jurisdiction: 'Municipal Corporation',
    },
    {
      id: 'BLD-01-SHARMA',
      category: 'violation',
      name: 'Setback line breach',
      tagline: 'Building corner crosses the mandatory side setback',
      ulpin: 'IN-DL-01-849205-B07-SETBACK',
      ulpinType: 'VIOLATION',
      base2dUlpin: 'IN-DL-01-849205',
      plotNumber: 'Baba Kharak Singh Marg',
      centroid: [ASHOK.violation[0] + 4, 3, ASHOK.violation[2]],
      violations: [
        {
          type: 'Setback line breach',
          description: 'The street-facing corner crosses the mandatory 3.0 m side setback by about 2.1 m.',
          penalty: 'Compoundable fine',
          status: 'Open',
        },
      ],
    },
  ];

  const openViolation = (item: SelectedObjectData) => {
    setShowViolationList(false);
    setSelectedObject(item);
    flyToSelection(item);
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 overflow-hidden font-sans select-none">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* ===================================================================== */}
      {/* 1. TOP FLOATING CONTROL BAR (CLEAN & MINIMAL - NO CENTER OVERLAYS) */}
      {/* ===================================================================== */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
        <div className="flex items-center space-x-3 pointer-events-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/surveyor/map?project_id=${projectId}&area_id=${activeArea}`)}
            className="bg-slate-900/90 backdrop-blur-md border-slate-700 text-slate-200 hover:bg-slate-800 font-bold shadow-xl"
          >
            <ArrowLeft className="w-4 h-4 mr-2 text-blue-400" />
            <span>Back to 2D Base Cadastre Map</span>
          </Button>

          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl shadow-xl flex items-center space-x-3 text-white">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div>
              <div className="text-xs font-bold text-slate-100 flex items-center space-x-2">
                <span>{areaInfo.name} ({areaInfo.ward})</span>
                <span className="text-[10px] text-amber-400 font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                  {activeArea.toUpperCase()} • 360° Orbit
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                {areaInfo.desc} • Click any 3D asset to inspect
              </div>

            </div>
          </div>
        </div>

        {/* View Mode Action Toggles */}
        <div className="flex items-center space-x-2 pointer-events-auto">
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 p-1 rounded-xl shadow-xl flex items-center space-x-1">
            <button
              onClick={() => setQuickView('perspective')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                cameraView === 'perspective' && !isUnderground
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Satellite 3D
            </button>
            <button
              onClick={() => setQuickView('top')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                cameraView === 'top'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Top Ortho
            </button>
            <button
              onClick={() => setQuickView('underground_metro')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                cameraView === 'underground_metro'
                  ? 'bg-cyan-600 text-white shadow animate-pulse'
                  : 'text-cyan-400 hover:text-cyan-300'
              }`}
            >
              <Train className="w-3.5 h-3.5" />
              <span>Underground Metro</span>
            </button>
            <button
              onClick={() => setQuickView('underground_parking')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                cameraView === 'underground_parking'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-blue-400 hover:text-blue-300'
              }`}
            >
              <Car className="w-3.5 h-3.5" />
              <span>Underground Parking</span>
            </button>
            <button
              onClick={() => setQuickView('violation')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                cameraView === 'violation'
                  ? 'bg-red-600 text-white shadow'
                  : 'text-red-400 hover:text-red-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Violations</span>
            </button>
          </div>

          {/* Subterranean X-Ray Toggle */}
          <button
            onClick={() => setIsUnderground(!isUnderground)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xl flex items-center space-x-2 border ${
              isUnderground
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-cyan-500/30 font-extrabold'
                : 'bg-slate-900/90 backdrop-blur-md text-cyan-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Train className="w-4 h-4" />
            <span>{isUnderground ? 'Subterranean 360° ON' : 'Toggle Underground'}</span>
          </button>

          {/* Hide Surface Toggle in Underground Mode */}
          {isUnderground && (
            <button
              onClick={() => setHideSurfaceCompletely(!hideSurfaceCompletely)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xl border ${
                hideSurfaceCompletely
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-extrabold'
                  : 'bg-slate-900/90 backdrop-blur-md text-slate-300 border-slate-700'
              }`}
              title="Hide surface ground plane completely to see underground 100% clearly"
            >
              {hideSurfaceCompletely ? 'Show Surface' : 'Hide Surface'}
            </button>
          )}

          {/* Auto-Rotation Toggle */}
          <button
            onClick={() => setIsRotating(!isRotating)}
            className={`p-2 rounded-xl text-xs font-bold transition-all shadow-xl border ${
              isRotating
                ? 'bg-amber-500 text-slate-950 border-amber-400'
                : 'bg-slate-900/90 backdrop-blur-md text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
            title="Auto-Rotate Locality"
          >
            <RotateCcw className={`w-4 h-4 ${isRotating ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. 360° ORBIT NAVIGATION KEYPAD (Dedicated On-Screen Controls) */}
      {/* ===================================================================== */}
      <div className="absolute top-20 left-6 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-2xl shadow-2xl z-20 flex flex-col items-center space-y-2 text-white">
        <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-400">360° Orbit Keypad</span>
        <div className="grid grid-cols-3 gap-1 w-28">
          <div />
          <button
            onClick={() => rotateCamera360(0, -0.2)}
            className="p-2 bg-slate-800 hover:bg-blue-600 rounded-xl flex items-center justify-center transition-colors shadow"
            title="Tilt Up"
          >
            <ChevronUp className="w-4 h-4 text-slate-200" />
          </button>
          <div />

          <button
            onClick={() => rotateCamera360(-Math.PI / 6, 0)}
            className="p-2 bg-slate-800 hover:bg-blue-600 rounded-xl flex items-center justify-center transition-colors shadow"
            title="Rotate Left 30°"
          >
            <ChevronLeft className="w-4 h-4 text-slate-200" />
          </button>
          <button
            onClick={() => setQuickView('perspective')}
            className="p-2 bg-slate-950 hover:bg-slate-700 rounded-xl flex items-center justify-center text-[10px] font-mono font-bold text-amber-400 shadow"
            title="Reset Angle"
          >
            ●
          </button>
          <button
            onClick={() => rotateCamera360(Math.PI / 6, 0)}
            className="p-2 bg-slate-800 hover:bg-blue-600 rounded-xl flex items-center justify-center transition-colors shadow"
            title="Rotate Right 30°"
          >
            <ChevronRight className="w-4 h-4 text-slate-200" />
          </button>

          <div />
          <button
            onClick={() => rotateCamera360(0, 0.2)}
            className="p-2 bg-slate-800 hover:bg-blue-600 rounded-xl flex items-center justify-center transition-colors shadow"
            title="Tilt Down / Under Ground"
          >
            <ChevronDown className="w-4 h-4 text-slate-200" />
          </button>
          <div />
        </div>

        <div className="flex items-center space-x-1.5 border-t border-slate-800 pt-2 w-full justify-center">
          <button
            onClick={() => zoomCamera(-15)}
            className="p-2 bg-slate-800 hover:bg-blue-600 rounded-xl flex items-center justify-center transition-colors shadow"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5 text-slate-200" />
          </button>
          <button
            onClick={() => zoomCamera(15)}
            className="p-2 bg-slate-800 hover:bg-blue-600 rounded-xl flex items-center justify-center transition-colors shadow"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5 text-slate-200" />
          </button>
        </div>
      </div>

      {showViolationList && (
        <div className="absolute top-20 right-6 w-[360px] max-w-[calc(100vw-3rem)] bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl shadow-xl text-slate-900 p-4 z-30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Violations</h2>
            <button onClick={() => setShowViolationList(false)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            {violationItems.map((item) => (
              <button
                key={item.name}
                onClick={() => openViolation(item)}
                className="w-full text-left p-3 rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <div className="text-xs font-semibold text-red-700">{item.name}</div>
                <div className="text-[11px] text-slate-600 mt-0.5">{item.tagline}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inspector opens when any 3D object is clicked */}
      {selectedObject && activeUlpinData && (
        <div className="absolute top-20 right-6 w-[420px] max-w-[calc(100vw-3rem)] bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl text-white p-5 z-30 animate-in fade-in slide-in-from-right-4 duration-200">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-3">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold border ${
                    activeUlpinData.type === 'VIOLATION'
                      ? 'bg-red-950 text-red-300 border-red-800'
                      : activeUlpinData.type === '2D_ULPIN'
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-blue-950 text-blue-300 border-blue-800'
                  }`}
                >
                  {selectedObject.category}
                </span>
                {selectedObject.plotNumber && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                    {selectedObject.plotNumber}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-100">{selectedObject.name}</h2>
              <p className="text-[11px] text-slate-400">{selectedObject.tagline}</p>
            </div>
            <button
              onClick={() => setSelectedObject(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-3 text-xs text-slate-300 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {/* MoHUA Standard ULPIN Card (Embedded right inside sidebar) */}
            <div
              className={`p-3.5 rounded-xl border font-mono text-center space-y-1.5 shadow-lg ${
                activeUlpinData.type === 'VIOLATION'
                  ? 'bg-red-950/80 border-red-500/70 text-red-200'
                  : activeUlpinData.type === '2D_ULPIN'
                  ? 'bg-amber-950/60 border-amber-500/60 text-amber-200'
                  : activeUlpinData.type === 'INFRA_3D_ULPIN'
                  ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-200'
                  : 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-extrabold uppercase tracking-wide">
                  {activeUlpinData.type === 'VIOLATION' && '⚠️ '}
                  {activeUlpinData.typeLabel}
                </span>
                <span className="text-slate-400 text-[9px] bg-slate-950/60 px-1.5 py-0.5 rounded">MoHUA STD</span>
              </div>

              <div className="flex items-center justify-center space-x-2 py-0.5">
                <span className={`text-sm font-extrabold tracking-wide ${activeUlpinData.type === 'VIOLATION' ? 'line-through text-red-400' : 'text-white'}`}>
                  {activeUlpinData.code}
                </span>
                <button
                  onClick={() => copyToClipboard(activeUlpinData.code)}
                  className="p-1 rounded bg-slate-800/90 hover:bg-slate-700 text-slate-300 transition-colors"
                  title="Copy ULPIN"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-300 text-left pt-1 border-t border-slate-800/60">
                <div>Base 2D: <span className="font-bold text-slate-100">{activeUlpinData.base2d}</span></div>
                <div>Volume: <span className="font-bold text-emerald-400">{activeUlpinData.volume}</span></div>
                <div>Bounds: <span className="font-bold text-amber-300">{activeUlpinData.heightRange}</span></div>
                <div>UDS Share: <span className="font-bold text-cyan-300">{activeUlpinData.uds}</span></div>
              </div>

              <div className="text-[10px] text-slate-300 text-left italic border-t border-slate-800/60 pt-1 font-sans leading-tight">
                <strong className="text-slate-200 not-italic">Norm: </strong>{activeUlpinData.normRationale}
              </div>
            </div>

            {/* A. RESIDENTIAL TOWER (Aarav Heights) */}
            {selectedObject.category === 'tower' && selectedObject.id === 'BLD-01-01' && (
              <>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Select Floor to Inspect 3D Slabs & Units
                  </label>
                  <div className="grid grid-cols-6 gap-1">
                    {Array.from({ length: selectedObject.floors || 12 }, (_, i) => i + 1).map((f) => (
                      <button
                        key={f}
                        onClick={() => setSelectedFloor(f)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          selectedFloor === f
                            ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-extrabold'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        F{f}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                      3D Floor {selectedFloor} Houses Mapping (4 Units)
                    </label>
                    <span className="text-[9px] text-slate-400 font-mono">Click unit to highlight</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { u: 1, type: '2BHK (North-West)', area: '88.2 sq.m', vol: '282.2 m³' },
                      { u: 2, type: '3BHK (North-East)', area: '112.5 sq.m', vol: '360.0 m³' },
                      { u: 3, type: '2BHK (South-West)', area: '92.0 sq.m', vol: '294.4 m³' },
                      { u: 4, type: '3BHK (South-East)', area: '108.5 sq.m', vol: '347.2 m³' }
                    ].map((item) => {
                      const flatNo = `${selectedFloor}0${item.u}`;
                      const isSel = selectedUnit === item.u;
                      return (
                        <button
                          key={item.u}
                          onClick={() => setSelectedUnit(item.u)}
                          className={`p-2.5 rounded-xl text-left border transition-all ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-400 shadow-lg font-bold'
                              : 'bg-slate-950/60 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-extrabold">Flat {flatNo}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${isSel ? 'bg-blue-900 text-white' : 'bg-slate-800 text-amber-300'}`}>
                              {item.type.split(' ')[0]}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-300 mt-1">{item.type}</div>
                          <div className="text-[10px] text-emerald-300 font-mono mt-0.5">
                            {item.area} • {item.vol}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                    <span className="font-bold text-amber-400">
                      Unit Flat {selectedFloor}0{selectedUnit} Cadastral Profile
                    </span>
                    <Badge variant="success" size="sm">Deed Verified</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                    <div>
                      <span className="text-slate-500 text-[10px] block">Owner / Title</span>
                      <span className="font-semibold text-slate-200">
                        {selectedUnit === 4 ? 'Rajesh K. Sharma' : selectedUnit === 1 ? 'Meera Nambiar' : selectedUnit === 2 ? 'Aditya Sengupta' : 'Gaurav Bhatia'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Undivided Land Share</span>
                      <span className="font-semibold text-cyan-400">2.083% (1/48 Share)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Carpet Area</span>
                      <span className="font-semibold text-emerald-400">
                        {selectedUnit === 4 ? '108.5 sq.m' : selectedUnit === 1 ? '88.2 sq.m' : selectedUnit === 2 ? '112.5 sq.m' : '92.0 sq.m'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">3D Enclosed Volume</span>
                      <span className="font-semibold text-emerald-400">
                        {selectedUnit === 4 ? '347.2 m³' : selectedUnit === 1 ? '282.2 m³' : selectedUnit === 2 ? '360.0 m³' : '294.4 m³'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Property Tax (Annual)</span>
                      <span className="font-semibold text-slate-200">₹14,200 / yr (Paid)</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">Volumetric VPRID</span>
                      <span className="font-mono text-cyan-400 text-[10px]">
                        IN-DL-01-849201-B01-F{selectedFloor.toString().padStart(2, '0')}-U{selectedFloor}0{selectedUnit}-R
                      </span>
                    </div>
                  </div>
                </div>

              </>
            )}

            {/* B. VILLA (Plotted House - Retains 2D ULPIN) */}
            {selectedObject.category === 'villa' && (
              <>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Title Holder:</span>
                    <span className="font-bold text-slate-200">{selectedObject.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Built-up / Carpet Area:</span>
                    <span className="font-bold text-slate-200">{selectedObject.builtUpArea} / {selectedObject.carpetArea}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Municipal Tax:</span>
                    <span className="font-bold text-slate-200">{selectedObject.propertyTax}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Cadastral Status:</span>
                    <span className="font-bold text-emerald-400">{selectedObject.status}</span>
                  </div>
                </div>
              </>
            )}

            {/* C. CLICKABLE FOOTPATH INSPECTION */}
            {selectedObject.category === 'footpath' && (
              <>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Designated Width</span>
                    <span className="font-bold text-slate-200">{selectedObject.widthMeters} meters Paved Walkway</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Paving Material</span>
                    <span className="font-bold text-slate-200">{selectedObject.surfaceMaterial}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Controlling Authority</span>
                    <span className="font-bold text-slate-200">{selectedObject.jurisdiction}</span>
                  </div>
                  <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 text-[10px]">
                    <span className="font-bold text-amber-400 block mb-0.5">Cadastral Right-of-Way (RoW):</span>
                    <span className="text-slate-300">{selectedObject.status}</span>
                  </div>
                </div>
              </>
            )}

            {/* D. SUBTERRANEAN PARKING */}
            {selectedObject.category === 'parking' && (
              <>
                <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Total Stalls</span>
                    <span className="text-emerald-400 font-bold text-sm">{selectedObject.parkingStalls} Bays</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">EV Charging Points</span>
                    <span className="text-cyan-400 font-bold text-sm">{selectedObject.evPoints} Active</span>
                  </div>
                </div>
              </>
            )}

            {/* E. UNDERGROUND METRO STATION */}
            {selectedObject.category === 'metro' && (
              <>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Platform Depth:</span>
                    <span className="text-amber-400 font-bold">-{selectedObject.depthMeters} meters MSL</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Operating Authority:</span>
                    <span className="text-slate-200">{selectedObject.owner}</span>
                  </div>
                </div>
              </>
            )}

            {/* F. RAILWAY STATION */}
            {selectedObject.category === 'railway' && (
              <>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Zone / Authority:</span>
                    <span className="text-slate-200">{selectedObject.owner}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Operational Status:</span>
                    <span className="text-emerald-400">{selectedObject.status}</span>
                  </div>
                </div>
              </>
            )}

            {/* G. HOSPITAL */}
            {selectedObject.category === 'hospital' && (
              <>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Volumetric Hospital Department Wings
                  </label>
                  <div className="space-y-1.5">
                    {selectedObject.departments?.map((dept, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedHospitalDept(dept)}
                        className={`p-2 rounded-xl text-[11px] cursor-pointer transition-all border ${
                          selectedHospitalDept === dept
                            ? 'bg-emerald-900/60 border-emerald-400 text-white font-bold'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {dept}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* H. MALL */}
            {selectedObject.category === 'mall' && (
              <>
                <div className="grid grid-cols-3 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-center font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Total Stores</span>
                    <span className="text-indigo-400 font-bold text-sm">{selectedObject.storesCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Leased Units</span>
                    <span className="text-emerald-400 font-bold text-sm">{selectedObject.leasedCount}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Vacant</span>
                    <span className="text-amber-400 font-bold text-sm">{selectedObject.vacantCount}</span>
                  </div>
                </div>
              </>
            )}

            {/* I. SHARMA PLAZA VIOLATIONS */}
            {selectedObject.category === 'violation' && (
              <>
                <div className="bg-red-950/80 p-3 rounded-xl border border-red-700/80 text-red-200 space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-xs text-red-100">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span>3 Physical Geometry Violations Rendered</span>
                  </div>
                  <p className="text-[10px] text-red-300">
                    Extra floors, footpath encroachment and setback breach are physically visible in red geometry.
                  </p>
                </div>

                <div className="space-y-2">
                  {selectedObject.violations?.map((vio, idx) => (
                    <div key={idx} className="bg-slate-950 p-2.5 rounded-xl border border-red-900/60 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-red-400 text-[11px]">{vio.type}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-800">
                          {vio.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300">{vio.description}</p>
                      <div className="text-[10px] text-amber-400 font-mono pt-0.5 border-t border-slate-900">
                        Penalty: {vio.penalty}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* J. FLYOVER */}
            {selectedObject.category === 'flyover' && (
              <>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Clearance Height</span>
                    <span className="font-bold text-slate-200">+{selectedObject.heightMeters}m (Sweeping Curved Span)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Authority</span>
                    <span className="font-bold text-slate-200">{selectedObject.jurisdiction}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default Full3DWorldPage;

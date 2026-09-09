import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import * as THREE from 'three';
import {
  ArrowLeft,
  Building2,
  AlertTriangle,
  Sparkles,
  Train,
  ShoppingBag,
  HeartPulse,
  CheckCircle2,
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
  area_01: { name: 'Central Heights', ward: 'Ward 16', desc: 'High-Rise Residential & Commercial Core' },
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
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Selected Object State - ONLY opens when an object is clicked
  const [selectedObject, setSelectedObject] = useState<SelectedObjectData | null>(null);

  const [selectedFloor, setSelectedFloor] = useState<number>(8);
  const [selectedUnit, setSelectedUnit] = useState<number>(4);
  const [selectedHospitalDept, setSelectedHospitalDept] = useState<string>('Level 4: Intensive Care Unit (ICU) & CCU');

  // 3D ULPIN / VPRID Volumetric Scan Telemetry
  const [isScanningVPRID, setIsScanningVPRID] = useState<boolean>(false);
  const [scanStepIndex, setScanStepIndex] = useState<number>(-1);
  const [generatedVPRID, setGeneratedVPRID] = useState<string | null>(null);

  const scanStages = [
    '1. 3D LiDAR Volumetric Bounding Box Acquisition (X, Y, Zmin, Zmax)',
    '2. Slicing Horizontal Slab & Dividing Wall Centerlines at 3.10m',
    '3. Computing 2-Manifold Watertight Mesh Volume (347.2 m³)',
    '4. Cross-Referencing Revenue Sub-Registrar & 2D Parcel UDS (2.083%)',
    '5. Minting Sovereign 3D ULPIN (IN-DL-01-849201-B01-F08-U804-R)'
  ];

  // 360° Spherical Camera Orbit
  const isDragging = useRef<boolean>(false);
  const previousMousePosition = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraSpherical = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 110,
    theta: Math.PI / 4,
    phi: Math.PI / 3.4
  });
  const cameraTarget = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));

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

  // =========================================================================
  // HELPER: CREATE REALISTIC SATELLITE ORTHO-TEXTURE
  // =========================================================================
  const createSatelliteTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d')!;

    // 1. Natural satellite soil/terrain base
    ctx.fillStyle = '#2d3748';
    ctx.fillRect(0, 0, 2048, 2048);

    // Add satellite noise & terrain variation
    for (let i = 0; i < 6000; i++) {
      const x = Math.random() * 2048;
      const y = Math.random() * 2048;
      const r = Math.random() * 6 + 2;
      ctx.fillStyle = Math.random() > 0.5 ? '#1a202c' : '#334155';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Satellite Lush Greenery & Lawns
    const drawSatelliteGarden = (gx: number, gy: number, gw: number, gh: number) => {
      ctx.fillStyle = '#1e3a1e';
      ctx.fillRect(gx, gy, gw, gh);
      for (let j = 0; j < 800; j++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#275227' : '#143014';
        ctx.fillRect(gx + Math.random() * gw, gy + Math.random() * gh, 8, 8);
      }
    };

    drawSatelliteGarden(100, 100, 750, 750);
    drawSatelliteGarden(1200, 100, 750, 750);
    drawSatelliteGarden(100, 1200, 750, 750);
    drawSatelliteGarden(1200, 1200, 750, 750);

    // 3. Realistic Satellite Asphalt Roads (Curved East-West & North-South)
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 140;
    ctx.beginPath();
    ctx.moveTo(0, 1024);
    ctx.bezierCurveTo(600, 950, 1400, 1100, 2048, 1024);
    ctx.stroke();

    ctx.lineWidth = 130;
    ctx.beginPath();
    ctx.moveTo(1024, 0);
    ctx.lineTo(1024, 2048);
    ctx.stroke();

    // Central Satellite Roundabout Circle
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(1024, 1024, 190, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(1024, 1024, 85, 0, Math.PI * 2);
    ctx.fill();

    // 4. White Lane Divider Markings
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 15]);
    ctx.beginPath();
    ctx.moveTo(0, 1024);
    ctx.bezierCurveTo(600, 950, 1400, 1100, 2048, 1024);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(1024, 0);
    ctx.lineTo(1024, 2048);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Cadastral Parcel Outlines in Crisp Satellite Surveyor Lines
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.strokeRect(95, 95, 760, 760);
    ctx.strokeStyle = '#34d399';
    ctx.strokeRect(1195, 95, 760, 760);
    ctx.strokeStyle = '#10b981';
    ctx.strokeRect(95, 1195, 760, 760);
    ctx.strokeStyle = '#818cf8';
    ctx.strokeRect(1195, 1195, 760, 760);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  };

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
    scene.background = new THREE.Color(isUnderground ? 0x050811 : 0x94a3b8);
    scene.fog = new THREE.FogExp2(isUnderground ? 0x050811 : 0x94a3b8, 0.0035);

    // 2. Camera with Full Subterranean Clipping Range
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1500);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // 4. Natural Directional Sunlight + Sky Ambient
    const ambientLight = new THREE.AmbientLight(0xffffff, isUnderground ? 0.7 : 1.0);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, isUnderground ? 0.3 : 1.5);
    sunLight.position.set(75, 110, 60);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
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
      xrayMetro.position.set(-22, -12, 16);
      scene.add(xrayMetro);

      const xrayPark = new THREE.PointLight(0x3b82f6, 5, 110);
      xrayPark.position.set(-42, -6, -38);
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
      beaconGroup.position.set(-42 + ox, targetY, -38 + oz);
      beaconGroup.visible = true;
    } else if (selectedObject?.centroid) {
      beaconGroup.position.set(...selectedObject.centroid);
      beaconGroup.visible = true;
    } else {
      beaconGroup.visible = false;
    }

    // =======================================================================
    // 1. SATELLITE ORTHO TERRAIN (REALISTIC GOOGLE EARTH / CESIUM STYLE)
    // =======================================================================
    const satTexture = createSatelliteTexture();
    const terrainGeo = new THREE.PlaneGeometry(200, 200, 32, 32);
    const terrainMat = new THREE.MeshStandardMaterial({
      map: satTexture,
      roughness: 0.85,
      metalness: 0.1,
      transparent: true,
      opacity: hideSurfaceCompletely ? 0.0 : isUnderground ? 0.08 : 1.0,
      visible: !hideSurfaceCompletely
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -0.02;
    terrain.receiveShadow = true;
    scene.add(terrain);

    // =======================================================================
    // 2. CURVED ELEVATED FLYOVER (+8.5m Clear of all buildings)
    // =======================================================================
    const flyoverGroup = new THREE.Group();
    (flyoverGroup as any).userData = {
      id: 'INFRA-FLYOVER-01',
      category: 'flyover',
      name: 'Central Expressway Elevated Viaduct (Curved)',
      tagline: 'Grade-Separated Curved Elevated Arterial Flyover',
      ulpin: 'INF-FLY-DL01-0004',
      ulpinType: 'INFRA_3D_ULPIN',
      base2dUlpin: 'IN-DL-01-ROW-MEDIAN',
      heightMeters: 8.5,
      builtUpArea: '1,650m curved span',
      jurisdiction: 'National Highways Authority of India (NHAI) / PWD',
      status: 'Structural Sensors Active • +8.5m Grade Separation',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 3 & Section 4.3',
      normRationale: 'Elevated Flyover Corridor: Single Infrastructure ULPIN (INF-FLY) for elevated roadway deck occupying public air-rights envelope.',
      centroid: [0, 8.5, 0]
    };
    scene.add(flyoverGroup);

    const flyCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-95, 8.5, -15),
      new THREE.Vector3(-50, 8.5, -8),
      new THREE.Vector3(-15, 8.5, 0),
      new THREE.Vector3(20, 8.5, 8),
      new THREE.Vector3(55, 8.5, 18),
      new THREE.Vector3(95, 8.5, 25)
    ]);

    const flyTubeGeo = new THREE.TubeGeometry(flyCurve, 64, 4.2, 8, false);
    const flyDeckMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
    const flyDeck = new THREE.Mesh(flyTubeGeo, flyDeckMat);
    flyDeck.scale.set(1, 0.25, 1);
    flyDeck.position.y = 6.4;
    flyDeck.castShadow = true;
    (flyDeck as any).userData = flyoverGroup.userData;
    flyoverGroup.add(flyDeck);

    // Concrete Piers
    flyCurve.getPoints(7).forEach((pt) => {
      const pierGeo = new THREE.CylinderGeometry(1.1, 1.3, 8.5, 16);
      const pierMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
      const pier = new THREE.Mesh(pierGeo, pierMat);
      pier.position.set(pt.x, 4.25, pt.z);
      pier.castShadow = true;
      (pier as any).userData = flyoverGroup.userData;
      flyoverGroup.add(pier);

      const capGeo = new THREE.BoxGeometry(3.2, 0.8, 7.2);
      const cap = new THREE.Mesh(capGeo, pierMat);
      cap.position.set(pt.x, 8.0, pt.z);
      cap.castShadow = true;
      (cap as any).userData = flyoverGroup.userData;
      flyoverGroup.add(cap);
    });

    // =======================================================================
    // 3. CLICKABLE FOOTPATHS / SIDEWALKS
    // =======================================================================
    const addInteractiveFootpath = (x: number, z: number, w: number, d: number, name: string, id: string) => {
      const swGroup = new THREE.Group();
      swGroup.position.set(x, 0, z);
      const isSharmaEncroached = id.includes('SHARMA');

      (swGroup as any).userData = {
        id,
        category: 'footpath',
        name,
        tagline: 'Public Pedestrian Right-of-Way & Utility Corridor',
        ulpin: `INF-ROW-DL01-${id}`,
        ulpinType: 'INFRA_3D_ULPIN',
        base2dUlpin: 'IN-DL-01-STREET-ROW',
        widthMeters: 3.5,
        surfaceMaterial: 'High-Density Interlocking Paver Blocks with Tactile Guiding Strips',
        jurisdiction: 'Municipal Corporation (MCD) / PWD Pedestrian Safety Cell',
        status: isSharmaEncroached ? '⚠️ ACTIVE ENCROACHMENT DETECTED (3.5m OVERLAP)' : 'Clear Public Corridor • Dedicated Sub-Surface Utility RoW',
        standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.3',
        normRationale: 'Pedestrian Sidewalk RoW: Public pedestrian Right-of-Way corridor. Surface encroachments are verified against this spatial polygon.',
        centroid: [x, 0.2, z]
      };
      scene.add(swGroup);

      const swGeo = new THREE.BoxGeometry(w, 0.18, d);
      const swMat = new THREE.MeshStandardMaterial({
        color: isSharmaEncroached ? 0xfecdd3 : 0xcfd8dc,
        roughness: 0.8,
        transparent: isUnderground,
        opacity: isUnderground ? 0.15 : 1.0
      });
      const sw = new THREE.Mesh(swGeo, swMat);
      sw.position.y = 0.09;
      sw.receiveShadow = true;
      (sw as any).userData = swGroup.userData;
      swGroup.add(sw);

      const tactileGeo = new THREE.BoxGeometry(w > d ? w : 0.4, 0.02, d > w ? d : 0.4);
      const tactileMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
      const tactile = new THREE.Mesh(tactileGeo, tactileMat);
      tactile.position.y = 0.19;
      (tactile as any).userData = swGroup.userData;
      swGroup.add(tactile);
    };

    addInteractiveFootpath(-50, -10.5, 75, 3.5, 'North-West Boulevard Pedestrian Footpath', 'PED-NW-01');
    addInteractiveFootpath(-10.5, -50, 3.5, 75, 'North-West Avenue Pedestrian Footpath', 'PED-NW-02');
    addInteractiveFootpath(50, -10.5, 75, 3.5, 'North-East Boulevard Pedestrian Footpath', 'PED-NE-01');
    addInteractiveFootpath(10.5, -50, 3.5, 75, 'North-East Avenue Pedestrian Footpath', 'PED-NE-02');
    addInteractiveFootpath(-50, 10.5, 75, 3.5, 'South-West Boulevard Pedestrian Footpath', 'PED-SW-01');
    addInteractiveFootpath(-10.5, 50, 3.5, 75, 'South-West Avenue Pedestrian Footpath', 'PED-SW-02');
    addInteractiveFootpath(50, 10.5, 75, 3.5, 'South-East Boulevard Pedestrian Footpath (Sharma Sector)', 'PED-SHARMA-01');
    addInteractiveFootpath(10.5, 50, 3.5, 75, 'South-East Avenue Pedestrian Footpath', 'PED-SE-02');

    // =======================================================================
    // 4. DENSE RESIDENTIAL BUILDINGS (TOWERS A, B, C & MULTI-HOUSES/FLOOR)
    // =======================================================================
    const towerAGroup = new THREE.Group();
    towerAGroup.position.set(-42, 0, -38);
    (towerAGroup as any).userData = {
      id: 'BLD-01-01',
      category: 'tower',
      name: 'Aarav Heights Tower A',
      tagline: 'High-Density Residential Condominium',
      ulpin: `IN-DL-01-849201-B01-F${selectedFloor.toString().padStart(2, '0')}-U${selectedFloor}0${selectedUnit}-R`,
      ulpinType: '3D_ULPIN',
      base2dUlpin: 'IN-DL-01-849201',
      plotNumber: 'Plot #101',
      floors: 12,
      units: 48,
      heightMeters: 41.5,
      builtUpArea: '5,840 sq.m',
      carpetArea: '108.5 sq.m',
      volumeM3: '347.2 m³',
      udsPercentage: '2.083% (1/48 Share of Base 2D Parcel)',
      owner: 'Aarav Residents Welfare Association (RWA)',
      status: 'Approved & Certified (RERA: PRM/KA/RERA/1251/310/PR/170915)',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.1',
      normRationale: 'Multi-Story Apartment Flats: Unique 3D ULPIN per unit volume. Legally alienable unit with separate title deed, property tax, and UDS %.',
      centroid: [-42, 2.5 + selectedFloor * 3.1, -38]
    };
    scene.add(towerAGroup);

    const podiumGeo = new THREE.BoxGeometry(16, 2.5, 15);
    const podiumMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
    const podium = new THREE.Mesh(podiumGeo, podiumMat);
    podium.position.y = 1.25;
    podium.castShadow = true;
    towerAGroup.add(podium);

    // Build 12 Floors with 4 Houses on each floor
    for (let f = 1; f <= 12; f++) {
      const isCurrentInspectedFloor = selectedFloor === f;

      const slabGeo = new THREE.BoxGeometry(14.2, 0.35, 13.2);
      const slabMat = new THREE.MeshStandardMaterial({
        color: isCurrentInspectedFloor ? 0xf59e0b : 0x1e3a8a,
        roughness: 0.3
      });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = 2.5 + (f - 1) * 3.1;
      slab.castShadow = true;
      towerAGroup.add(slab);

      const lobbyGeo = new THREE.BoxGeometry(2.6, 2.6, 2.6);
      const lobbyMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
      const lobby = new THREE.Mesh(lobbyGeo, lobbyMat);
      lobby.position.set(0, 2.5 + (f - 1) * 3.1 + 1.4, 0);
      towerAGroup.add(lobby);

      const unitsConfig = [
        { uNo: 1, pos: [-3.2, 2.5 + (f - 1) * 3.1 + 1.4, -3.0], size: [5.8, 2.6, 5.2] },
        { uNo: 2, pos: [3.2, 2.5 + (f - 1) * 3.1 + 1.4, -3.0], size: [5.8, 2.6, 5.2] },
        { uNo: 3, pos: [-3.2, 2.5 + (f - 1) * 3.1 + 1.4, 3.0], size: [5.8, 2.6, 5.2] },
        { uNo: 4, pos: [3.2, 2.5 + (f - 1) * 3.1 + 1.4, 3.0], size: [5.8, 2.6, 5.2] },
      ];

      unitsConfig.forEach((cfg) => {
        const isTargetUnit = isCurrentInspectedFloor && selectedUnit === cfg.uNo;

        const uGeo = new THREE.BoxGeometry(cfg.size[0], cfg.size[1], cfg.size[2]);
        const uMat = new THREE.MeshStandardMaterial({
          color: isTargetUnit ? 0xfbbf24 : isCurrentInspectedFloor ? 0x60a5fa : 0x93c5fd,
          transparent: true,
          opacity: isTargetUnit ? 0.95 : isCurrentInspectedFloor ? 0.75 : 0.45,
          roughness: 0.15,
          metalness: 0.2
        });
        const uMesh = new THREE.Mesh(uGeo, uMat);
        uMesh.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        uMesh.castShadow = true;
        (uMesh as any).userData = {
          floorNumber: f,
          unitNumber: cfg.uNo,
          id: 'BLD-01-01',
          category: 'tower',
          centroid: [-42 + cfg.pos[0], cfg.pos[1], -38 + cfg.pos[2]]
        };
        towerAGroup.add(uMesh);

        const uEdges = new THREE.EdgesGeometry(uGeo);
        const uEdgeMat = new THREE.LineBasicMaterial({
          color: isTargetUnit ? 0xffffff : isCurrentInspectedFloor ? 0x1e3a8a : 0x64748b,
          linewidth: isTargetUnit ? 3 : 1
        });
        const uEdgeLines = new THREE.LineSegments(uEdges, uEdgeMat);
        uEdgeLines.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
        towerAGroup.add(uEdgeLines);
      });
    }

    const roofCoreGeo = new THREE.BoxGeometry(5.0, 3.5, 5.0);
    const roofCoreMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const roofCore = new THREE.Mesh(roofCoreGeo, roofCoreMat);
    roofCore.position.set(0, 2.5 + 12 * 3.1 + 1.75, 0);
    roofCore.castShadow = true;
    towerAGroup.add(roofCore);

    // Tower B (G+8) & Tower C (G+10)
    const towerBGroup = new THREE.Group();
    towerBGroup.position.set(-65, 0, -60);
    (towerBGroup as any).userData = {
      id: 'BLD-01-02',
      category: 'tower',
      name: 'Nilgiri Heights Tower B',
      tagline: 'Residential High-Rise Strata Tower',
      ulpin: 'IN-DL-01-849201-B02-F05-U502-R',
      ulpinType: '3D_ULPIN',
      base2dUlpin: 'IN-DL-01-849201',
      plotNumber: 'Plot #101B',
      floors: 8,
      units: 32,
      heightMeters: 28.5,
      builtUpArea: '3,920 sq.m',
      volumeM3: '312.0 m³',
      udsPercentage: '3.125% (1/32 Share)',
      owner: 'Nilgiri Co-operative Housing Society',
      status: 'Approved & Certified • 32 Flats Registered',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.1',
      normRationale: 'Residential High-Rise Strata Unit with registered title and undivided land share.',
      centroid: [-65, 14, -60]
    };
    scene.add(towerBGroup);

    for (let f = 1; f <= 8; f++) {
      const slabGeo = new THREE.BoxGeometry(11.5, 0.35, 10.5);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.4 });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = (f - 1) * 3.1;
      slab.castShadow = true;
      (slab as any).userData = towerBGroup.userData;
      towerBGroup.add(slab);

      const glassGeo = new THREE.BoxGeometry(11.0, 2.65, 10.0);
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.7 });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.y = (f - 1) * 3.1 + 1.5;
      glass.castShadow = true;
      (glass as any).userData = towerBGroup.userData;
      towerBGroup.add(glass);
    }

    const towerCGroup = new THREE.Group();
    towerCGroup.position.set(-25, 0, -65);
    (towerCGroup as any).userData = {
      id: 'BLD-01-03-C',
      category: 'tower',
      name: 'Shivalik Residency Tower C',
      tagline: 'Modern High-Rise Residential Tower',
      ulpin: 'IN-DL-01-849201-B03-F06-U601-R',
      ulpinType: '3D_ULPIN',
      base2dUlpin: 'IN-DL-01-849201',
      plotNumber: 'Plot #101C',
      floors: 10,
      units: 40,
      heightMeters: 33.0,
      builtUpArea: '4,600 sq.m',
      volumeM3: '335.5 m³',
      udsPercentage: '2.50% (1/40 Share)',
      owner: 'Shivalik Apex Developers',
      status: 'Occupancy Certificate Issued • 40 Units Certified',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.1',
      normRationale: 'High-Rise Residential Unit registered in Sovereign 3D Cadastre.',
      centroid: [-25, 16.5, -65]
    };
    scene.add(towerCGroup);

    for (let f = 1; f <= 10; f++) {
      const slabGeo = new THREE.BoxGeometry(12, 0.35, 11);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x0f766e });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = (f - 1) * 3.1;
      slab.castShadow = true;
      (slab as any).userData = towerCGroup.userData;
      towerCGroup.add(slab);

      const glassGeo = new THREE.BoxGeometry(11.5, 2.65, 10.5);
      const glassMat = new THREE.MeshStandardMaterial({ color: 0x99f6e4, transparent: true, opacity: 0.65 });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.y = (f - 1) * 3.1 + 1.5;
      glass.castShadow = true;
      (glass as any).userData = towerCGroup.userData;
      towerCGroup.add(glass);
    }

    // =======================================================================
    // 5. GREENWOOD ENCLAVE LUXURY VILLAS (6 Plotted Houses - Retain 2D ULPIN)
    // =======================================================================
    const addVilla = (x: number, z: number, villaId: string, name: string, owner: string) => {
      const villaGroup = new THREE.Group();
      villaGroup.position.set(x, 0, z);
      (villaGroup as any).userData = {
        id: villaId,
        category: 'villa',
        name,
        tagline: 'Independent G+2 Luxury Plotted House',
        ulpin: `IN-DL-01-849210-${villaId}`,
        ulpinType: '2D_ULPIN',
        base2dUlpin: `IN-DL-01-849210-${villaId}`,
        plotNumber: `Plot #${villaId.replace('VIL-', 'P-')}`,
        floors: 2,
        builtUpArea: '285 sq.m',
        carpetArea: '242 sq.m',
        volumeM3: '786.5 m³ (Accessory Volume)',
        udsPercentage: '100.00% (Sole Freehold Parcel)',
        owner,
        occupant: 'Owner Occupied',
        propertyTax: '₹18,400 / year (Paid)',
        status: 'Retains Base 2D ULPIN • Plotted Freehold Title',
        standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.1 & Section 8',
        normRationale: 'Independent Villa (Plotted House): Retain Base 2D ULPIN. Parcel and superstructure are coterminous under unified freehold title (center of earth to sky). No separate 3D ULPIN created unless basement or rooftop rights are severed.',
        centroid: [x, 3.6, z]
      };
      scene.add(villaGroup);

      const gfGeo = new THREE.BoxGeometry(8.5, 3.2, 7.5);
      const gfMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
      const gf = new THREE.Mesh(gfGeo, gfMat);
      gf.position.y = 1.6;
      gf.castShadow = true;
      (gf as any).userData = villaGroup.userData;
      villaGroup.add(gf);

      const ffGeo = new THREE.BoxGeometry(7.5, 3.0, 6.5);
      const ffMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
      const ff = new THREE.Mesh(ffGeo, ffMat);
      ff.position.set(-0.3, 4.7, 0);
      ff.castShadow = true;
      (ff as any).userData = villaGroup.userData;
      villaGroup.add(ff);

      const roofGeo = new THREE.ConeGeometry(5.8, 2.0, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(-0.3, 7.2, 0);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      (roof as any).userData = villaGroup.userData;
      villaGroup.add(roof);
    };

    addVilla(36, -36, 'VIL-01', 'Greenwood Villa #1', 'Dr. Sunita Verma');
    addVilla(52, -36, 'VIL-02', 'Greenwood Villa #2', 'Col. R.K. Malhotra');
    addVilla(68, -36, 'VIL-03', 'Greenwood Villa #3', 'Rohan Mathur');
    addVilla(36, -56, 'VIL-04', 'Greenwood Villa #4', 'Ananya Deshmukh');
    addVilla(52, -56, 'VIL-05', 'Greenwood Villa #5', 'Vikramaditya Rao');
    addVilla(68, -56, 'VIL-06', 'Greenwood Villa #6', 'Sanjay Kapoor');

    // =======================================================================
    // 6. CITY HOSPITAL (G+6 & Helipad) & CIVIC MALL
    // =======================================================================
    const hospGroup = new THREE.Group();
    hospGroup.position.set(-48, 0, 45);
    (hospGroup as any).userData = {
      id: 'BLD-01-05',
      category: 'hospital',
      name: 'City Multi-Specialty Hospital',
      tagline: 'Super-Specialty Tertiary Healthcare Facility',
      ulpin: 'INF-HSP-DL01-0001',
      ulpinType: 'INFRA_3D_ULPIN',
      base2dUlpin: 'IN-DL-01-849204',
      plotNumber: 'Plot #103',
      floors: 6,
      heightMeters: 24.5,
      builtUpArea: '14,200 sq.m',
      volumeM3: '51,120 m³',
      owner: 'Department of Health & Family Welfare / Apollo Trust',
      departments: [
        'Level 0: 24/7 Emergency, Trauma Bay & Triage (Institutional)',
        'Level 1: Outpatient OPD, Pharmacy & Diagnostics (Comm. 3D ULPIN)',
        'Level 2: Advanced Radiology, MRI & CT Scanning (Institutional)',
        'Level 3: Inpatient Deluxe Wards & Pediatric Wing (Institutional)',
        'Level 4: Intensive Care Unit (ICU) & CCU (Negative Invariant)',
        'Level 5: 6 Modular Operation Theatres (Negative Invariant)',
        'Level 6: Rooftop Helipad & Aeromedical Evacuation'
      ],
      status: 'Institutional 3D Cadastre Active • Unified Healthcare Envelope',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.4 & Section 8',
      normRationale: 'Hospitals & Healthcare: Main hospital building holds Unified Infrastructure ULPIN. Clinical facilities (ICUs, OTs, Wards) DO NOT receive separate 3D ULPINs (Negative Invariants). Leased ground commercial pharmacy holds distinct 3D ULPIN.',
      centroid: [-48, 12.25, 45]
    };
    scene.add(hospGroup);

    for (let f = 1; f <= 6; f++) {
      const slabGeo = new THREE.BoxGeometry(24, 0.4, 20);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.3 });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = (f - 1) * 3.6;
      slab.castShadow = true;
      (slab as any).userData = hospGroup.userData;
      hospGroup.add(slab);

      const wallGeo = new THREE.BoxGeometry(23.4, 3.1, 19.4);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xecfdf5, roughness: 0.2 });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.y = (f - 1) * 3.6 + 1.8;
      wall.castShadow = true;
      (wall as any).userData = hospGroup.userData;
      hospGroup.add(wall);
    }

    const heliGeo = new THREE.CylinderGeometry(5.0, 5.0, 0.3, 32);
    const heliMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
    const helipad = new THREE.Mesh(heliGeo, heliMat);
    helipad.position.set(0, 6 * 3.6 + 0.2, 0);
    (helipad as any).userData = hospGroup.userData;
    hospGroup.add(helipad);

    // Civic Mall (4 Levels)
    const mallGroup = new THREE.Group();
    mallGroup.position.set(50, 0, 48);
    (mallGroup as any).userData = {
      id: 'BLD-01-08',
      category: 'mall',
      name: 'Civic Central Galleria Mall',
      tagline: 'Regional Commercial & Retail Galleria Complex',
      ulpin: 'IN-DL-01-849203-B04-F01-S102-C',
      ulpinType: '3D_ULPIN',
      base2dUlpin: 'IN-DL-01-849203',
      plotNumber: 'Plot #104',
      floors: 4,
      storesCount: 42,
      leasedCount: 38,
      vacantCount: 4,
      heightMeters: 18.0,
      builtUpArea: '18,600 sq.m',
      volumeM3: '445.0 m³ per retail shop',
      owner: 'Civic Infrastructure & Retail Holdings Ltd.',
      propertyTax: '₹48,60,000 / year (Paid)',
      status: 'Commercial 3D Registry Active • 38 Active Commercial Leases Mapped',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.2',
      normRationale: 'Shopping Mall Retail Shops: Unique 3D ULPIN per demarcated shop. Mall owner retains structure title; tenants register commercial leases against unit 3D ULPIN.',
      centroid: [50, 9.0, 48]
    };
    scene.add(mallGroup);

    for (let f = 1; f <= 4; f++) {
      const slabGeo = new THREE.BoxGeometry(28, 0.5, 24);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x4338ca, roughness: 0.3 });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = (f - 1) * 4.2;
      slab.castShadow = true;
      (slab as any).userData = mallGroup.userData;
      mallGroup.add(slab);

      const glassGeo = new THREE.BoxGeometry(27.4, 3.6, 23.4);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        transparent: true,
        opacity: 0.8,
        roughness: 0.1,
        metalness: 0.4
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.y = (f - 1) * 4.2 + 2.1;
      glass.castShadow = true;
      (glass as any).userData = mallGroup.userData;
      mallGroup.add(glass);
    }

    // =======================================================================
    // 7. SHARMA PLAZA WITH PHYSICAL VISUAL VIOLATIONS
    // =======================================================================
    const sharmaGroup = new THREE.Group();
    sharmaGroup.position.set(24, 0, 18);
    (sharmaGroup as any).userData = {
      id: 'BLD-01-SHARMA',
      category: 'violation',
      name: 'Sharma Commercial Plaza (Airspace Encroachment)',
      tagline: 'High-Priority Physical Cadastral Violations Detected',
      ulpin: 'IN-DL-01-849205-B07-F05-UNAUTHORIZED',
      ulpinType: 'VIOLATION',
      base2dUlpin: 'IN-DL-01-849205',
      plotNumber: 'Plot #105',
      floors: 6,
      heightMeters: 22.8,
      owner: 'Sharma Properties & Constructions LLP',
      violations: [
        {
          type: '1. Unauthorized Vertical Construction',
          description: 'Approved Sanction: G+4 (14.5m). Actual Construction: G+6 (22.8m). Floors 5 & 6 constructed with zero structural NOC.',
          penalty: 'Demolition Notice #MCD-2024-9912 & ₹15,00,000 fine',
          status: 'RED ALERT • 3D ULPIN REJECTED'
        },
        {
          type: '2. Public Footpath Encroachment',
          description: 'Ground-floor commercial showroom extends 3.5m into designated municipal pedestrian walkway.',
          penalty: 'Immediate Sealing of Encroached Bay',
          status: 'PHYSICAL OVERLAP DETECTED'
        },
        {
          type: '3. Setback Line Breach',
          description: 'North-East building corner violates mandatory 3.0m side setback boundary by 2.1m.',
          penalty: 'Compoundable Fine of ₹4,50,000',
          status: 'CADASTRAL BOUNDARY BREACH'
        }
      ],
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 5 Edge Case 2 & Section 8',
      normRationale: 'AIRSPACE VIOLATION: Unsanctioned vertical construction beyond approved height ceiling is mathematically flagged by 3D Cadastre Compliance Engine.',
      centroid: [24, 11.4, 18]
    };
    scene.add(sharmaGroup);

    for (let f = 1; f <= 4; f++) {
      const slabGeo = new THREE.BoxGeometry(10, 0.4, 9);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = (f - 1) * 3.3;
      slab.castShadow = true;
      (slab as any).userData = sharmaGroup.userData;
      sharmaGroup.add(slab);

      const wallGeo = new THREE.BoxGeometry(9.6, 2.8, 8.6);
      const wallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4 });
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.y = (f - 1) * 3.3 + 1.65;
      wall.castShadow = true;
      (wall as any).userData = sharmaGroup.userData;
      sharmaGroup.add(wall);
    }

    // Illegal Floors 5 & 6 in RED
    for (let f = 5; f <= 6; f++) {
      const slabGeo = new THREE.BoxGeometry(10.2, 0.4, 9.2);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.2 });
      const slab = new THREE.Mesh(slabGeo, slabMat);
      slab.position.y = (f - 1) * 3.3;
      slab.castShadow = true;
      (slab as any).userData = sharmaGroup.userData;
      sharmaGroup.add(slab);

      const illegalWallGeo = new THREE.BoxGeometry(9.8, 2.8, 8.8);
      const illegalWallMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.88,
        roughness: 0.1
      });
      const illegalWall = new THREE.Mesh(illegalWallGeo, illegalWallMat);
      illegalWall.position.y = (f - 1) * 3.3 + 1.65;
      illegalWall.castShadow = true;
      (illegalWall as any).userData = sharmaGroup.userData;
      sharmaGroup.add(illegalWall);

      const edges = new THREE.EdgesGeometry(illegalWallGeo);
      const edgeLine = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 3 })
      );
      edgeLine.position.y = (f - 1) * 3.3 + 1.65;
      sharmaGroup.add(edgeLine);
    }

    // Footpath Encroachment Geometry
    const encroachedBoxGeo = new THREE.BoxGeometry(6.0, 3.0, 3.5);
    const encroachedMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85,
      roughness: 0.2
    });
    const encroachedBox = new THREE.Mesh(encroachedBoxGeo, encroachedMat);
    encroachedBox.position.set(0, 1.5, -5.8);
    encroachedBox.castShadow = true;
    (encroachedBox as any).userData = sharmaGroup.userData;
    sharmaGroup.add(encroachedBox);

    // =======================================================================
    // 8. FULL SUBTERRANEAN DIGITAL TWIN (METRO + PARKING + TUNNELS + PIPES)
    // =======================================================================
    // A. Subterranean Metro Station (-14.2m)
    const metroGroup = new THREE.Group();
    metroGroup.position.set(-22, 0, 16);
    (metroGroup as any).userData = {
      id: 'METRO-STN-01',
      category: 'metro',
      name: 'Central Heights Underground Metro Station (Yellow Line)',
      tagline: 'Multi-Modal Mass Rapid Transit Intermodal Hub',
      ulpin: 'INF-TUN-DL01-0012',
      ulpinType: 'INFRA_3D_ULPIN',
      base2dUlpin: 'IN-DL-01-METRO-ZONE',
      depthMeters: 14.2,
      owner: 'Delhi Metro Rail Corporation (DMRC)',
      status: 'Active Underground Rapid Transit • 4 Subsurface Levels',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.3 & Section 5 Edge Case 1',
      normRationale: 'Subsurface Transit Tunnel: 3D Polyhedral cylinder with mandatory 5.0m statutory safety clearance buffer traversing subterranean parcels.',
      centroid: [-22, -14.2, 16]
    };
    scene.add(metroGroup);

    const metroPavGeo = new THREE.BoxGeometry(9.0, 3.8, 6.0);
    const metroPavMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.75,
      roughness: 0.1,
      metalness: 0.5
    });
    const metroPav = new THREE.Mesh(metroPavGeo, metroPavMat);
    metroPav.position.y = 1.9;
    (metroPav as any).userData = metroGroup.userData;
    metroGroup.add(metroPav);

    // Concourse Mezzanine (-6.0m)
    const concourseGeo = new THREE.BoxGeometry(32, 3.5, 16);
    const concourseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: isUnderground ? 0.95 : 0.4
    });
    const concourse = new THREE.Mesh(concourseGeo, concourseMat);
    concourse.position.set(0, -6.0, 0);
    (concourse as any).userData = metroGroup.userData;
    metroGroup.add(concourse);

    // Platform (-14.2m)
    const platformGeo = new THREE.BoxGeometry(80, 1.2, 8.0);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      transparent: true,
      opacity: isUnderground ? 0.95 : 0.4
    });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(0, -14.2, 0);
    (platform as any).userData = metroGroup.userData;
    metroGroup.add(platform);

    // Twin Metro Tunnels (-14.2m)
    const tunnelGeo = new THREE.CylinderGeometry(4.5, 4.5, 200, 24, 1, true);
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0x0891b2,
      side: THREE.DoubleSide,
      roughness: 0.6,
      transparent: true,
      opacity: isUnderground ? 0.92 : 0.25
    });
    const metroTunnel = new THREE.Mesh(tunnelGeo, tunnelMat);
    metroTunnel.rotation.z = Math.PI / 2;
    metroTunnel.position.set(0, -14.2, 16);
    (metroTunnel as any).userData = metroGroup.userData;
    scene.add(metroTunnel);

    // B. Subterranean 2-Level Automated Parking Facility (-4.5m B1 & -7.8m B2)
    const parkingGroup = new THREE.Group();
    parkingGroup.position.set(-42, 0, -38);
    (parkingGroup as any).userData = {
      id: 'UTIL-PARKING-B1-B2',
      category: 'parking',
      name: 'Aarav Heights Subterranean 2-Level Parking Facility',
      tagline: 'Multi-Level Underground Automated Parking Hub',
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
      centroid: [-42, -6.0, -38]
    };
    scene.add(parkingGroup);

    [-4.2, -7.8].forEach((depth) => {
      const bSlabGeo = new THREE.BoxGeometry(26, 0.4, 24);
      const bSlabMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.6,
        transparent: true,
        opacity: isUnderground ? 0.95 : 0.35
      });
      const bSlab = new THREE.Mesh(bSlabGeo, bSlabMat);
      bSlab.position.y = depth;
      (bSlab as any).userData = parkingGroup.userData;
      parkingGroup.add(bSlab);

      [-8, 0, 8].forEach((cx) => {
        [-7, 0, 7].forEach((cz) => {
          const colGeo = new THREE.BoxGeometry(0.8, 3.2, 0.8);
          const colMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
          const col = new THREE.Mesh(colGeo, colMat);
          col.position.set(cx, depth + 1.6, cz);
          (col as any).userData = parkingGroup.userData;
          parkingGroup.add(col);
        });
      });
    });

    // C. Water Supply Trunk Main (-1.8m)
    const waterPipeGeo = new THREE.CylinderGeometry(0.55, 0.55, 200, 16);
    const waterPipeMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.2,
      metalness: 0.6,
      transparent: true,
      opacity: isUnderground ? 0.95 : 0.35
    });
    const waterPipe = new THREE.Mesh(waterPipeGeo, waterPipeMat);
    waterPipe.rotation.z = Math.PI / 2;
    waterPipe.position.set(0, -1.8, -7.5);
    (waterPipe as any).userData = {
      id: 'UTIL-WATER-MAIN',
      category: 'utility',
      name: 'Municipal Water Supply Trunk Main',
      tagline: 'High-Pressure Potable Water Grid',
      ulpin: 'INF-UTL-WAT-DL01-1042',
      ulpinType: 'INFRA_3D_ULPIN',
      base2dUlpin: 'IN-DL-01-PUBLIC-ROW',
      utilityType: 'Water Supply',
      diameter: '600mm Ductile Iron',
      depthMeters: 1.8,
      jurisdiction: 'Delhi Jal Board (DJB)',
      status: 'Active • Pressure: 4.2 Bar • 1.5m Safety Buffer',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 3 & Section 4.3',
      normRationale: 'Subsurface Utility: LineStringZ corridor with mandatory 1.5m statutory clearance buffer.',
      centroid: [0, -1.8, -7.5]
    };
    scene.add(waterPipe);

    // D. Gravity Sewer Trunk Line (-3.2m)
    const sewerPipeGeo = new THREE.CylinderGeometry(0.75, 0.75, 200, 16);
    const sewerPipeMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.4,
      transparent: true,
      opacity: isUnderground ? 0.95 : 0.35
    });
    const sewerPipe = new THREE.Mesh(sewerPipeGeo, sewerPipeMat);
    sewerPipe.rotation.z = Math.PI / 2;
    sewerPipe.position.set(0, -3.2, 7.5);
    (sewerPipe as any).userData = {
      id: 'UTIL-SEWER-TRUNK',
      category: 'utility',
      name: 'Gravity Sewer & Stormwater Conduit',
      tagline: 'Municipal Wastewater Trunk Line',
      ulpin: 'INF-UTL-SWR-DL01-2089',
      ulpinType: 'INFRA_3D_ULPIN',
      base2dUlpin: 'IN-DL-01-PUBLIC-ROW',
      utilityType: 'Sewerage',
      diameter: '900mm Reinforced Concrete',
      depthMeters: 3.2,
      jurisdiction: 'Municipal Corporation (MCD)',
      status: 'Active Flow • 1.5m Statutory Clearance Corridor',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 3 & Section 4.3',
      normRationale: 'Subsurface Wastewater Conduit with statutory safety buffer.',
      centroid: [0, -3.2, 7.5]
    };
    scene.add(sewerPipe);

    // E. Intercity Railway Station Hub
    const railGroup = new THREE.Group();
    railGroup.position.set(50, 0, -75);
    (railGroup as any).userData = {
      id: 'RAIL-STN-01',
      category: 'railway',
      name: 'Central Junction Intercity Railway Station',
      tagline: 'National Passenger Rail & Transit Hub',
      ulpin: 'INF-RLY-DL01-0002',
      ulpinType: 'INFRA_3D_ULPIN',
      base2dUlpin: 'IN-DL-01-849205-RLY',
      builtUpArea: '32,400 sq.m Platform Span',
      owner: 'Indian Railways (Northern Railway Zone)',
      status: '4 Platform Tracks • Electrified 25kV AC Corridor Active',
      standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.3',
      normRationale: 'Railway Station Complex: Station concourse holds primary infrastructure ULPIN (INF-RLY). Leased commercial retail shops inside receive distinct commercial 3D ULPINs.',
      centroid: [50, 3.25, -75]
    };
    scene.add(railGroup);

    const railBldGeo = new THREE.BoxGeometry(36, 6.5, 12);
    const railBldMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.5 });
    const railBld = new THREE.Mesh(railBldGeo, railBldMat);
    railBld.position.y = 3.25;
    railBld.castShadow = true;
    (railBld as any).userData = railGroup.userData;
    railGroup.add(railBld);

    [-7, 7].forEach((pz) => {
      const platGeo = new THREE.BoxGeometry(85, 0.8, 4.5);
      const platMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6 });
      const plat = new THREE.Mesh(platGeo, platMat);
      plat.position.set(0, 0.4, pz);
      plat.castShadow = true;
      (plat as any).userData = railGroup.userData;
      railGroup.add(plat);

      const canopyGeo = new THREE.BoxGeometry(85, 0.3, 5.2);
      const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(0, 3.8, pz);
      canopy.castShadow = true;
      (canopy as any).userData = railGroup.userData;
      railGroup.add(canopy);
    });

    // =======================================================================
    // 9. LIVING 3D TREES & CARS
    // =======================================================================
    const addRealisticTree = (x: number, z: number, scale: number = 1.0, species: 'oak' | 'pine' = 'oak') => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, 0, z);

      const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.45 * scale, 3 * scale, 8);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = (1.5 * scale);
      trunk.castShadow = true;
      treeGroup.add(trunk);

      if (species === 'oak') {
        const foliageGeo = new THREE.DodecahedronGeometry(1.8 * scale, 1);
        const foliageMat = new THREE.MeshStandardMaterial({
          color: Math.random() > 0.5 ? 0x276749 : 0x2f855a,
          roughness: 0.8
        });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 3.8 * scale;
        foliage.castShadow = true;
        treeGroup.add(foliage);
      } else {
        const coneGeo = new THREE.ConeGeometry(1.4 * scale, 4.5 * scale, 8);
        const coneMat = new THREE.MeshStandardMaterial({ color: 0x1c4532, roughness: 0.75 });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.y = 3.8 * scale;
        cone.castShadow = true;
        treeGroup.add(cone);
      }
      scene.add(treeGroup);
    };

    [-75, -60, -45, -30, 30, 45, 60, 75].forEach((x) => {
      addRealisticTree(x, -13.5, 0.95, 'oak');
      addRealisticTree(x, 13.5, 0.95, 'oak');
    });

    const add3DCar = (x: number, z: number, color: number, rotY: number = 0) => {
      const carGroup = new THREE.Group();
      carGroup.position.set(x, 0.2, z);
      carGroup.rotation.y = rotY;

      const chassisGeo = new THREE.BoxGeometry(3.6, 0.8, 1.7);
      const chassisMat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.4 });
      const chassis = new THREE.Mesh(chassisGeo, chassisMat);
      chassis.position.y = 0.4;
      chassis.castShadow = true;
      carGroup.add(chassis);

      const cabinGeo = new THREE.BoxGeometry(2.0, 0.65, 1.4);
      const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1 });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(-0.2, 1.05, 0);
      cabin.castShadow = true;
      carGroup.add(cabin);

      const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });
      [-1.1, 1.1].forEach((wx) => {
        [-0.85, 0.85].forEach((wz) => {
          const wheel = new THREE.Mesh(wheelGeo, wheelMat);
          wheel.rotation.x = Math.PI / 2;
          wheel.position.set(wx, 0.15, wz);
          carGroup.add(wheel);
        });
      });
      scene.add(carGroup);
    };

    add3DCar(-35, -4, 0xdc2626, 0);
    add3DCar(35, 4, 0x2563eb, Math.PI);
    add3DCar(36, 36, 0x9333ea, Math.PI / 2);
    add3DCar(40, 36, 0xf59e0b, Math.PI / 2);

    // =======================================================================
    // 10. UNRESTRICTED 360° RAYCASTING & TOUCH/MOUSE ORBIT
    // =======================================================================
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      isDragging.current = false;
      previousMousePosition.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerMove = (event: MouseEvent) => {
      if (event.buttons === 1) {
        isDragging.current = true;
        const deltaX = event.clientX - previousMousePosition.current.x;
        const deltaY = event.clientY - previousMousePosition.current.y;

        cameraSpherical.current.theta -= deltaX * 0.007;

        const maxPhi = isUnderground ? Math.PI * 0.95 : Math.PI / 2.05;
        cameraSpherical.current.phi = Math.max(0.04, Math.min(maxPhi, cameraSpherical.current.phi - deltaY * 0.007));

        updateCameraPosition();
      }
      previousMousePosition.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerUp = (event: MouseEvent) => {
      if (isDragging.current) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        let curr: THREE.Object3D | null = intersects[0].object;
        let foundFloor: number | null = null;
        let foundUnit: number | null = null;

        for (const hit of intersects) {
          if (hit.object.userData?.unitNumber) {
            foundUnit = hit.object.userData.unitNumber;
          }
          if (hit.object.userData?.floorNumber) {
            foundFloor = hit.object.userData.floorNumber;
          }
        }

        while (curr && !curr.userData?.id) {
          curr = curr.parent;
        }

        if (curr && curr.userData?.id) {
          setSelectedObject(curr.userData as SelectedObjectData);
          if (foundFloor !== null) setSelectedFloor(foundFloor);
          if (foundUnit !== null) setSelectedUnit(foundUnit);
        }
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      cameraSpherical.current.radius = Math.max(
        15,
        Math.min(240, cameraSpherical.current.radius + event.deltaY * 0.08)
      );
      updateCameraPosition();
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handlePointerDown);
    dom.addEventListener('mousemove', handlePointerMove);
    dom.addEventListener('mouseup', handlePointerUp);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    // =======================================================================
    // 11. ANIMATION RENDER LOOP & 3D CENTROID BEACON PULSE
    // =======================================================================
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Animate 3D Centroid Spatial Beacon (Pulsing ring and rotating diamond)
      if (beaconMeshRef.current && beaconMeshRef.current.visible) {
        beaconMeshRef.current.rotation.y = elapsedTime * 1.5;
        const scale = 1 + Math.sin(elapsedTime * 4) * 0.08;
        beaconMeshRef.current.scale.set(scale, 1, scale);
      }

      if (isRotating) {
        cameraSpherical.current.theta += 0.003;
        updateCameraPosition();
      }

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
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      renderer.dispose();
    };
  }, [isUnderground, isRotating, selectedFloor, selectedUnit, hideSurfaceCompletely, selectedObject]);

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
    if (view === 'top') {
      cameraTarget.current.set(0, 0, 0);
      cameraSpherical.current = { radius: 140, theta: 0.001, phi: 0.05 };
    } else if (view === 'front') {
      cameraTarget.current.set(0, 8, 0);
      cameraSpherical.current = { radius: 95, theta: 0, phi: Math.PI / 2.3 };
    } else if (view === 'underground_metro') {
      setIsUnderground(true);
      cameraTarget.current.set(-22, -14, 16);
      cameraSpherical.current = { radius: 45, theta: Math.PI / 4, phi: Math.PI * 0.78 };
      setSelectedObject({
        id: 'METRO-STN-01',
        category: 'metro',
        name: 'Central Heights Underground Metro Station (Yellow Line)',
        tagline: 'Multi-Modal Mass Rapid Transit Intermodal Hub',
        ulpin: 'INF-TUN-DL01-0012',
        ulpinType: 'INFRA_3D_ULPIN',
        base2dUlpin: 'IN-DL-01-METRO-ZONE',
        depthMeters: 14.2,
        owner: 'Delhi Metro Rail Corporation (DMRC)',
        status: 'Active Underground Rapid Transit • 4 Subsurface Levels',
        standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 4.3 & Section 5 Edge Case 1',
        normRationale: 'Subsurface Transit Tunnel: 3D Polyhedral cylinder with mandatory 5.0m statutory safety clearance corridor.',
        centroid: [-22, -14.2, 16]
      });
    } else if (view === 'underground_parking') {
      setIsUnderground(true);
      cameraTarget.current.set(-42, -6, -38);
      cameraSpherical.current = { radius: 45, theta: Math.PI / 3, phi: Math.PI * 0.82 };
      setSelectedObject({
        id: 'UTIL-PARKING-B1-B2',
        category: 'parking',
        name: 'Aarav Heights Subterranean 2-Level Parking Facility',
        tagline: 'Multi-Level Underground Automated Parking Hub',
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
        centroid: [-42, -6.0, -38]
      });
    } else if (view === 'violation') {
      cameraTarget.current.set(24, 10, 18);
      cameraSpherical.current = { radius: 45, theta: Math.PI / 3, phi: Math.PI / 2.8 };
      setSelectedObject({
        id: 'BLD-01-SHARMA',
        category: 'violation',
        name: 'Sharma Commercial Plaza (Airspace Encroachment)',
        tagline: 'High-Priority Physical Cadastral Violations Detected',
        ulpin: 'IN-DL-01-849205-B07-F05-UNAUTHORIZED',
        ulpinType: 'VIOLATION',
        base2dUlpin: 'IN-DL-01-849205',
        plotNumber: 'Plot #105',
        floors: 6,
        heightMeters: 22.8,
        owner: 'Sharma Properties & Constructions LLP',
        violations: [
          {
            type: '1. Unauthorized Vertical Construction',
            description: 'Approved Sanction: G+4 (14.5m). Actual Construction: G+6 (22.8m). Floors 5 & 6 constructed with zero structural NOC.',
            penalty: 'Demolition Notice #MCD-2024-9912 & ₹15,00,000 fine',
            status: 'RED ALERT • 3D ULPIN REJECTED'
          },
          {
            type: '2. Public Footpath Encroachment',
            description: 'Ground-floor commercial showroom extends 3.5m into designated municipal pedestrian walkway.',
            penalty: 'Immediate Sealing of Encroached Bay',
            status: 'PHYSICAL OVERLAP DETECTED'
          },
          {
            type: '3. Setback Line Breach',
            description: 'North-East building corner violates mandatory 3.0m side setback boundary by 2.1m.',
            penalty: 'Compoundable Fine of ₹4,50,000',
            status: 'CADASTRAL BOUNDARY BREACH'
          }
        ],
        standardNormRef: 'MoHUA Standard B3D-STD-2026-ULPIN-01 • Section 5 Edge Case 2 & Section 8',
        normRationale: 'AIRSPACE VIOLATION: Unsanctioned vertical construction beyond approved height ceiling is mathematically flagged by 3D Cadastre Compliance Engine.',
        centroid: [24, 11.4, 18]
      });
    } else {
      cameraTarget.current.set(0, 0, 0);
      cameraSpherical.current = { radius: 110, theta: Math.PI / 4, phi: Math.PI / 3.4 };
    }
    updateCameraPosition();
  };

  const rotateCamera360 = (deltaTheta: number, deltaPhi: number = 0) => {
    cameraSpherical.current.theta += deltaTheta;
    if (deltaPhi !== 0) {
      const maxPhi = isUnderground ? Math.PI * 0.95 : Math.PI / 2.05;
      cameraSpherical.current.phi = Math.max(0.04, Math.min(maxPhi, cameraSpherical.current.phi + deltaPhi));
    }
    updateCameraPosition();
  };

  const zoomCamera = (deltaR: number) => {
    cameraSpherical.current.radius = Math.max(15, Math.min(240, cameraSpherical.current.radius + deltaR));
    updateCameraPosition();
  };

  const handleGenerateVPRID = () => {
    setIsScanningVPRID(true);
    setScanStepIndex(0);
    setGeneratedVPRID(null);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < scanStages.length) {
        setScanStepIndex(step);
      } else {
        clearInterval(interval);
        setIsScanningVPRID(false);
        const minted = `IN-DL-01-849201-B01-F${selectedFloor.toString().padStart(2, '0')}-U${selectedFloor}0${selectedUnit}-R`;
        setGeneratedVPRID(minted);
      }
    }, 600);
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

      {/* ===================================================================== */}
      {/* 3. FLOATING OBJECT INSPECTION SIDEBAR (OPENS ONLY ON CLICK) */}
      {/* ===================================================================== */}
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

                <Button
                  variant="accent"
                  size="md"
                  onClick={handleGenerateVPRID}
                  disabled={isScanningVPRID}
                  className="w-full font-bold shadow-lg py-2.5 flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isScanningVPRID ? 'SCANNING 3D VOLUMETRIC SLAB...' : 'GENERATE 3D ULPIN / VPRID'}</span>
                </Button>
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

      {/* ===================================================================== */}
      {/* 4. VPRID / 3D ULPIN TELEMETRY SCAN MODAL */}
      {/* ===================================================================== */}
      {isScanningVPRID && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-blue-500/60 rounded-3xl p-6 max-w-lg w-full shadow-2xl text-white space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-600/30 text-blue-400 rounded-2xl border border-blue-500/40">
                <Sparkles className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold">3D Volumetric ULPIN Certification Engine</h3>
                <p className="text-xs text-slate-400">Processing Floor {selectedFloor} • Flat {selectedFloor}0{selectedUnit}</p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {scanStages.map((stage, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl text-xs flex items-center justify-between border transition-all ${
                    scanStepIndex > idx
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
                      : scanStepIndex === idx
                      ? 'bg-blue-900/60 border-blue-400 text-white font-bold animate-pulse'
                      : 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                  }`}
                >
                  <span>{stage}</span>
                  {scanStepIndex > idx ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : scanStepIndex === idx ? (
                    <div className="w-3 h-3 rounded-full bg-blue-400 animate-ping" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VPRID Certificate Modal upon Completion */}
      {generatedVPRID && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-emerald-500/80 rounded-3xl p-6 max-w-md w-full shadow-2xl text-white space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-600/20 text-emerald-400 rounded-2xl mx-auto flex items-center justify-center border border-emerald-500/50">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-100">3D Volumetric ULPIN Issued</h3>
              <p className="text-xs text-slate-400 mt-1">
                Flat {selectedFloor}0{selectedUnit} has been officially certified on India's 3D Cadastre.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-emerald-900/60 space-y-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest block">Standard 3D ULPIN (VPRID)</span>
              <div className="text-sm font-mono font-extrabold text-emerald-400 tracking-wider">
                {generatedVPRID}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Bounding Volume: 347.2 m³ • Height: +{(2.5 + (selectedFloor - 1) * 3.1).toFixed(1)}m to +{(2.5 + selectedFloor * 3.1).toFixed(1)}m MSL
              </div>
            </div>

            <Button
              variant="accent"
              size="md"
              onClick={() => setGeneratedVPRID(null)}
              className="w-full font-bold py-2.5"
            >
              Done & Return to Locality
            </Button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. BOTTOM CADASTRE LEGEND OVERLAY */}
      {/* ===================================================================== */}
      <div className="absolute bottom-5 left-5 bg-slate-900/90 backdrop-blur-md border border-slate-700 p-3.5 rounded-2xl shadow-2xl text-white z-10 text-[10px] space-y-2 max-w-sm pointer-events-none">
        <div className="font-bold text-slate-200 text-[11px] flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span>MoHUA 3D Cadastre Standard Norms</span>
          <span className="text-[9px] text-emerald-400 font-mono">B3D-STD-2026</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-0.5">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow" />
            <span>3D ULPIN (Multi-Flats / Shops)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block shadow" />
            <span>2D ULPIN (Freehold Villas)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow" />
            <span>Subsurface Metro & Parking</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block shadow" />
            <span>Elevated Flyover (Air-Rights)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow animate-ping" />
            <span className="text-red-300 font-bold">Sharma Plaza Violations</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block shadow" />
            <span>Pedestrian RoW Corridors</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Full3DWorldPage;

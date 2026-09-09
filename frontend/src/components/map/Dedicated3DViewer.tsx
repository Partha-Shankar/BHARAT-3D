import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Layers,
  Box,
  Building2,
  AlertTriangle,
  Compass,
  Sparkles,
  Maximize2,
  Eye,
  Activity,
  Zap,
  ShoppingBag,
  Train,
  CheckCircle2,
  FileCheck2,
  Sliders,
  RotateCcw,
  Camera,
  Scissors
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface Dedicated3DViewerProps {
  entityId?: string;
  initialEntityType?: 'building' | 'mall' | 'violation' | 'flyover' | 'tunnel';
  onClose?: () => void;
  onOpenEditor?: () => void;
}

export const Dedicated3DViewer: React.FC<Dedicated3DViewerProps> = ({
  entityId = 'BLD-01-01',
  initialEntityType = 'building',
  onClose,
  onOpenEditor,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedEntity, setSelectedEntity] = useState<string>(entityId);
  const [activeTab, setActiveTab] = useState<'tower' | 'mall' | 'violation' | 'flyover' | 'tunnel'>(
    initialEntityType === 'mall'
      ? 'mall'
      : initialEntityType === 'violation'
      ? 'violation'
      : initialEntityType === 'flyover'
      ? 'flyover'
      : initialEntityType === 'tunnel'
      ? 'tunnel'
      : 'tower'
  );

  // Viewer Controls
  const [explosionFactor, setExplosionFactor] = useState<number>(0.25);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [isUndergroundMode, setIsUndergroundMode] = useState<boolean>(false);
  const [isWireframe, setIsWireframe] = useState<boolean>(false);
  const [isCrossSection, setIsCrossSection] = useState<boolean>(false);

  // Hierarchy Selection
  const [selectedFloor, setSelectedFloor] = useState<number>(8);
  const [selectedUnit, setSelectedUnit] = useState<number>(4);
  const [selectedStore, setSelectedStore] = useState<string>('S-101');

  // VPRID Real-Time Looking Generation Animation State
  const [isGeneratingVPRID, setIsGeneratingVPRID] = useState<boolean>(false);
  const [vpridStageIndex, setVpridStageIndex] = useState<number>(-1);
  const [generatedVPRID, setGeneratedVPRID] = useState<string | null>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const buildingGroupRef = useRef<THREE.Group | null>(null);
  const floorMeshesRef = useRef<THREE.Mesh[]>([]);

  const vpridStages = [
    '1. LiDAR Building Envelope Volumetric Mesh Scan',
    '2. Horizontal Floor Slab Stratification (3.25m pitch)',
    '3. Polyhedral Unit Divider Partition Enumeration',
    '4. Revenue Registry ULPIN / Title Deed Binding',
    '5. Cryptographic SHA-256 Spatial Certification'
  ];

  // 1. Setup Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 600;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(isUndergroundMode ? 0x070b14 : 0x0f172a); // Deep CAD Blueprint Slate

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.set(28, 22, 34);
    camera.lookAt(0, 6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const mainSunLight = new THREE.DirectionalLight(0xffffff, 1.3);
    mainSunLight.position.set(30, 50, 25);
    mainSunLight.castShadow = true;
    mainSunLight.shadow.mapSize.width = 2048;
    mainSunLight.shadow.mapSize.height = 2048;
    scene.add(mainSunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    rimLight.position.set(-25, 20, -25);
    scene.add(rimLight);

    const bluePointLight = new THREE.PointLight(0x06b6d4, 2, 40);
    bluePointLight.position.set(0, -6, 0);
    scene.add(bluePointLight);

    // Ground Plane & Foundation
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: isUndergroundMode ? 0.12 : 0.95,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Architectural Ground Grid
    const gridHelper = new THREE.GridHelper(60, 30, 0x38bdf8, 0x334155);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Foundation Excavation Box
    const foundationGeo = new THREE.BoxGeometry(16, 2.5, 14);
    const foundationMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      wireframe: isWireframe
    });
    const foundationMesh = new THREE.Mesh(foundationGeo, foundationMat);
    foundationMesh.position.set(0, -1.25, 0);
    scene.add(foundationMesh);

    // Subterranean Yellow Line Metro Tunnel (-14.2m MSL)
    const metroTunnelGeo = new THREE.CylinderGeometry(2.4, 2.4, 52, 32);
    const metroTunnelMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.75,
      roughness: 0.2,
      metalness: 0.5,
      wireframe: isWireframe
    });
    const metroTunnelMesh = new THREE.Mesh(metroTunnelGeo, metroTunnelMat);
    metroTunnelMesh.rotation.z = Math.PI / 2;
    metroTunnelMesh.position.set(0, -7.0, -8);
    scene.add(metroTunnelMesh);

    // Metro Tracks Line
    const trackGeo = new THREE.BoxGeometry(50, 0.15, 1.2);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x0891b2 });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.position.set(0, -7.8, -8);
    scene.add(trackMesh);

    // Subsurface Road Tunnel (-8.5m MSL)
    const roadTunnelGeo = new THREE.BoxGeometry(48, 2.8, 4.5);
    const roadTunnelMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.7,
      wireframe: isWireframe
    });
    const roadTunnelMesh = new THREE.Mesh(roadTunnelGeo, roadTunnelMat);
    roadTunnelMesh.position.set(0, -4.2, 8);
    scene.add(roadTunnelMesh);

    // Underground Utilities Conduits (-1.4m to -4.2m)
    // 1. Telecom (Orange/Green)
    const telGeo = new THREE.CylinderGeometry(0.2, 0.2, 48, 16);
    const telMat = new THREE.MeshStandardMaterial({ color: 0x10b981 });
    const telMesh = new THREE.Mesh(telGeo, telMat);
    telMesh.rotation.z = Math.PI / 2;
    telMesh.position.set(0, -1.4, -4);
    scene.add(telMesh);

    // 2. Water Main (Cyan/Blue)
    const wtrGeo = new THREE.CylinderGeometry(0.35, 0.35, 48, 16);
    const wtrMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const wtrMesh = new THREE.Mesh(wtrGeo, wtrMat);
    wtrMesh.rotation.z = Math.PI / 2;
    wtrMesh.position.set(0, -1.8, -2);
    scene.add(wtrMesh);

    // 3. Power (Red)
    const pwrGeo = new THREE.CylinderGeometry(0.25, 0.25, 48, 16);
    const pwrMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    const pwrMesh = new THREE.Mesh(pwrGeo, pwrMat);
    pwrMesh.rotation.z = Math.PI / 2;
    pwrMesh.position.set(0, -2.2, 2);
    scene.add(pwrMesh);

    // Underground Parking Basement (-6.0m MSL)
    const pkgGeo = new THREE.BoxGeometry(14, 2.0, 12);
    const pkgMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.85,
      wireframe: isWireframe
    });
    const pkgMesh = new THREE.Mesh(pkgGeo, pkgMat);
    pkgMesh.position.set(0, -3.2, 0);
    scene.add(pkgMesh);

    // Elevated Flyover Model (+8.5m MSL)
    const flyoverGroup = new THREE.Group();
    scene.add(flyoverGroup);

    // Flyover Deck (+8.5m)
    const deckGeo = new THREE.BoxGeometry(54, 0.8, 6.0);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.4,
      wireframe: isWireframe
    });
    const deckMesh = new THREE.Mesh(deckGeo, deckMat);
    deckMesh.position.set(0, 8.5, -16);
    deckMesh.castShadow = true;
    flyoverGroup.add(deckMesh);

    // Flyover Support Pillars (Solid Concrete Pier Columns touching ground 0 to 8.5m)
    [-18, -9, 0, 9, 18].forEach((posX) => {
      const pierGeo = new THREE.CylinderGeometry(0.8, 0.9, 8.5, 24);
      const pierMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
      const pierMesh = new THREE.Mesh(pierGeo, pierMat);
      pierMesh.position.set(posX, 4.25, -16);
      pierMesh.castShadow = true;
      flyoverGroup.add(pierMesh);
    });

    // Building Group (Floors & Slabs)
    const buildingGroup = new THREE.Group();
    buildingGroupRef.current = buildingGroup;
    scene.add(buildingGroup);

    floorMeshesRef.current = [];
    const isSharma = activeTab === 'violation';
    const isMallMode = activeTab === 'mall';
    const totalFloors = isSharma ? 6 : isMallMode ? 4 : 12;

    for (let f = 1; f <= totalFloors; f++) {
      const isIllegal = isSharma && f > 4;
      const isSelectedFloor = f === selectedFloor;

      const floorGroup = new THREE.Group();
      floorGroup.position.y = (f - 1) * 1.2;

      // Concrete Slab
      const slabGeo = new THREE.BoxGeometry(11.5, 0.35, 9.5);
      const slabMat = new THREE.MeshStandardMaterial({
        color: isIllegal
          ? 0xdc2626 // Warning Red
          : isSelectedFloor
          ? 0xf59e0b // Amber Gold
          : 0x1e293b, // Dark Concrete
        roughness: 0.3,
        wireframe: isWireframe
      });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      floorGroup.add(slabMesh);

      // Glass Enclosure / Walls
      const wallGeo = new THREE.BoxGeometry(11.2, 0.85, 9.2);
      const wallMat = new THREE.MeshStandardMaterial({
        color: isIllegal
          ? 0xfca5a5
          : isSelectedFloor
          ? 0xfef08a
          : isMallMode
          ? 0x818cf8
          : 0x60a5fa,
        transparent: true,
        opacity: isCrossSection ? 0.3 : 0.7,
        roughness: 0.1,
        metalness: 0.1,
        wireframe: isWireframe
      });
      const wallMesh = new THREE.Mesh(wallGeo, wallMat);
      wallMesh.position.y = 0.55;
      floorGroup.add(wallMesh);

      // Unit Dividers (Interior 4 partitions)
      const dividerGeo = new THREE.BoxGeometry(11.3, 0.9, 9.3);
      const dividerMat = new THREE.MeshBasicMaterial({
        color: isIllegal ? 0xff0000 : 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.4
      });
      const dividerMesh = new THREE.Mesh(dividerGeo, dividerMat);
      dividerMesh.position.y = 0.55;
      floorGroup.add(dividerMesh);

      // Highlight selected Unit 4 on Floor 8
      if (f === 8 && selectedUnit === 4 && activeTab === 'tower') {
        const unitGeo = new THREE.BoxGeometry(5.4, 0.8, 4.4);
        const unitMat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.85,
          roughness: 0.2
        });
        const unitMesh = new THREE.Mesh(unitGeo, unitMat);
        unitMesh.position.set(2.7, 0.55, 2.2);
        floorGroup.add(unitMesh);
      }

      // Footpath Encroachment Mesh on Ground Floor for Sharma Plaza
      if (isSharma && f === 1) {
        const encroachmentGeo = new THREE.BoxGeometry(4.0, 0.4, 2.5);
        const encroachmentMat = new THREE.MeshStandardMaterial({
          color: 0xdb2777, // Vibrant Pink/Red Encroachment
          transparent: true,
          opacity: 0.85,
          wireframe: false
        });
        const encroachmentMesh = new THREE.Mesh(encroachmentGeo, encroachmentMat);
        encroachmentMesh.position.set(4.0, 0.2, 5.2);
        floorGroup.add(encroachmentMesh);
      }

      (slabMesh as any).userData = { floorNumber: f };
      buildingGroup.add(floorGroup);
      floorMeshesRef.current.push(slabMesh);
    }

    // Roof Fixtures
    const roofFixtureGroup = new THREE.Group();
    roofFixtureGroup.position.y = totalFloors * 1.2;
    const liftRoomGeo = new THREE.BoxGeometry(3.5, 1.8, 3.5);
    const liftRoomMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    const liftRoomMesh = new THREE.Mesh(liftRoomGeo, liftRoomMat);
    liftRoomMesh.position.set(0, 0.9, 0);
    roofFixtureGroup.add(liftRoomMesh);
    buildingGroup.add(roofFixtureGroup);

    // Animation Loop
    let animationFrameId: number;
    let angle = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (isRotating) {
        angle += 0.005;
        camera.position.x = 32 * Math.cos(angle);
        camera.position.z = 32 * Math.sin(angle);
        camera.lookAt(0, 6 + explosionFactor * totalFloors * 0.8, 0);
      }

      // Dynamic Explosion Translation along Y
      floorMeshesRef.current.forEach((slabMesh, index) => {
        const parentGroup = slabMesh.parent;
        if (parentGroup) {
          const flr = index + 1;
          const targetY = (flr - 1) * (1.2 + explosionFactor * 2.4);
          parentGroup.position.y = targetY;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Mouse Interaction
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      setIsRotating(false);
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;

      camera.position.x += dx * 0.1;
      camera.position.y -= dy * 0.1;
      camera.lookAt(0, 6, 0);

      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      dom.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.dispose();
    };
  }, [
    activeTab,
    selectedFloor,
    selectedUnit,
    explosionFactor,
    isRotating,
    isUndergroundMode,
    isWireframe,
    isCrossSection
  ]);

  // Handle Real-Time Looking VPRID Generation Animation
  const handleTriggerVPRIDGeneration = () => {
    setIsGeneratingVPRID(true);
    setVpridStageIndex(0);
    setGeneratedVPRID(null);

    let stage = 0;
    const interval = setInterval(() => {
      stage += 1;
      if (stage < vpridStages.length) {
        setVpridStageIndex(stage);
      } else {
        clearInterval(interval);
        setIsGeneratingVPRID(false);
        setGeneratedVPRID(`VPR-BLD018-F${selectedFloor < 10 ? '0' + selectedFloor : selectedFloor}-U0${selectedUnit}`);
      }
    }, 700);
  };

  const setCameraPreset = (preset: 'iso' | 'front' | 'top' | 'underground') => {
    if (!cameraRef.current) return;
    setIsRotating(false);
    if (preset === 'iso') {
      cameraRef.current.position.set(28, 22, 34);
      cameraRef.current.lookAt(0, 6, 0);
    } else if (preset === 'front') {
      cameraRef.current.position.set(0, 12, 42);
      cameraRef.current.lookAt(0, 6, 0);
    } else if (preset === 'top') {
      cameraRef.current.position.set(0, 50, 0.1);
      cameraRef.current.lookAt(0, 0, 0);
    } else if (preset === 'underground') {
      setIsUndergroundMode(true);
      cameraRef.current.position.set(20, -6, 26);
      cameraRef.current.lookAt(0, -6, 0);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-white rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
      {/* Top Header & Entity Mode Bar */}
      <div className="bg-slate-900/95 px-6 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between z-10 backdrop-blur-md gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-sm">
            <Box className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center space-x-2">
              <span>BHARAT 3D Dedicated BIM Cadastre & Digital Twin Viewer</span>
              <Badge variant="accent" size="sm">BIM Level 3 LOD-350</Badge>
            </h2>
            <p className="text-[11px] text-slate-400">
              True volumetric geometry • Stratified vertical floorplates • Micro unit boundaries • Subterranean transit
            </p>
          </div>
        </div>

        {/* Entity Switcher Tabs */}
        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
          <button
            onClick={() => setActiveTab('tower')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'tower' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🏢 Aarav Heights (G+12)
          </button>
          <button
            onClick={() => setActiveTab('mall')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'mall' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🛍️ Civic Grand Mall
          </button>
          <button
            onClick={() => setActiveTab('violation')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'violation' ? 'bg-red-600 text-white shadow animate-pulse' : 'text-slate-400 hover:text-white'
            }`}
          >
            ⚠️ Sharma Plaza (Violation)
          </button>
          <button
            onClick={() => setActiveTab('flyover')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'flyover' ? 'bg-orange-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🌉 Elevated Flyover
          </button>
          <button
            onClick={() => setActiveTab('tunnel')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'tunnel' ? 'bg-cyan-700 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            🚇 Metro Tunnel (-14.2m)
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          {onOpenEditor && (
            <Button variant="accent" size="sm" onClick={onOpenEditor} className="font-bold">
              <span>Open 3D Editor</span>
            </Button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-bold"
            >
              ✕ Close Viewer
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport & Inspection Split */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 3D WebGL Canvas */}
        <div className="flex-1 relative overflow-hidden bg-slate-950">
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

          {/* Floating Camera & Shading Toolbar (Top Left) */}
          <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 shadow-2xl z-10 flex items-center space-x-2 text-xs">
            <button
              onClick={() => setCameraPreset('iso')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold"
            >
              📐 Isometric
            </button>
            <button
              onClick={() => setCameraPreset('front')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold"
            >
              🏢 Front BIM
            </button>
            <button
              onClick={() => setCameraPreset('top')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold"
            >
              🔝 Top Ortho
            </button>
            <button
              onClick={() => setCameraPreset('underground')}
              className={`px-2.5 py-1 rounded border font-semibold ${
                isUndergroundMode ? 'bg-cyan-700 border-cyan-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              🚇 Subsurface
            </button>

            <div className="w-px h-4 bg-slate-700 mx-1" />

            <button
              onClick={() => setIsRotating(!isRotating)}
              className={`px-2.5 py-1 rounded border font-semibold ${
                isRotating ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              {isRotating ? '⏸️ Orbiting' : '▶️ 360° Orbit'}
            </button>

            <button
              onClick={() => setIsWireframe(!isWireframe)}
              className={`px-2.5 py-1 rounded border font-semibold ${
                isWireframe ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              🕸️ Wireframe
            </button>

            <button
              onClick={() => setIsUndergroundMode(!isUndergroundMode)}
              className={`px-2.5 py-1 rounded border font-semibold ${
                isUndergroundMode ? 'bg-cyan-700 border-cyan-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              👁️ X-Ray Mode
            </button>
          </div>

          {/* Explosion Slider HUD (Bottom Left) */}
          <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-800 shadow-2xl z-10 text-xs space-y-2 w-72">
            <div className="flex justify-between font-bold text-slate-200 text-[11px]">
              <span className="flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>Explode Floor Slabs:</span>
              </span>
              <span className="font-mono text-amber-400">{Math.round(explosionFactor * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={explosionFactor}
              onChange={(e) => setExplosionFactor(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 font-mono">
              <span>Watertight Slabs (0m)</span>
              <span>Stratified (+2.4m)</span>
            </div>
          </div>

          {/* Subterranean Metro Clearance Callout (Bottom Right) */}
          <div className="absolute bottom-4 right-4 bg-cyan-950/90 backdrop-blur-md p-3 rounded-xl border border-cyan-800 text-[11px] text-cyan-200 shadow-2xl space-y-1 max-w-xs">
            <div className="font-bold flex items-center space-x-1.5 text-cyan-300">
              <Train className="w-4 h-4 text-cyan-400" />
              <span>Subsurface Metro Buffer Clearance:</span>
            </div>
            <div>Yellow Line Metro Tunnel depth: <strong>-14.2m MSL</strong> below base slab.</div>
            <div className="text-[10px] text-emerald-400 font-mono font-bold flex items-center space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>0 Structural Collisions • Verified Safe Buffer</span>
            </div>
          </div>
        </div>

        {/* Right Hierarchical Cadastre & Unit Inspection Sidebar */}
        <div className="w-96 bg-slate-900 border-l border-slate-800 p-4 overflow-y-auto space-y-4 text-xs">
          {/* 1. Apartment Tower: Building -> Floor -> Unit */}
          {activeTab === 'tower' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 text-sm">Aarav Heights Tower</span>
                  <Badge variant="success">ULPIN: IN-01-0008</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div>Floors: <strong className="text-slate-200">12 Residential Slabs</strong></div>
                  <div>Total Units: <strong className="text-slate-200">48 Condos</strong></div>
                  <div>Height: <strong className="text-slate-200 font-mono">+39.0m MSL</strong></div>
                  <div>Plot Area: <strong className="text-slate-200">1,240 m²</strong></div>
                </div>
              </div>

              {/* Step 1: Vertical Floor Slices */}
              <div className="space-y-2">
                <div className="font-bold text-slate-300 flex items-center justify-between text-[11px]">
                  <span>1. Select Vertical Floor:</span>
                  <span className="text-amber-400 font-mono">Floor {selectedFloor} Active</span>
                </div>
                <div className="grid grid-cols-6 gap-1 font-mono text-[10px]">
                  {[12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((flr) => (
                    <button
                      key={flr}
                      onClick={() => setSelectedFloor(flr)}
                      className={`py-1.5 rounded border transition-all ${
                        selectedFloor === flr
                          ? 'bg-blue-600 text-white font-bold border-blue-400 shadow-md ring-2 ring-blue-300'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border-slate-700'
                      }`}
                    >
                      F{flr}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Individual Unit Subdivisions on Selected Floor */}
              <div className="space-y-2">
                <div className="font-bold text-slate-300 flex items-center justify-between text-[11px]">
                  <span>2. Subdivided Units on Floor {selectedFloor}:</span>
                  <span className="text-blue-400 font-mono">4 Units / Floor</span>
                </div>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  {[1, 2, 3, 4].map((u) => {
                    const isCitizenUnit = selectedFloor === 8 && u === 4;
                    const isSelected = selectedUnit === u;
                    return (
                      <button
                        key={u}
                        onClick={() => setSelectedUnit(u)}
                        className={`p-2.5 rounded-lg border text-left transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold ring-2 ring-amber-300 shadow'
                            : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span>Flat {selectedFloor * 100 + u}</span>
                          {isCitizenUnit && (
                            <span className="text-[8px] bg-amber-400 text-slate-950 px-1 py-0.5 rounded font-black">
                              CITIZEN DEED
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400 font-sans mt-0.5">115.2 m² • 345.6 m³</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Selected Unit VPRID Spatial Card */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="font-mono text-amber-400 font-bold text-xs">
                    VPR-BLD018-F{selectedFloor < 10 ? '0' + selectedFloor : selectedFloor}-U0{selectedUnit}
                  </span>
                  <span className="text-[9px] bg-emerald-900/80 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-700">
                    CERTIFIED VPRID
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div>Carpet Area: <strong className="text-white">94.5 m² (1,017 sq.ft)</strong></div>
                  <div>Built-up Area: <strong className="text-white">115.2 m² (1,240 sq.ft)</strong></div>
                  <div>Volume: <strong className="text-white">345.6 m³</strong></div>
                  <div>Z-Elevation: <strong className="font-mono text-slate-200">237.7m - 241.0m MSL</strong></div>
                  <div>Owner: <strong className="text-amber-300">Priya Mehta</strong></div>
                  <div>Occupant: <strong className="text-white">Rohan Gupta (Tenant)</strong></div>
                  <div>Annual Tax: <strong className="text-emerald-400">₹18,400 (Paid)</strong></div>
                  <div>Title Deed: <strong className="font-mono text-slate-300">DEED-DL-2024-0981</strong></div>
                </div>

                {/* Generate 3D IDs Button */}
                <div className="pt-2 border-t border-slate-800">
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={handleTriggerVPRIDGeneration}
                    isLoading={isGeneratingVPRID}
                    className="w-full justify-center font-bold text-xs shadow-lg"
                  >
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    <span>Generate 3D IDs (VPRID)</span>
                  </Button>
                </div>
              </div>

              {/* VPRID Generation Animation HUD */}
              {isGeneratingVPRID && (
                <div className="p-3 bg-blue-950/80 border border-blue-700 rounded-xl space-y-1.5 animate-in fade-in duration-200">
                  <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider flex items-center space-x-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                    <span>Real-Time Volumetric Cadastre Scanning:</span>
                  </div>
                  <div className="text-[11px] text-white font-mono font-bold">
                    {vpridStages[vpridStageIndex]}
                  </div>
                </div>
              )}

              {generatedVPRID && (
                <div className="p-3 bg-emerald-950/90 border border-emerald-700 rounded-xl space-y-1 animate-in fade-in duration-200">
                  <div className="text-[10px] font-bold text-emerald-300 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                    <span>3D Spatial Identifier Certified:</span>
                  </div>
                  <div className="text-xs font-mono font-black text-amber-300">
                    {generatedVPRID}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. Commercial Mall Stores */}
          {activeTab === 'mall' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-100 text-sm">Civic Grand Mall</span>
                  <Badge variant="accent">Commercial Complex</Badge>
                </div>
                <p className="text-[11px] text-slate-400">
                  4 Levels of retail stores, anchor hypermarket, and multi-cuisine food court.
                </p>
              </div>

              <div className="font-bold text-slate-300 text-[11px] flex items-center space-x-1.5">
                <ShoppingBag className="w-4 h-4 text-indigo-400" />
                <span>Commercial Stores & Lease Status:</span>
              </div>

              <div className="space-y-2">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex justify-between items-center font-bold text-white">
                    <span>Store S-101 (Anchor Hypermarket)</span>
                    <Badge variant="success">Active Lease</Badge>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Tenant: <strong>Apex Retail Supermarket</strong> • Period: 2024–2027
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Carpet: 1,200 m² • Volume: 4,800 m³ • Annual Tax: ₹1,45,000 (Paid)
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex justify-between items-center font-bold text-white">
                    <span>Store S-201 (Fashion Store)</span>
                    <Badge variant="success">Active Lease</Badge>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Tenant: <strong>FabIndia Living</strong> • Period: 2024–2026
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Carpet: 320 m² • Annual Tax: ₹48,000 (Paid)
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex justify-between items-center font-bold text-white">
                    <span>Store S-202 (Footwear Retail)</span>
                    <Badge variant="warning">Expired Lease</Badge>
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Tenant: <strong>Bata India Ltd</strong> • Expired: Dec 2025
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Carpet: 210 m² • Renewal Pending
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <div className="flex justify-between items-center font-bold text-white">
                    <span>Store S-203 (Vacant Retail Unit)</span>
                    <Badge variant="neutral">Vacant</Badge>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Available for Stratified Commercial Lease • Carpet: 180 m²
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Physical Violations: Sharma Plaza (G+6 vs G+4, Setback, Footpath) */}
          {activeTab === 'violation' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-red-950/80 border border-red-800 rounded-xl space-y-2 text-red-100">
                <div className="flex items-center space-x-2 font-bold text-red-300">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <span>Sharma Commercial Plaza Violations</span>
                </div>
                <p className="text-[11px] text-red-200">
                  Critical non-compliance detected by automated LiDAR 3D reconstruction against municipal architectural sanctions.
                </p>
              </div>

              {/* Violation 1: Unauthorized Floors */}
              <div className="p-3 bg-slate-950 border border-red-900/60 rounded-xl space-y-1.5">
                <div className="font-bold text-red-400 text-xs flex items-center justify-between">
                  <span>1. Vertical Height Exceeded (+2 Illegal Floors)</span>
                  <span className="text-[9px] bg-red-900 text-red-200 px-1.5 py-0.5 rounded font-mono font-bold">
                    FLOORS 5 & 6 (RED)
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Approved Sanction: <strong>G+4 (14.0m)</strong> • LiDAR Measured: <strong>G+6 (21.2m)</strong>
                </div>
                <div className="text-[10px] text-red-300 font-mono">
                  Excess Vertical Height: +7.2 meters • +920 m² Unauthorized Commercial Space
                </div>
              </div>

              {/* Violation 2: Footpath Encroachment */}
              <div className="p-3 bg-slate-950 border border-red-900/60 rounded-xl space-y-1.5">
                <div className="font-bold text-pink-400 text-xs flex items-center justify-between">
                  <span>2. Public Footpath Encroachment</span>
                  <span className="text-[9px] bg-pink-950 text-pink-300 px-1.5 py-0.5 rounded font-mono font-bold">
                    OVERLAP DETECTED
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Ground floor retail extension physically overlaps <strong>Sector 04 Public Footpath</strong>.
                </div>
                <div className="text-[10px] text-pink-300 font-mono">
                  Encroached Footpath Area: <strong>24.8 m²</strong> (Rendered in Magenta on Ground)
                </div>
              </div>

              {/* Violation 3: Front Setback Breach */}
              <div className="p-3 bg-slate-950 border border-red-900/60 rounded-xl space-y-1.5">
                <div className="font-bold text-amber-400 text-xs flex items-center justify-between">
                  <span>3. Front Setback Breach</span>
                  <span className="text-[9px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                    -2.2m SETBACK BREACH
                  </span>
                </div>
                <div className="text-[11px] text-slate-300">
                  Required Front Setback: <strong>6.0 meters</strong> • Actual Surveyed: <strong>3.8 meters</strong>
                </div>
              </div>

              {/* Municipal Action */}
              <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 space-y-1.5 text-[11px] text-slate-300">
                <div className="font-bold text-slate-100">Municipal Enforcement Assessment:</div>
                <div>Annual Unauthorized Surcharge: <strong className="text-red-400">+₹84,000 / year</strong></div>
                <div>Compounding Penalty: <strong className="text-red-400">₹2,50,000</strong></div>
                <div>Legal Notice: <strong className="text-amber-300 font-mono">NOT-2026-SHARMA-01</strong></div>
              </div>
            </div>
          )}

          {/* 4. Elevated Flyover Infrastructure */}
          {activeTab === 'flyover' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-orange-950/80 border border-orange-800 rounded-xl space-y-2 text-orange-100">
                <div className="font-bold text-orange-300 text-sm">Elevated Bypass Flyover (FLY-01-01)</div>
                <p className="text-[11px] text-orange-200">
                  Grade-separated elevated highway corridor spanning above the Central Urban Spine road.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-[11px] text-slate-300">
                <div>Deck Base Elevation: <strong className="text-orange-400 font-mono">+8.5m MSL</strong></div>
                <div>Deck Top Elevation: <strong className="text-orange-400 font-mono">+10.7m MSL</strong></div>
                <div>Corridor Length: <strong className="text-white">340 meters</strong></div>
                <div>Support Piers: <strong className="text-white">Solid Concrete Columns (0 to 8.5m)</strong></div>
                <div>Surface Road Clearance: <strong className="text-emerald-400">8.5m Vertical Clearance (Safe)</strong></div>
                <div>Asset Operator: <strong className="text-white">PWD Delhi / NHAI</strong></div>
              </div>
            </div>
          )}

          {/* 5. Subterranean Metro & Road Tunnels */}
          {activeTab === 'tunnel' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-cyan-950/80 border border-cyan-800 rounded-xl space-y-2 text-cyan-100">
                <div className="font-bold text-cyan-300 text-sm">Yellow Line Metro Transit Tunnel (TNL-01-02)</div>
                <p className="text-[11px] text-cyan-200">
                  Subsurface mass transit corridor aligned beneath urban real estate parcels.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-[11px] text-slate-300">
                <div>Tunnel Depth BGL: <strong className="text-cyan-400 font-mono">-14.2m MSL</strong></div>
                <div>Tunnel Diameter: <strong className="text-white">5.8 meters</strong></div>
                <div>Corridor Length: <strong className="text-white">520 meters</strong></div>
                <div>Asset Operator: <strong className="text-white">Delhi Metro Rail Corporation (DMRC)</strong></div>
                <div>Foundation Safety Margin: <strong className="text-emerald-400 font-bold">14.2m Vertical Clearance</strong></div>
              </div>

              {/* Underground Utilities Details */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-[11px] text-slate-300">
                <div className="font-bold text-slate-200 flex items-center space-x-1.5">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span>Subterranean Utility Corridor:</span>
                </div>
                <div>Telecom Fiber Trunk: <strong className="text-emerald-400 font-mono">-1.4m MSL</strong></div>
                <div>Water Trunk Main: <strong className="text-blue-400 font-mono">-1.8m MSL</strong></div>
                <div>11kV Power Feeder: <strong className="text-red-400 font-mono">-2.2m MSL</strong></div>
                <div>Basement Parking Slab: <strong className="text-slate-200 font-mono">-6.0m MSL</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dedicated3DViewer;

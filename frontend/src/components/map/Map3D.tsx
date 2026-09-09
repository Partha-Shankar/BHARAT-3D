import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface Exploded3DProps {
  buildingId?: string;
  selectedFloor?: number;
  onSelectFloor?: (floorNum: number) => void;
  onClose?: () => void;
}

export const Exploded3DBuildingViewer: React.FC<Exploded3DProps> = ({
  buildingId = 'BLD-001',
  selectedFloor = 8,
  onSelectFloor,
  onClose,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [explosionFactor, setExplosionFactor] = useState<number>(0.35);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [activeFloor, setActiveFloor] = useState<number>(selectedFloor || 8);

  const floorMeshesRef = useRef<THREE.Mesh[]>([]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const isSharma = buildingId === 'BLD-007';
  const totalFloors = isSharma ? 6 : 12;

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 500;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0f172a); // Slate-900

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(24, 20, 32);
    camera.lookAt(0, 6, 0);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const bluePointLight = new THREE.PointLight(0x38bdf8, 2, 50);
    bluePointLight.position.set(-15, 15, -15);
    scene.add(bluePointLight);

    // 4. Ground Grid & Subterranean Foundation
    const gridHelper = new THREE.GridHelper(40, 20, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Subsurface Metro Tunnel Cylinder passing underneath
    const tunnelGeo = new THREE.CylinderGeometry(2.2, 2.2, 38, 32);
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.7,
      roughness: 0.3,
      metalness: 0.4,
      wireframe: false,
    });
    const tunnelMesh = new THREE.Mesh(tunnelGeo, tunnelMat);
    tunnelMesh.rotation.z = Math.PI / 2;
    tunnelMesh.position.set(0, -4.5, -4);
    scene.add(tunnelMesh);

    // Metro Tracks Line inside tunnel
    const trackGeo = new THREE.BoxGeometry(36, 0.2, 1.2);
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x0891b2 });
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.position.set(0, -5.2, -4);
    scene.add(trackMesh);

    // 5. Building Model (Floor Slabs)
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    floorMeshesRef.current = [];

    for (let f = 1; f <= totalFloors; f++) {
      const isFloorActive = f === activeFloor;
      const isIllegalFloor = isSharma && f > 4;

      const floorGeo = new THREE.BoxGeometry(10, 0.9, 8);
      const floorMat = new THREE.MeshStandardMaterial({
        color: isIllegalFloor
          ? 0xdc2626 // Red warning for illegal floors
          : isFloorActive
          ? 0xf59e0b // Amber gold for active floor
          : f % 2 === 0
          ? 0x2563eb
          : 0x1d4ed8,
        transparent: true,
        opacity: isIllegalFloor ? 0.92 : 0.95,
        roughness: 0.2,
        metalness: 0.2,
      });

      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.castShadow = true;
      floorMesh.receiveShadow = true;
      (floorMesh as any).userData = { floorNumber: f };

      // Add Glass Window Insets
      const glassGeo = new THREE.BoxGeometry(9.6, 0.5, 7.6);
      const glassMat = new THREE.MeshStandardMaterial({
        color: isIllegalFloor ? 0xfca5a5 : 0xbae6fd,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1,
      });
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.y = 0.5;
      floorMesh.add(glassMesh);

      // Add Unit Divider Lines (Cross partitions inside floor)
      const dividerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
      const dividerMesh = new THREE.Mesh(new THREE.BoxGeometry(10.05, 0.95, 8.05), dividerMat);
      floorMesh.add(dividerMesh);

      buildingGroup.add(floorMesh);
      floorMeshesRef.current.push(floorMesh);
    }

    // 6. Animation Loop
    let animationFrameId: number;
    let angle = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (isRotating) {
        angle += 0.005;
        camera.position.x = 28 * Math.cos(angle);
        camera.position.z = 28 * Math.sin(angle);
        camera.lookAt(0, 6 + explosionFactor * totalFloors * 0.8, 0);
      }

      // Update Floor Positions based on Explosion Factor
      floorMeshesRef.current.forEach((mesh, index) => {
        const floorNum = index + 1;
        const targetY = (floorNum - 1) * (1.1 + explosionFactor * 2.2);
        mesh.position.y = targetY;
      });

      renderer.render(scene, camera);
    };

    animate();

    // 7. Mouse Orbit Drag Handling
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      setIsRotating(false);
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      camera.position.x += deltaX * 0.1;
      camera.position.y -= deltaY * 0.1;
      camera.lookAt(0, 6, 0);

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      renderer.dispose();
    };
  }, [buildingId, totalFloors, isSharma, isRotating, explosionFactor, activeFloor]);

  const handleFloorClick = (flr: number) => {
    setActiveFloor(flr);
    if (onSelectFloor) onSelectFloor(flr);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-white rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative">
      {/* Top Header Bar */}
      <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between z-10 backdrop-blur-md">
        <div>
          <h3 className="text-sm font-bold flex items-center space-x-2 text-white">
            <span>{isSharma ? 'Sharma Commercial Plaza (G+6)' : 'Aarav Heights Condominium (G+12)'}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
              isSharma ? 'bg-red-900/80 text-red-300 border border-red-700' : 'bg-blue-900/80 text-blue-300 border border-blue-700'
            }`}>
              {isSharma ? '2 UNAUTHORIZED FLOORS' : 'BIM VOLUMETRIC CADASTRE'}
            </span>
          </h3>
          <p className="text-[11px] text-slate-400">
            {isSharma ? 'Floors 5 & 6 exceed municipal sanctioned G+4 height limit' : 'Interactive 3D vertical floor slice & unit delineation'}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsRotating(!isRotating)}
            className={`px-3 py-1 text-xs rounded border transition-all ${
              isRotating ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {isRotating ? '⏸️ Pause Orbit' : '▶️ Auto-Rotate'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* 3D Canvas Viewport */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Floating Explode Slider HUD */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur-md p-3 rounded-lg border border-slate-800 shadow-xl z-10 text-xs space-y-2 w-64">
          <div className="flex justify-between font-bold text-slate-300 text-[11px]">
            <span>💥 Explode Floor Slices:</span>
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
            <span>Compact (0m)</span>
            <span>Subdivided (+2.2m)</span>
          </div>
        </div>

        {/* Floor Selection Stack on the Right */}
        <div className="absolute top-4 right-4 bg-slate-900/90 backdrop-blur-md p-2.5 rounded-lg border border-slate-800 shadow-xl z-10 space-y-1 w-36 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Floor Navigator
          </div>
          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 font-mono text-[10px]">
            {Array.from({ length: totalFloors }, (_, i) => totalFloors - i).map((flr) => {
              const isIllegal = isSharma && flr > 4;
              const isSelected = flr === activeFloor;
              return (
                <button
                  key={flr}
                  onClick={() => handleFloorClick(flr)}
                  className={`w-full py-1 px-2 rounded flex items-center justify-between text-left transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow'
                      : isIllegal
                      ? 'bg-red-950/80 text-red-300 border border-red-800 hover:bg-red-900'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>F{flr}</span>
                  <span className="text-[8px] opacity-75">
                    {isIllegal ? '⚠️ ILLEGAL' : `${(flr * 3.25).toFixed(1)}m`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Subterranean Metro Clearance Callout */}
        <div className="absolute bottom-4 right-4 bg-cyan-950/90 backdrop-blur-md p-2 rounded-lg border border-cyan-800 text-[10px] text-cyan-200 shadow-lg space-y-0.5">
          <div className="font-bold flex items-center space-x-1">
            <span>🚇 Subsurface Metro Clearance:</span>
          </div>
          <div>Depth: <strong>-14.2m MSL</strong> below foundation</div>
          <div className="text-[9px] text-cyan-400 font-mono">No structural clash detected</div>
        </div>
      </div>
    </div>
  );
};

export default Exploded3DBuildingViewer;


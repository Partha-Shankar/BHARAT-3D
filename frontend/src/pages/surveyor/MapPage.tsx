import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore, MapMode } from '../../stores/appStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Map2D } from '../../components/map/Map2D';
import { Exploded3DBuildingViewer } from '../../components/map/Map3D';
import { PropertyInspector } from '../../components/inspector/PropertyInspector';
import api from '../../lib/api';
import {
  Layers,
  Box,
  Building2,
  AlertTriangle,
  Compass,
  X,
  Sparkles,
  Maximize2,
  ArrowRight,
  ShieldCheck,
  HardHat,
  Network
} from 'lucide-react';

export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || 'proj-001';
  const queryAreaId = searchParams.get('area_id');
  const queryMode = searchParams.get('mode') as MapMode;

  const { mapMode, setMapMode, selectedAreaId, setSelectedAreaId } = useAppStore();
  const [show3DExplodedModal, setShow3DExplodedModal] = useState<boolean>(false);

  const activeArea = queryAreaId || selectedAreaId || 'area_01';

  const [areaMetadata, setAreaMetadata] = useState<any>({
    area_name: 'Central Heights',
    ward_number: 'Ward 16'
  });

  const [selectedEntity, setSelectedEntity] = useState<any>({
    id: 'BLD-01-01',
    name: 'Aarav Heights Condominium Tower',
    ulpin: 'IN-01-0008',
    building_type: 'RESIDENTIAL',
    floors: 12,
    height: 39.0,
    units: 48,
    violations: 1,
  });

  const [selectedFloorNumber, setSelectedFloorNumber] = useState<number | null>(8);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>('VPR-BLD0101-F08-U04');

  useEffect(() => {
    if (queryAreaId) {
      setSelectedAreaId(queryAreaId);
    }
    if (queryMode) {
      setMapMode(queryMode);
    }

    api.get(`/projects/${projectId}/map?area_id=${activeArea}`)
      .then((res) => {
        if (res.data && res.data.metadata) {
          setAreaMetadata(res.data.metadata);
        }
      })
      .catch(() => {});
  }, [queryAreaId, queryMode, activeArea, projectId, setSelectedAreaId, setMapMode]);

  const handleFeatureClick = (props: any) => {
    if (!props) return;
    setSelectedEntity(props);
  };

  return (
    <div className="h-[calc(100vh-61px)] flex flex-col overflow-hidden bg-slate-100">
      {/* Top Map Mode & Inspection Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between z-10 shadow-sm gap-3">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <span>{areaMetadata.area_name || 'Central Heights'} ({areaMetadata.ward_number || 'Ward 16'}) • 3D Cadastral Map</span>
              <Badge variant="success" size="sm">Certified v3.0</Badge>
            </h1>
            <p className="text-[10px] text-slate-500">
              2D ULPIN Base Cadastre with Extruded 3D Stratified Property & Subsurface Infrastructure
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
            <button
              onClick={() => setMapMode('2d')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                mapMode === '2d'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2D Cadastre
            </button>
            <button
              onClick={() => setMapMode('3d')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                mapMode === '3d'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3D Volumetric
            </button>
            <button
              onClick={() => setMapMode('underground')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                mapMode === 'underground'
                  ? 'bg-cyan-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚇 Underground
            </button>
            <button
              onClick={() => setMapMode('hybrid')}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                mapMode === 'hybrid'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hybrid
            </button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShow3DExplodedModal(true)}
            className="bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 font-bold"
          >
            <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
            <span>3D BIM Floor Exploder</span>
          </Button>

          <Button
            variant="accent"
            size="sm"
            onClick={() => navigate(`/surveyor/editor?project_id=${projectId}&area_id=${activeArea}`)}
            className="shadow-md font-bold"
          >
            <Box className="w-3.5 h-3.5 mr-1.5" />
            <span>Open 3D Cadastre Editor</span>
          </Button>
        </div>
      </div>

      {/* Main Map Viewport with Map2D and Right Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative overflow-hidden">
          <Map2D
            areaId={activeArea}
            mapMode={mapMode}
            onFeatureClick={handleFeatureClick}
            selectedFeatureId={selectedEntity?.id}
            selectedFloor={selectedFloorNumber}
          />

          {/* Modal Overlay for 3D Exploded BIM Viewer */}
          {show3DExplodedModal && (
            <div className="absolute inset-4 z-30 bg-slate-950/95 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl p-4 flex flex-col animate-in fade-in zoom-in-95 duration-200">
              <Exploded3DBuildingViewer
                buildingId={selectedEntity?.id || 'BLD-01-01'}
                selectedFloor={selectedFloorNumber || 8}
                onSelectFloor={(flr) => setSelectedFloorNumber(flr)}
                onClose={() => setShow3DExplodedModal(false)}
              />
            </div>
          )}

          {/* Floating Professional 3D Cadastre Legend */}
          <div className="absolute bottom-6 left-6 bg-slate-900/95 backdrop-blur-md p-3.5 rounded-xl shadow-2xl border border-slate-700 text-white z-10 text-[10px] space-y-2 max-w-xs">
            <div className="font-bold text-slate-200 text-[11px] mb-1 flex items-center justify-between">
              <span>3D Cadastral Volumetric Legend</span>
              <span className="text-[9px] text-amber-400 font-mono">EPSG:4326</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block shadow" />
              <span>Residential Tower (Aarav Heights G+12 • +39.0m)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-sm bg-amber-500 inline-block shadow" />
              <span>Commercial Hub (Civic Grand Mall G+4 • +18.5m)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-sm bg-cyan-400 inline-block shadow" />
              <span>Yellow Line Metro Tunnel (Subsurface -14.2m MSL)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block shadow" />
              <span>Elevated Flyover Deck (+8.5m MSL)</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-sm bg-red-600 inline-block shadow animate-pulse" />
              <span>Illegal Floors (Sharma Plaza G+6 Unauthorized)</span>
            </div>
          </div>
        </div>

        {/* Right Universal Property Cadastre Inspector */}
        <div className="w-96 border-l border-slate-200 shadow-2xl z-10">
          <PropertyInspector
            entity={selectedEntity}
            selectedFloorNumber={selectedFloorNumber}
            selectedUnitId={selectedUnitId}
            onSelectFloor={(flr) => setSelectedFloorNumber(flr)}
            onSelectUnit={(uId) => setSelectedUnitId(uId)}
            onOpenExploder={() => setShow3DExplodedModal(true)}
            onClose={() => setSelectedEntity(null)}
          />
        </div>
      </div>
    </div>
  );
};

export default MapPage;

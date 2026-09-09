import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../stores/appStore';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Map2D } from '../../components/map/Map2D';
import api from '../../lib/api';
import {
  Box,
  ArrowRight,
  Navigation
} from 'lucide-react';

export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || 'proj-001';
  const queryAreaId = searchParams.get('area_id');
  const { selectedAreaId, setSelectedAreaId } = useAppStore();

  const activeArea = queryAreaId || selectedAreaId || 'area_01';

  const [areaMetadata, setAreaMetadata] = useState<any>({
    area_name: 'Central Heights',
    ward_number: 'Ward 16'
  });

  useEffect(() => {
    if (queryAreaId) {
      setSelectedAreaId(queryAreaId);
    }

    api.get(`/projects/${projectId}/map?area_id=${activeArea}`)
      .then((res) => {
        if (res.data && res.data.metadata) {
          setAreaMetadata(res.data.metadata);
        }
      })
      .catch(() => {});
  }, [queryAreaId, activeArea, projectId, setSelectedAreaId]);

  const handleOpen3DWorld = (feature?: any) => {
    const targetEntity = feature?.id || 'BLD-01-01';
    navigate(`/3d-space/${activeArea}?project_id=${projectId}&focus=${targetEntity}`);
  };

  return (
    <div className="h-[calc(100vh-61px)] flex flex-col overflow-hidden bg-slate-900">
      {/* Top Clean Cadastre Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold text-slate-900">
                {areaMetadata.area_name || 'Central Heights'} ({areaMetadata.ward_number || 'Ward 16'}) • 2D Cadastral Base Map
              </h1>
              <Badge variant="success" size="sm">Active Cadastre</Badge>
            </div>
            <p className="text-[11px] text-slate-500">
              India 2D ULPIN Base Cadastre. Click on the highlighted 3D polygon area to open the 3D Mini-City World.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="accent"
            size="md"
            onClick={() => handleOpen3DWorld()}
            className="shadow-md font-bold px-4 py-2"
          >
            <Box className="w-4 h-4 mr-2" />
            <span>ENTER 3D MINI-CITY WORLD</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Full-Screen 2D Map Viewport (Clean cadastre, no clutter) */}
      <div className="flex-1 relative overflow-hidden bg-slate-100">
        <Map2D
          areaId={activeArea}
          onFeatureClick={(feature) => handleOpen3DWorld(feature)}
          onOpen3DViewer={(feature) => handleOpen3DWorld(feature)}
        />
      </div>
    </div>
  );
};

export default MapPage;

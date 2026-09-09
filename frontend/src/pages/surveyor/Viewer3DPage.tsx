import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Dedicated3DViewer } from '../../components/map/Dedicated3DViewer';
import { Button } from '../../components/ui/Button';
import { Map, ArrowLeft, Box, FileCheck2, AlertOctagon } from 'lucide-react';

export const Viewer3DPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || 'proj-001';
  const areaId = searchParams.get('area_id') || 'area_01';
  const entityId = searchParams.get('entity_id') || 'BLD-01-01';
  const entityType = (searchParams.get('type') || 'building') as any;

  return (
    <div className="h-[calc(100vh-61px)] flex flex-col bg-slate-950 p-4 space-y-3">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/surveyor/map?project_id=${projectId}&area_id=${areaId}`)}
            className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 font-bold"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Back to 2D Cadastre Map</span>
          </Button>
          <span className="text-xs text-slate-400 font-mono">
            Project: {projectId} • Area: {areaId} • Entity: {entityId}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/surveyor/editor?project_id=${projectId}&area_id=${areaId}`)}
            className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 font-bold"
          >
            <Box className="w-4 h-4 mr-1.5 text-amber-400" />
            <span>Open 3D Editor</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/surveyor/registry?project_id=${projectId}&area_id=${areaId}`)}
            className="bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 font-bold"
          >
            <FileCheck2 className="w-4 h-4 mr-1.5 text-emerald-400" />
            <span>Registry</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Dedicated3DViewer
          entityId={entityId}
          initialEntityType={entityType}
          onClose={() => navigate(`/surveyor/map?project_id=${projectId}&area_id=${areaId}`)}
          onOpenEditor={() => navigate(`/surveyor/editor?project_id=${projectId}&area_id=${areaId}`)}
        />
      </div>
    </div>
  );
};

export default Viewer3DPage;

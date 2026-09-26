import React from 'react';
import { useNavigate } from 'react-router-dom';
import { StatCard } from '../../components/ui/StatCard';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import {
  MapPin,
  Building,
  Layers,
  Network,
  AlertTriangle,
  FolderPlus,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: projects } = useProjects();

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#1e4d6b] p-6 rounded-sm text-white shadow-sm border border-[#173e56]">
        <div>
          <div className="inline-flex items-center space-x-2 text-[#8fd0c8] text-xs font-semibold uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Surveyor workspace</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[#f3efe6]">
            Surveyor cadastre studio
          </h1>
          <p className="text-xs text-[#d5e3ea] mt-1 max-w-xl">
            Register child 3D identities on top of the ground ULPIN: model volumes, confirm geometry, and save to the registry.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="accent"
            size="md"
            onClick={() => navigate('/surveyor/projects')}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            <span>New Survey Project</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="2D Land Parcels"
          value="134"
          subtitle="Base ULPIN Layer"
          icon={<MapPin className="w-5 h-5 text-blue-600" />}
        />
        <StatCard
          title="3D Buildings"
          value="64"
          subtitle="Extruded Envelopes"
          icon={<Building className="w-5 h-5 text-indigo-600" />}
        />
        <StatCard
          title="Volumetric Units"
          value="884"
          subtitle="VPRIDs Generated"
          icon={<Layers className="w-5 h-5 text-amber-600" />}
        />
        <StatCard
          title="Infrastructure"
          value="52"
          subtitle="Tunnels, Deck, Utilities"
          icon={<Network className="w-5 h-5 text-emerald-600" />}
        />
        <StatCard
          title="Bylaw Violations"
          value="18"
          subtitle="Setback & Floor Flags"
          icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
        />
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card
            title="Active Cadastral Survey Projects"
            subtitle="Recent multi-sensor survey captures and their processing status"
            actions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/surveyor/projects')}
              >
                <span>View All Projects</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            }
          >
            <div className="divide-y divide-slate-100">
              {projects && projects.length > 0 ? (
                projects.map((project) => (
                  <div
                    key={project.id}
                    className="py-3.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-md transition-colors cursor-pointer"
                    onClick={() => navigate(`/surveyor/map?project_id=${project.id}`)}
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900">{project.name}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {project.ward_number} • {project.zone_name} • Dataset v{project.dataset_version}.0
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge
                        variant={
                          project.status === 'CONFIRMED'
                            ? 'success'
                            : project.status === 'PROCESSING'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {project.status}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        Open Map
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  Loading active survey projects...
                </div>
              )}
            </div>
          </Card>

          {/* Quick Demo Workflow Stepper */}
          <Card
            title="Standard Cadastral Ingestion Workflow"
            subtitle="Step-by-step procedure for converting raw 2D cadastral records to certified 3D Property Registry"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-center">
              <div
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-400 transition-all"
                onClick={() => navigate('/surveyor/area')}
              >
                <div className="w-7 h-7 mx-auto rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center mb-2">
                  1
                </div>
                <div className="text-xs font-semibold text-slate-800">Area Selection</div>
                <div className="text-[10px] text-slate-500 mt-1">Delineate survey polygon on 2D GIS map</div>
              </div>

              <div
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-400 transition-all"
                onClick={() => navigate('/surveyor/upload')}
              >
                <div className="w-7 h-7 mx-auto rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center mb-2">
                  2
                </div>
                <div className="text-xs font-semibold text-slate-800">Multi-Modal Upload</div>
                <div className="text-[10px] text-slate-500 mt-1">Drone, LiDAR, CAD & GNSS data ingestion</div>
              </div>

              <div
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-400 transition-all"
                onClick={() => navigate('/surveyor/processing')}
              >
                <div className="w-7 h-7 mx-auto rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center mb-2">
                  3
                </div>
                <div className="text-xs font-semibold text-slate-800">45s AI Pipeline</div>
                <div className="text-[10px] text-slate-500 mt-1">Height, floor extraction & 3D topology</div>
              </div>

              <div
                className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:border-slate-400 transition-all"
                onClick={() => navigate('/surveyor/editor')}
              >
                <div className="w-7 h-7 mx-auto rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center mb-2">
                  4
                </div>
                <div className="text-xs font-semibold text-slate-800">Surveyor Review</div>
                <div className="text-[10px] text-slate-500 mt-1">3D editor validation & VPRID generation</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: AI Extraction Confidence */}
        <div className="space-y-6">
          <Card
            title="Analysis Confidence"
            subtitle="Processing quality metrics on active survey zone"
          >
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">3D Topology Score</span>
                  <span className="font-bold text-slate-900">98.9%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '98.9%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Building Extraction</span>
                  <span className="font-bold text-slate-900">96.7%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '96.7%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Height Estimation (nDSM)</span>
                  <span className="font-bold text-slate-900">95.1%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '95.1%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 font-medium">Vertical Floor Segmentation</span>
                  <span className="font-bold text-slate-900">92.4%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '92.4%' }} />
                </div>
              </div>
            </div>

            <div className="mt-5 p-2.5 bg-slate-50 border border-slate-200 rounded text-[11px] text-slate-500 flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span>
                Deterministic rules validate all geometry before registration into the National 3D Cadastre.
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

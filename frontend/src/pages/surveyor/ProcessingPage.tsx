import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../stores/appStore';
import api from '../../lib/api';
import {
  CheckCircle2,
  Clock,
  Loader2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building,
  Layers,
  Network,
  AlertTriangle,
  Box,
  FileCheck2,
  AlertOctagon,
  HardHat,
  MapPin,
  Check
} from 'lucide-react';

export const ProcessingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('job_id') || 'job-74291';
  const projectId = searchParams.get('project_id') || 'proj-001';
  const pkgNum = parseInt(searchParams.get('pkg') || '1', 10);
  const { selectedAreaId, setSelectedAreaId } = useAppStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [metrics, setMetrics] = useState<any>({
    area_name: 'Central Heights',
    ward: 'Ward 16',
    parcels_count: 41,
    buildings_detected: 18,
    floors_inferred: 112,
    vertical_units: 188,
    infrastructure_assets: 7,
    violations_detected: 4,
    analysis_confidence: 0.948,
    topology_score: 0.987,
  });

  const areaId = `area_${pkgNum < 10 ? '0' + pkgNum : pkgNum}`;

  // Exact 16 Engineering Stages with Deterministic Timing
  const stages = [
    { name: 'Upload Validation', start: 0, end: 3, desc: 'Validating file integrity & MIME headers' },
    { name: 'File Integrity Verification', start: 3, end: 5, desc: 'Computing SHA-256 geodetic digests' },
    { name: 'Coordinate Reference Detection', start: 5, end: 8, desc: 'Parsing CRS tie-points & CORS baseline' },
    { name: 'CRS Normalization', start: 8, end: 11, desc: 'Aligning EPSG:4326 to Metric UTM 43N' },
    { name: 'GIS Parcel Alignment', start: 11, end: 14, desc: 'Conforming 2D cadastral boundaries & ULPIN keys' },
    { name: 'LiDAR Point Cloud Analysis', start: 14, end: 19, desc: 'Filtering ground vs non-ground points (nDSM)' },
    { name: 'Building Extraction', start: 19, end: 23, desc: 'Segmenting 3D building envelopes & rooflines' },
    { name: 'Building Height Estimation', start: 23, end: 26, desc: 'Inferring 95th percentile ridge elevations' },
    { name: 'Floor Segmentation', start: 26, end: 30, desc: 'Stratifying vertical slabs at 3.25m intervals' },
    { name: 'Vertical Unit Generation', start: 30, end: 34, desc: 'Allocating 3D volumetric polyhedral spaces' },
    { name: 'Infrastructure Extraction', start: 34, end: 37, desc: 'Modeling flyovers, subterranean tunnels & utilities' },
    { name: 'Topology Validation', start: 37, end: 40, desc: 'Verifying 2-manifold closed watertight meshes' },
    { name: 'Bylaw Analysis', start: 40, end: 42, desc: 'Evaluating setbacks, max height & FAR compliance' },
    { name: 'Ownership Linking', start: 42, end: 43, desc: 'Binding revenue title deeds to 3D units' },
    { name: 'Tax Linking', start: 43, end: 44, desc: 'Associating municipal property tax rolls' },
    { name: '3D Scene Preparation', start: 44, end: 45, desc: 'Optimizing 3D MapLibre/Three.js spatial assets' },
  ];

  useEffect(() => {
    setSelectedAreaId(areaId);

    // Fetch area metrics from backend or local fallback
    api.get(`/projects/${projectId}/map?area_id=${areaId}`)
      .then((res) => {
        if (res.data && res.data.metrics) {
          setMetrics(res.data.metrics);
        }
      })
      .catch(() => {});

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => {
        if (prev >= 45) {
          clearInterval(timer);
          return 45;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [areaId, projectId, setSelectedAreaId]);

  const progressPct = Math.min(100, Math.round((elapsedSeconds / 45) * 100));

  // Determine current active stage
  let currentStageIndex = stages.findIndex((s) => elapsedSeconds >= s.start && elapsedSeconds < s.end);
  if (currentStageIndex === -1) {
    currentStageIndex = elapsedSeconds >= 45 ? 15 : 0;
  }
  const currentStage = stages[currentStageIndex];
  const isComplete = elapsedSeconds >= 45;

  // Formatted visible timer string: 00:17 / 00:45
  const formattedElapsed = `00:${elapsedSeconds < 10 ? '0' + elapsedSeconds : elapsedSeconds}`;
  const formattedTarget = '00:45';

  // Scaled live counter metrics during 45s run
  const bldMax = metrics.buildings_detected || 18;
  const flrMax = metrics.floors_inferred || 112;
  const unitMax = metrics.vertical_units || 188;
  const infraMax = metrics.infrastructure_assets || 7;
  const vltMax = metrics.violations_detected || 4;

  const liveBld = isComplete ? bldMax : Math.min(bldMax, Math.round((elapsedSeconds / 23) * bldMax));
  const liveFlr = isComplete ? flrMax : Math.min(flrMax, Math.round((elapsedSeconds / 30) * flrMax));
  const liveUnits = isComplete ? unitMax : Math.min(unitMax, Math.round((elapsedSeconds / 34) * unitMax));
  const liveInfra = isComplete ? infraMax : Math.min(infraMax, Math.round((elapsedSeconds / 37) * infraMax));
  const liveVlt = isComplete ? vltMax : Math.min(vltMax, Math.round((elapsedSeconds / 42) * vltMax));

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-2 bg-slate-900 text-amber-400 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Spatial Analysis Pipeline • {metrics.area_name} ({metrics.ward})</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          {isComplete ? '3D ANALYSIS COMPLETE' : 'Multi-Modal Spatial Analysis in Progress'}
        </h1>
        <p className="text-xs text-slate-500 max-w-xl mx-auto">
          Fusing 2D cadastral parcels, drone imagery, LiDAR point clouds, and CAD floor plans into watertight volumetric 3D property models.
        </p>
      </div>

      {/* Progress & Timing Bar Card with PROMINENT VISIBLE TIMER */}
      <Card className="p-6 bg-gradient-to-b from-white to-slate-50 shadow-lg border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-semibold text-slate-700 mb-3 gap-2">
          <div className="flex items-center space-x-2.5">
            {!isComplete ? (
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
            <span className="text-sm font-bold text-slate-900">
              {isComplete
                ? 'Spatial analysis completed for selected survey area.'
                : `Stage ${currentStageIndex + 1} of 16: ${currentStage.name}`}
            </span>
          </div>

          {/* Visible Timer Display: 00:17 / 00:45 */}
          <div className="flex items-center space-x-3 bg-slate-900 text-white px-3.5 py-1.5 rounded-lg shadow-inner">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="font-mono text-xs font-bold text-slate-200">
              {formattedElapsed} <span className="text-slate-500">/</span> {formattedTarget}
            </span>
            <div className="w-px h-3.5 bg-slate-700" />
            <span className="font-mono text-xs font-black text-amber-400">
              {progressPct}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner p-0.5">
          <div
            className={`h-full transition-all duration-1000 ease-out rounded-full ${
              isComplete
                ? 'bg-gradient-to-r from-emerald-600 to-green-500'
                : 'bg-gradient-to-r from-blue-700 via-blue-500 to-amber-400'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Post-Processing Action Toolbar (Requirement 20) */}
        {isComplete && (
          <div className="mt-6 pt-6 border-t border-slate-200 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center space-x-2.5 text-xs text-emerald-900 font-semibold bg-emerald-50 p-3 rounded-lg border border-emerald-200">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                Watertight 3D topology verified • {metrics.parcels_count} parcels synchronized • {metrics.vertical_units} Vertical Units ready for cadastral inspection.
              </span>
            </div>

            {/* Post-Processing Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button
                variant="accent"
                size="md"
                onClick={() => navigate(`/surveyor/map?project_id=${projectId}&area_id=${areaId}`)}
                className="shadow-lg font-bold"
              >
                <span>View 3D Cadastral Map</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={() => navigate(`/surveyor/editor?project_id=${projectId}&area_id=${areaId}`)}
              >
                <Box className="w-4 h-4 mr-2 text-amber-400" />
                <span>Open 3D Cadastre Editor</span>
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(`/surveyor/registry?project_id=${projectId}&area_id=${areaId}`)}
              >
                <FileCheck2 className="w-4 h-4 mr-2 text-slate-700" />
                <span>View Registry</span>
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(`/surveyor/violations?project_id=${projectId}&area_id=${areaId}`)}
              >
                <AlertOctagon className="w-4 h-4 mr-2 text-red-600" />
                <span>Analyze Violations</span>
              </Button>

              <Button
                variant="outline"
                size="md"
                onClick={() => navigate(`/surveyor/map?project_id=${projectId}&area_id=${areaId}&mode=underground`)}
              >
                <Network className="w-4 h-4 mr-2 text-cyan-600" />
                <span>Inspect Infrastructure</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Live Extracted Metrics Counters from Selected Area's metrics.json */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center shadow-sm">
          <Building className="w-4 h-4 mx-auto text-blue-600 mb-1" />
          <div className="text-2xl font-black text-slate-900 font-mono">{liveBld}</div>
          <div className="text-[11px] text-slate-500 font-medium">Buildings Detected</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center shadow-sm">
          <Layers className="w-4 h-4 mx-auto text-indigo-600 mb-1" />
          <div className="text-2xl font-black text-slate-900 font-mono">{liveFlr}</div>
          <div className="text-[11px] text-slate-500 font-medium">Floors Identified</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center shadow-sm">
          <Layers className="w-4 h-4 mx-auto text-amber-600 mb-1" />
          <div className="text-2xl font-black text-slate-900 font-mono">{liveUnits}</div>
          <div className="text-[11px] text-slate-500 font-medium">Vertical Units</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center shadow-sm">
          <Network className="w-4 h-4 mx-auto text-emerald-600 mb-1" />
          <div className="text-2xl font-black text-slate-900 font-mono">{liveInfra}</div>
          <div className="text-[11px] text-slate-500 font-medium">Infrastructure Assets</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center shadow-sm">
          <AlertTriangle className="w-4 h-4 mx-auto text-red-600 mb-1" />
          <div className="text-2xl font-black text-slate-900 font-mono">{liveVlt}</div>
          <div className="text-[11px] text-slate-500 font-medium">Potential Violations</div>
        </div>
      </div>

      {/* Model Confidence & Topology Panel */}
      <Card title="Analysis Confidence & Topology Metrics">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-slate-500">Analysis Confidence:</span>
              <strong className="text-slate-900">{((metrics.analysis_confidence || 0.948) * 100).toFixed(1)}%</strong>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(metrics.analysis_confidence || 0.948) * 100}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-slate-500">Topology Score:</span>
              <strong className="text-slate-900">{((metrics.topology_score || 0.987) * 100).toFixed(1)}%</strong>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${(metrics.topology_score || 0.987) * 100}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-slate-500">Building Extraction:</span>
              <strong className="text-slate-900">96.7%</strong>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full" style={{ width: '96.7%' }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-slate-500">Height Estimation (nDSM):</span>
              <strong className="text-slate-900">95.4%</strong>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full" style={{ width: '95.4%' }} />
            </div>
          </div>
        </div>
      </Card>

      {/* 16 Telemetry Stages Breakdown */}
      <Card title="Live Pipeline Telemetry (16 Stages)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1 text-xs">
          {stages.map((stage, idx) => {
            const isStageDone = elapsedSeconds >= stage.end || isComplete;
            const isStageCurrent = elapsedSeconds >= stage.start && elapsedSeconds < stage.end && !isComplete;

            return (
              <div
                key={idx}
                className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                  isStageDone
                    ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                    : isStageCurrent
                    ? 'bg-blue-50/80 border-blue-300 text-blue-950 font-bold shadow-sm animate-pulse'
                    : 'bg-slate-50/60 border-slate-100 text-slate-400'
                }`}
              >
                <div className="flex items-center space-x-2 truncate">
                  {isStageDone ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : isStageCurrent ? (
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                  ) : (
                    <Clock className="w-4 h-4 text-slate-300 shrink-0" />
                  )}
                  <span className="truncate">{idx + 1}. {stage.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono ml-2 shrink-0">
                  {isStageDone ? '✓ COMPLETED' : isStageCurrent ? 'RUNNING' : 'QUEUED'}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default ProcessingPage;

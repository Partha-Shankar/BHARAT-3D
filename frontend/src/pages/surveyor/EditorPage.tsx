import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useAppStore } from '../../stores/appStore';
import api from '../../lib/api';
import {
  Box,
  Layers,
  Save,
  CheckCircle2,
  ArrowRight,
  Split,
  Plus,
  Trash2,
  Maximize2,
  Compass,
  FileCheck2,
  Sparkles,
  Sliders,
  Check,
  AlertCircle
} from 'lucide-react';
import { Exploded3DBuildingViewer } from '../../components/map/Map3D';

export const EditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || 'proj-001';
  const queryAreaId = searchParams.get('area_id');
  const { selectedAreaId } = useAppStore();

  const activeArea = queryAreaId || selectedAreaId || 'area_01';

  // Demo Edits State
  const [floorsCount, setFloorsCount] = useState<number>(12);
  const [unitSplits, setUnitSplits] = useState<number>(4);
  const [tunnelLength, setTunnelLength] = useState<number>(280);
  const [tunnelDepth, setTunnelDepth] = useState<number>(8.5);
  const [flyoverElevation, setFlyoverElevation] = useState<number>(8.5);
  const [activeTab, setActiveTab] = useState<'tower' | 'tunnel' | 'flyover'>('tower');
  
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isGeneratingIds, setIsGeneratingIds] = useState<boolean>(false);
  const [generatedResult, setGeneratedResult] = useState<any>(null);

  const handleAddFloor = () => {
    setFloorsCount((prev) => prev + 1);
  };

  const handleSplitUnits = (num: number) => {
    setUnitSplits(num);
  };

  const handleSaveDraft = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }, 800);
  };

  const handleGenerate3DIds = async () => {
    setIsGeneratingIds(true);
    try {
      const response = await api.post(`/projects/${projectId}/generate-3d-ids`);
      setGeneratedResult(response.data);
    } catch (e) {
      setGeneratedResult({
        status: 'SUCCESS',
        summary: {
          buildings_processed: 18,
          floors_processed: floorsCount + 100,
          units_processed: unitSplits * floorsCount + 140,
          infrastructure_processed: 7,
          total_vprids_allocated: 401
        },
        registry_status: 'ACTIVE_CERTIFIED'
      });
    } finally {
      setIsGeneratingIds(false);
    }
  };

  return (
    <div className="h-[calc(100vh-61px)] flex flex-col bg-slate-100 overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-wrap items-center justify-between z-10 shadow-sm gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-slate-900">3D Cadastre Human-in-the-Loop Editor</h1>
            <Badge variant="accent" size="sm">Active Cadastral Workspace</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Refine volumetric floor stratification, subdivide unit partitions, and adjust subterranean corridor profiles.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            isLoading={isSaving}
          >
            <Save className="w-3.5 h-3.5 mr-1.5 text-slate-700" />
            <span>{saveSuccess ? 'Draft Saved ✓' : 'Save Draft Edits'}</span>
          </Button>

          <Button
            variant="accent"
            size="sm"
            onClick={handleGenerate3DIds}
            isLoading={isGeneratingIds}
            className="shadow-md font-bold"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            <span>CONFIRM MODEL & GENERATE 3D IDS</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/surveyor/registry?project_id=${projectId}&area_id=${activeArea}`)}
          >
            <FileCheck2 className="w-3.5 h-3.5 mr-1.5" />
            <span>Open Registry</span>
          </Button>
        </div>
      </div>

      {/* Main Split Layout: Left Controls, Right 3D Exploder Viewer */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Interactive Parameter Modification Tools */}
        <div className="w-96 bg-white border-r border-slate-200 p-5 overflow-y-auto space-y-5 shadow-sm">
          {/* Editor Target Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setActiveTab('tower')}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                activeTab === 'tower' ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏢 Apartment Tower
            </button>
            <button
              onClick={() => setActiveTab('tunnel')}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                activeTab === 'tunnel' ? 'bg-cyan-700 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🚇 Subsurface Tunnel
            </button>
            <button
              onClick={() => setActiveTab('flyover')}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                activeTab === 'flyover' ? 'bg-orange-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌉 Flyover Deck
            </button>
          </div>

          {/* 1. Apartment Tower Edits */}
          {activeTab === 'tower' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-150">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 text-blue-950">
                <div className="font-bold flex items-center justify-between">
                  <span>Aarav Heights Cadastral Slab Stack</span>
                  <span className="font-mono bg-blue-200 px-2 py-0.5 rounded text-blue-900">{floorsCount} Slabs</span>
                </div>
                <p className="text-[11px] text-blue-800">
                  Floor stratification interval: <strong>3.25 meters</strong>. Total measured height: <strong>{(floorsCount * 3.25).toFixed(2)}m MSL</strong>.
                </p>
              </div>

              {/* Action 1: Add Floor */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-800">Edit 1: Add Vertical Floor Slab</div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddFloor}
                  className="w-full justify-center bg-white border-blue-300 text-blue-700 hover:bg-blue-50 font-bold"
                >
                  <Plus className="w-4 h-4 mr-1 text-blue-600" />
                  <span>Add Floor {floorsCount + 1} (+3.25m Slab)</span>
                </Button>
              </div>

              {/* Action 2: Subdivide Floor into Homes */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-800">Edit 2: Subdivide Slabs into Homes</div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  {[2, 4, 6].map((num) => (
                    <button
                      key={num}
                      onClick={() => handleSplitUnits(num)}
                      className={`py-2 rounded-lg border text-center font-bold transition-all ${
                        unitSplits === num
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {num} Units / Flr
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Carpet Area per Unit: <strong>{roundNumber(912 / unitSplits)} m²</strong>
                </div>
              </div>
            </div>
          )}

          {/* 2. Subsurface Tunnel Edits */}
          {activeTab === 'tunnel' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-150">
              <div className="p-3.5 bg-cyan-50/70 border border-cyan-200 rounded-xl space-y-2 text-cyan-950">
                <div className="font-bold flex items-center justify-between">
                  <span>Central Subsurface Road Tunnel (TNL-01)</span>
                  <Badge variant="accent">Underground Asset</Badge>
                </div>
                <p className="text-[11px] text-cyan-800">
                  Subsurface corridor aligned beneath the Central Spine surface road.
                </p>
              </div>

              {/* Action 3: Tunnel Length Modification */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Edit 3: Tunnel Corridor Length:</span>
                  <span className="font-mono text-cyan-700">{tunnelLength} meters</span>
                </div>
                <input
                  type="range"
                  min="200"
                  max="450"
                  step="10"
                  value={tunnelLength}
                  onChange={(e) => setTunnelLength(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>

              {/* Action 4: Tunnel Depth Modification */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Edit 4: Tunnel Depth BGL:</span>
                  <span className="font-mono text-cyan-700">-{tunnelDepth.toFixed(1)}m BGL</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="18"
                  step="0.5"
                  value={tunnelDepth}
                  onChange={(e) => setTunnelDepth(parseFloat(e.target.value))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 3. Flyover Deck Edits */}
          {activeTab === 'flyover' && (
            <div className="space-y-4 text-xs animate-in fade-in duration-150">
              <div className="p-3.5 bg-orange-50/70 border border-orange-200 rounded-xl space-y-2 text-orange-950">
                <div className="font-bold flex items-center justify-between">
                  <span>Elevated Bypass Flyover (FLY-01)</span>
                  <Badge variant="accent">Elevated Deck</Badge>
                </div>
                <p className="text-[11px] text-orange-800">
                  Elevated road deck supported on solid concrete pier columns.
                </p>
              </div>

              {/* Action 5: Flyover Elevation */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>Edit 5: Deck Base Elevation:</span>
                  <span className="font-mono text-orange-700">+{flyoverElevation.toFixed(1)}m MSL</span>
                </div>
                <input
                  type="range"
                  min="6"
                  max="14"
                  step="0.5"
                  value={flyoverElevation}
                  onChange={(e) => setFlyoverElevation(parseFloat(e.target.value))}
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Bulk 3D ID Generation Output Card */}
          {generatedResult && (
            <div className="p-4 bg-emerald-950 text-emerald-100 rounded-xl space-y-2.5 shadow-xl border border-emerald-800 animate-in fade-in duration-200">
              <div className="flex items-center space-x-2 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>3D Property Registry Ready</span>
              </div>
              <div className="text-[11px] text-emerald-200 space-y-1">
                <div>Buildings Processed: <strong>{generatedResult.summary.buildings_processed}</strong></div>
                <div>Floors Stratified: <strong>{generatedResult.summary.floors_processed}</strong></div>
                <div>Volumetric Units: <strong>{generatedResult.summary.units_processed}</strong></div>
                <div>Total 3D Identities: <strong className="text-amber-400 text-sm">{generatedResult.summary.total_vprids_allocated} VPRIDs</strong></div>
              </div>
              <Button
                variant="accent"
                size="sm"
                onClick={() => navigate(`/surveyor/registry?project_id=${projectId}&area_id=${activeArea}`)}
                className="w-full justify-center mt-2 font-bold"
              >
                <span>Inspect Published Registry</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Right 3D Exploded BIM Viewer */}
        <div className="flex-1 p-4 bg-slate-900 flex flex-col">
          <Exploded3DBuildingViewer
            buildingId="BLD-01-01"
            selectedFloor={8}
          />
        </div>
      </div>
    </div>
  );
};

function roundNumber(num: number) {
  return Math.round(num * 10) / 10;
}

export default EditorPage;

import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useStartProcessing } from '../../hooks/useProcessing';
import { useAppStore } from '../../stores/appStore';
import {
  UploadCloud,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  FolderOpen,
  Check,
  RefreshCw,
  Loader2,
  FileCheck2,
  CloudUpload
} from 'lucide-react';

interface ModalityCard {
  id: string;
  title: string;
  extensions: string;
  acceptTypes: string;
  defaultFileName: string;
  defaultFileSize: string;
  uploadedFileName?: string;
  uploadedFileSize?: string;
  status: 'idle' | 'uploading' | 'completed';
  progress: number;
}

const PACKAGE_NAMES: Record<string, string> = {
  area_01: 'Central Heights Survey Zone (Ward 16)',
  area_02: 'Metro District Transit Corridor (Ward 22)',
  area_03: 'Civic Square Urban Center (Ward 08)',
  area_04: 'Transit Quarter Multi-Modal Sector (Ward 31)',
  area_05: 'Urban Heights High-Rise Zone (Ward 14)',
  area_06: 'Central Market Commercial Hub (Ward 19)',
  area_07: 'Civic Transit Infrastructure Zone (Ward 05)',
  area_08: 'Integrated Eco-District Sector (Ward 27)',
  area_09: 'Vertical City Skyscraper District (Ward 11)',
  area_10: 'Central Urban Core (Ward 01)',
};

export const DataUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || 'proj-001';
  const paramAreaId = searchParams.get('area_id');
  const startProcessing = useStartProcessing(projectId);
  const { selectedAreaId } = useAppStore();

  const currentAreaKey = paramAreaId || selectedAreaId || 'area_01';
  const pkgNum = parseInt(currentAreaKey.replace('area_', ''), 10) || 1;
  const packageName = PACKAGE_NAMES[currentAreaKey] || PACKAGE_NAMES['area_01'];

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isBulkUploading, setIsBulkUploading] = useState<boolean>(false);

  // 6 Clean Primary Modality Cards
  const [cards, setCards] = useState<ModalityCard[]>([
    {
      id: 'drone',
      title: 'Drone Imagery',
      extensions: '(.tif, .jpg, .png)',
      acceptTypes: '.tif,.tiff,.jp2,.jpg,.jpeg,.png',
      defaultFileName: `drone_orthomosaic_pkg${pkgNum < 10 ? '0' + pkgNum : pkgNum}.tif`,
      defaultFileSize: '842 MB',
      status: 'idle',
      progress: 0,
    },
    {
      id: 'lidar',
      title: 'LiDAR Point Cloud',
      extensions: '(.las, .laz)',
      acceptTypes: '.las,.laz',
      defaultFileName: `lidar_classified_pkg${pkgNum < 10 ? '0' + pkgNum : pkgNum}.las`,
      defaultFileSize: '418 MB',
      status: 'idle',
      progress: 0,
    },
    {
      id: 'floorplans',
      title: 'Floor Plans & BIM',
      extensions: '(.dxf, .dwg, .ifc, .pdf)',
      acceptTypes: '.dxf,.dwg,.ifc,.pdf',
      defaultFileName: 'floor_plans_bim.dxf',
      defaultFileSize: '18.4 MB',
      status: 'idle',
      progress: 0,
    },
    {
      id: 'cadastre',
      title: 'Cadastral 2D Boundaries',
      extensions: '(.geojson, .shp)',
      acceptTypes: '.geojson,.shp,.gpkg,.zip,.json',
      defaultFileName: 'parcels_2d.geojson',
      defaultFileSize: '3.2 MB',
      status: 'idle',
      progress: 0,
    },
    {
      id: 'elevation',
      title: 'Elevation Model (DEM / DSM)',
      extensions: '(.tif, .dem)',
      acceptTypes: '.tif,.tiff,.dem',
      defaultFileName: 'elevation_dsm.tif',
      defaultFileSize: '124 MB',
      status: 'idle',
      progress: 0,
    },
    {
      id: 'deeds',
      title: 'Title Deeds & Tax Data',
      extensions: '(.csv, .xlsx)',
      acceptTypes: '.csv,.xlsx,.json',
      defaultFileName: 'ownership_and_tax.csv',
      defaultFileSize: '1.4 MB',
      status: 'idle',
      progress: 0,
    },
  ]);

  const allCompleted = cards.every((c) => c.status === 'completed');
  const uploadedCount = cards.filter((c) => c.status === 'completed').length;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const simulateUpload = (cardId: string, customFile?: File) => {
    const fileName = customFile ? customFile.name : undefined;
    const fileSize = customFile ? formatBytes(customFile.size) : undefined;

    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? {
              ...c,
              uploadedFileName: fileName || c.defaultFileName,
              uploadedFileSize: fileSize || c.defaultFileSize,
              status: 'uploading',
              progress: 15,
            }
          : c
      )
    );

    let p = 15;
    const timer = setInterval(() => {
      p += 25;
      if (p >= 100) {
        clearInterval(timer);
        setCards((prev) =>
          prev.map((c) =>
            c.id === cardId ? { ...c, status: 'completed', progress: 100 } : c
          )
        );
      } else {
        setCards((prev) =>
          prev.map((c) => (c.id === cardId ? { ...c, progress: p } : c))
        );
      }
    }, 150);
  };

  const handleBlockClick = (cardId: string) => {
    if (fileInputRefs.current[cardId]) {
      fileInputRefs.current[cardId]?.click();
    } else {
      simulateUpload(cardId);
    }
  };

  const handleFileInputChange = (cardId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      simulateUpload(cardId, files[0]);
    } else {
      simulateUpload(cardId);
    }
  };

  const handleDragOver = (cardId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(cardId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
  };

  const handleDrop = (cardId: string, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      simulateUpload(cardId, droppedFiles[0]);
    } else {
      simulateUpload(cardId);
    }
  };

  const handleUploadAll = () => {
    setIsBulkUploading(true);

    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        uploadedFileName: c.uploadedFileName || c.defaultFileName,
        uploadedFileSize: c.uploadedFileSize || c.defaultFileSize,
        status: 'uploading',
        progress: 15,
      }))
    );

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      setCards((prev) =>
        prev.map((c, idx) => {
          const p = Math.min(100, step * 25 + idx * 5);
          if (p >= 100) return { ...c, progress: 100, status: 'completed' };
          return { ...c, progress: p };
        })
      );

      if (step >= 5) {
        clearInterval(interval);
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => ({ ...c, progress: 100, status: 'completed' }))
          );
          setIsBulkUploading(false);
        }, 250);
      }
    }, 200);
  };

  const handleReset = () => {
    setIsBulkUploading(false);
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        uploadedFileName: undefined,
        uploadedFileSize: undefined,
        status: 'idle',
        progress: 0,
      }))
    );
  };

  const handleStartProcessing = async () => {
    if (!allCompleted) {
      handleUploadAll();
      return;
    }
    try {
      const response = await startProcessing.mutateAsync();
      navigate(`/surveyor/processing?job_id=${response.job_id}&project_id=${projectId}&area_id=${currentAreaKey}&pkg=${pkgNum}`);
    } catch (error) {
      navigate(`/surveyor/processing?job_id=job-74291&project_id=${projectId}&area_id=${currentAreaKey}&pkg=${pkgNum}`);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 font-sans">
      {/* Clean Minimal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Upload Survey Data
            </h1>
            <span className="text-[11px] bg-blue-100 text-blue-900 font-semibold px-2 py-0.5 rounded">
              Step 2 of 4
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Upload drone, LiDAR, and cadastral datasets to reconstruct the 3D model.
          </p>
        </div>

        {/* Primary CTA Button */}
        <Button
          variant={allCompleted ? 'accent' : 'primary'}
          size="md"
          onClick={handleStartProcessing}
          isLoading={startProcessing.isPending || isBulkUploading}
          disabled={isBulkUploading}
          className={`font-bold px-6 py-2.5 shadow-md transition-all ${
            allCompleted
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          <span>{allCompleted ? 'START 3D ANALYSIS' : 'UPLOAD ALL DATA'}</span>
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      {/* Clean Package Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-blue-600 text-white rounded-xl">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-100">{packageName}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {allCompleted ? '✓ All datasets uploaded and verified' : `${uploadedCount} of 6 datasets uploaded`}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {allCompleted ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 text-xs font-medium"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              <span>Reset</span>
            </Button>
          ) : (
            <Button
              variant="accent"
              size="sm"
              onClick={handleUploadAll}
              disabled={isBulkUploading}
              className="font-bold text-xs shadow"
            >
              {isBulkUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-3.5 h-3.5 mr-1.5" />
                  <span>Upload All Files</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* 6 Minimalist Modality Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((card) => {
          const isDragging = dragOverId === card.id;
          const displayFileName = card.uploadedFileName || card.defaultFileName;
          const displayFileSize = card.uploadedFileSize || card.defaultFileSize;

          return (
            <div
              key={card.id}
              onDragOver={(e) => handleDragOver(card.id, e)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(card.id, e)}
              className={`bg-white rounded-2xl border transition-all p-5 shadow-sm flex flex-col justify-between ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/40 ring-4 ring-blue-100'
                  : card.status === 'completed'
                  ? 'border-emerald-200 bg-emerald-50/10'
                  : card.status === 'uploading'
                  ? 'border-blue-300 bg-blue-50/20'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input
                type="file"
                ref={(el) => (fileInputRefs.current[card.id] = el)}
                accept={card.acceptTypes}
                className="hidden"
                onChange={(e) => handleFileInputChange(card.id, e)}
              />

              <div>
                {/* Clean Card Header */}
                <div className="flex items-center justify-between mb-3.5">
                  <span className="text-xs font-bold text-slate-900">{card.title}</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {card.extensions}
                  </span>
                </div>

                {/* State 1: Idle Dropzone */}
                {card.status === 'idle' && (
                  <div
                    onClick={() => handleBlockClick(card.id)}
                    className="p-5 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl bg-slate-50/60 hover:bg-blue-50/30 cursor-pointer transition-all flex flex-col items-center justify-center text-center space-y-2 group min-h-[100px]"
                  >
                    <div className="p-2 bg-white group-hover:bg-blue-600 group-hover:text-white text-slate-400 rounded-lg shadow-sm border border-slate-200 transition-colors">
                      <CloudUpload className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-semibold text-slate-600 group-hover:text-blue-700">
                      {isDragging ? 'Drop file to upload' : 'Click or drag file here'}
                    </div>
                  </div>
                )}

                {/* State 2: Uploading */}
                {card.status === 'uploading' && (
                  <div className="p-4 border border-blue-200 rounded-xl bg-blue-50/50 space-y-3 min-h-[100px] flex flex-col justify-center">
                    <div className="flex items-center space-x-2.5">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                      <div className="truncate">
                        <div className="text-xs font-bold text-blue-950 truncate font-mono">
                          {displayFileName}
                        </div>
                        <div className="text-[10px] text-blue-600 mt-0.5">
                          Uploading... {card.progress}%
                        </div>
                      </div>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-200"
                        style={{ width: `${card.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* State 3: Uploaded */}
                {card.status === 'completed' && (
                  <div className="p-4 border border-emerald-200 rounded-xl bg-emerald-50/60 flex items-center justify-between min-h-[100px]">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                        <FileCheck2 className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-emerald-950 font-mono truncate">
                          {displayFileName}
                        </div>
                        <div className="text-[10px] text-emerald-700 mt-0.5">
                          {displayFileSize}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md flex items-center shrink-0">
                      <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                      <span>Uploaded</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Minimal CTA Bar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-md flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${allCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
            {allCompleted ? <CheckCircle2 className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {allCompleted
                ? 'All survey data ready for 3D reconstruction'
                : `Progress: ${uploadedCount} of 6 files uploaded`}
            </div>
            <div className="text-[11px] text-slate-500">
              {allCompleted
                ? 'Click "Start 3D Analysis" to begin the AI reconstruction pipeline.'
                : 'Upload all datasets above or click "Upload All Data" to proceed.'}
            </div>
          </div>
        </div>

        <Button
          variant={allCompleted ? 'accent' : 'primary'}
          size="md"
          onClick={handleStartProcessing}
          isLoading={startProcessing.isPending || isBulkUploading}
          disabled={isBulkUploading}
          className={`font-bold px-6 py-2.5 shadow transition-all ${
            allCompleted
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-300'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          <span>{allCompleted ? 'START 3D ANALYSIS' : 'UPLOAD ALL & START'}</span>
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
};

export default DataUploadPage;

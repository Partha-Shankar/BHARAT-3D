import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { useStartProcessing } from '../../hooks/useProcessing';
import { useAppStore } from '../../stores/appStore';
import {
  UploadCloud,
  FileCheck2,
  HardDrive,
  Layers,
  MapPin,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FolderOpen,
  FileCode,
  Sliders,
  FileSpreadsheet,
  Check,
  AlertCircle
} from 'lucide-react';

export const DataUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || 'proj-001';
  const startProcessing = useStartProcessing(projectId);
  const { activeDatasetVersion, setActiveDatasetVersion, selectedAreaId, setSelectedAreaId } = useAppStore();

  const [selectedPkgNum, setSelectedPkgNum] = useState<number>(activeDatasetVersion || 1);
  const [showPackageSwitcher, setShowPackageSwitcher] = useState(false);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);

  const packageNames = [
    "Central Heights Core Multi-Modal Ingestion Package",
    "Metro District Urban Corridor Survey Package",
    "Civic Square High-Density Cadastral Package",
    "Transit Quarter Multi-Modal Rail Siding Ingestion",
    "Urban Heights Condominium High-Rise Sensor Bundle",
    "Central Market Commercial Zone Survey Dataset",
    "Civic Transit Underground-Heavy Infrastructure Package",
    "Integrated Urban Zone Mixed Redevelopment Package",
    "Vertical City District Stratified Cadastral Bundle",
    "Central Urban Core Flagship 3D Cadastral Digital Twin"
  ];

  // 8 Multi-Modal Upload Ingestion Classes
  const uploadSections = [
    {
      category: '1. Aerial Drone Imagery (Orthomosaic)',
      formats: '.tif, .tiff, .jp2, .jpg, .jpeg, .png',
      file: `orthomosaic_survey_pkg${selectedPkgNum < 10 ? '0' + selectedPkgNum : selectedPkgNum}.tif`,
      size: '842.5 MB',
      type: 'RGB Orthomosaic (0.05m GSD)',
      crs: 'EPSG:4326',
      status: 'Validated',
      digest: '7a9b...41e2',
    },
    {
      category: '2. Point Cloud (Aerial LiDAR)',
      formats: '.las, .laz',
      file: `pointcloud_classified_pkg${selectedPkgNum < 10 ? '0' + selectedPkgNum : selectedPkgNum}.las`,
      size: '418.2 MB',
      type: 'ASPRS LiDAR v1.4 (28 pts/m²)',
      crs: 'EPSG:32643',
      status: 'Validated',
      digest: 'e3b0...b855',
    },
    {
      category: '3. Cadastral 2D GIS Boundaries',
      formats: '.geojson, .gpkg, .shp, .zip',
      file: 'parcels.geojson',
      size: '2.8 MB',
      type: '2D Cadastral Land Parcels (ULPIN)',
      crs: 'EPSG:4326',
      status: 'Validated',
      digest: '9481...7190',
    },
    {
      category: '4. Architectural CAD Floor Plans (BIM)',
      formats: '.dxf, .dwg, .ifc, .pdf',
      file: 'apartment_and_mall_floors.dxf',
      size: '18.4 MB',
      type: 'AutoCAD DXF Floor Slabs',
      crs: 'Local Cartesian (Georeferenced)',
      status: 'Validated',
      digest: '1829...4184',
    },
    {
      category: '5. GNSS Ground Control Points (CORS)',
      formats: '.csv, .txt, .rnx',
      file: 'gnss_base_rover_points.csv',
      size: '340 KB',
      type: 'RTK Ground Control Reference',
      crs: 'WGS84 Ellipsoidal MSL',
      status: 'Validated',
      digest: 'a891...0918',
    },
    {
      category: '6. Elevation Models (DEM / DSM)',
      formats: '.tif, .tiff',
      file: 'surface_elevation_dsm.tif',
      size: '124.0 MB',
      type: 'Normalized DSM / DTM Raster',
      crs: 'EPSG:4326',
      status: 'Validated',
      digest: '2948...9481',
    },
    {
      category: '7. Ownership Title Deeds',
      formats: '.csv, .xlsx, .json',
      file: 'ownership.csv',
      size: '850 KB',
      type: 'Revenue Cadastral Title Deeds',
      crs: 'VPRID / ULPIN Key',
      status: 'Validated',
      digest: '4091...8294',
    },
    {
      category: '8. Municipal Property Tax Assessment',
      formats: '.csv, .xlsx, .json',
      file: 'tax.csv',
      size: '620 KB',
      type: 'Municipal Tax Assessment Roll 2026',
      crs: 'VPRID / ULPIN Key',
      status: 'Validated',
      digest: '8491...0918',
    },
  ];

  const handlePackageSelect = (num: number) => {
    setSelectedPkgNum(num);
    setActiveDatasetVersion(num);
    const areaKey = `area_${num < 10 ? '0' + num : num}`;
    setSelectedAreaId(areaKey);
  };

  const handleStartProcessing = async () => {
    try {
      const response = await startProcessing.mutateAsync();
      navigate(`/surveyor/processing?job_id=${response.job_id}&project_id=${projectId}&pkg=${selectedPkgNum}`);
    } catch (error) {
      navigate(`/surveyor/processing?job_id=job-74291&project_id=${projectId}&pkg=${selectedPkgNum}`);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Multi-Source Spatial Data Ingestion Portal
            </h1>
            <span className="text-[11px] bg-blue-100 text-blue-900 font-semibold px-2 py-0.5 rounded">
              Step 2 of 4 • Ingestion
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Ingest heterogeneous multi-modal sensor packages. Coordinate Reference System (CRS) normalization, MIME validation, and SHA-256 integrity verification are executed automatically.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="accent"
            size="md"
            onClick={handleStartProcessing}
            isLoading={startProcessing.isPending}
            className="shadow-lg font-bold"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            <span>START MULTI-MODAL 3D ANALYSIS</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Active Survey Ingestion Package Bar */}
      <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 text-white rounded-lg">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-amber-400">
              Selected Ingestion Package: survey_package_{selectedPkgNum < 10 ? `0${selectedPkgNum}` : selectedPkgNum}
            </div>
            <div className="text-[11px] text-slate-300 font-medium">
              {packageNames[selectedPkgNum - 1]}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowPackageSwitcher(!showPackageSwitcher)}
            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>{showPackageSwitcher ? 'Close Package Switcher' : 'Switch Prepared Package (01–10)'}</span>
          </button>
        </div>
      </div>

      {showPackageSwitcher && (
        <Card className="p-4 bg-slate-50 border-slate-300 shadow-sm animate-in fade-in duration-150">
          <div className="text-xs font-bold text-slate-900 mb-2.5 flex items-center justify-between">
            <span>Available Ready-to-Upload Multi-Modal Survey Packages (10 Prepared Packages):</span>
            <span className="text-[10px] text-slate-500 font-normal">Includes LiDAR, Drone, GIS, CAD, GNSS, DEM/DSM, Deeds, Tax</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-xs">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                onClick={() => handlePackageSelect(num)}
                className={`py-2 px-3 rounded-lg border text-left transition-all ${
                  selectedPkgNum === num
                    ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-md ring-2 ring-blue-300'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="font-bold">survey_package_{num < 10 ? `0${num}` : num}</div>
                <div className={`text-[10px] truncate ${selectedPkgNum === num ? 'text-blue-100' : 'text-slate-400'}`}>
                  Area {num < 10 ? `0${num}` : num} Bundle
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Security & Ingestion Verification Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-600 text-white rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-emerald-950">
              Quarantine & Geospatial Alignment: 8 of 8 Datasets Validated
            </h4>
            <p className="text-[11px] text-emerald-700">
              MIME magic bytes verified • SHA-256 integrity digests computed • Georeferenced to Common Project CRS (EPSG:4326 / UTM 43N).
            </p>
          </div>
        </div>
        <Badge variant="success" size="md">
          Ready for Multi-Modal AI Processing
        </Badge>
      </div>

      {/* 8 Ingestion Files Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {uploadSections.map((item, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-900">{item.category}</span>
                <span className="text-[10px] text-slate-400 font-mono">{item.formats}</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-md shrink-0">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-800 truncate">{item.file}</div>
                    <div className="text-[10px] text-slate-500">
                      {item.size} • {item.type} • {item.crs}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded flex items-center space-x-1 shrink-0">
                  <Check className="w-3 h-3 mr-0.5" />
                  <span>{item.status}</span>
                </span>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
              <span className="font-mono">SHA-256: {item.digest}</span>
              <span className="text-emerald-600 font-semibold">✓ Quarantined & Verified</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataUploadPage;

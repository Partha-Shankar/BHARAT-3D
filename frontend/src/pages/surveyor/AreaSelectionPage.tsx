import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useUpdateProjectArea, useProject } from '../../hooks/useProjects';
import { useAppStore } from '../../stores/appStore';
import {
  Navigation,
  CheckCircle2,
  Trash2,
  ArrowRight,
  MousePointerClick,
  Layers,
  Square,
  Sparkles
} from 'lucide-react';

const AREA_CENTERS: Record<string, [number, number]> = {
  area_01: [77.2090, 28.6280],
  area_02: [77.2180, 28.6340],
  area_03: [77.2250, 28.6220],
  area_04: [77.2020, 28.6410],
  area_05: [77.2140, 28.6180],
  area_06: [77.2310, 28.6300],
  area_07: [77.1950, 28.6250],
  area_08: [77.2060, 28.6500],
  area_09: [77.2220, 28.6450],
  area_10: [77.2100, 28.6320],
};

export const AreaSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || 'proj-001';
  const { data: project } = useProject(projectId);
  const updateArea = useUpdateProjectArea(projectId);
  const { setSelectedAreaId, setCustomSurveyPolygon } = useAppStore();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  // State for Box/Polygon drawing
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [dragStartPoint, setDragStartPoint] = useState<[number, number] | null>(null);
  const [drawnBoxCoords, setDrawnBoxCoords] = useState<[number, number][] | null>(null);
  const [polygonAreaSqm, setPolygonAreaSqm] = useState<number | null>(null);
  const [boxCentroid, setBoxCentroid] = useState<[number, number] | null>(null);

  // Geodesic Shoelace calculation for box area in m²
  const calculateAreaSqm = (coords: [number, number][]): number => {
    if (coords.length < 3) return 420000;
    let area = 0.0;
    const n = coords.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x1 = coords[i][0] * 111111 * Math.cos((coords[i][1] * Math.PI) / 180);
      const y1 = coords[i][1] * 111111;
      const x2 = coords[j][0] * 111111 * Math.cos((coords[j][1] * Math.PI) / 180);
      const y2 = coords[j][1] * 111111;
      area += x1 * y2 - x2 * y1;
    }
    const computed = Math.abs(area) / 2.0;
    return Math.round(computed > 1000 ? computed : 420000);
  };

  const updateMapLayer = (coords: [number, number][] | null) => {
    if (!map.current || !map.current.getSource('survey-box-source')) return;

    if (!coords || coords.length === 0) {
      (map.current.getSource('survey-box-source') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: []
      });
      if (map.current.getSource('survey-box-vertices')) {
        (map.current.getSource('survey-box-vertices') as maplibregl.GeoJSONSource).setData({
          type: 'FeatureCollection',
          features: []
        });
      }
      return;
    }

    const closed = coords[0][0] === coords[coords.length - 1][0] && coords[0][1] === coords[coords.length - 1][1]
      ? coords
      : [...coords, coords[0]];

    (map.current.getSource('survey-box-source') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [closed],
          },
          properties: { name: 'Delineated Survey Box' },
        },
      ],
    });

    if (map.current.getSource('survey-box-vertices')) {
      const vertexFeatures: any[] = coords.slice(0, 4).map((pt, idx) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: { vertexIndex: idx + 1 }
      }));
      (map.current.getSource('survey-box-vertices') as maplibregl.GeoJSONSource).setData({
        type: 'FeatureCollection',
        features: vertexFeatures
      } as any);
    }
  };

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap Contributors | BHARAT 3D Cadastre',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [77.2090, 28.6280], // Delhi Central Ward
      zoom: 15.6,
      dragRotate: false,
      pitchWithRotate: false,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.current.on('load', () => {
      if (!map.current) return;

      // Start with completely clean, empty source
      map.current.addSource('survey-box-source', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.current.addSource('survey-box-vertices', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Translucent Cadastral Blue Fill
      map.current.addLayer({
        id: 'survey-box-fill',
        type: 'fill',
        source: 'survey-box-source',
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.30,
        },
      });

      // Bold Highlight Boundary Line with Dashed Cadastre Style
      map.current.addLayer({
        id: 'survey-box-line',
        type: 'line',
        source: 'survey-box-source',
        paint: {
          'line-color': '#0284c7',
          'line-width': 3.5,
          'line-dasharray': [3, 1.5],
        },
      });

      // Golden Corner Node Handles
      map.current.addLayer({
        id: 'survey-box-nodes',
        type: 'circle',
        source: 'survey-box-vertices',
        paint: {
          'circle-radius': 6,
          'circle-color': '#f59e0b',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
        },
      });
    });

    // Box Drag & Click Handlers
    let startLngLat: [number, number] | null = null;
    let isMouseDown = false;

    const handleMouseDown = (e: maplibregl.MapMouseEvent) => {
      // Start drawing box
      isMouseDown = true;
      startLngLat = [parseFloat(e.lngLat.lng.toFixed(6)), parseFloat(e.lngLat.lat.toFixed(6))];
      setDragStartPoint(startLngLat);
      setIsDrawing(true);
      if (map.current) {
        map.current.dragPan.disable();
      }
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isMouseDown || !startLngLat) return;
      const currentLngLat: [number, number] = [
        parseFloat(e.lngLat.lng.toFixed(6)),
        parseFloat(e.lngLat.lat.toFixed(6)),
      ];

      const minLng = Math.min(startLngLat[0], currentLngLat[0]);
      const maxLng = Math.max(startLngLat[0], currentLngLat[0]);
      const minLat = Math.min(startLngLat[1], currentLngLat[1]);
      const maxLat = Math.max(startLngLat[1], currentLngLat[1]);

      const box: [number, number][] = [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ];

      updateMapLayer(box);
    };

    const handleMouseUp = (e: maplibregl.MapMouseEvent) => {
      if (!isMouseDown || !startLngLat) return;
      isMouseDown = false;
      setIsDrawing(false);
      if (map.current) {
        map.current.dragPan.enable();
      }

      let currentLngLat: [number, number] = [
        parseFloat(e.lngLat.lng.toFixed(6)),
        parseFloat(e.lngLat.lat.toFixed(6)),
      ];

      // If user just clicked without dragging, provide a neat standard 400m box around click
      let minLng = Math.min(startLngLat[0], currentLngLat[0]);
      let maxLng = Math.max(startLngLat[0], currentLngLat[0]);
      let minLat = Math.min(startLngLat[1], currentLngLat[1]);
      let maxLat = Math.max(startLngLat[1], currentLngLat[1]);

      if (Math.abs(maxLng - minLng) < 0.0005 || Math.abs(maxLat - minLat) < 0.0005) {
        const dLng = 0.0025;
        const dLat = 0.0025;
        minLng = startLngLat[0] - dLng;
        maxLng = startLngLat[0] + dLng;
        minLat = startLngLat[1] - dLat;
        maxLat = startLngLat[1] + dLat;
      }

      const finalBox: [number, number][] = [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat],
      ];

      setDrawnBoxCoords(finalBox);
      const computedArea = calculateAreaSqm(finalBox);
      setPolygonAreaSqm(computedArea);
      setBoxCentroid([(minLng + maxLng) / 2, (minLat + maxLat) / 2]);
      updateMapLayer(finalBox);
    };

    map.current.on('mousedown', handleMouseDown);
    map.current.on('mousemove', handleMouseMove);
    map.current.on('mouseup', handleMouseUp);

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Clear / Delete Action (Resets to clean map)
  const handleClearDraw = () => {
    setDrawnBoxCoords(null);
    setPolygonAreaSqm(null);
    setBoxCentroid(null);
    setIsDrawing(false);
    updateMapLayer(null);
  };

  // Confirm Survey Boundary & Randomly Assign one of the 10 3D Maps
  const handleConfirmArea = async () => {
    if (!drawnBoxCoords) return;

    const polygonGeojson = {
      type: 'Polygon',
      coordinates: [drawnBoxCoords],
    };

    // Randomly select one of the 10 diverse 3D map combinations (area_01 to area_10)
    const randomAreaNum = Math.floor(Math.random() * 10) + 1;
    const randomAreaId = `area_${String(randomAreaNum).padStart(2, '0')}`;

    // Store custom survey polygon & assigned area
    setCustomSurveyPolygon(polygonGeojson);
    setSelectedAreaId(randomAreaId);

    try {
      await updateArea.mutateAsync(polygonGeojson);
      navigate(`/surveyor/upload?project_id=${projectId}&area_id=${randomAreaId}`);
    } catch (error) {
      navigate(`/surveyor/upload?project_id=${projectId}&area_id=${randomAreaId}`);
    }
  };

  return (
    <div className="h-[calc(100vh-61px)] flex flex-col bg-slate-900">
      {/* Clean Minimal Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between z-10 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-bold text-slate-900">Select Survey Area</h1>
            <span className="text-[11px] bg-blue-100 text-blue-900 font-semibold px-2 py-0.5 rounded">
              Step 1 of 4 • Delineation
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Click & drag on the map to draw your survey box boundary for 3D reconstruction.
          </p>
        </div>

        {/* Minimal Toolset: Delete Button & Confirm Button Only */}
        <div className="flex items-center space-x-3">
          {drawnBoxCoords && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearDraw}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              title="Delete / Redraw Box"
            >
              <Trash2 className="w-4 h-4 mr-1.5 text-red-500" />
              <span>Delete / Redraw</span>
            </Button>
          )}

          {drawnBoxCoords && (
            <Button
              variant="accent"
              size="sm"
              onClick={handleConfirmArea}
              className="shadow-md font-bold text-xs"
            >
              <span>CONFIRM SURVEY BOUNDARY & UPLOAD DATA</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Main Interactive Clean Map Viewport */}
      <div className="flex-1 relative overflow-hidden bg-slate-100">
        <div ref={mapContainer} className="w-full h-full cursor-crosshair" />

        {/* Floating Instruction Badge when Map is Empty */}
        {!drawnBoxCoords && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-md text-white px-5 py-2.5 rounded-full shadow-2xl border border-slate-700 flex items-center space-x-2.5 z-10 text-xs font-semibold pointer-events-none animate-bounce">
            <Square className="w-4 h-4 text-amber-400" />
            <span>Click and drag on the map to draw a survey box</span>
          </div>
        )}

        {/* Floating "Selected Survey Area" Card - APPEARS ONLY AFTER DRAWING */}
        {drawnBoxCoords && polygonAreaSqm !== null && (
          <div className="absolute top-4 left-4 max-w-sm bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-2xl border border-slate-200 z-10 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Delineated Survey Box
                </h4>
                <p className="text-[11px] text-slate-600 font-semibold">
                  Custom Georeferenced Cadastral Boundary
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Area Extent:</span>
                <strong className="text-blue-700 font-mono text-sm">
                  {(polygonAreaSqm / 1000000).toFixed(2)} km² ({polygonAreaSqm.toLocaleString()} m²)
                </strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Coordinate Reference:</span>
                <span className="font-mono text-[11px] text-slate-700">EPSG:4326 (WGS84 / UTM 43N)</span>
              </div>
              {boxCentroid && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Center Coordinates:</span>
                  <span className="font-mono text-[10px] text-slate-600">
                    {boxCentroid[0].toFixed(4)}° E, {boxCentroid[1].toFixed(4)}° N
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                <span className="text-slate-500">Status:</span>
                <span className="text-emerald-700 font-bold flex items-center">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Georeferenced
                </span>
              </div>
            </div>

            <Button
              variant="accent"
              size="sm"
              onClick={handleConfirmArea}
              className="w-full justify-center shadow-md font-bold text-xs py-2.5"
            >
              <span>CONFIRM SURVEY BOUNDARY & UPLOAD DATA</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AreaSelectionPage;

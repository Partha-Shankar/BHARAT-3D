import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import api from '../../lib/api';

interface Map2DProps {
  areaId?: string;
  mapMode?: '2d' | '3d' | 'underground' | 'hybrid';
  onFeatureClick?: (feature: any) => void;
  selectedFeatureId?: string | null;
  selectedFloor?: number | null;
  interactive?: boolean;
}

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

export const Map2D: React.FC<Map2DProps> = ({
  areaId = 'area_01',
  mapMode = '3d',
  onFeatureClick,
  selectedFeatureId,
  selectedFloor = 8,
  interactive = true,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentPitch, setCurrentPitch] = useState(62);
  const [currentBearing, setCurrentBearing] = useState(-25);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const centerLngLat = AREA_CENTERS[areaId] || AREA_CENTERS['area_01'];

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  const addLandmarkMarkers = (center: [number, number]) => {
    if (!map.current) return;
    clearMarkers();

    const [clon, clat] = center;
    const landmarks = [
      {
        lngLat: [clon - 0.0003, clat + 0.0004] as [number, number],
        title: 'Aarav Heights Tower',
        subtitle: '12 Floors • 39.0m MSL',
        badgeColor: 'bg-blue-600',
        id: 'BLD-01-01',
        entity_type: 'building',
      },
      {
        lngLat: [clon + 0.0007, clat + 0.0003] as [number, number],
        title: 'Civic Grand Mall',
        subtitle: '4 Levels • Leased Stores',
        badgeColor: 'bg-amber-600',
        id: 'BLD-01-03',
        entity_type: 'mall',
      },
      {
        lngLat: [clon + 0.0009, clat - 0.0007] as [number, number],
        title: '⚠️ Sharma Plaza',
        subtitle: '2 Illegal Floors (G+6)',
        badgeColor: 'bg-red-600 animate-pulse',
        id: 'BLD-01-07',
        entity_type: 'violation',
      },
      {
        lngLat: [clon, clat - 0.0001] as [number, number],
        title: '🌉 Elevated Flyover',
        subtitle: 'Deck Elevation: +8.5m',
        badgeColor: 'bg-orange-600',
        id: 'FLY-01-01',
        entity_type: 'flyover',
      },
      {
        lngLat: [clon - 0.0002, clat + 0.0011] as [number, number],
        title: '🚇 Metro Rail Tunnel',
        subtitle: 'Subterranean: -14.2m',
        badgeColor: 'bg-cyan-600',
        id: 'TNL-01-02',
        entity_type: 'tunnel',
      },
    ];

    landmarks.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'group cursor-pointer transform -translate-y-4 transition-transform hover:scale-110';
      el.innerHTML = `
        <div class="flex flex-col items-center">
          <div class="px-2 py-1 rounded-md text-[10px] font-bold text-white shadow-xl flex items-center space-x-1 ${item.badgeColor} border border-white/50 backdrop-blur-sm">
            <span>${item.title}</span>
          </div>
          <div class="text-[9px] font-semibold bg-slate-900/90 text-slate-200 px-1.5 py-0.5 rounded shadow mt-0.5 border border-slate-700 whitespace-nowrap">
            ${item.subtitle}
          </div>
          <div class="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-0.5"></div>
        </div>
      `;

      el.addEventListener('click', () => {
        if (onFeatureClick) {
          onFeatureClick({ id: item.id, name: item.title, entity_type: item.entity_type });
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(item.lngLat)
        .addTo(map.current!);
      markersRef.current.push(marker);
    });
  };

  const loadSceneData = async () => {
    if (!map.current) return;
    try {
      const response = await api.get(`/projects/proj-001/3d?area_id=${areaId}`);
      if (response.data && response.data.features && response.data.features.length > 0) {
        if (map.current.getSource('cadastre-3d-data')) {
          (map.current.getSource('cadastre-3d-data') as maplibregl.GeoJSONSource).setData(response.data);
        }
      }
    } catch (e) {
      // Data loaded gracefully
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
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            paint: {
              'raster-opacity': mapMode === 'underground' ? 0.12 : 0.85,
            },
          },
        ],
      },
      center: centerLngLat,
      zoom: 16.5,
      pitch: mapMode === '3d' || mapMode === 'hybrid' || mapMode === 'underground' ? 62 : 0,
      bearing: mapMode === 'underground' ? 38 : -25,
      antialias: true,
    });

    map.current.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.current.on('load', async () => {
      setMapLoaded(true);
      if (!map.current) return;

      // 1. Initial 3D Spatial GeoJSON Source
      let geojsonData: any = { type: 'FeatureCollection', features: [] };
      try {
        const response = await api.get(`/projects/proj-001/3d?area_id=${areaId}`);
        if (response.data && response.data.features) {
          geojsonData = response.data;
        }
      } catch (e) {}

      if (!map.current.getSource('cadastre-3d-data')) {
        map.current.addSource('cadastre-3d-data', {
          type: 'geojson',
          data: geojsonData,
        });

        // 2D Base Cadastral Parcels Layer
        map.current.addLayer({
          id: 'cadastre-parcels-fill',
          type: 'fill',
          source: 'cadastre-3d-data',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'entity_type'], 'violation'], '#fecaca',
              ['==', ['get', 'entity_type'], 'mall'], '#fef3c7',
              ['==', ['get', 'entity_type'], 'tunnel'], '#cffafe',
              '#e0f2fe'
            ],
            'fill-opacity': mapMode === 'underground' ? 0.05 : 0.25,
          },
        });

        // 2D Cadastral Boundary Lines
        map.current.addLayer({
          id: 'cadastre-parcels-line',
          type: 'line',
          source: 'cadastre-3d-data',
          paint: {
            'line-color': [
              'case',
              ['==', ['get', 'entity_type'], 'violation'], '#dc2626',
              ['==', ['get', 'entity_type'], 'mall'], '#d97706',
              ['==', ['get', 'entity_type'], 'tunnel'], '#0891b2',
              ['==', ['get', 'entity_type'], 'flyover'], '#ea580c',
              '#0284c7'
            ],
            'line-width': mapMode === 'underground' ? 1.5 : 2.0,
          },
        });

        // True 3D Volumetric Extrusion Layer (Buildings, Slabs, Deck, Tunnels)
        map.current.addLayer({
          id: 'cadastre-buildings-3d',
          type: 'fill-extrusion',
          source: 'cadastre-3d-data',
          paint: {
            'fill-extrusion-color': [
              'case',
              ['==', ['get', 'entity_type'], 'violation'], '#DC2626',
              ['==', ['get', 'entity_type'], 'tunnel'], '#06B6D4',
              ['==', ['get', 'entity_type'], 'flyover'], '#EA580C',
              ['==', ['get', 'entity_type'], 'mall'], '#F59E0B',
              ['coalesce', ['get', 'color'], '#2563EB'],
            ],
            'fill-extrusion-height': [
              'coalesce',
              ['get', 'height'],
              12.0,
            ],
            'fill-extrusion-base': [
              'coalesce',
              ['get', 'base_height'],
              0,
            ],
            'fill-extrusion-opacity': mapMode === 'underground' ? 0.96 : 0.88,
          },
        });

        if (interactive) {
          map.current.on('click', 'cadastre-buildings-3d', (e) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              if (onFeatureClick) {
                onFeatureClick(feature.properties);
              }
            }
          });

          map.current.on('click', 'cadastre-parcels-fill', (e) => {
            if (e.features && e.features.length > 0) {
              const feature = e.features[0];
              if (onFeatureClick) {
                onFeatureClick(feature.properties);
              }
            }
          });

          map.current.on('mouseenter', 'cadastre-buildings-3d', () => {
            if (map.current) map.current.getCanvas().style.cursor = 'pointer';
          });

          map.current.on('mouseleave', 'cadastre-buildings-3d', () => {
            if (map.current) map.current.getCanvas().style.cursor = '';
          });
        }

        addLandmarkMarkers(centerLngLat);
      }
    });

    return () => {
      clearMarkers();
      map.current?.remove();
      map.current = null;
    };
  }, [areaId]);

  // Handle Dynamic Area Center Updates
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.flyTo({
      center: centerLngLat,
      zoom: 16.5,
      pitch: mapMode === 'underground' ? 68 : 62,
      bearing: mapMode === 'underground' ? 38 : -25,
      duration: 1200
    });
    loadSceneData();
    addLandmarkMarkers(centerLngLat);
  }, [areaId, mapLoaded]);

  // Handle Mode Switching (2D / 3D / Underground / Hybrid)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (mapMode === '2d') {
      map.current.easeTo({ pitch: 0, bearing: 0, zoom: 16.0, duration: 1000 });
      setCurrentPitch(0);
      setCurrentBearing(0);
      if (map.current.getLayer('osm-tiles')) {
        map.current.setPaintProperty('osm-tiles', 'raster-opacity', 0.95);
      }
      if (map.current.getLayer('cadastre-buildings-3d')) {
        map.current.setLayoutProperty('cadastre-buildings-3d', 'visibility', 'none');
      }
      if (map.current.getLayer('cadastre-parcels-fill')) {
        map.current.setPaintProperty('cadastre-parcels-fill', 'fill-opacity', 0.40);
      }
    } else if (mapMode === '3d' || mapMode === 'hybrid') {
      map.current.easeTo({ pitch: 62, bearing: -25, zoom: 16.6, duration: 1200 });
      setCurrentPitch(62);
      setCurrentBearing(-25);
      if (map.current.getLayer('osm-tiles')) {
        map.current.setPaintProperty('osm-tiles', 'raster-opacity', mapMode === 'hybrid' ? 0.75 : 0.45);
      }
      if (map.current.getLayer('cadastre-buildings-3d')) {
        map.current.setLayoutProperty('cadastre-buildings-3d', 'visibility', 'visible');
        map.current.setPaintProperty('cadastre-buildings-3d', 'fill-extrusion-opacity', 0.88);
      }
    } else if (mapMode === 'underground') {
      map.current.easeTo({ pitch: 68, bearing: 38, zoom: 17.2, duration: 1200 });
      setCurrentPitch(68);
      setCurrentBearing(38);
      if (map.current.getLayer('osm-tiles')) {
        map.current.setPaintProperty('osm-tiles', 'raster-opacity', 0.12);
      }
      if (map.current.getLayer('cadastre-buildings-3d')) {
        map.current.setLayoutProperty('cadastre-buildings-3d', 'visibility', 'visible');
        map.current.setPaintProperty('cadastre-buildings-3d', 'fill-extrusion-opacity', 0.96);
      }
    }
  }, [mapMode, mapLoaded]);

  const rotateCamera = (deltaDegrees: number) => {
    if (!map.current) return;
    const newBearing = (map.current.getBearing() + deltaDegrees) % 360;
    map.current.easeTo({ bearing: newBearing, duration: 600 });
    setCurrentBearing(Math.round(newBearing));
  };

  const adjustPitch = (newPitch: number) => {
    if (!map.current) return;
    map.current.easeTo({ pitch: newPitch, duration: 600 });
    setCurrentPitch(newPitch);
  };

  const focusEntity = (type: 'tower' | 'mall' | 'violation' | 'tunnel' | 'flyover') => {
    if (!map.current) return;
    const [clon, clat] = centerLngLat;

    if (type === 'tower') {
      map.current.flyTo({ center: [clon - 0.0003, clat + 0.0004], zoom: 17.8, pitch: 65, bearing: -30, duration: 1400 });
      if (onFeatureClick) {
        onFeatureClick({ id: 'BLD-01-01', name: 'Aarav Heights Tower', entity_type: 'building' });
      }
    } else if (type === 'mall') {
      map.current.flyTo({ center: [clon + 0.0007, clat + 0.0003], zoom: 17.5, pitch: 60, bearing: -15, duration: 1400 });
      if (onFeatureClick) {
        onFeatureClick({ id: 'BLD-01-03', name: 'Civic Grand Mall', entity_type: 'mall' });
      }
    } else if (type === 'violation') {
      map.current.flyTo({ center: [clon + 0.0009, clat - 0.0007], zoom: 18.0, pitch: 68, bearing: 15, duration: 1400 });
      if (onFeatureClick) {
        onFeatureClick({ id: 'BLD-01-07', name: 'Sharma Commercial Plaza', entity_type: 'violation' });
      }
    } else if (type === 'tunnel') {
      map.current.flyTo({ center: [clon - 0.0002, clat + 0.0011], zoom: 17.4, pitch: 70, bearing: 45, duration: 1400 });
      if (onFeatureClick) {
        onFeatureClick({ id: 'TNL-01-02', name: 'Yellow Line Metro Rail Tunnel', entity_type: 'tunnel' });
      }
    } else if (type === 'flyover') {
      map.current.flyTo({ center: [clon, clat - 0.0001], zoom: 17.4, pitch: 60, bearing: -75, duration: 1400 });
      if (onFeatureClick) {
        onFeatureClick({ id: 'FLY-01-01', name: 'Elevated Bypass Flyover', entity_type: 'flyover' });
      }
    }
  };

  return (
    <div className="w-full h-full relative bg-slate-950">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating 3D HUD Camera & Perspective Controls */}
      <div className="absolute top-4 left-4 bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-slate-700/80 shadow-2xl z-10 flex flex-col space-y-2.5 text-white text-[11px] w-64">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span>3D Spatial HUD</span>
          <span className="font-mono text-amber-400">{currentPitch}° Pitch • {currentBearing}° Yaw</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => adjustPitch(65)}
            className={`px-2 py-1.5 rounded-lg text-center font-semibold transition-all ${
              currentPitch >= 60 ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            🏙️ 3D Isometric (65°)
          </button>
          <button
            onClick={() => adjustPitch(78)}
            className={`px-2 py-1.5 rounded-lg text-center font-semibold transition-all ${
              currentPitch >= 75 ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            🏢 Street Eye (78°)
          </button>
          <button
            onClick={() => adjustPitch(0)}
            className={`px-2 py-1.5 rounded-lg text-center font-semibold transition-all ${
              currentPitch === 0 ? 'bg-blue-600 text-white shadow' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            📐 2D Ortho (0°)
          </button>
          <button
            onClick={() => rotateCamera(45)}
            className="px-2 py-1.5 rounded-lg text-center bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
          >
            🔄 Orbit +45°
          </button>
        </div>

        <div className="pt-2 border-t border-slate-800 space-y-1.5">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Quick Fly-To Landmarks:</div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            <button
              onClick={() => focusEntity('tower')}
              className="px-1.5 py-1 rounded bg-blue-900/70 hover:bg-blue-800 text-blue-200 border border-blue-700 text-center font-bold"
            >
              Tower
            </button>
            <button
              onClick={() => focusEntity('mall')}
              className="px-1.5 py-1 rounded bg-amber-900/70 hover:bg-amber-800 text-amber-200 border border-amber-700 text-center font-bold"
            >
              Mall
            </button>
            <button
              onClick={() => focusEntity('violation')}
              className="px-1.5 py-1 rounded bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-700 text-center font-bold animate-pulse"
            >
              Violation
            </button>
            <button
              onClick={() => focusEntity('tunnel')}
              className="px-1.5 py-1 rounded bg-cyan-900/70 hover:bg-cyan-800 text-cyan-200 border border-cyan-700 text-center font-bold"
            >
              Tunnels
            </button>
            <button
              onClick={() => focusEntity('flyover')}
              className="px-1.5 py-1 rounded bg-orange-900/70 hover:bg-orange-800 text-orange-200 border border-orange-700 text-center font-bold col-span-2"
            >
              Elevated Flyover
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Map2D;

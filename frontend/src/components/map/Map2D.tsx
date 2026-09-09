import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useAppStore } from '../../stores/appStore';

interface Map2DProps {
  areaId?: string;
  onFeatureClick?: (feature: any) => void;
  onOpen3DViewer?: (feature: any) => void;
  selectedFeatureId?: string | null;
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

// Computes the exact GeoJSON feature and centroid from user-delineated polygon or default zone
const getActiveZoneData = (
  customPolygon: any | null,
  defaultCenter: [number, number],
  areaId: string
): { geojson: any; center: [number, number] } => {
  if (
    customPolygon &&
    customPolygon.coordinates &&
    customPolygon.coordinates[0] &&
    customPolygon.coordinates[0].length >= 3
  ) {
    const coords: [number, number][] = customPolygon.coordinates[0];
    let sumLng = 0;
    let sumLat = 0;
    const n =
      coords.length > 1 &&
      coords[0][0] === coords[coords.length - 1][0] &&
      coords[0][1] === coords[coords.length - 1][1]
        ? coords.length - 1
        : coords.length;

    for (let i = 0; i < n; i++) {
      sumLng += coords[i][0];
      sumLat += coords[i][1];
    }
    const computedCenter: [number, number] = [sumLng / n, sumLat / n];

    return {
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            id: `ZONE-3D-${areaId}`,
            properties: {
              id: `ZONE-${areaId}`,
              title: 'Ward 16 Delineated 3D Cadastral Survey Zone',
              description:
                'Surveyor-delineated boundary enclosing 3D high-rises, subterranean metro, flyover and utilities',
              has_3d: true,
            },
            geometry: customPolygon,
          },
        ],
      },
      center: computedCenter,
    };
  }

  // Pre-calibrated default boundary matching AreaSelectionPage
  const [lng, lat] = defaultCenter;
  const dLng = 0.0036;
  const dLat = 0.0026;
  const defaultCoords = [
    [lng - dLng * 0.95, lat - dLat * 0.85],
    [lng + dLng * 1.05, lat - dLat * 0.80],
    [lng + dLng * 1.0, lat + dLat * 0.90],
    [lng - dLng * 0.90, lat + dLat * 0.95],
    [lng - dLng * 0.95, lat - dLat * 0.85],
  ];

  return {
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          id: `ZONE-3D-${areaId}`,
          properties: {
            id: `ZONE-${areaId}`,
            title: 'Ward 16 Central Urban 3D Digital Twin Zone',
            description:
              'Comprehensive 3D Cadastre: Multi-story towers, underground metro, curved flyover, utilities & parking',
            has_3d: true,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [defaultCoords],
          },
        },
      ],
    },
    center: defaultCenter,
  };
};

export const Map2D: React.FC<Map2DProps> = ({
  areaId = 'area_01',
  onFeatureClick,
  onOpen3DViewer,
  interactive = true,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const { customSurveyPolygon } = useAppStore();

  const baseCenter = AREA_CENTERS[areaId] || AREA_CENTERS['area_01'];
  const activeZone = getActiveZoneData(customSurveyPolygon, baseCenter, areaId);

  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  // Add single clean central call-to-action on the 3D polygon area
  const addSingleCentralCallToAction = (center: [number, number]) => {
    if (!map.current) return;
    clearMarkers();

    const el = document.createElement('div');
    el.className = 'cursor-pointer transform -translate-y-6 select-none';
    el.innerHTML = `
      <div class="flex flex-col items-center group">
        <button class="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-2xl font-black text-xs shadow-2xl border-2 border-amber-300 flex items-center space-x-2 tracking-wide transform transition-transform group-hover:scale-110">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-950 animate-ping inline-block"></span>
          <span>CLICK TO OPEN 3D WORLD →</span>
        </button>
        <div class="w-3 h-3 bg-amber-500 rotate-45 -mt-1.5 border-r-2 border-b-2 border-amber-300"></div>
      </div>
    `;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onOpen3DViewer) onOpen3DViewer({ id: 'BLD-01-01', area_id: areaId });
      if (onFeatureClick) onFeatureClick({ id: 'BLD-01-01', area_id: areaId });
    });

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([center[0], center[1]])
      .addTo(map.current!);
    markersRef.current.push(marker);
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
              'raster-opacity': 0.88,
            },
          },
        ],
      },
      center: activeZone.center,
      zoom: 16.5,
      pitch: 0,
      bearing: 0,
      antialias: true,
      maxPitch: 0,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.current.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.current.on('load', () => {
      setMapLoaded(true);
      if (!map.current) return;

      if (!map.current.getSource('cadastre-single-3d-zone')) {
        map.current.addSource('cadastre-single-3d-zone', {
          type: 'geojson',
          data: activeZone.geojson as any,
        });

        // 1. Single unified 3D Area Fill (Light glowing cyan/blue)
        map.current.addLayer({
          id: 'single-3d-zone-fill',
          type: 'fill',
          source: 'cadastre-single-3d-zone',
          paint: {
            'fill-color': '#0284c7',
            'fill-opacity': 0.16,
          },
        });

        // 2. Single unified Outer Boundary Line (Clean bold orange highlight border)
        map.current.addLayer({
          id: 'single-3d-zone-line',
          type: 'line',
          source: 'cadastre-single-3d-zone',
          paint: {
            'line-color': '#ea580c',
            'line-width': 3.5,
            'line-opacity': 0.95,
          },
        });

        if (interactive) {
          map.current.on('click', 'single-3d-zone-fill', () => {
            if (onOpen3DViewer) onOpen3DViewer({ id: 'BLD-01-01', area_id: areaId });
            if (onFeatureClick) onFeatureClick({ id: 'BLD-01-01', area_id: areaId });
          });

          map.current.on('mouseenter', 'single-3d-zone-fill', () => {
            if (map.current) map.current.getCanvas().style.cursor = 'pointer';
          });

          map.current.on('mouseleave', 'single-3d-zone-fill', () => {
            if (map.current) map.current.getCanvas().style.cursor = '';
          });
        }

        addSingleCentralCallToAction(activeZone.center);
      }
    });

    return () => {
      clearMarkers();
      map.current?.remove();
      map.current = null;
    };
  }, [areaId]);

  // Handle Dynamic Area or Custom Polygon Updates
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    map.current.flyTo({
      center: activeZone.center,
      zoom: 16.5,
      pitch: 0,
      bearing: 0,
      duration: 1000,
    });

    if (map.current.getSource('cadastre-single-3d-zone')) {
      (map.current.getSource('cadastre-single-3d-zone') as maplibregl.GeoJSONSource).setData(
        activeZone.geojson as any
      );
    }
    addSingleCentralCallToAction(activeZone.center);
  }, [areaId, customSurveyPolygon, mapLoaded]);

  return (
    <div className="w-full h-full relative bg-slate-100">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
};

export default Map2D;



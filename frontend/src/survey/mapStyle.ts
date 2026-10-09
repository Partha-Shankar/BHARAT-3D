import type maplibregl from 'maplibre-gl';

/** Esri satellite with place labels, plus an OpenStreetMap base that can be switched on. */
export const SATELLITE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    sat: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    labels: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
    },
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm', layout: { visibility: 'none' } },
    { id: 'sat', type: 'raster', source: 'sat' },
    { id: 'labels', type: 'raster', source: 'labels' },
  ],
};

export const setBaseLayer = (m: maplibregl.Map, base: 'sat' | 'osm') => {
  if (!m.isStyleLoaded()) return;
  m.setLayoutProperty('osm', 'visibility', base === 'osm' ? 'visible' : 'none');
  m.setLayoutProperty('sat', 'visibility', base === 'sat' ? 'visible' : 'none');
  m.setLayoutProperty('labels', 'visibility', base === 'sat' ? 'visible' : 'none');
};

type LngLat = [number, number];

/** A square of `sizeM` metres centred on a point, as a closed lon/lat ring. */
export function squareAround([lon, lat]: LngLat, sizeM: number): LngLat[] {
  const dx = sizeM / 2 / (111320 * Math.cos((lat * Math.PI) / 180));
  const dy = sizeM / 2 / 110540;
  const r = (v: number) => +v.toFixed(7);
  return [
    [r(lon - dx), r(lat - dy)], [r(lon + dx), r(lat - dy)], [r(lon + dx), r(lat + dy)], [r(lon - dx), r(lat + dy)], [r(lon - dx), r(lat - dy)],
  ];
}

/** GeoJSON features for generated areas (outline + centre point). */
export function areasGeoJSON(areas: { key: string; survey_polygon: LngLat[]; label: string; origin: { lon: number; lat: number } }[]) {
  return {
    polys: {
      type: 'FeatureCollection' as const,
      features: areas.filter((a) => a.survey_polygon?.length > 2).map((a) => ({
        type: 'Feature' as const, id: undefined, properties: { key: a.key, label: a.label },
        geometry: { type: 'Polygon' as const, coordinates: [a.survey_polygon] },
      })),
    },
    points: {
      type: 'FeatureCollection' as const,
      features: areas.map((a) => ({
        type: 'Feature' as const, properties: { key: a.key, label: a.label },
        geometry: { type: 'Point' as const, coordinates: [a.origin.lon, a.origin.lat] },
      })),
    },
  };
}

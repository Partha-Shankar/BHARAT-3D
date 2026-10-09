import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { SATELLITE_STYLE } from './mapStyle';

/** A small, still satellite view of a survey polygon. */
export const PolygonPreview: React.FC<{ polygon: GeoJSON.Polygon; className?: string }> = ({ polygon, className = '' }) => {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    const ring = polygon.coordinates[0] as [number, number][];
    const bounds = ring.reduce((b, p) => b.extend(p), new maplibregl.LngLatBounds(ring[0], ring[0]));
    const m = new maplibregl.Map({
      container: host.current, style: SATELLITE_STYLE, bounds, fitBoundsOptions: { padding: 28 },
      interactive: false, attributionControl: false,
    });
    m.on('load', () => {
      m.addSource('p', { type: 'geojson', data: { type: 'Feature', geometry: polygon, properties: {} } });
      m.addLayer({ id: 'pf', type: 'fill', source: 'p', paint: { 'fill-color': '#1f7a72', 'fill-opacity': 0.22 } });
      m.addLayer({ id: 'pl', type: 'line', source: 'p', paint: { 'line-color': '#fff6df', 'line-width': 2.2 } });
      // a slow drift so the preview feels alive
      m.easeTo({ zoom: m.getZoom() + 0.35, duration: 9000, easing: (t) => t * (2 - t) });
    });
    return () => m.remove();
  }, [polygon]);
  return <div ref={host} className={`overflow-hidden ${className}`} />;
};

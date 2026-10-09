import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useUpdateProjectArea } from '../../hooks/useProjects';
import { useAppStore } from '../../stores/appStore';
import { ringAreaM2, MAX_AREA_M2, MIN_AREA_M2, INDIA_BOUNDS, DRAW_MIN_ZOOM, DRAW_MAX_ZOOM, isInIndia } from '../../world/api';
import {
  ArrowRight, Box, Hexagon, Loader2, Map as MapIcon, MousePointerClick, Satellite, Search, Square, Trash2, AlertTriangle, ZoomIn, FolderOpen, X,
} from 'lucide-react';
import { SATELLITE_STYLE, setBaseLayer, squareAround, areasGeoJSON } from '../../survey/mapStyle';
import { useSurveyDraft, reversePlace } from '../../survey/draft';
import { SurveySteps } from '../../survey/Steps';
import { useScenes, placeOf } from '../../survey/ui';
import { Segmented } from '../../world/ui';

type Mode = 'click' | 'box' | 'polygon';
type LngLat = [number, number];

const SIZES = [
  { m: 220, label: 'S · 220 m' },
  { m: 340, label: 'M · 340 m' },
  { m: 480, label: 'L · 480 m' },
];

const closeRing = (pts: LngLat[]): LngLat[] =>
  pts.length && (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1]) ? [...pts, pts[0]] : pts;

export const AreaSelectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project_id') || 'proj-001';
  const updateArea = useUpdateProjectArea(projectId);
  const { setCustomSurveyPolygon } = useAppStore();
  const startDraft = useSurveyDraft((s) => s.start);
  const setDraftPlace = useSurveyDraft((s) => s.setPlace);
  const { data: scenes } = useScenes();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const modeRef = useRef<Mode>('click');
  const sizeRef = useRef(340);
  const draftRef = useRef<LngLat[]>([]);
  const doneRef = useRef(false);
  const boxStartRef = useRef<LngLat | null>(null);
  const ignoreHitsRef = useRef(false); // set by "Draw anyway"

  const [mode, setMode] = useState<Mode>('click');
  const [size, setSize] = useState(340);
  const [ring, setRing] = useState<LngLat[] | null>(null);
  const [areaM2, setAreaM2] = useState<number | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [baseLayer, setBase] = useState<'sat' | 'osm'>('sat');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(4.6);
  const [hitArea, setHitArea] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const zoomOk = zoom >= DRAW_MIN_ZOOM && zoom <= DRAW_MAX_ZOOM;
  const zoomOkRef = useRef(false);
  zoomOkRef.current = zoomOk;

  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  const render = (pts: LngLat[], closed: boolean) => {
    const m = map.current;
    if (!m || !m.getSource('draw')) return;
    const features: GeoJSON.Feature[] = [];
    if (pts.length >= 3 && closed) {
      features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [closeRing(pts)] }, properties: {} });
    } else if (pts.length >= 2) {
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} });
    }
    pts.forEach((p) => features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: {} }));
    (m.getSource('draw') as maplibregl.GeoJSONSource).setData({ type: 'FeatureCollection', features });
  };

  const finish = (pts: LngLat[]) => {
    if (pts.length < 3) return;
    doneRef.current = true;
    const closed = closeRing(pts);
    setRing(closed);
    const a = ringAreaM2(closed.slice(0, -1));
    setAreaM2(a);
    setError(a > MAX_AREA_M2 ? `Area is ${(a / 1e6).toFixed(2)} km² — keep it under ${(MAX_AREA_M2 / 1e6).toFixed(1)} km² so the 3D model builds quickly.`
      : a < MIN_AREA_M2 ? `Area is ${Math.round(a)} m² — draw at least ${MIN_AREA_M2.toLocaleString()} m².` : null);
    render(pts, true);
    const c = closed.slice(0, -1);
    setPlace(null);
    reversePlace(c.reduce((s, p) => s + p[0], 0) / c.length, c.reduce((s, p) => s + p[1], 0) / c.length).then((p) => setPlace(p ?? ''));
    const bounds = c.reduce((b, p) => b.extend(p as any), new maplibregl.LngLatBounds(c[0] as any, c[0] as any));
    map.current?.fitBounds(bounds, { padding: { top: 120, bottom: 120, left: 380, right: 120 }, duration: 900, maxZoom: Math.max(map.current.getZoom(), 16) });
  };

  const clear = () => {
    draftRef.current = [];
    boxStartRef.current = null;
    doneRef.current = false;
    setRing(null);
    setAreaM2(null);
    setPlace(null);
    setError(null);
    render([], false);
  };

  useEffect(() => {
    if (map.current || !mapContainer.current) return;
    const start = lat && lon ? { center: [+lon, +lat] as LngLat, zoom: 16.2 } : { center: [79.5, 22.5] as LngLat, zoom: 4.6 };
    const m = new maplibregl.Map({
      container: mapContainer.current,
      style: SATELLITE_STYLE,
      center: start.center,
      zoom: start.zoom,
      minZoom: 4,
      maxZoom: 19.5,
      maxBounds: INDIA_BOUNDS,
      dragRotate: false,
      pitchWithRotate: false,
      doubleClickZoom: false,
    });
    map.current = m;
    setZoom(start.zoom);
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    m.on('zoom', () => setZoom(m.getZoom()));

    m.on('load', () => {
      m.addSource('areas', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas', paint: { 'fill-color': '#c8962e', 'fill-opacity': 0.16 } });
      m.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': '#f2c46a', 'line-width': 1.6, 'line-dasharray': [3, 2] } });
      m.addSource('draw', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'draw-fill', type: 'fill', source: 'draw', filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': '#1f7a72', 'fill-opacity': 0.24 } });
      m.addLayer({ id: 'draw-line', type: 'line', source: 'draw', filter: ['!=', '$type', 'Point'],
        paint: { 'line-color': '#fff6df', 'line-width': 2.5 } });
      m.addLayer({ id: 'draw-pts', type: 'circle', source: 'draw', filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#fff6df', 'circle-stroke-width': 2, 'circle-stroke-color': '#1f7a72' } });
      setMapReady(true);
    });

    const ll = (e: maplibregl.MapMouseEvent): LngLat => [+e.lngLat.lng.toFixed(7), +e.lngLat.lat.toFixed(7)];
    const boxFrom = (a: LngLat, b: LngLat): LngLat[] => [
      [Math.min(a[0], b[0]), Math.min(a[1], b[1])], [Math.max(a[0], b[0]), Math.min(a[1], b[1])],
      [Math.max(a[0], b[0]), Math.max(a[1], b[1])], [Math.min(a[0], b[0]), Math.max(a[1], b[1])],
    ];

    m.on('mousemove', (e) => {
      const overArea = m.getLayer('areas-fill') && m.queryRenderedFeatures(e.point, { layers: ['areas-fill'] }).length > 0;
      if (doneRef.current) {
        m.getCanvas().style.cursor = overArea ? 'pointer' : '';
        return;
      }
      m.getCanvas().style.cursor = 'crosshair';
      if (modeRef.current === 'click' && zoomOkRef.current) {
        render(squareAround(ll(e), sizeRef.current).slice(0, -1), true); // preview follows the cursor
      } else if (modeRef.current === 'box' && boxStartRef.current) {
        render(boxFrom(boxStartRef.current, ll(e)), true);
      } else if (modeRef.current === 'polygon' && draftRef.current.length) {
        render([...draftRef.current, ll(e)], false);
      }
    });
    m.on('mouseout', () => {
      if (!doneRef.current && modeRef.current === 'click') render([], false);
    });
    m.on('click', (e) => {
      const idle = !boxStartRef.current && !draftRef.current.length;
      if (idle && (doneRef.current || !ignoreHitsRef.current) && m.getLayer('areas-fill')) {
        const hit = m.queryRenderedFeatures(e.point, { layers: ['areas-fill'] })[0];
        if (hit) {
          setHitArea(String(hit.properties?.key));
          return;
        }
      }
      if (doneRef.current) return;
      if (!zoomOkRef.current) {
        setError(`Zoom in to level ${DRAW_MIN_ZOOM}–${DRAW_MAX_ZOOM} to draw (street level), so the survey area is small enough to model in detail.`);
        return;
      }
      setError(null);
      setHitArea(null);
      const p = ll(e);
      if (modeRef.current === 'click') {
        finish(squareAround(p, sizeRef.current).slice(0, -1));
        return;
      }
      if (modeRef.current === 'box') {
        if (!boxStartRef.current) {
          boxStartRef.current = p; // first corner; dragging still pans the map
          render([p], false);
          return;
        }
        const pts = boxFrom(boxStartRef.current, p);
        boxStartRef.current = null;
        finish(pts);
        return;
      }
      const d = draftRef.current;
      if (d.length >= 3) {
        const first = m.project(d[0] as any);
        const here = m.project(p as any);
        if (Math.hypot(first.x - here.x, first.y - here.y) < 12) {
          finish(d);
          return;
        }
      }
      draftRef.current = [...d, p];
      render(draftRef.current, false);
    });
    m.on('dblclick', (e) => {
      if (modeRef.current !== 'polygon' || doneRef.current) return;
      e.preventDefault();
      finish(draftRef.current);
    });

    return () => {
      m.remove();
      map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // generated areas on the map, so the surveyor sees what already exists
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady || !scenes) return;
    const { polys } = areasGeoJSON(scenes.map((s) => ({ key: s.key, survey_polygon: s.survey_polygon, label: placeOf(s), origin: s.origin })));
    (m.getSource('areas') as maplibregl.GeoJSONSource | undefined)?.setData(polys as any);
  }, [scenes, mapReady]);

  useEffect(() => {
    modeRef.current = mode;
    clear();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sizeRef.current = size;
  }, [size]);

  useEffect(() => {
    if (map.current) setBaseLayer(map.current, baseLayer);
  }, [baseLayer]);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`);
      const hits = await r.json();
      if (hits[0]) {
        map.current?.flyTo({ center: [+hits[0].lon, +hits[0].lat], zoom: 16.5, duration: 2200, curve: 1.5, essential: true });
        setError(null);
      } else {
        setError(`No place found for “${query}”.`);
      }
    } catch {
      setError('Place search is unavailable right now — pan the map manually.');
    } finally {
      setSearching(false);
    }
  };

  const confirm = async () => {
    if (!ring || error) return;
    const polygon: GeoJSON.Polygon = { type: 'Polygon', coordinates: [ring] };
    setSubmitting(true);
    setError(null);
    const cx = ring.slice(0, -1).reduce((a, p) => a + p[0], 0) / (ring.length - 1);
    const cy = ring.slice(0, -1).reduce((a, p) => a + p[1], 0) / (ring.length - 1);
    if ((await isInIndia(cx, cy)) === false) {
      setError('This area is outside India. BHARAT 3D generates only inside India.');
      setSubmitting(false);
      return;
    }
    setCustomSurveyPolygon(polygon);
    startDraft(polygon, areaM2 ?? 0, place || undefined);
    if (!place) reversePlace(cx, cy).then((p) => p && setDraftPlace(p));
    updateArea.mutateAsync(polygon).catch(() => undefined); // records the polygon on the project; not needed to continue
    navigate(`/surveyor/upload?project_id=${projectId}`);
  };

  const hit = hitArea ? scenes?.find((s) => s.key === hitArea) : null;
  const help: Record<Mode, string> = {
    click: 'Click anywhere on the map to drop a survey square of the chosen size. The preview follows your cursor.',
    box: 'Click one corner, then click the opposite corner. Drag to pan, scroll to zoom.',
    polygon: 'Click to add corners. Double-click, or click the first corner, to close the polygon.',
  };

  return (
    <div className="flex-1 min-h-0 h-screen flex flex-col bg-[#f3efe6] b3-app">
      <div className="bg-[#f7f4ed] border-b border-[#e4dccf] px-6 py-3 flex items-center justify-between gap-4 z-10 flex-wrap">
        <div className="min-w-0 b3-rise">
          <h1 className="b3-serif text-xl text-[#1b3344]">New survey · select the area</h1>
          <SurveySteps current={1} className="mt-1.5" />
        </div>
        <form onSubmit={search} className="flex items-center gap-2 flex-1 max-w-md b3-rise b3-d1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#7d8c97] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a place (e.g. MG Road, Bengaluru)" className="b3-input !pl-8" />
          </div>
          <button type="submit" className="b3-btn" disabled={searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
          </button>
          <button type="button" onClick={() => navigate('/surveyor/projects')} className="b3-btn shrink-0" title="Survey register">
            <FolderOpen className="w-4 h-4" />
          </button>
        </form>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div ref={mapContainer} className="w-full h-full" />

        <div className="absolute top-4 left-4 z-10 b3-panel p-4 w-[340px] space-y-3 b3-slide-l b3-d2">
          <Segmented<Mode> value={mode} onChange={setMode} className="w-full [&>button]:flex-1" options={[
            { value: 'click', label: <><MousePointerClick className="w-3.5 h-3.5" /> Click a spot</> },
            { value: 'box', label: <><Square className="w-3.5 h-3.5" /> Rectangle</> },
            { value: 'polygon', label: <><Hexagon className="w-3.5 h-3.5" /> Polygon</> },
          ]} />
          {mode === 'click' && (
            <div className="b3-fade">
              <Segmented value={String(size)} onChange={(v) => setSize(+v)} className="w-full [&>button]:flex-1"
                options={SIZES.map((s) => ({ value: String(s.m), label: s.label }))} />
            </div>
          )}
          <div className={`flex items-center gap-2 text-[11px] rounded-lg px-2 py-1.5 border transition-colors duration-500 ${zoomOk ? 'bg-[#1f7a72]/8 border-[#1f7a72]/25 text-[#1d6a52]' : 'bg-[#c8962e]/10 border-[#c8962e]/35 text-[#8a5a12]'}`}>
            <ZoomIn className="w-3.5 h-3.5 shrink-0" />
            <span>Zoom <b className="font-mono">{zoom.toFixed(1)}</b> · drawing at {DRAW_MIN_ZOOM}–{DRAW_MAX_ZOOM}{zoomOk ? '' : ' — zoom in or search a place'}</span>
          </div>
          <p className="text-[11.5px] text-[#33495a] leading-relaxed" key={mode}>{help[mode]}</p>
          <p className="text-[11px] text-[#7d8c97]">India only · {(MIN_AREA_M2).toLocaleString()} m² to {(MAX_AREA_M2 / 1e6).toFixed(1)} km² · <span className="text-[#8a5a12]">gold outlines</span> are areas already generated</p>

          {ring && areaM2 !== null && (
            <div className="text-xs space-y-1.5 border-t border-[#e4dccf] pt-2.5 b3-expand">
              <div className="flex justify-between gap-2"><span className="text-[#5c6e7c]">Place</span>
                <span className="text-right font-semibold truncate">{place === null ? <span className="b3-skel inline-block w-28 h-3.5 align-middle" /> : place || 'Unnamed locality'}</span></div>
              <div className="flex justify-between"><span className="text-[#5c6e7c]">Area</span>
                <strong className="b3-num text-[#1f7a72]">{(areaM2 / 1e6).toFixed(3)} km² · {Math.round(areaM2).toLocaleString()} m²</strong></div>
              <div className="flex justify-between"><span className="text-[#5c6e7c]">Corners</span><span className="font-mono">{ring.length - 1}</span></div>
              <div className="flex justify-between"><span className="text-[#5c6e7c]">CRS</span><span className="font-mono">EPSG:4326</span></div>
            </div>
          )}

          {error && (
            <div className="flex gap-2 text-[11px] text-[#c0392b] bg-[#c0392b]/5 border border-[#c0392b]/25 rounded-lg p-2 b3-pop">
              <AlertTriangle className="w-4 h-4 shrink-0" /> <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2">
            {ring && (
              <button onClick={clear} className="b3-btn b3-btn-danger b3-pop" title="Clear and redraw">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button className="flex-1 b3-btn b3-btn-teal !py-2" disabled={!ring || !!error || submitting} onClick={confirm}>
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking the area…</> : <>Continue to data ingestion <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        </div>

        {hit && (
          <div className="absolute top-4 right-14 z-10 b3-panel p-4 w-72 b3-pop">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="b3-eyebrow">Already surveyed</div>
                <div className="b3-serif text-lg leading-tight mt-0.5">{placeOf(hit)}</div>
              </div>
              <button onClick={() => setHitArea(null)} className="p-0.5 text-[#5c6e7c] hover:text-[#1b3344]"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-[11.5px] text-[#5c6e7c] mt-1">{hit.buildings} buildings · {hit.vprids_reserved.toLocaleString('en-IN')} 3D ULPINs · {hit.violations} findings</p>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 b3-btn b3-btn-primary" onClick={() => navigate(`/3d-world/${hit.key}`)}><Box className="w-4 h-4" /> Open 3D</button>
              <button className="b3-btn" onClick={() => { ignoreHitsRef.current = true; setHitArea(null); }}>Draw anyway</button>
            </div>
          </div>
        )}

        <div className="absolute bottom-8 right-4 z-10 b3-panel p-1 b3-rise b3-d3">
          <Segmented<'sat' | 'osm'> value={baseLayer} onChange={setBase} className="!bg-transparent" options={[
            { value: 'sat', label: <><Satellite className="w-3.5 h-3.5" /> Satellite</> },
            { value: 'osm', label: <><MapIcon className="w-3.5 h-3.5" /> Map</> },
          ]} />
        </div>
      </div>
    </div>
  );
};

export default AreaSelectionPage;

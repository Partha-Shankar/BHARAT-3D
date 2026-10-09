import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowRight, Box, Fingerprint, Loader2, Map as MapIcon, MapPinned, Pencil, Pickaxe, Satellite, Search, ShieldAlert, X, Crosshair,
} from 'lucide-react';
import { INDIA_BOUNDS, DRAW_MIN_ZOOM, MAX_AREA_M2, MIN_AREA_M2, ringAreaM2, isInIndia } from '../../world/api';
import type { SceneMeta } from '../../world/sceneSpec';
import { SATELLITE_STYLE, setBaseLayer, squareAround, areasGeoJSON } from '../../survey/mapStyle';
import { useSurveyDraft, reversePlace } from '../../survey/draft';
import { AreaThumb, fmtAgo, placeOf, useCanEdit, useRoleBase, useScenes } from '../../survey/ui';
import { Segmented } from '../../world/ui';
import { useAuthStore } from '../../stores/authStore';

type LngLat = [number, number];
const MARKER_MAX_ZOOM = 13.2;

/** Survey atlas: every generated area on one India map; click an area to open it, or click anywhere to survey it. */
export const MapPage: React.FC = () => {
  const navigate = useNavigate();
  const base = useRoleBase();
  const canEdit = useCanEdit();
  const { user } = useAuthStore();
  const isUtility = String(user?.role) === 'UTILITY_OPERATOR';
  const { data: scenes } = useScenes();
  const startDraft = useSurveyDraft((s) => s.start);

  const host = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const fitted = useRef(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(4.6);
  const [sel, setSel] = useState<string | null>(null);
  const [spot, setSpot] = useState<LngLat | null>(null);
  const [spotSize, setSpotSize] = useState(340);
  const [spotPlace, setSpotPlace] = useState<string | null>(null);
  const [spotBusy, setSpotBusy] = useState(false);
  const [spotErr, setSpotErr] = useState<string | null>(null);
  const [base_, setBase] = useState<'sat' | 'osm'>('sat');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filter, setFilter] = useState('');

  const selected = useMemo(() => scenes?.find((s) => s.key === sel) ?? null, [scenes, sel]);
  const listed = useMemo(() => (scenes ?? []).filter((s) => !filter || placeOf(s).toLowerCase().includes(filter.toLowerCase())), [scenes, filter]);

  const flyToArea = (m: SceneMeta) => {
    const ring = m.survey_polygon;
    const b = ring.reduce((acc, p) => acc.extend(p as LngLat), new maplibregl.LngLatBounds(ring[0] as LngLat, ring[0] as LngLat));
    map.current?.fitBounds(b, { padding: { top: 80, bottom: 80, left: 380, right: 420 }, duration: 2000, maxZoom: 16.6, essential: true });
  };

  useEffect(() => {
    if (map.current || !host.current) return;
    const m = new maplibregl.Map({
      container: host.current, style: SATELLITE_STYLE, center: [79.5, 22.5], zoom: 4.6, minZoom: 4, maxZoom: 19.5,
      maxBounds: INDIA_BOUNDS, dragRotate: false, pitchWithRotate: false,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    m.on('zoom', () => setZoom(m.getZoom()));
    m.on('load', () => {
      m.addSource('areas', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'areas-fill', type: 'fill', source: 'areas',
        paint: { 'fill-color': '#1f7a72', 'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.38, 0.2] } });
      m.addLayer({ id: 'areas-line', type: 'line', source: 'areas', paint: { 'line-color': '#fff6df', 'line-width': 2 } });
      m.addSource('spot', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      m.addLayer({ id: 'spot-fill', type: 'fill', source: 'spot', paint: { 'fill-color': '#c8962e', 'fill-opacity': 0.25 } });
      m.addLayer({ id: 'spot-line', type: 'line', source: 'spot', paint: { 'line-color': '#f2c46a', 'line-width': 2.2, 'line-dasharray': [2, 1.5] } });
      setReady(true);
    });
    let hovered: string | number | undefined;
    m.on('mousemove', 'areas-fill', (e) => {
      m.getCanvas().style.cursor = 'pointer';
      const id = e.features?.[0]?.id;
      if (hovered !== undefined) m.setFeatureState({ source: 'areas', id: hovered }, { hover: false });
      hovered = id;
      if (id !== undefined) m.setFeatureState({ source: 'areas', id }, { hover: true });
    });
    m.on('mouseleave', 'areas-fill', () => {
      m.getCanvas().style.cursor = '';
      if (hovered !== undefined) m.setFeatureState({ source: 'areas', id: hovered }, { hover: false });
      hovered = undefined;
    });
    m.on('click', (e) => {
      const hit = m.getLayer('areas-fill') ? m.queryRenderedFeatures(e.point, { layers: ['areas-fill'] })[0] : undefined;
      if (hit) {
        setSpot(null);
        setSel(String(hit.properties?.key));
        return;
      }
      setSel(null);
      if (m.getZoom() < DRAW_MIN_ZOOM) {
        // anywhere on the map: fly in towards street level
        m.flyTo({ center: e.lngLat, zoom: Math.min(DRAW_MIN_ZOOM + 0.6, m.getZoom() + 4.5), duration: 1500, essential: true });
        return;
      }
      setSpot([+e.lngLat.lng.toFixed(7), +e.lngLat.lat.toFixed(7)]);
    });
    return () => {
      markers.current.forEach((mk) => mk.remove());
      m.remove();
      map.current = null;
    };
  }, []);

  // areas → polygons + pulsing markers; fit to them the first time
  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !scenes) return;
    const { polys } = areasGeoJSON(scenes.map((s) => ({ key: s.key, survey_polygon: s.survey_polygon, label: placeOf(s), origin: s.origin })));
    polys.features.forEach((f, i) => { (f as any).id = i + 1; });
    (m.getSource('areas') as maplibregl.GeoJSONSource).setData(polys as any);
    markers.current.forEach((mk) => mk.remove());
    markers.current = scenes.map((s, i) => {
      // MapLibre positions the outer element with a transform, so all motion lives on the inner one
      const el = document.createElement('div');
      el.className = 'b3-atlas-anchor';
      el.innerHTML = `<button class="b3-atlas-marker" style="animation-delay:${0.2 + i * 0.05}s"><span class="b3-atlas-dot b3-pulse"></span><span class="b3-atlas-label">${placeOf(s).replace(/</g, '&lt;')}<em>${s.buildings} bldg · ${s.vprids_reserved.toLocaleString('en-IN')} 3D ULPINs</em></span></button>`;
      ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick'].forEach((t) => el.addEventListener(t, (ev) => ev.stopPropagation()));
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        setSpot(null);
        setSel(s.key);
        flyToArea(s);
      });
      return new maplibregl.Marker({ element: el, anchor: 'left', offset: [-9, 0] }).setLngLat([s.origin.lon, s.origin.lat]).addTo(m);
    });
    if (!fitted.current && scenes.length) {
      fitted.current = true;
      const b = scenes.reduce((acc, s) => acc.extend([s.origin.lon, s.origin.lat]), new maplibregl.LngLatBounds([scenes[0].origin.lon, scenes[0].origin.lat], [scenes[0].origin.lon, scenes[0].origin.lat]));
      m.fitBounds(b, { padding: { top: 120, bottom: 120, left: 420, right: 160 }, maxZoom: 11, duration: 2400, essential: true });
    }
  }, [scenes, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // markers give way to outlines at street level
  useEffect(() => {
    markers.current.forEach((mk) => mk.getElement().firstElementChild?.classList.toggle('is-hidden', zoom > MARKER_MAX_ZOOM));
  }, [zoom, scenes]);

  // the survey square for a clicked spot
  const spotRing = spot ? squareAround(spot, spotSize) : null;
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;
    (m.getSource('spot') as maplibregl.GeoJSONSource).setData(spotRing
      ? { type: 'Feature', geometry: { type: 'Polygon', coordinates: [spotRing] }, properties: {} }
      : { type: 'FeatureCollection', features: [] });
    setSpotErr(null);
    if (spot) {
      setSpotPlace(null);
      reversePlace(spot[0], spot[1]).then((p) => setSpotPlace(p ?? ''));
    }
  }, [spot, spotSize, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (map.current) setBaseLayer(map.current, base_); }, [base_]);

  const surveySpot = async () => {
    if (!spot || !spotRing) return;
    setSpotBusy(true);
    const a = ringAreaM2(spotRing.slice(0, -1));
    if (a < MIN_AREA_M2 || a > MAX_AREA_M2) { setSpotErr('Choose another size.'); setSpotBusy(false); return; }
    if ((await isInIndia(spot[0], spot[1])) === false) {
      setSpotErr('This spot is outside India. BHARAT 3D surveys only inside India.');
      setSpotBusy(false);
      return;
    }
    startDraft({ type: 'Polygon', coordinates: [spotRing] }, a, spotPlace || undefined);
    navigate('/surveyor/upload');
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`);
      const hits = await r.json();
      if (hits[0]) map.current?.flyTo({ center: [+hits[0].lon, +hits[0].lat], zoom: 16.3, duration: 2400, curve: 1.5, essential: true });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 h-screen relative b3-app">
      <div ref={host} className="absolute inset-0" />

      {/* left: atlas panel */}
      <div className="absolute top-4 left-4 bottom-4 z-10 w-[340px] flex flex-col gap-3 pointer-events-none">
        <div className="b3-panel p-4 pointer-events-auto b3-slide-l">
          <div className="b3-eyebrow">Survey atlas</div>
          <h1 className="b3-serif text-2xl text-[#1b3344] leading-tight mt-1">Every surveyed area in India</h1>
          <p className="text-[12px] text-[#5c6e7c] mt-1.5 leading-relaxed">
            Click an area to open its 3D record. {canEdit ? 'Click anywhere else to fly in; at street level, click to survey that spot.' : 'Click anywhere to fly in.'}
          </p>
          <form onSubmit={search} className="flex gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#7d8c97] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Go to a place in India" className="b3-input !pl-8" />
            </div>
            <button className="b3-btn" disabled={searching}>{searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}</button>
          </form>
        </div>

        <div className="b3-panel p-2 pointer-events-auto flex-1 min-h-0 flex flex-col b3-slide-l b3-d2">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[#5c6e7c]">{scenes ? `${scenes.length} areas` : 'Loading areas…'}</span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter" className="b3-input !w-28 !py-1 !text-[11.5px]" />
          </div>
          <div className="overflow-y-auto b3-scroll space-y-0.5 b3-stagger pr-1">
            {!scenes && [0, 1, 2, 3].map((i) => <div key={i} className="b3-skel h-12 m-1" />)}
            {listed.map((s) => (
              <button key={s.key} onClick={() => { setSpot(null); setSel(s.key); flyToArea(s); }}
                className={`b3-list-item flex items-center gap-2.5 ${sel === s.key ? '!bg-white !border-[#1f7a72]/40' : ''}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${s.violations ? 'bg-[#c0392b]' : 'bg-[#1f7a72]'}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-[#1b3344] truncate">{placeOf(s)}</span>
                  <span className="block text-[10.5px] text-[#7d8c97] b3-num">{s.buildings} bldg · {s.vprids_reserved.toLocaleString('en-IN')} VPRIDs · {s.violations} findings</span>
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-[#9aa6ae]" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* right: selected area */}
      {selected && (
        <aside key={selected.key} className="absolute top-4 right-14 z-10 w-[360px] b3-panel overflow-hidden b3-drawer">
          <div className="relative">
            <AreaThumb meta={selected} className="h-40" />
            <button onClick={() => setSel(null)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[#1b3344]/60 text-white flex items-center justify-center hover:bg-[#1b3344]/80 transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <div className="b3-serif text-xl leading-tight">{placeOf(selected)}</div>
              <div className="text-[11px] text-[#7d8c97] font-mono">{selected.place.state ?? ''} · {(selected.area_m2 / 1e6).toFixed(3)} km² · updated {fmtAgo(selected.updated_at)}</div>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {([['Buildings', selected.buildings], ['3D ULPINs', selected.vprids_reserved], ['Subsurface', selected.subsurface_assets], ['Findings', selected.violations]] as [string, number][]).map(([k, v]) => (
                <div key={k} className="b3-well py-1.5">
                  <div className="font-bold b3-num text-[14px]">{(v ?? 0).toLocaleString('en-IN')}</div>
                  <div className="text-[9.5px] text-[#5c6e7c] uppercase tracking-wider">{k}</div>
                </div>
              ))}
            </div>
            <button className="w-full b3-btn b3-btn-primary !py-2.5" onClick={() => navigate(`/3d-world/${selected.key}`)}><Box className="w-4 h-4" /> Open in 3D <ArrowRight className="w-4 h-4" /></button>
            <div className="grid grid-cols-2 gap-1.5">
              {canEdit && <button className="b3-btn b3-btn-gold" onClick={() => navigate(`/3d-editor/${selected.key}`)}><Pencil className="w-4 h-4" /> Edit</button>}
              {isUtility && <button className="b3-btn" onClick={() => navigate(`/3d-world/${selected.key}?dig=1`)}><Pickaxe className="w-4 h-4" /> Dig check</button>}
              <button className="b3-btn" onClick={() => navigate(`${base}/registry?key=${selected.key}`)}><Fingerprint className="w-4 h-4" /> 3D ULPINs</button>
              <button className="b3-btn" onClick={() => navigate(`${base}/violations?key=${selected.key}`)}><ShieldAlert className="w-4 h-4" /> Findings</button>
            </div>
          </div>
        </aside>
      )}

      {/* a clicked spot at street level */}
      {spot && !selected && (
        <aside className="absolute top-4 right-14 z-10 w-[330px] b3-panel p-4 space-y-3 b3-drawer">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="b3-eyebrow flex items-center gap-1"><Crosshair className="w-3 h-3" /> Survey this spot</div>
              <div className="b3-serif text-lg leading-tight mt-1">{spotPlace === null ? <span className="b3-skel inline-block w-40 h-5 align-middle" /> : spotPlace || 'Unnamed locality'}</div>
              <div className="text-[11px] text-[#7d8c97] font-mono">{spot[1].toFixed(5)}°N {spot[0].toFixed(5)}°E</div>
            </div>
            <button onClick={() => setSpot(null)} className="p-0.5 text-[#5c6e7c] hover:text-[#1b3344]"><X className="w-4 h-4" /></button>
          </div>
          <Segmented value={String(spotSize)} onChange={(v) => setSpotSize(+v)} className="w-full [&>button]:flex-1"
            options={[{ value: '220', label: '220 m' }, { value: '340', label: '340 m' }, { value: '480', label: '480 m' }]} />
          {spotErr && <div className="text-[11.5px] text-[#c0392b] b3-pop">{spotErr}</div>}
          {canEdit ? (
            <button className="w-full b3-btn b3-btn-teal !py-2.5" onClick={surveySpot} disabled={spotBusy}>
              {spotBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</> : <><MapPinned className="w-4 h-4" /> Survey here · attach data <ArrowRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <p className="text-[11.5px] text-[#5c6e7c]">Only surveyors can start a new survey. Ask the survey team to model this spot.</p>
          )}
          {canEdit && <button className="w-full text-[11.5px] text-[#1e4d6b] hover:underline" onClick={() => navigate(`/surveyor/area?lat=${spot[1]}&lon=${spot[0]}`)}>Draw a custom outline here instead</button>}
        </aside>
      )}

      {/* zoom hint + base layer */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        {zoom < DRAW_MIN_ZOOM && (
          <div className="b3-panel px-3 py-1.5 text-[11.5px] text-[#33495a] b3-rise" key="hint">
            Zoom {zoom.toFixed(1)} · click anywhere to fly in{canEdit ? `; at ${DRAW_MIN_ZOOM}+ you can survey a spot` : ''}
          </div>
        )}
      </div>
      <div className="absolute bottom-8 right-4 z-10 b3-panel p-1 b3-rise b3-d3">
        <Segmented<'sat' | 'osm'> value={base_} onChange={setBase} className="!bg-transparent" options={[
          { value: 'sat', label: <><Satellite className="w-3.5 h-3.5" /> Satellite</> },
          { value: 'osm', label: <><MapIcon className="w-3.5 h-3.5" /> Map</> },
        ]} />
      </div>
    </div>
  );
};

export default MapPage;

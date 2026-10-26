/**
 * Activity tracking: a session id per browser tab (sent on every API call as X-B3D-Session), page views and user
 * actions in plain words. The edge adds IP, location and device and stores everything in D1.
 */
import { getToken } from './auth';

const KEY = 'b3d_sid';
const newId = () => (crypto?.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

let sid = '';
let fresh = false;
try {
  sid = sessionStorage.getItem(KEY) || '';
  if (!sid) {
    sid = newId();
    sessionStorage.setItem(KEY, sid);
    fresh = true;
  }
} catch {
  sid = newId();
  fresh = true;
}
export const sessionId = () => sid;

type Ev = { kind: 'page' | 'action' | 'logout' | 'session_start' | 'perf' | 'error'; action?: string; label?: string; path?: string; text?: string; detail?: unknown };

// Returning visitors: a random id kept in this browser (no personal data), and how many visits it has made.
let vid = '';
let visits = 1;
try {
  vid = localStorage.getItem('b3d_vid') || '';
  if (!vid) { vid = newId(); localStorage.setItem('b3d_vid', vid); }
  if (fresh) { visits = Number(localStorage.getItem('b3d_visits') || '0') + 1; localStorage.setItem('b3d_visits', String(visits)); }
} catch { vid = vid || newId(); }
export const visitorId = () => vid;
let queue: Ev[] = [];
let timer: number | undefined;

function apiBase() {
  const v = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '') : '';
  return `${v}/api`;
}

function flush() {
  window.clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  const events = queue.splice(0, 20);
  const token = getToken();
  fetch(`${apiBase()}/__track`, {
    method: 'POST', keepalive: true,
    headers: { 'Content-Type': 'application/json', 'X-B3D-Session': sid, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ visitor: vid, events }),
  }).catch(() => undefined);
  if (queue.length) flush();
}

export function track(e: Ev, now = false) {
  if (import.meta.env.VITE_API_URL) return; // local development talks to the API directly: no edge, no analytics
  queue.push(e);
  if (now) flush();
  else if (!timer) timer = window.setTimeout(flush, 1500);
}

export const trackAction = (action: string, text: string, detail?: unknown) => track({ kind: 'action', action, text, detail });

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
  if (fresh) track({ kind: 'session_start', path: location.pathname, detail: deviceProfile() });
  installTelemetry();
}

/** Screen, language, network, hardware and graphics card, plus campaign tags and the referring site. */
function deviceProfile() {
  const nav: any = navigator;
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    const ext = gl && (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    gpu = gl ? String((gl as WebGLRenderingContext).getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : (gl as WebGLRenderingContext).RENDERER)) : 'no WebGL';
  } catch { gpu = 'unknown'; }
  const q = new URLSearchParams(location.search);
  const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map((k) => q.get(k) ? `${k.slice(4)}=${q.get(k)}` : '').filter(Boolean).join(' ');
  return {
    visitor: vid, visits, returning: visits > 1, screen: `${screen.width}x${screen.height}@${devicePixelRatio}`,
    viewport: `${innerWidth}x${innerHeight}`, language: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    network: nav.connection ? `${nav.connection.effectiveType || ''}${nav.connection.downlink ? ` ${nav.connection.downlink} Mb/s` : ''}` : '',
    cores: nav.hardwareConcurrency || null, memory_gb: nav.deviceMemory || null, gpu: gpu.slice(0, 120), utm, referrer: document.referrer.slice(0, 200),
  };
}

/** Core Web Vitals, page load, and JavaScript errors, sent as perf / error events. */
function installTelemetry() {
  const vitals: Record<string, number> = {};
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) { vitals.ttfb_ms = Math.round(nav.responseStart); vitals.load_ms = Math.round(nav.loadEventEnd || nav.domContentLoadedEventEnd); }
    new PerformanceObserver((l) => { const all = l.getEntries(); const e = all[all.length - 1]; if (e) vitals.lcp_ms = Math.round(e.startTime); }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) vitals.cls = +((vitals.cls || 0) + e.value).toFixed(3); }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) vitals.inp_ms = Math.max(vitals.inp_ms || 0, Math.round(e.duration)); }).observe({ type: 'event', buffered: true, durationThreshold: 40 } as any);
  } catch { /* older browsers */ }
  let sent = false;
  const sendVitals = () => {
    if (sent || !Object.keys(vitals).length) return;
    sent = true;
    track({ kind: 'perf', action: 'web_vitals', text: `loaded the app (first paint of main content ${vitals.lcp_ms ?? '?'} ms, server first byte ${vitals.ttfb_ms ?? '?'} ms)`, detail: vitals }, true);
  };
  window.addEventListener('pagehide', sendVitals);
  window.setTimeout(sendVitals, 15000);
  let errors = 0;
  const report = (msg: string, where: string) => {
    if (errors++ >= 10) return;
    track({ kind: 'error', action: 'js_error', path: location.pathname, text: `hit an error on ${pageLabel(location.pathname)}: ${msg.slice(0, 160)}`, detail: { where: where.slice(0, 300) } });
  };
  window.addEventListener('error', (e) => report(String(e.message || 'error'), `${e.filename || ''}:${e.lineno || ''}`));
  window.addEventListener('unhandledrejection', (e: any) => report(String(e.reason?.message || e.reason || 'promise rejected'), 'promise'));
}

// time spent on each page, reported with the next page view
let lastPath = '';
let lastAt = 0;
export function trackPage(path: string) {
  const now = Date.now();
  const detail = lastPath ? { previous: lastPath, seconds_on_previous: Math.round((now - lastAt) / 1000) } : undefined;
  lastPath = path;
  lastAt = now;
  track({ kind: 'page', path, label: pageLabel(path), detail });
}

const PAGES: [RegExp, string][] = [
  [/^\/$/, 'the home page'], [/^\/login/, 'the sign-in page'], [/^\/3d-world\//, 'a 3D world'], [/^\/3d-editor\//, 'the 3D editor'],
  [/\/dashboard$/, 'the dashboard'], [/\/map$/, 'the survey atlas'], [/\/area$/, 'New survey (select area)'],
  [/\/upload$/, 'Data ingestion'], [/\/generate$/, 'the generation progress page'], [/\/(projects|scenes)$/, 'Surveyed areas'],
  [/\/editor$/, 'the 3D editor hub'], [/\/registry$/, 'the 3D ULPIN registry'], [/\/violations$/, 'Findings'],
  [/\/audit$/, 'the activity log'], [/\/excavation$/, 'Dig-safe planning'], [/^\/citizen\/dashboard/, 'My property in 3D'],
  [/^\/privacy/, 'the privacy policy'], [/^\/terms/, 'the terms of service'],
];
export const pageLabel = (path: string) => PAGES.find(([re]) => re.test(path))?.[1] ?? path;

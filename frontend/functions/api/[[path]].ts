// Cloudflare Pages Function: the app's same-origin API (/api/*) in front of the backend, with:
//   - R2 area store  (/api/__store, for the backend; X-Store-Token) so generated areas survive backend restarts
//   - fast reads     scene JSON and satellite textures served from R2 / the CDN after verifying the sign-in token
//   - analytics      every request, sign-in, sign-out, page view and action, with IP, Cloudflare geolocation and
//                    device, written to D1 (/api/__track from the app, /api/__analytics for the key-holder)
//   - wake-on-visit  /api/__wake starts the backend while the visitor reads or types
// Responses carry `X-B3D-Cache: STATIC | R2 | PASS`.
import { peek, verify, Claims } from '../_lib/jwt';
import { D1, log, fmtDuration } from '../_lib/analytics';

type R2Object = { body: ReadableStream; httpMetadata?: { contentType?: string }; size: number };
type R2 = {
  get: (k: string) => Promise<R2Object | null>;
  put: (k: string, v: ArrayBuffer | ReadableStream | string, o?: unknown) => Promise<unknown>;
  delete: (k: string | string[]) => Promise<void>;
  list: (o: { prefix?: string; delimiter?: string; cursor?: string; limit?: number }) =>
    Promise<{ objects: { key: string }[]; delimitedPrefixes: string[]; truncated: boolean; cursor?: string }>;
};
type Env = {
  BACKEND_ORIGIN?: string; JWT_SECRET?: string; STORE_TOKEN?: string; ANALYTICS_KEY?: string;
  AREAS?: R2; ANALYTICS?: D1; ASSETS?: { fetch: (r: Request | string) => Promise<Response> };
};
type Ctx = { request: Request; env: Env; waitUntil: (p: Promise<unknown>) => void };

const DEFAULT_ORIGIN = 'https://bharat-3d-backend.onrender.com';
const TEXTURE = /^\/api\/realgen\/scenes\/([a-f0-9]{16})\/(texture|context)\.jpg$/;
const SCENE = /^\/api\/realgen\/scenes\/([a-f0-9]{16})$/;
const QUIET = /^\/api\/(realgen\/jobs\/|__wake|__store|__track|__analytics)|\.jpg$/; // not logged as requests
const TYPES: Record<string, string> = { json: 'application/json', jpg: 'image/jpeg' };

export async function onRequest(context: Ctx): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = String(env.BACKEND_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
  const session = request.headers.get('X-B3D-Session');
  const started = Date.now();
  try {
    if (path === '/api/__wake') {
      context.waitUntil(fetch(`${origin}/health`).catch(() => undefined));
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    if (path === '/api/__store' || path.startsWith('/api/__store/')) return await store(context, path.slice('/api/__store'.length));
    if (path === '/api/__track') return await track(context);
    if (path === '/api/__analytics') return await analytics(context, url);

    // Satellite textures: CDN (bundled demo areas) -> R2 (any stored area) -> backend
    const tex = request.method === 'GET' ? path.match(TEXTURE) : null;
    if (tex) {
      if (env.ASSETS) {
        const stat = await env.ASSETS.fetch(new URL(`/tex/${tex[1]}/${tex[2]}.jpg`, url).toString());
        if (stat.ok && (stat.headers.get('content-type') || '').startsWith('image/')) return tag(stat, 'STATIC');
      }
      const obj = await env.AREAS?.get(`${tex[1]}/${tex[2]}.jpg`);
      if (obj) return new Response(obj.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=86400', 'X-B3D-Cache': 'R2' } });
    }

    // Scene JSON for signed-in users straight from R2 (the backend writes it there before answering any change)
    const scene = request.method === 'GET' ? path.match(SCENE) : null;
    if (scene && env.AREAS && env.JWT_SECRET) {
      const claims = await verify(request.headers.get('Authorization'), env.JWT_SECRET);
      if (claims) {
        const obj = await env.AREAS.get(`${scene[1]}/scene.json`);
        if (obj) {
          context.waitUntil(log(env.ANALYTICS, request, { kind: 'request', session, claims, method: 'GET', path, status: 200, ms: Date.now() - started, bytes: obj.size }));
          return new Response(obj.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-cache', 'X-B3D-Cache': 'R2' } });
        }
      }
    }

    // Sign-in: record success (with the user) or failure (with the email tried), never the password
    if (path === '/api/auth/login' && request.method === 'POST') {
      const body = await request.clone().json().catch(() => ({})) as { email?: string };
      const res = await fetch(new Request(`${origin}${path}${url.search}`, request));
      const data = res.ok ? await res.clone().json().catch(() => null) as { access_token?: string } | null : null;
      const claims = data?.access_token ? peek(`Bearer ${data.access_token}`) : null;
      context.waitUntil(log(env.ANALYTICS, request, res.ok
        ? { kind: 'login', session, claims, method: 'POST', path, status: res.status, ms: Date.now() - started }
        : { kind: 'login_failed', session, method: 'POST', path, status: res.status, ms: Date.now() - started,
            extra: { email: String(body.email || '').slice(0, 120), reason: res.status === 401 ? 'wrong email or password' : `error ${res.status}` } }));
      return tag(res, 'PASS');
    }

    const res = await fetch(new Request(`${origin}${path}${url.search}`, request));
    if (!QUIET.test(path)) {
      context.waitUntil(log(env.ANALYTICS, request, {
        kind: 'request', session, claims: peek(request.headers.get('Authorization')), method: request.method, path,
        status: res.status, ms: Date.now() - started, bytes: Number(res.headers.get('content-length')) || undefined,
      }));
    }
    return tag(res, 'PASS');
  } catch (err: any) {
    return new Response(JSON.stringify({ detail: 'The API is waking up or unreachable. Please retry in a few seconds.', error: String(err?.message || err) }),
      { status: 504, headers: { 'Content-Type': 'application/json', 'X-B3D-Cache': 'PASS' } });
  }
}

// ----------------------------------------------------------------------------- R2 area store (backend only)
async function store(context: Ctx, rest: string): Promise<Response> {
  const { request, env } = context;
  if (!env.AREAS || !env.STORE_TOKEN || request.headers.get('X-Store-Token') !== env.STORE_TOKEN) return json({ detail: 'forbidden' }, 403);
  const [key, name] = rest.replace(/^\//, '').split('/');
  if (!key) {  // list: {areas, deleted}
    const areas: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await env.AREAS.list({ delimiter: '/', cursor, limit: 1000 });
      areas.push(...page.delimitedPrefixes.map((p) => p.replace(/\/$/, '')).filter((k) => k !== '_deleted'));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    const deleted = (await env.AREAS.list({ prefix: '_deleted/', limit: 1000 })).objects.map((o) => o.key.slice('_deleted/'.length));
    return json({ areas, deleted });
  }
  if (!/^([a-f0-9]{16}|_registry)$/.test(key) || (name && !/^[a-z_]+\.(json|jpg)$/.test(name))) return json({ detail: 'bad key' }, 400);
  if (request.method === 'DELETE' && !name) {
    let cursor: string | undefined;
    do {
      const page = await env.AREAS.list({ prefix: `${key}/`, cursor, limit: 1000 });
      if (page.objects.length) await env.AREAS.delete(page.objects.map((o) => o.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    await env.AREAS.put(`_deleted/${key}`, new Date().toISOString());
    return json({ deleted: key });
  }
  if (!name) return json({ detail: 'file name required' }, 400);
  if (request.method === 'PUT') {
    await env.AREAS.put(`${key}/${name}`, await request.arrayBuffer(), { httpMetadata: { contentType: TYPES[name.split('.').pop() || ''] } });
    await env.AREAS.delete(`_deleted/${key}`);
    return json({ stored: `${key}/${name}` });
  }
  const obj = await env.AREAS.get(`${key}/${name}`);
  return obj ? new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream' } }) : json({ detail: 'not found' }, 404);
}

// ----------------------------------------------------------------------------- events from the app
async function track(context: Ctx): Promise<Response> {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ detail: 'POST only' }, 405);
  const body = await request.json().catch(() => null) as { events?: any[]; visitor?: string } | null;
  const claims: Claims | null = peek(request.headers.get('Authorization'));
  const session = request.headers.get('X-B3D-Session');
  const events = (body?.events || []).slice(0, 20);
  context.waitUntil((async () => {
    for (const e of events) {
      const kind = ['page', 'action', 'logout', 'session_start', 'perf', 'error'].includes(e.kind) ? e.kind : 'action';
      let extra: Record<string, any> = { label: String(e.label || '').slice(0, 120), path: String(e.path || '').slice(0, 200), text: String(e.text || '').slice(0, 400) };
      if (kind === 'logout' && env.ANALYTICS && session) {
        const s = await env.ANALYTICS.prepare('SELECT started_at FROM sessions WHERE session_id = ?').bind(session).first().catch(() => null);
        if (s?.started_at) extra = { ...extra, duration: fmtDuration(Date.now() - Date.parse(s.started_at)) };
      }
      await log(env.ANALYTICS, request, { kind, session, claims, visitor: body?.visitor, path: extra.path, action: String(e.action || '').slice(0, 60) || undefined,
        detail: e.detail, extra });
    }
  })());
  return new Response(null, { status: 204 });
}

// ----------------------------------------------------------------------------- analytics API (key holder only)
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'X-Analytics-Key, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const EVENT_COLS = ['at', 'kind', 'session_id', 'user_email', 'user_name', 'role', 'ip', 'country', 'region', 'city', 'postal', 'lat', 'lon', 'timezone',
  'asn', 'isp', 'colo', 'browser', 'os', 'device', 'ua', 'referer', 'method', 'path', 'status', 'ms', 'bytes', 'action', 'detail', 'message', 'visitor_id', 'source', 'ext_id'];

async function analytics(context: Ctx, url: URL): Promise<Response> {
  // the private dashboard runs from the owner's machine (file://), so this endpoint allows any origin; the key guards it
  const res = await analyticsInner(context, url);
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
  return out;
}

async function analyticsInner(context: Ctx, url: URL): Promise<Response> {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!env.ANALYTICS || !env.ANALYTICS_KEY || request.headers.get('X-Analytics-Key') !== env.ANALYTICS_KEY) return json({ detail: 'forbidden' }, 403);
  const db = env.ANALYTICS;
  const q = (sql: string, ...v: unknown[]) => db.prepare(sql).bind(...v).all().then((r) => r.results);
  const view = url.searchParams.get('view') || 'summary';
  const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 30, 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 5000);
  const offset = Number(url.searchParams.get('offset')) || 0;

  if (view === 'import' && request.method === 'POST') {  // history from Render logs, backend activity, GitHub traffic
    const body = await request.json().catch(() => ({})) as { events?: any[]; daily?: any[] };
    const stmts: unknown[] = [];
    for (const e of (body.events || []).slice(0, 500)) {
      if (!e.ext_id || !e.at || !e.kind) continue;
      stmts.push(db.prepare(`INSERT OR IGNORE INTO events (${EVENT_COLS.join(', ')}) VALUES (${EVENT_COLS.map(() => '?').join(', ')})`)
        .bind(...EVENT_COLS.map((c) => (c === 'detail' && e.detail !== undefined && typeof e.detail !== 'string' ? JSON.stringify(e.detail) : e[c] ?? null))));
    }
    for (const d of (body.daily || []).slice(0, 500)) {
      if (!d.day || !d.source || !d.metric) continue;
      stmts.push(db.prepare('INSERT OR REPLACE INTO daily_stats (day, source, metric, label, value) VALUES (?, ?, ?, ?, ?)')
        .bind(d.day, d.source, d.metric, d.label || '', Number(d.value) || 0));
    }
    if (stmts.length) await db.batch(stmts);
    return json({ received: stmts.length });
  }

  if (view === 'summary') {
    const [totals] = await q(`SELECT
        (SELECT COUNT(*) FROM sessions WHERE started_at >= ?) AS sessions,
        (SELECT COUNT(DISTINCT ip) FROM events WHERE at >= ?) AS visitors,
        (SELECT COUNT(DISTINCT user_email) FROM events WHERE at >= ? AND user_email IS NOT NULL) AS users,
        (SELECT COUNT(*) FROM events WHERE at >= ? AND kind = 'login') AS logins,
        (SELECT COUNT(*) FROM events WHERE at >= ? AND kind = 'login_failed') AS failed_logins,
        (SELECT COUNT(*) FROM events WHERE at >= ? AND kind = 'action') AS actions,
        (SELECT COUNT(*) FROM events WHERE at >= ? AND kind = 'page') AS pages,
        (SELECT COUNT(*) FROM events WHERE at >= ? AND kind = 'request') AS requests,
        (SELECT COUNT(*) FROM events WHERE at >= ? AND status >= 500) AS errors,
        (SELECT AVG((julianday(COALESCE(ended_at, last_seen)) - julianday(started_at)) * 86400) FROM sessions WHERE started_at >= ?) AS avg_session_s,
        (SELECT AVG(ms) FROM events WHERE at >= ? AND kind = 'request') AS avg_ms`, since, since, since, since, since, since, since, since, since, since, since);
    const perDay = await q(`SELECT substr(at, 1, 10) AS day, COUNT(DISTINCT session_id) AS sessions, COUNT(DISTINCT ip) AS visitors,
        SUM(kind = 'login') AS logins, SUM(kind = 'action') AS actions, SUM(kind = 'request') AS requests
        FROM events WHERE at >= ? GROUP BY day ORDER BY day`, since);
    const by = (col: string, n = 12) => q(`SELECT COALESCE(NULLIF(${col}, ''), 'Unknown') AS k, COUNT(DISTINCT session_id) AS sessions, COUNT(*) AS events
        FROM events WHERE at >= ? GROUP BY k ORDER BY sessions DESC, events DESC LIMIT ${n}`, since);
    const [countries, cities, isps, browsers, oses, devices, roles] = await Promise.all([
      by('country'), by('city', 15), by('isp'), by('browser'), by('os'), by('device'), by('role')]);
    const places = await q(`SELECT city, region, country, ROUND(lat, 2) AS lat, ROUND(lon, 2) AS lon, COUNT(DISTINCT session_id) AS sessions,
        COUNT(DISTINCT ip) AS visitors FROM events WHERE at >= ? AND lat IS NOT NULL GROUP BY city, region, country ORDER BY sessions DESC LIMIT 200`, since);
    const actions = await q(`SELECT COALESCE(action, 'other') AS k, COUNT(*) AS n FROM events WHERE at >= ? AND kind = 'action' GROUP BY k ORDER BY n DESC LIMIT 15`, since);
    const pages = await q(`SELECT path AS k, COUNT(*) AS n FROM events WHERE at >= ? AND kind = 'page' GROUP BY k ORDER BY n DESC LIMIT 15`, since);
    const hours = await q(`SELECT CAST(strftime('%w', at, '+330 minutes') AS INTEGER) AS dow, CAST(strftime('%H', at, '+330 minutes') AS INTEGER) AS hour,
        COUNT(*) AS n FROM events WHERE at >= ? AND kind IN ('page', 'action', 'login') GROUP BY dow, hour`, since);
    const recent = await q(`SELECT at, kind, message, city, country, user_name, role, session_id FROM events
        WHERE at >= ? AND kind NOT IN ('request', 'perf') ORDER BY at DESC LIMIT 40`, since);
    const [visitors] = await q(`SELECT SUM(is_returning = 1) AS returning_sessions, SUM(COALESCE(is_returning, 0) = 0) AS new_sessions,
        COUNT(DISTINCT visitor_id) AS unique_browsers FROM sessions WHERE started_at >= ?`, since);
    const funnel = await q(`SELECT action AS step, COUNT(DISTINCT session_id) AS sessions FROM events WHERE at >= ? AND action IN
        ('survey_area_selected', 'survey_package_attached', 'dataset_uploaded', 'generation_started', 'generation_completed', 'area_opened',
         'building_inspected', 'registry_search', 'dig_check', 'edit_applied') GROUP BY action`, since);
    const dwell = await q(`SELECT json_extract(detail, '$.previous') AS k, ROUND(AVG(json_extract(detail, '$.seconds_on_previous'))) AS avg_s,
        COUNT(*) AS n FROM events WHERE at >= ? AND kind = 'page' AND json_extract(detail, '$.previous') IS NOT NULL
        AND json_extract(detail, '$.seconds_on_previous') < 3600 GROUP BY k ORDER BY n DESC LIMIT 15`, since);
    const [perf] = await q(`SELECT ROUND(AVG(json_extract(detail, '$.lcp_ms'))) AS lcp_ms, ROUND(AVG(json_extract(detail, '$.ttfb_ms'))) AS ttfb_ms,
        ROUND(AVG(json_extract(detail, '$.inp_ms'))) AS inp_ms, ROUND(AVG(json_extract(detail, '$.cls')), 3) AS cls, COUNT(*) AS samples
        FROM events WHERE at >= ? AND action = 'web_vitals'`, since);
    const [world] = await q(`SELECT ROUND(AVG(json_extract(detail, '$.seconds')), 1) AS load_s, ROUND(AVG(json_extract(detail, '$.fps'))) AS fps,
        COUNT(*) AS samples FROM events WHERE at >= ? AND action = 'world_loaded'`, since);
    const errorsList = await q(`SELECT at, message, path, browser, os, city FROM events WHERE at >= ? AND (kind = 'error' OR status >= 500)
        ORDER BY at DESC LIMIT 25`, since);
    const slowest = await q(`SELECT path AS k, ROUND(AVG(ms)) AS avg_ms, COUNT(*) AS n FROM events WHERE at >= ? AND kind = 'request'
        GROUP BY k HAVING n >= 2 ORDER BY avg_ms DESC LIMIT 10`, since);
    const daily = await q(`SELECT day, source, metric, label, value FROM daily_stats WHERE day >= ? ORDER BY day`, since.slice(0, 10));
    const sources = await q(`SELECT COALESCE(source, 'edge') AS k, COUNT(*) AS n, MIN(at) AS first, MAX(at) AS last FROM events GROUP BY k`);
    return json({ daily, sources, days, totals, perDay, countries, cities, isps, browsers, oses, devices, roles, places, actions, pages, hours, recent,
      visitors, funnel, dwell, perf, world, errors: errorsList, slowest });
  }
  if (view === 'events') {
    const kind = url.searchParams.get('kind');
    const term = url.searchParams.get('q');
    const sid = url.searchParams.get('session');
    const where = ['at >= ?'];
    const args: unknown[] = [since];
    if (kind) { where.push('kind = ?'); args.push(kind); }
    if (sid) { where.push('session_id = ?'); args.push(sid); }
    if (term) { where.push('(message LIKE ? OR ip LIKE ? OR user_email LIKE ? OR path LIKE ?)'); args.push(...Array(4).fill(`%${term}%`)); }
    return json({ items: await q(`SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY at DESC LIMIT ${limit} OFFSET ${offset}`, ...args) });
  }
  if (view === 'sessions') {
    return json({ items: await q(`SELECT *, ROUND((julianday(COALESCE(ended_at, last_seen)) - julianday(started_at)) * 86400) AS duration_s
        FROM sessions WHERE started_at >= ? ORDER BY started_at DESC LIMIT ${limit} OFFSET ${offset}`, since) });
  }
  if (view === 'session') {
    const id = url.searchParams.get('id') || '';
    const [s] = await q(`SELECT *, ROUND((julianday(COALESCE(ended_at, last_seen)) - julianday(started_at)) * 86400) AS duration_s FROM sessions WHERE session_id = ?`, id);
    return json({ session: s || null, events: await q(`SELECT * FROM events WHERE session_id = ? ORDER BY at`, id) });
  }
  if (view === 'export') {
    const after = Number(url.searchParams.get('after_id')) || 0;
    return json({ items: await q(`SELECT * FROM events WHERE id > ? ORDER BY id LIMIT ${limit}`, after),
      sessions: url.searchParams.get('sessions') ? await q(`SELECT * FROM sessions ORDER BY started_at`) : undefined });
  }
  return json({ detail: 'unknown view' }, 400);
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function tag(res: Response, state: 'STATIC' | 'R2' | 'PASS'): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-B3D-Cache', state);
  return out;
}

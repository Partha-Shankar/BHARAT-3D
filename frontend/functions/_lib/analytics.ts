// Analytics at the edge: who (signed-in user), where (Cloudflare geolocation of the IP), on what (browser / OS),
// what they did, written to D1 with a readable sentence. Sessions are keyed by the X-B3D-Session id the app sends.
import { Claims } from './jwt';

export type D1 = {
  prepare: (sql: string) => { bind: (...v: unknown[]) => { run: () => Promise<unknown>; all: () => Promise<{ results: any[] }>; first: () => Promise<any> } };
  batch: (stmts: unknown[]) => Promise<unknown>;
};

export type Visitor = {
  ip: string; country: string; region: string; city: string; postal: string; lat: number | null; lon: number | null;
  timezone: string; asn: number | null; isp: string; colo: string; browser: string; os: string; device: string; ua: string; referer: string;
};

const ROLE: Record<string, string> = { SURVEYOR: 'Surveyor', ADMIN: 'Admin', MUNICIPALITY: 'Municipality', UTILITY_OPERATOR: 'Utility operator', CITIZEN: 'Citizen' };
let regionNames: Intl.DisplayNames | null = null;
const countryName = (cc: string) => {
  try {
    regionNames = regionNames ?? new Intl.DisplayNames(['en'], { type: 'region' });
    return cc ? regionNames.of(cc) ?? cc : '';
  } catch {
    return cc;
  }
};

export function visitor(request: Request): Visitor {
  const cf: any = (request as any).cf || {};
  const ua = request.headers.get('User-Agent') || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari'
      : /curl|python|httpx|node|bot|crawl|spider/i.test(ua) ? 'Script / bot' : 'Other browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other OS';
  const device = /iPad|Tablet/.test(ua) ? 'Tablet' : /Mobi|Android|iPhone/.test(ua) ? 'Mobile' : 'Desktop';
  return {
    ip: request.headers.get('CF-Connecting-IP') || '', country: cf.country || '', region: cf.region || '', city: cf.city || '',
    postal: cf.postalCode || '', lat: cf.latitude ? Number(cf.latitude) : null, lon: cf.longitude ? Number(cf.longitude) : null,
    timezone: cf.timezone || '', asn: cf.asn ?? null, isp: String(cf.asOrganization || '').replace(/[,\s]+$/, ''), colo: cf.colo || '',
    browser, os, device, ua: ua.slice(0, 300), referer: (request.headers.get('Referer') || '').slice(0, 300),
  };
}

export const who = (c: Claims | null, fallback = 'A visitor') =>
  c?.name ? `${c.name.replace(/\s*\((Surveyor|Admin|Municipality|Utility.*|Citizen)\)\s*$/i, '')} (${ROLE[c.role || ''] || c.role || 'user'})` : c?.email || fallback;
export const where = (v: Visitor) => [v.city, v.region, countryName(v.country)].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ') || 'an unknown location';
const on = (v: Visitor) => `${v.browser} on ${v.os}${v.device !== 'Desktop' ? ` (${v.device.toLowerCase()})` : ''}`;
export const fmtDuration = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 1 ? 'under a minute' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

export function message(kind: string, c: Claims | null, v: Visitor, extra: Record<string, any> = {}): string {
  switch (kind) {
    case 'login': return `${who(c)} signed in from ${where(v)}${v.isp ? ` · ${v.isp}` : ''} · ${on(v)}`;
    case 'login_failed': return `Failed sign-in for ${extra.email || 'an unknown account'} from ${where(v)} · ${on(v)} (${extra.reason || 'rejected'})`;
    case 'logout': return `${who(c)} signed out${extra.duration ? ` after ${extra.duration}` : ''}`;
    case 'session_start': return `New visit from ${where(v)}${v.isp ? ` · ${v.isp}` : ''} · ${on(v)}${extra.path ? `, landing on ${extra.path}` : ''}`;
    case 'page': return `${who(c)} opened ${extra.label || extra.path}`;
    case 'action': return `${who(c)} ${extra.text || extra.action}`;
    case 'perf': return `${who(c)} ${extra.text || 'reported performance'} · ${on(v)}`;
    case 'error': return `${who(c)} ${extra.text || 'hit an error'} · ${on(v)}`;
    default: return `${extra.method} ${extra.path} → ${extra.status} in ${extra.ms} ms`;
  }
}

export type LogInput = {
  kind: string; session?: string | null; claims?: Claims | null; method?: string; path?: string; status?: number; ms?: number;
  bytes?: number; action?: string; detail?: unknown; extra?: Record<string, any>; visitor?: string | null;
};

/** Insert one event and update its session (create it on first sight). Never throws. */
export async function log(db: D1 | undefined, request: Request, e: LogInput): Promise<void> {
  if (!db) return;
  try {
    const v = visitor(request);
    const c = e.claims ?? null;
    const at = new Date().toISOString();
    const sid = (e.session || '').slice(0, 64) || null;
    const msg = message(e.kind, c, v, { ...e.extra, method: e.method, path: e.path, status: e.status, ms: e.ms, action: e.action });
    const stmts: unknown[] = [
      db.prepare(`INSERT INTO events (visitor_id, at, kind, session_id, user_email, user_name, role, ip, country, region, city, postal, lat, lon,
        timezone, asn, isp, colo, browser, os, device, ua, referer, method, path, status, ms, bytes, action, detail, message)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
        (e.visitor || '').slice(0, 64) || null, at, e.kind, sid, c?.email ?? null, c?.name ?? null, c?.role ?? null, v.ip, v.country, v.region, v.city, v.postal, v.lat, v.lon,
        v.timezone, v.asn, v.isp, v.colo, v.browser, v.os, v.device, v.ua, v.referer, e.method ?? null, e.path ?? null,
        e.status ?? null, e.ms ?? null, e.bytes ?? null, e.action ?? null, e.detail === undefined ? null : JSON.stringify(e.detail).slice(0, 4000), msg),
    ];
    if (sid) {
      const profile = e.kind === 'session_start' && e.detail ? JSON.stringify(e.detail).slice(0, 2000) : null;
      const returning = e.kind === 'session_start' ? ((e.detail as any)?.returning ? 1 : 0) : null;
      stmts.push(db.prepare(`INSERT INTO sessions (session_id, user_email, user_name, role, started_at, last_seen, ip, country, region, city,
        lat, lon, timezone, isp, browser, os, device, landing_path, referer, pages, actions, requests, errors, visitor_id, profile, is_returning)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(session_id) DO UPDATE SET last_seen = excluded.last_seen,
          visitor_id = COALESCE(sessions.visitor_id, excluded.visitor_id), profile = COALESCE(excluded.profile, sessions.profile),
          is_returning = COALESCE(excluded.is_returning, sessions.is_returning),
          user_email = COALESCE(excluded.user_email, sessions.user_email), user_name = COALESCE(excluded.user_name, sessions.user_name),
          role = COALESCE(excluded.role, sessions.role),
          pages = sessions.pages + excluded.pages, actions = sessions.actions + excluded.actions,
          requests = sessions.requests + excluded.requests, errors = sessions.errors + excluded.errors,
          ended_at = CASE WHEN ? = 'logout' THEN excluded.last_seen ELSE sessions.ended_at END,
          end_reason = CASE WHEN ? = 'logout' THEN 'signed out' ELSE sessions.end_reason END`).bind(
        sid, c?.email ?? null, c?.name ?? null, c?.role ?? null, at, at, v.ip, v.country, v.region, v.city, v.lat, v.lon, v.timezone,
        v.isp, v.browser, v.os, v.device, e.kind === 'session_start' ? e.path ?? null : null, v.referer,
        e.kind === 'page' ? 1 : 0, ['action', 'login', 'logout'].includes(e.kind) ? 1 : 0, e.kind === 'request' ? 1 : 0,
        (e.status ?? 0) >= 500 || e.kind === 'error' ? 1 : 0, (e.visitor || '').slice(0, 64) || null, profile, returning, e.kind, e.kind));
    }
    await db.batch(stmts);
  } catch {
    /* analytics must never break the app */
  }
}

/**
 * Is the API server awake, and if not, when should the visitor come back?
 *
 * The API runs on a free Render instance that sleeps after 15 minutes without traffic and needs about half a minute
 * to start again. Every API call goes through lib/api.ts, which asks this module to check the server whenever a call
 * is slow or fails with a "server not running" answer. While the server starts, the app shows a countdown
 * (components/ServerStatusBanner.tsx), new calls wait instead of failing, and failed calls are retried by themselves.
 *
 * Free plans also have limits. When one is reached the banner says so and gives an estimated time to come back:
 *  - "busy": too many requests (HTTP 429). Cloudflare's free daily allowance resets at 00:00 UTC; otherwise the
 *    host's Retry-After, or 15 minutes;
 *  - "suspended": the host paused the service (Render's free monthly hours or bandwidth): back on the 1st;
 *  - "down": the server did not start within 3 minutes. Outages like this lasted 7-13 minutes, so about 15 minutes.
 */
import { create } from 'zustand';

export type ServerState = 'unknown' | 'awake' | 'waking' | 'down' | 'busy' | 'suspended';
export type Limit = 'traffic' | 'daily' | 'monthly';

interface ServerStatus {
  state: ServerState;
  /** when the current wake-up began (ms since epoch) */
  since: number | null;
  /** expected wake-up length in seconds (learned from earlier wake-ups on this browser) */
  estimateS: number;
  /** user actions currently waiting for the server */
  waiting: number;
  /** when the server came back (for the short "ready" message) */
  readyAt: number | null;
  /** it came back after we had given up, so the visitor has to repeat the last action */
  readyAfterDown: boolean;
  /** busy, suspended or down: estimated time the visitor can come back (ms since epoch) */
  retryAt: number | null;
  /** which limit was reached (busy / suspended) */
  limit: Limit | null;
}

const LEARN_KEY = 'b3d_wake_seconds_v2'; // v2: estimates learned before the direct wake-up (often 90 s) are dropped
const DEFAULT_WAKE_S = 35; // measured on the live server: a direct request starts it in ~25 s, then ~10 s to be ready
const MAX_WAIT_MS = 180_000; // after this the banner says the server cannot be reached
const POLL_MS = 2000;
const WAKE_KEY = 'b3d_wake_url';
const DIRECT_SPACING_MS = 5000; // at most one direct wake-up request every 5 s
const DIRECT_TIMEOUT_MS = 90_000; // Render holds a direct request while the instance starts (~25 s, sometimes more)
const DOWN_RETRY_MS = 15 * 60_000; // free-plan outages where the server would not start lasted 7-13 minutes
const BUSY_DEFAULT_MS = 15 * 60_000; // "too many requests" without the host's own estimate

function learned(): number {
  try {
    const v = JSON.parse(localStorage.getItem(LEARN_KEY) || '[]') as number[];
    if (Array.isArray(v) && v.length) return Math.min(90, Math.max(15, v.reduce((a, b) => a + b, 0) / v.length));
  } catch { /* storage unavailable */ }
  return DEFAULT_WAKE_S;
}

function learn(seconds: number) {
  if (!(seconds > 3 && seconds < 300)) return;
  try {
    const v = JSON.parse(localStorage.getItem(LEARN_KEY) || '[]') as number[];
    localStorage.setItem(LEARN_KEY, JSON.stringify([...(Array.isArray(v) ? v : []), Math.round(seconds)].slice(-5)));
  } catch { /* storage unavailable */ }
}

export const useServerStatus = create<ServerStatus>(() => ({
  state: 'unknown', since: null, estimateS: learned(), waiting: 0, readyAt: null, readyAfterDown: false, retryAt: null, limit: null,
}));

export const isLimited = (s: ServerState) => s === 'busy' || s === 'suspended';

// ------------------------------------------------------------------------------------------------- limit estimates
export function nextUtcMidnight(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export function nextMonthStartUtc(now = Date.now()): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
}

/** When a "too many requests" answer says the visitor can come back, and which limit it was. */
export function busyEstimate(retryAfter: string | null | undefined, body: string, now = Date.now()): { retryAt: number; limit: Limit } {
  if (/\b1027\b|has been temporarily rate limited/i.test(body)) return { retryAt: nextUtcMidnight(now), limit: 'daily' }; // Cloudflare's free daily allowance
  if (retryAfter) {
    const s = Number(retryAfter);
    if (Number.isFinite(s) && s > 0) return { retryAt: now + s * 1000, limit: 'traffic' };
    const t = Date.parse(retryAfter);
    if (!Number.isNaN(t) && t > now) return { retryAt: t, limit: 'traffic' };
  }
  return { retryAt: now + BUSY_DEFAULT_MS, limit: 'traffic' };
}

/** "in about 12 minutes (around 21:45)", "after 05:30 (in about 7 h 10 min)" or "on 1 December (in about 17 days)". */
export function comeBack(retryAt: number, now = Date.now()): string {
  const ms = Math.max(0, retryAt - now);
  const at = new Date(retryAt);
  const clock = at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const min = Math.ceil(ms / 60_000);
  if (ms >= 36 * 3_600_000) {
    return `on ${at.toLocaleDateString([], { day: 'numeric', month: 'long' })} (in about ${Math.ceil(ms / 86_400_000)} days)`;
  }
  if (min >= 90) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `after ${clock} (in about ${h} h${m ? ` ${m} min` : ''})`;
  }
  if (min <= 1) return 'in a minute';
  return `in about ${min} minutes (around ${clock})`;
}

// ------------------------------------------------------------------------------------------------------- checking
const DIRECT = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '') : '';

/*
 * Waking the server. App calls travel through the website's Cloudflare proxy, and while Render's free instance
 * sleeps it answers those with an instant 502 and often does not start (seen for 25+ minutes). A request sent
 * straight from the visitor's browser to the backend's own address starts it in about half a minute. The status
 * check tells us that address (`wake`); it is remembered for the next visit so the first request goes out at once.
 */
/** A signal that aborts after `ms`; AbortSignal.timeout is missing before Safari 16, so fall back to a timer. */
function timeoutSignal(ms: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof (AbortSignal as { timeout?: unknown }).timeout === 'function') return AbortSignal.timeout(ms);
    if (typeof AbortController !== 'undefined') {
      const c = new AbortController();
      window.setTimeout(() => c.abort(), ms);
      return c.signal;
    }
  } catch { /* very old browser: no timeout, the request just takes as long as it takes */ }
  return undefined;
}

const WAKE_RE = /^https:\/\/[^/\s?#]+\/health$/;
let wakeUrl: string | null = (() => {
  try {
    const v = localStorage.getItem(WAKE_KEY);
    return v && WAKE_RE.test(v) ? v : null;
  } catch {
    return null;
  }
})();

function rememberWake(u: unknown) {
  if (typeof u !== 'string' || !WAKE_RE.test(u) || u === wakeUrl) return;
  wakeUrl = u;
  try { localStorage.setItem(WAKE_KEY, u); } catch { /* storage unavailable */ }
}

let direct: Promise<boolean> | null = null;
let lastDirect = 0;

/**
 * One request straight to the backend (not through the proxy), at most every DIRECT_SPACING_MS and one at a time.
 * Resolves true when the backend answered OK. Never rejects: a blocked network or a refused request is just false.
 */
export function wakeDirect(): Promise<boolean> {
  if (!wakeUrl || DIRECT || typeof fetch === 'undefined') return Promise.resolve(false);
  if (direct) return direct;
  if (Date.now() - lastDirect < DIRECT_SPACING_MS) return Promise.resolve(false);
  lastDirect = Date.now();
  const url = wakeUrl;
  direct = Promise.resolve()
    .then(() => fetch(url, { mode: 'cors', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal: timeoutSignal(DIRECT_TIMEOUT_MS) }))
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => { direct = null; });
  return direct;
}

type Probe = { ok: boolean; busy?: { retryAt: number; limit: Limit }; suspended?: boolean };

/** One quick check. ok when the server answers (or when this deployment cannot tell, so nothing is blocked). */
async function probe(): Promise<Probe> {
  try {
    const res = await fetch(DIRECT ? `${DIRECT}/health` : '/api/__status', { cache: 'no-store', signal: timeoutSignal(4000) });
    if (res.status === 429) { // the edge itself is over a limit (for example Cloudflare's daily allowance)
      const text = await res.text().catch(() => '');
      return { ok: false, busy: busyEstimate(res.headers.get('retry-after'), text) };
    }
    if (DIRECT) return { ok: res.ok };
    if (res.status === 404) return { ok: true }; // no status endpoint here (local development behind the Vite proxy)
    const body = await res.json().catch(() => null) as { state?: string; retry_after_s?: number | null; wake?: string } | null;
    rememberWake(body?.wake);
    if (body?.state === 'busy') return { ok: false, busy: busyEstimate(body.retry_after_s ? String(body.retry_after_s) : null, '') };
    if (body?.state === 'suspended') return { ok: false, suspended: true };
    return { ok: res.ok && body?.state === 'awake' };
  } catch {
    return { ok: false };
  }
}

function markAwake() {
  const s = useServerStatus.getState();
  if (s.state === 'waking' || s.state === 'down' || isLimited(s.state)) {
    if (s.state === 'waking' && s.since) learn((Date.now() - s.since) / 1000); // an outage is not a normal start-up
    window.clearTimeout(recheck);
    useServerStatus.setState({ state: 'awake', since: null, readyAt: Date.now(), readyAfterDown: s.state !== 'waking',
      estimateS: learned(), retryAt: null, limit: null });
  } else if (s.state !== 'awake') {
    useServerStatus.setState({ state: 'awake' });
  }
}

/** A call just succeeded: the server is up. */
export const noteServerOk = markAwake;

/** A limit was reached: show it with the estimated time, and keep checking quietly. */
export function markLimited(kind: 'busy' | 'suspended', retryAt: number, limit: Limit) {
  useServerStatus.setState({ state: kind, retryAt, limit, since: null, readyAt: null });
  scheduleRecheck(kind === 'suspended' ? 5 * 60_000 : 60_000);
}

function applyProbe(r: Probe): boolean {
  if (r.ok) {
    markAwake();
    return true;
  }
  if (r.suspended) markLimited('suspended', nextMonthStartUtc(), 'monthly');
  else if (r.busy) markLimited('busy', r.busy.retryAt, r.busy.limit);
  return false;
}

let current: Promise<boolean> | null = null;

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Resolves when this device is back online (or after `ms`, to look again). */
function onlineAgain(ms = 30_000): Promise<void> {
  return new Promise((resolve) => {
    const done = () => { window.removeEventListener('online', done); window.clearTimeout(t); resolve(); };
    const t = window.setTimeout(done, ms);
    window.addEventListener('online', done);
  });
}

/**
 * Resolves true once the server answers, or false after MAX_WAIT_MS (or at once when a limit was reached). Every
 * caller shares one check, so a burst of slow calls makes one wake-up and one banner. `startedAt` is when the first
 * affected call began, which makes the countdown honest. While the device itself is offline the wait pauses: a
 * missing connection is not a sleeping server.
 */
export function ensureAwake(startedAt?: number): Promise<boolean> {
  if (current) return current;
  current = (async () => {
    let t0 = Date.now();
    let shown = false;
    while (Date.now() - t0 < MAX_WAIT_MS) {
      if (offline()) {
        await onlineAgain();
        t0 = Date.now();
        continue;
      }
      const r = await probe();
      if (applyProbe(r)) return true;
      if (r.busy || r.suspended) return false;
      // Asleep: make sure a direct request is on its way, since that is what starts the instance.
      const d = wakeDirect();
      if (!shown) {
        shown = true;
        const s = useServerStatus.getState();
        if (s.state !== 'waking') {
          useServerStatus.setState({ state: 'waking', since: Math.min(startedAt ?? t0, t0), estimateS: learned(), readyAt: null });
        }
      }
      // Next check after POLL_MS, or at once when the direct request reports that the backend is up.
      await Promise.race([
        new Promise((r2) => window.setTimeout(r2, POLL_MS)),
        d.then((ok) => (ok ? undefined : new Promise(() => undefined))),
      ]);
    }
    useServerStatus.setState({ state: 'down', retryAt: Date.now() + DOWN_RETRY_MS, limit: null });
    scheduleRecheck(10_000);
    return false;
  })().finally(() => { current = null; });
  return current;
}

/** While down, busy or suspended, keep checking quietly so the page notices when the server is back. */
let recheck: number | undefined;
function scheduleRecheck(delay: number) {
  window.clearTimeout(recheck);
  recheck = window.setTimeout(async () => {
    const st = useServerStatus.getState().state;
    if (!(st === 'down' || isLimited(st)) || current) return;
    const r = await probe();
    if (applyProbe(r)) return;
    if (!r.busy && !r.suspended) wakeDirect(); // still asleep: keep nudging it awake
    const now = useServerStatus.getState().state;
    if (now === 'down') scheduleRecheck(Math.min(60_000, delay * 1.5));
    else if (isLimited(now)) scheduleRecheck(now === 'suspended' ? 5 * 60_000 : 60_000);
  }, delay);
}

/** Start a fresh attempt after giving up (the "Try again" button, or the visitor doing something again). */
export function retryWake(): Promise<boolean> {
  const st = useServerStatus.getState().state;
  if (st === 'down' || isLimited(st)) {
    useServerStatus.setState({ state: 'waking', since: Date.now(), estimateS: learned(), readyAt: null, retryAt: null, limit: null });
  }
  return ensureAwake();
}

/** One check now (the "Check now" button while a limit is shown): no countdown unless the server is simply asleep. */
export async function checkNow(): Promise<boolean> {
  const r = await probe();
  if (!r.ok && !r.busy && !r.suspended) return retryWake();
  return applyProbe(r);
}

/** One sentence for the visitor about the current limit or outage, with the estimated time to come back. */
export function limitMessage(s: Pick<ServerStatus, 'state' | 'retryAt' | 'limit'>, now = Date.now()): string {
  const when = s.retryAt ? comeBack(s.retryAt, now) : 'in a few minutes';
  if (s.state === 'suspended') return `BHARAT 3D's free server has reached its monthly limit. Please come back ${when}.`;
  if (s.state === 'busy') return `BHARAT 3D is getting too much traffic right now. Please come back ${when}.`;
  return `The free server is overloaded right now and did not start. Please come back ${when}.`;
}

/** Track a user action that is waiting for the server (shows the full card instead of the small pill). */
export function waitingDelta(d: number) {
  useServerStatus.setState((s) => ({ waiting: Math.max(0, s.waiting + d) }));
}

/** Seconds left on the countdown (can go below zero when a start-up runs long). */
export function secondsLeft(s: ServerStatus, now = Date.now()): number {
  return s.since ? s.estimateS - (now - s.since) / 1000 : s.estimateS;
}

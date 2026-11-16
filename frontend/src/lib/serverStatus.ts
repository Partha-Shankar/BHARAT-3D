/**
 * Is the API server awake, and if not, how long until it is?
 *
 * The API runs on a free Render instance that sleeps after 15 minutes without traffic. Render documents "about one
 * minute" to start it again (render.com/docs/free); measured on the live site on 2026-11-16: 52 s from the first
 * request. Every API call goes through lib/api.ts, which asks this module to check the server whenever a call is slow
 * or fails with a "server not running" answer. While the server starts, the app shows a countdown (inside the sign-in
 * form, or components/ServerStatusBanner.tsx elsewhere), new calls wait instead of failing, and calls that failed
 * because the server was asleep are sent again by themselves.
 *
 * The wait never gives up. When the estimate runs out, the countdown adds 30 seconds and counts down again, with words
 * that say honestly how the start-up is going, until the server answers and the waiting action (a sign-in, opening
 * an area) finishes by itself.
 *
 * Free plans also have limits. When one is reached the visitor is told so, with an estimated time to come back, and the
 * page keeps checking quietly:
 *  - "busy": too many requests (HTTP 429). Cloudflare's free daily allowance resets at 00:00 UTC; otherwise the
 *    host's Retry-After, or 15 minutes;
 *  - "suspended": the host paused the service (Render's free monthly hours or bandwidth): back on the 1st.
 */
import { create } from 'zustand';

export type ServerState = 'unknown' | 'awake' | 'waking' | 'busy' | 'suspended';
export type Limit = 'traffic' | 'daily' | 'monthly';

interface ServerStatus {
  state: ServerState;
  /** when the current wake-up began (ms since epoch) */
  since: number | null;
  /** expected wake-up length in seconds (Render's "about one minute", adjusted by earlier wake-ups on this browser) */
  estimateS: number;
  /** user actions currently waiting for the server */
  waiting: number;
  /** when the server came back (for the short "ready" message) */
  readyAt: number | null;
  /** it came back after a limit (busy or suspended), so the visitor may have to repeat the last action */
  readyAfterLimit: boolean;
  /** busy or suspended: estimated time the visitor can come back (ms since epoch) */
  retryAt: number | null;
  /** which limit was reached (busy / suspended) */
  limit: Limit | null;
}

const LEARN_KEY = 'b3d_wake_seconds_v3'; // v3: wake-ups learned while the default was 35 s are dropped
const DEFAULT_WAKE_S = 60; // Render: "about one minute"; measured 52 s on the live site (2026-11-16)
const MIN_WAKE_S = 45;
const MAX_WAKE_S = 90;
/** When the estimate runs out, the countdown adds this many seconds and counts down to 1 again. */
export const EXTRA_S = 30;
const POLL_MS = 2000;
const WAKE_KEY = 'b3d_wake_url';
const DIRECT_SPACING_MS = 5000; // at most one direct wake-up request every 5 s
const DIRECT_TIMEOUT_MS = 90_000; // Render holds a direct request while the instance starts (about a minute)
const BUSY_DEFAULT_MS = 15 * 60_000; // "too many requests" without the host's own estimate
const AWAY_RECHECK_MS = 10 * 60_000; // back on the tab after this long: check the server before the next click

function learned(): number {
  try {
    const v = JSON.parse(localStorage.getItem(LEARN_KEY) || '[]') as number[];
    if (Array.isArray(v) && v.length) {
      const avg = v.reduce((a, b) => a + b, 0) / v.length;
      // a little more than the average: finishing early feels fine, running over does not
      return Math.round(Math.min(MAX_WAKE_S, Math.max(MIN_WAKE_S, avg * 1.15)));
    }
  } catch { /* storage unavailable */ }
  return DEFAULT_WAKE_S;
}

function learn(seconds: number) {
  if (!(seconds > 3 && seconds < 600)) return;
  try {
    const v = JSON.parse(localStorage.getItem(LEARN_KEY) || '[]') as number[];
    localStorage.setItem(LEARN_KEY, JSON.stringify([...(Array.isArray(v) ? v : []), Math.round(seconds)].slice(-5)));
  } catch { /* storage unavailable */ }
}

export const useServerStatus = create<ServerStatus>(() => ({
  state: 'unknown', since: null, estimateS: learned(), waiting: 0, readyAt: null, readyAfterLimit: false, retryAt: null, limit: null,
}));

export const isLimited = (s: ServerState) => s === 'busy' || s === 'suspended';

// ------------------------------------------------------------------------------------------------- the countdown
export interface WakeClock {
  /** whole seconds left in the current round: counts down to 1, never shows 0 */
  left: number;
  /** 0 during the first estimate, then 1, 2, … for each further 30 s */
  round: number;
  /** seconds since the wake-up began */
  elapsed: number;
  /** progress bar, 0–99: keeps moving, never goes backwards, and only fills when the server answers */
  pct: number;
}

/** Where the wake-up countdown stands: the estimate first, then rounds of EXTRA_S seconds until the server answers. */
export function wakeClock(s: Pick<ServerStatus, 'since' | 'estimateS'>, now = Date.now()): WakeClock {
  const est = Math.max(s.estimateS, 1);
  const elapsed = s.since ? Math.max(0, (now - s.since) / 1000) : 0;
  const round = elapsed < est ? 0 : Math.floor((elapsed - est) / EXTRA_S) + 1;
  const end = est + round * EXTRA_S;
  return { left: Math.max(1, Math.ceil(end - elapsed)), round, elapsed, pct: Math.min(99, 99 * (1 - Math.exp((-1.6 * elapsed) / est))) };
}

export interface WakeCopy {
  /** heading of the status card */
  title: string;
  /** one or two plain sentences under the heading */
  note: string;
  /** short lines that cycle beside the countdown */
  steps: string[];
  /** the sign-in button while it waits (the countdown is added after it) */
  button: string;
}

const minutesText = (s: number) => (s < 150 ? 'over 2 minutes' : `about ${Math.round(s / 60)} minutes`);

/**
 * The words for each round of a wake-up, so the sign-in form and the banner always say the same, true thing: what is
 * happening, roughly how long, and that the waiting action finishes by itself.
 */
export function wakeCopy(round: number, elapsedS: number, forSignIn: boolean): WakeCopy {
  const done = forSignIn ? 'you will be signed in automatically' : 'what you asked for continues by itself';
  if (round <= 0) {
    return {
      title: 'Waking up the server',
      note: `BHARAT 3D runs on a free server that sleeps when nobody is using it. It is starting now (this usually takes about a minute), and ${done}. No need to click again.`,
      steps: ['Starting the server…', 'Loading the 3D engine…', 'Restoring surveyed areas from storage…', 'Opening the property registry…', 'Almost ready…'],
      button: 'Waking the server…',
    };
  }
  if (round === 1) {
    return {
      title: 'Taking a little longer than usual',
      note: `The free server is a little slower to start this time. ${forSignIn ? 'Your sign-in is' : 'Your request is'} still waiting, and ${done}.`,
      steps: ['Almost ready…', 'Finishing start-up…'],
      button: 'Almost ready…',
    };
  }
  if (round === 2) {
    return {
      title: 'Still starting',
      note: `Free servers are sometimes slow to start. This page checks again every few seconds, and ${done} as soon as it answers.`,
      steps: ['Still starting…', 'Checking again…'],
      button: 'Still starting…',
    };
  }
  return {
    title: 'The free server is slow to start right now',
    note: `It has been ${minutesText(elapsedS)}, longer than usual. This page keeps trying by itself, and ${done} as soon as the server answers. You can leave this tab open.`,
    steps: ['Still trying…', 'Checking again…'],
    button: 'Still trying…',
  };
}

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
 * sleeps it answers those with an instant 502 and does not start (seen for 25+ minutes on 2026-11-15; the proxy's own
 * status check sends no forwarded headers and still gets the 502, so this is not about the headers it passes on). A
 * request sent straight from the visitor's browser to the backend's own address starts it in about a minute. The
 * status check tells us that address (`wake`) and it is remembered for the next visit; until then the address this
 * site is deployed with is used, so the very first wake-up never depends on the status check.
 */
const DEFAULT_WAKE_URL = String(import.meta.env.VITE_WAKE_URL || 'https://bharat-3d-api.onrender.com/health');

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
    if (v && WAKE_RE.test(v)) return v;
  } catch { /* storage unavailable */ }
  return WAKE_RE.test(DEFAULT_WAKE_URL) ? DEFAULT_WAKE_URL : null;
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
  if (s.state === 'waking' || isLimited(s.state)) {
    if (s.state === 'waking' && s.since) learn((Date.now() - s.since) / 1000); // a limit is not a normal start-up
    window.clearTimeout(recheck);
    useServerStatus.setState({ state: 'awake', since: null, readyAt: Date.now(), readyAfterLimit: s.state !== 'waking',
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

/** Lets the wait look again at once (the tab became visible again, or the connection came back). */
let lookAgain: (() => void) | null = null;
function nudge() {
  const f = lookAgain;
  lookAgain = null;
  f?.();
}
const nudged = () => new Promise<void>((resolve) => { lookAgain = resolve; });

/** Checks every 2 s for the first 2 minutes, then a little less often during a very long start-up. */
const pollDelay = (waitedMs: number) => (waitedMs < 120_000 ? POLL_MS : waitedMs < 300_000 ? 4000 : 8000);

/**
 * Resolves true once the server answers; false only when a free-plan limit was reached (nothing to wait for then).
 * A sleeping server is never given up on: the countdown keeps adding time (see wakeClock) until it answers. Every
 * caller shares one check, so a burst of slow calls makes one wake-up and one countdown. `startedAt` is when the first
 * affected call began, which makes the countdown honest. While the device itself is offline the wait pauses: a
 * missing connection is not a sleeping server.
 */
export function ensureAwake(startedAt?: number): Promise<boolean> {
  if (current) return current;
  current = (async () => {
    let shown = false;
    for (;;) {
      if (offline()) {
        await onlineAgain();
        continue;
      }
      const r = await probe();
      if (applyProbe(r)) return true;
      if (r.busy || r.suspended) return false;
      // Asleep: make sure a direct request is on its way, since that is what starts the instance.
      const d = wakeDirect();
      if (!shown) {
        shown = true;
        if (useServerStatus.getState().state !== 'waking') {
          const now = Date.now();
          useServerStatus.setState({ state: 'waking', since: Math.min(startedAt ?? now, now), estimateS: learned(), readyAt: null, retryAt: null, limit: null });
        }
      }
      const since = useServerStatus.getState().since ?? Date.now();
      // Next check after a short pause, or at once when the direct request reports that the backend is up, or when
      // the visitor comes back to this tab (a phone may have paused the page meanwhile).
      await Promise.race([
        new Promise((r2) => window.setTimeout(r2, pollDelay(Date.now() - since))),
        d.then((ok) => (ok ? undefined : new Promise(() => undefined))),
        nudged(),
      ]);
    }
  })().finally(() => { current = null; lookAgain = null; });
  return current;
}

/** While a limit is shown, keep checking quietly so the page notices when it is over. */
let recheck: number | undefined;
function scheduleRecheck(delay: number) {
  window.clearTimeout(recheck);
  recheck = window.setTimeout(async () => {
    if (!isLimited(useServerStatus.getState().state) || current) return;
    const r = await probe();
    if (applyProbe(r)) return;
    if (!r.busy && !r.suspended) { // the limit is over but the server fell asleep meanwhile: wake it, with the countdown
      ensureAwake();
      return;
    }
    const now = useServerStatus.getState().state;
    if (isLimited(now)) scheduleRecheck(now === 'suspended' ? 5 * 60_000 : 60_000);
  }, delay);
}

/** One check now (the "Check now" button while a limit is shown): a countdown if the server is simply asleep. */
export async function checkNow(): Promise<boolean> {
  const r = await probe();
  if (!r.ok && !r.busy && !r.suspended) return ensureAwake();
  return applyProbe(r);
}

/** The heading for a limit (the banner and the sign-in page use the same words). */
export function limitTitle(state: ServerState): string {
  return state === 'suspended' ? 'BHARAT 3D has reached its free monthly limit' : 'BHARAT 3D is getting too much traffic right now';
}

/** One sentence for the visitor about the current limit, with the estimated time to come back. */
export function limitMessage(s: Pick<ServerStatus, 'state' | 'retryAt' | 'limit'>, now = Date.now()): string {
  const when = s.retryAt ? comeBack(s.retryAt, now) : 'in a few minutes';
  if (s.state === 'suspended') return `BHARAT 3D's free server has reached its monthly limit. Please come back ${when}.`;
  return `BHARAT 3D is getting too much traffic right now. Please come back ${when}.`;
}

/** Track a user action that is waiting for the server (shows the full card instead of the small pill). */
export function waitingDelta(d: number) {
  useServerStatus.setState((s) => ({ waiting: Math.max(0, s.waiting + d) }));
}

// Coming back to the tab: during a wake-up, look again at once (phones pause background pages, and a request may have
// been cut off). After a long time away, check the server before the visitor clicks, so a sleeping one starts early.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      return;
    }
    const st = useServerStatus.getState().state;
    if (st === 'waking') {
      wakeDirect();
      nudge();
    } else if (st === 'awake' && hiddenAt && Date.now() - hiddenAt > AWAY_RECHECK_MS) {
      ensureAwake();
    }
  });
  window.addEventListener('online', () => nudge());
}

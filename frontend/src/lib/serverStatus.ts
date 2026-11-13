/**
 * Is the API server awake?
 *
 * The API runs on a free Render instance that sleeps after 15 minutes without traffic and needs about half a minute
 * to start again. Every API call goes through lib/api.ts, which asks this module to check the server whenever a call
 * is slow or fails with a "server not running" answer. While the server starts, the app shows a countdown
 * (components/ServerStatusBanner.tsx), new calls wait instead of failing, and failed calls are retried by themselves.
 */
import { create } from 'zustand';

export type ServerState = 'unknown' | 'awake' | 'waking' | 'down';

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
}

const LEARN_KEY = 'b3d_wake_seconds';
const DEFAULT_WAKE_S = 35; // measured on the live server: 30-35 s from the first request
const MAX_WAIT_MS = 180_000; // after this the banner says the server cannot be reached
const POLL_MS = 2000;

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
  state: 'unknown', since: null, estimateS: learned(), waiting: 0, readyAt: null, readyAfterDown: false,
}));

const DIRECT = import.meta.env.VITE_API_URL ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '') : '';

/** One quick check. True when the server answers (or when this deployment cannot tell, so nothing is blocked). */
async function probe(): Promise<boolean> {
  try {
    const res = await fetch(DIRECT ? `${DIRECT}/health` : '/api/__status', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
    if (DIRECT) return res.ok;
    if (res.status === 404) return true; // no status endpoint here (local development behind the Vite proxy)
    const body = await res.json().catch(() => null) as { state?: string } | null;
    return res.ok && body?.state === 'awake';
  } catch {
    return false;
  }
}

function markAwake() {
  const s = useServerStatus.getState();
  if (s.state === 'waking' || s.state === 'down') {
    if (s.state === 'waking' && s.since) learn((Date.now() - s.since) / 1000); // an outage is not a normal start-up
    window.clearTimeout(recheck);
    useServerStatus.setState({ state: 'awake', since: null, readyAt: Date.now(), readyAfterDown: s.state === 'down', estimateS: learned() });
  } else if (s.state !== 'awake') {
    useServerStatus.setState({ state: 'awake' });
  }
}

/** A call just succeeded: the server is up. */
export const noteServerOk = markAwake;

let current: Promise<boolean> | null = null;

/**
 * Resolves true once the server answers, or false after MAX_WAIT_MS. Every caller shares one check, so a burst of
 * slow calls makes one wake-up and one banner. `startedAt` is when the first affected call began, which makes the
 * countdown honest.
 */
export function ensureAwake(startedAt?: number): Promise<boolean> {
  if (current) return current;
  current = (async () => {
    const t0 = Date.now();
    let shown = false;
    while (Date.now() - t0 < MAX_WAIT_MS) {
      if (await probe()) {
        markAwake();
        return true;
      }
      if (!shown) {
        shown = true;
        const s = useServerStatus.getState();
        if (s.state !== 'waking') {
          useServerStatus.setState({ state: 'waking', since: Math.min(startedAt ?? t0, t0), estimateS: learned(), readyAt: null });
        }
      }
      await new Promise((r) => window.setTimeout(r, POLL_MS));
    }
    useServerStatus.setState({ state: 'down' });
    scheduleRecheck(10_000);
    return false;
  })().finally(() => { current = null; });
  return current;
}

/** After giving up, keep checking quietly (every 10 s, slowing to once a minute) so the page notices when it is back. */
let recheck: number | undefined;
function scheduleRecheck(delay: number) {
  window.clearTimeout(recheck);
  recheck = window.setTimeout(async () => {
    if (useServerStatus.getState().state !== 'down' || current) return;
    if (await probe()) markAwake();
    else if (useServerStatus.getState().state === 'down') scheduleRecheck(Math.min(60_000, delay * 1.5));
  }, delay);
}

/** Start a fresh attempt after giving up (the "Try again" button, or the visitor doing something again). */
export function retryWake(): Promise<boolean> {
  if (useServerStatus.getState().state === 'down') {
    useServerStatus.setState({ state: 'waking', since: Date.now(), estimateS: learned(), readyAt: null });
  }
  return ensureAwake();
}

/** Track a user action that is waiting for the server (shows the full card instead of the small pill). */
export function waitingDelta(d: number) {
  useServerStatus.setState((s) => ({ waiting: Math.max(0, s.waiting + d) }));
}

/** Seconds left on the countdown (can go below zero when a start-up runs long). */
export function secondsLeft(s: ServerStatus, now = Date.now()): number {
  return s.since ? s.estimateS - (now - s.since) / 1000 : s.estimateS;
}

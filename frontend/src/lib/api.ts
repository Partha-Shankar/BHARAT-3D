import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getToken, removeToken, removeUser } from './auth';
import { sessionId } from './track';
import {
  busyEstimate, checkNow, ensureAwake, isLimited, limitMessage, markLimited, nextMonthStartUtc, noteServerOk, retryWake,
  useServerStatus, waitingDelta,
} from './serverStatus';

const apiBaseUrl = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  // Long enough for a call that arrives while the free server is starting (~35 s) to finish by itself.
  timeout: 75000,
});

// --------------------------------------------------------------------------------------------- sleeping-server handling
type Cfg = InternalAxiosRequestConfig & { __started?: number; __slow?: number; __waitingSlow?: boolean; __wakeRetries?: number };
const EDGE_ONLY = /\/__(track|wake|status|store|analytics)\b/; // answered by the edge, never by the sleeping server
const SLOW_MS = 2500; // a call this slow makes us check whether the server is asleep
const MAX_RETRIES = 2;
const ACTION_BUDGET_MS = 200_000; // one action never waits longer than this in total, however many retries
export const SERVER_ASLEEP = 'ERR_SERVER_ASLEEP';
export const SERVER_BUSY = 'ERR_SERVER_BUSY'; // a free-plan limit was reached; the message says when to come back

/** Calls that are safe to send again when it is unclear whether the first attempt reached the server. */
const idempotent = (c: Cfg) => (c.method || 'get').toLowerCase() === 'get'
  || /\/auth\/login|\/realgen\/preflight|\/realgen\/generate/.test(c.url || ''); // sign-in; generation is de-duplicated per area

function settle(c?: Cfg) {
  if (!c) return;
  window.clearTimeout(c.__slow);
  if (c.__waitingSlow) {
    c.__waitingSlow = false;
    waitingDelta(-1);
  }
}

api.interceptors.request.use(
  async (config) => {
    const c = config as Cfg;
    const token = getToken();
    if (token && c.headers) {
      c.headers.Authorization = `Bearer ${token}`;
    }
    if (c.headers) c.headers['X-B3D-Session'] = sessionId(); // ties requests to the visit in analytics
    if (!EDGE_ONLY.test(c.url || '')) {
      // While the server is starting, hold new calls instead of letting them fail; they go out when it answers.
      // If we had given up, doing something again counts as "try again". If the wait gives up, the call is not sent.
      const state = useServerStatus.getState().state;
      if (isLimited(state)) {
        // A limit was reached: do not send until the estimated time has passed, then check once before sending.
        const s = useServerStatus.getState();
        if ((s.retryAt && Date.now() < s.retryAt) || !(await checkNow())) {
          throw new AxiosError(limitMessage(useServerStatus.getState()), SERVER_BUSY, c);
        }
      } else if (state === 'waking' || state === 'down') {
        c.__started = c.__started ?? Date.now();
        waitingDelta(1);
        let awake = false;
        try { awake = await (state === 'down' ? retryWake() : ensureAwake()); } finally { waitingDelta(-1); }
        if (!awake) {
          const s = useServerStatus.getState();
          throw new AxiosError(limitMessage(s), isLimited(s.state) ? SERVER_BUSY : SERVER_ASLEEP, c);
        }
      }
      c.__started = c.__started ?? Date.now();
      c.__slow = window.setTimeout(() => {
        c.__waitingSlow = true;
        waitingDelta(1);
        ensureAwake(c.__started); // shows the countdown only if the server really is asleep
      }, SLOW_MS);
    }
    return c;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    const c = response.config as Cfg;
    settle(c);
    if (!EDGE_ONLY.test(c.url || '')) noteServerOk();
    return response;
  },
  async (error: AxiosError) => {
    const c = error?.config as Cfg | undefined;
    settle(c);
    const status = error?.response?.status;
    const url: string = c?.url || '';
    // An expired or invalid session sends the user back to sign in (login failures are handled by the form).
    if (status === 401 && !url.includes('/auth/login') && window.location.pathname !== '/login') {
      removeToken();
      removeUser();
      window.location.assign('/login');
      return Promise.reject(error);
    }
    // 502/503: the server was not running, so the call never reached it and can always be repeated.
    // No answer at all, a gateway timeout or our own timeout: repeat only calls that are safe to repeat.
    // A free-plan limit: show it with the time to come back, and do not repeat the call.
    if (c && !EDGE_ONLY.test(url) && error.code !== SERVER_BUSY) {
      const body = typeof error.response?.data === 'string' ? error.response.data : '';
      if (status === 429) {
        const b = busyEstimate(error.response?.headers?.['retry-after'] as string | undefined, body);
        markLimited('busy', b.retryAt, b.limit);
        error.message = limitMessage(useServerStatus.getState());
        return Promise.reject(error);
      }
      if (status === 503 && /suspend/i.test(body)) {
        markLimited('suspended', nextMonthStartUtc(), 'monthly');
        error.message = limitMessage(useServerStatus.getState());
        return Promise.reject(error);
      }
    }
    // Never after the wait has already given up for this action, and never beyond the action's total budget.
    const notRunning = status === 502 || status === 503;
    const unclear = !error.response || status === 504;
    const gaveUp = error.code === SERVER_ASLEEP || error.code === SERVER_BUSY
      || useServerStatus.getState().state === 'down' || isLimited(useServerStatus.getState().state);
    const inBudget = !c?.__started || Date.now() - c.__started < ACTION_BUDGET_MS;
    if (c && !gaveUp && inBudget && !EDGE_ONLY.test(url) && (notRunning || (unclear && idempotent(c))) && (c.__wakeRetries ?? 0) < MAX_RETRIES) {
      c.__wakeRetries = (c.__wakeRetries ?? 0) + 1;
      waitingDelta(1);
      let awake = false;
      try {
        awake = await ensureAwake(c.__started);
      } finally {
        waitingDelta(-1);
      }
      if (awake) return api.request(c);
    }
    return Promise.reject(error);
  }
);

/** Start waking the API as soon as any page opens (free hosting sleeps when idle); fire-and-forget, once. */
let woken = false;
export function wakeApi() {
  if (woken || typeof fetch === 'undefined') return;
  woken = true;
  const url = import.meta.env.VITE_API_URL ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, '')}/health` : '/api/__wake';
  fetch(url, { cache: 'no-store' }).catch(() => undefined);
  ensureAwake(); // if the server is asleep, the countdown appears while the visitor reads or types
}

export default api;

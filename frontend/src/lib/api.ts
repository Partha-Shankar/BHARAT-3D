import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getToken } from './auth';
import { sessionId } from './track';
import {
  busyEstimate, checkNow, ensureAwake, isLimited, limitMessage, markLimited, nextMonthStartUtc, noteServerOk,
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
// Each repeat first waits until the server answers (however long its start-up takes), so this only stops a call that
// keeps failing after the server is up.
const MAX_RETRIES = 4;
export const SERVER_BUSY = 'ERR_SERVER_BUSY'; // a free-plan limit was reached; the message says when to come back
export const OFFLINE = 'ERR_OFFLINE'; // this device has no internet connection: nothing to do with the server
export const OFFLINE_MESSAGE = 'You are offline. Check your internet connection, then try again.';
/** Fired on window when the server rejects the current session (expired or invalid); App sends the visitor to sign in. */
export const SESSION_ENDED_EVENT = 'b3d:session-ended';

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

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
    if (!EDGE_ONLY.test(c.url || '') && isOffline()) {
      // No connection on this device: say so at once instead of starting a server wake-up countdown.
      throw new AxiosError(OFFLINE_MESSAGE, OFFLINE, c);
    }
    if (!EDGE_ONLY.test(c.url || '')) {
      // While the server is starting, hold new calls instead of letting them fail; they go out when it answers.
      const state = useServerStatus.getState().state;
      if (isLimited(state)) {
        // A limit was reached: do not send until the estimated time has passed, then check once before sending.
        const s = useServerStatus.getState();
        if ((s.retryAt && Date.now() < s.retryAt) || !(await checkNow())) {
          throw new AxiosError(limitMessage(useServerStatus.getState()), SERVER_BUSY, c);
        }
      } else if (state === 'waking') {
        c.__started = c.__started ?? Date.now();
        waitingDelta(1);
        let awake = false;
        try { awake = await ensureAwake(); } finally { waitingDelta(-1); }
        if (!awake) throw new AxiosError(limitMessage(useServerStatus.getState()), SERVER_BUSY, c); // only a limit stops the wait
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
    if (error?.code === OFFLINE) return Promise.reject(error);
    // An expired or invalid session sends the user back to sign in (login failures are handled by the form). Only
    // when the rejected token is still the current one: a late answer to a request sent with an older token must
    // never sign out a session that started since.
    if (status === 401 && !url.includes('/auth/login')) {
      const sent = String(c?.headers?.Authorization ?? '').replace(/^Bearer\s+/i, '');
      const current = getToken();
      if (current && sent === current) {
        window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT));
      }
      return Promise.reject(error);
    }
    // No answer because this device went offline: report that, without waking the server.
    if (!error?.response && isOffline()) {
      error.code = OFFLINE;
      error.message = OFFLINE_MESSAGE;
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
    // Wait for the server and send again: never while a limit is shown (it would only be refused again).
    const notRunning = status === 502 || status === 503;
    const unclear = !error.response || status === 504;
    const limited = error.code === SERVER_BUSY || isLimited(useServerStatus.getState().state);
    if (c && !limited && !EDGE_ONLY.test(url) && (notRunning || (unclear && idempotent(c))) && (c.__wakeRetries ?? 0) < MAX_RETRIES) {
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
  if (isOffline()) {
    // Nothing can reach the server now; start as soon as the connection is back.
    window.addEventListener('online', () => wakeApi(), { once: true });
    return;
  }
  woken = true;
  const url = import.meta.env.VITE_API_URL ? `${String(import.meta.env.VITE_API_URL).replace(/\/$/, '')}/health` : '/api/__wake';
  fetch(url, { cache: 'no-store' }).catch(() => undefined);
  ensureAwake(); // if the server is asleep, it starts while the visitor reads or types
}

export default api;

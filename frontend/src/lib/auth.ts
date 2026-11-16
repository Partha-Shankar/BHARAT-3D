/**
 * The signed-in session in this browser: the access token and the user it belongs to, kept in localStorage so a
 * reload or a new tab stays signed in. Tokens expire on the server after 8 hours; `isTokenExpired` lets the app
 * notice that before the first request fails, so a returning visitor goes straight to a friendly sign-in page.
 */
import type { User } from '../types';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
export const AUTH_KEYS = [TOKEN_KEY, USER_KEY] as const;

/** Tokens this close to their expiry count as expired, so a page never opens just before its calls start failing. */
const EXPIRY_MARGIN_MS = 60_000;

export const setToken = (token: string) => {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable: signed in for this page only */ }
};

export const getToken = (): string | null => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};

export const removeToken = () => {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
};

export const setUser = (user: User) => {
  try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* storage unavailable */ }
};

export const getUser = (): User | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
};

export const removeUser = () => {
  try { localStorage.removeItem(USER_KEY); } catch { /* storage unavailable */ }
};

/** Expiry time of a JWT in ms since the epoch, or null when the token carries none or cannot be read. */
export function tokenExpiry(token: string | null): number | null {
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const exp = Number(JSON.parse(json)?.exp);
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** True when the token is missing, unreadable or past (or about to pass) its expiry. */
export function isTokenExpired(token: string | null, now = Date.now()): boolean {
  if (!token) return true;
  const exp = tokenExpiry(token);
  if (exp === null) return token.split('.').length !== 3; // not a JWT at all: unusable
  return exp - EXPIRY_MARGIN_MS <= now;
}

import { create } from 'zustand';
import { User } from '../types';
import { AUTH_KEYS, getToken, getUser, isTokenExpired, removeToken, removeUser, setToken, setUser } from '../lib/auth';
import api from '../lib/api';
import { requestPreciseLocation, track } from '../lib/track';

/** Why the visitor is back on the sign-in page without having signed out (shown there as a short note). */
export type SignedOutReason = 'expired' | 'elsewhere' | null;

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** set when the session ended by itself (expired token, signed out in another tab) */
  signedOutReason: SignedOutReason;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  /** forget an expired or rejected session without the "signed out" analytics event */
  endSession: (reason: Exclude<SignedOutReason, null>) => void;
  initialize: () => void;
}

/**
 * The stored session, if it is complete and still valid. An expired one is removed and reported, so the sign-in page
 * can say why the visitor has to sign in again.
 */
function storedSession(): { session: { user: User; token: string } | null; expired: boolean } {
  const token = getToken();
  const user = getUser();
  if (!token || !user) return { session: null, expired: false };
  if (isTokenExpired(token)) {
    removeToken();
    removeUser();
    return { session: null, expired: true };
  }
  return { session: { user, token }, expired: false };
}

const initial = storedSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initial.session?.user ?? null,
  token: initial.session?.token ?? null,
  isAuthenticated: !!initial.session,
  isLoading: false,
  signedOutReason: initial.expired ? 'expired' : null,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      // a cold start of the free API can take ~50 s, so sign-in gets more time than ordinary calls
      const response = await api.post('/auth/login', { email: email.trim(), password }, { timeout: 90000 });
      const { access_token, user } = response.data as { access_token: string; user: User };
      setToken(access_token);
      setUser(user);
      set({ user, token: access_token, isAuthenticated: true, isLoading: false, signedOutReason: null });
      requestPreciseLocation(); // after sign-in only; falls back to the IP location if declined
      return user;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    track({ kind: 'logout' }, true); // sent with the token still present, so the edge knows who signed out
    removeToken();
    removeUser();
    set({ user: null, token: null, isAuthenticated: false, isLoading: false, signedOutReason: null });
  },

  endSession: (reason) => {
    removeToken();
    removeUser();
    if (get().isAuthenticated || get().signedOutReason !== reason) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false, signedOutReason: reason });
    }
  },

  initialize: () => {
    const { session } = storedSession();
    if (session) set({ user: session.user, token: session.token, isAuthenticated: true });
    else set({ user: null, token: null, isAuthenticated: false });
  },
}));

/**
 * Keep every open tab in step: signing out (or in as someone else) in one tab applies to the others at once, instead
 * of their next request failing with a confusing error.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== null && !(AUTH_KEYS as readonly string[]).includes(e.key)) return;
    const before = useAuthStore.getState();
    const { session } = storedSession();
    if (!session) {
      if (before.isAuthenticated) useAuthStore.setState({ user: null, token: null, isAuthenticated: false, signedOutReason: 'elsewhere' });
    } else if (session.token !== before.token || session.user.email !== before.user?.email || session.user.role !== before.user?.role) {
      // the token and the user are written one after the other, so compare both
      useAuthStore.setState({ user: session.user, token: session.token, isAuthenticated: true, signedOutReason: null });
    }
  });
}

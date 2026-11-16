/**
 * Where each role works, and whether a role may open a given address. Used by sign-in (where to go next), the route
 * guard (deep links and old bookmarks) and the workspace pages.
 */
import type { UserRole } from '../types';

const BASE: Record<string, string> = {
  SURVEYOR: '/surveyor',
  ADMIN: '/surveyor',
  MUNICIPALITY: '/municipality',
  UTILITY_OPERATOR: '/utility',
  CITIZEN: '/citizen',
};

const WORKSPACES = ['/surveyor', '/municipality', '/utility', '/citizen'];
const EDITORS = new Set<string>(['SURVEYOR', 'ADMIN']);

export const ROLE_LABEL: Record<string, string> = {
  SURVEYOR: 'Surveyor', ADMIN: 'Admin', MUNICIPALITY: 'Municipality', UTILITY_OPERATOR: 'Utility operator', CITIZEN: 'Citizen',
};

/** Base path of a role's workspace (`/surveyor` for surveyors and admins). */
export const roleBase = (role?: UserRole | string | null): string => BASE[String(role)] ?? '/surveyor';

/** The page a role lands on after signing in. */
export const homeFor = (role?: UserRole | string | null): string => `${roleBase(role)}/dashboard`;

export const canEdit = (role?: UserRole | string | null): boolean => EDITORS.has(String(role));

/**
 * A same-site path that is safe to return to after signing in, or null. Rejects other sites (`//host`, `http:`),
 * the sign-in page itself and anything that is not a plain path.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || typeof next !== 'string') return null;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  if (/^\/login(?:[/?#]|$)/.test(next)) return null;
  return next;
}

/**
 * The address a role should open for `path`: the path itself when the role may use it, otherwise the nearest page it
 * may use (the same 3D area outside the editor, or the role's own dashboard).
 */
export function allowedPath(role: UserRole | string | null | undefined, path: string): string {
  const pathname = path.split(/[?#]/)[0];
  const editor = pathname.match(/^\/3d-editor\/([^/]+)/);
  if (editor) return canEdit(role) ? path : `/3d-world/${editor[1]}`;
  const workspace = WORKSPACES.find((w) => pathname === w || pathname.startsWith(`${w}/`));
  if (workspace && workspace !== roleBase(role)) return homeFor(role);
  return path;
}

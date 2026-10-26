// HS256 JSON Web Tokens at the edge (the backend signs them with SECRET_KEY; Pages holds the same key as JWT_SECRET).

export type Claims = { sub?: string; email?: string; name?: string; role?: string; exp?: number };

const b64urlToBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

/** Payload without checking the signature: for labelling analytics only, never for access decisions. */
export function peek(authorization: string | null): Claims | null {
  const t = authorization?.replace(/^Bearer\s+/i, '');
  const parts = t?.split('.');
  if (!parts || parts.length !== 3) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }
}

/** Verified, unexpired claims, or null. */
export async function verify(authorization: string | null, secret: string | undefined): Promise<Claims | null> {
  const t = authorization?.replace(/^Bearer\s+/i, '');
  const parts = t?.split('.');
  if (!secret || !parts || parts.length !== 3) return null;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlToBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const claims: Claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
    if (claims.exp && claims.exp * 1000 < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

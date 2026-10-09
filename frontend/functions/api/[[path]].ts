// Cloudflare Pages Function: same-origin proxy for /api/* to the FastAPI backend.
// Active when the frontend is built without VITE_API_URL (the app then calls /api on the Pages domain).
// Set BACKEND_ORIGIN in the Pages project (Settings → Variables), e.g. https://bharat-3d-backend.onrender.com
//
// Caching policy: only anonymous GETs of immutable public assets (satellite textures) are cached at the edge.
// Authenticated and user-specific responses always go straight to the origin.

const DEFAULT_ORIGIN = 'https://bharat-3d-backend.onrender.com';
const CACHEABLE = /^\/api\/realgen\/scenes\/[a-f0-9]+\/(texture|context)\.jpg$/;

export async function onRequest(context: any): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = String(env?.BACKEND_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
  const target = new URL(url.pathname + url.search, origin);
  const forward = new Request(target.toString(), request);

  const cacheable = request.method === 'GET' && !request.headers.has('Authorization') && CACHEABLE.test(url.pathname);
  if (!cacheable) {
    try {
      return await fetch(forward);
    } catch (err: any) {
      return gatewayError(err);
    }
  }

  const cache = (caches as any).default;
  const hit = await cache.match(request);
  if (hit) return hit;
  try {
    const res = await fetch(forward);
    if (!res.ok) return res;
    const copy = new Response(res.body, res);
    copy.headers.set('Cache-Control', 'public, max-age=86400');
    context.waitUntil(cache.put(request, copy.clone()));
    return copy;
  } catch (err: any) {
    return gatewayError(err);
  }
}

function gatewayError(err: any): Response {
  return new Response(
    JSON.stringify({ detail: 'The API is waking up or unreachable. Please retry in a few seconds.', error: String(err?.message || err) }),
    { status: 504, headers: { 'Content-Type': 'application/json' } },
  );
}

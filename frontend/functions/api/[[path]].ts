// Cloudflare Pages Function: same-origin API for /api/* in front of the FastAPI backend (Render).
//
// - Same origin: the browser calls /api on the Pages domain, so authenticated requests need no CORS preflight.
// - Satellite textures of the bundled demo areas are deployed as static files under /tex/<key>/ and served by
//   Cloudflare's CDN (immutable, one-year cache). Other textures fall back to the backend and, on a custom domain,
//   to the edge Cache API (the Cache API stores nothing on *.pages.dev).
// - Everything else is passed through unchanged; nothing user-specific is cached at the edge.
// Responses carry `X-B3D-Cache: STATIC | HIT | MISS | PASS`.

const DEFAULT_ORIGIN = 'https://bharat-3d-backend.onrender.com';
const TEXTURE = /^\/api\/realgen\/scenes\/([a-f0-9]{16})\/(texture|context)\.jpg$/;
const TEXTURE_TTL = 7 * 24 * 3600;

type Ctx = {
  request: Request;
  env: { BACKEND_ORIGIN?: string; ASSETS?: { fetch: (r: Request | string) => Promise<Response> } };
  waitUntil: (p: Promise<unknown>) => void;
};

export async function onRequest(context: Ctx): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = String(env?.BACKEND_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, '');
  const target = new URL(url.pathname + url.search, origin).toString();

  try {
    const tex = request.method === 'GET' ? url.pathname.match(TEXTURE) : null;
    if (tex) {
      // 1. bundled demo area: static file on Cloudflare's CDN
      if (env?.ASSETS) {
        const stat = await env.ASSETS.fetch(new URL(`/tex/${tex[1]}/${tex[2]}.jpg`, url).toString());
        if (stat.ok && (stat.headers.get('content-type') || '').startsWith('image/')) return tag(stat, 'STATIC');
      }
      // 2. any other area: edge cache where available (custom domains), else the backend
      const cache: Cache = (caches as any).default;
      const key = new Request(url.toString());
      const hit = await cache.match(key).catch(() => undefined);
      if (hit) return tag(hit, 'HIT');
      const res = await fetch(new Request(target, request));
      if (!res.ok) return tag(res, 'PASS');
      const out = new Response(res.body, res);
      out.headers.set('Cache-Control', `public, max-age=${TEXTURE_TTL}`);
      context.waitUntil(cache.put(key, out.clone()).catch(() => undefined));
      return tag(out, 'MISS');
    }
    return tag(await fetch(new Request(target, request)), 'PASS');
  } catch (err: any) {
    return new Response(
      JSON.stringify({ detail: 'The API is waking up or unreachable. Please retry in a few seconds.', error: String(err?.message || err) }),
      { status: 504, headers: { 'Content-Type': 'application/json', 'X-B3D-Cache': 'PASS' } },
    );
  }
}

function tag(res: Response, state: 'STATIC' | 'HIT' | 'MISS' | 'PASS'): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-B3D-Cache', state);
  return out;
}

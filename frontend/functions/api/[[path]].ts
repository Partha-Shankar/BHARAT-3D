// Cloudflare Pages Function: High-performance Edge API Proxy & Cache
// Caches read-only responses at Cloudflare Edge datacenters across India and worldwide

export async function onRequest(context: any) {
  const url = new URL(context.request.url);
  const backendOrigin = 'https://bharat-3d-backend.onrender.com';
  const targetUrl = new URL(url.pathname + url.search, backendOrigin);

  // For write operations (POST, PUT, DELETE, PATCH), pass through directly to Render
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    return fetch(targetUrl.toString(), context.request);
  }

  // Edge Caching for GET / HEAD requests
  const cache = (caches as any).default;
  const cacheKey = new Request(url.toString(), {
    headers: context.request.headers,
    method: 'GET',
  });

  // Check Cloudflare Edge Cache first (sub-millisecond retrieval)
  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const res = new Response(cachedResponse.body, cachedResponse);
      res.headers.set('X-Edge-Cache', 'HIT');
      return res;
    }
  } catch (e) {
    // If cache match fails, continue to origin
  }

  // Fetch from Render backend with Cloudflare Edge Caching instruction
  try {
    const is3DData = url.pathname.includes('/map') || 
                     url.pathname.includes('/3d') || 
                     url.pathname.includes('/buildings') || 
                     url.pathname.includes('/units') || 
                     url.pathname.includes('/infrastructure');

    const edgeTtl = is3DData ? 86400 : 3600; // 24 hours for 3D maps and models, 1 hour for other endpoints

    const response = await fetch(targetUrl.toString(), {
      method: context.request.method,
      headers: context.request.headers,
      cf: {
        cacheEverything: true,
        cacheTtl: edgeTtl,
        cacheTtlByStatus: {
          '200-299': edgeTtl,
          '404': 60,
          '500-599': 0,
        },
      },
    } as any);

    if (response.status >= 200 && response.status < 300) {
      const edgeResponse = new Response(response.body, response);
      edgeResponse.headers.set('Cache-Control', `public, max-age=${edgeTtl}, s-maxage=${edgeTtl}, stale-while-revalidate=604800`);
      edgeResponse.headers.set('CDN-Cache-Control', `max-age=${edgeTtl}`);
      edgeResponse.headers.set('Cloudflare-CDN-Cache-Control', `max-age=${edgeTtl}`);
      edgeResponse.headers.set('X-Edge-Cache', 'MISS');
      if (is3DData) {
        edgeResponse.headers.set('X-3D-Spatial-Cache', 'Cloudflare-Edge-24h');
      }

      context.waitUntil(cache.put(cacheKey, edgeResponse.clone()));
      return edgeResponse;
    }

    return response;
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'Backend gateway timeout or sleeping',
        message: err.message,
      }),
      {
        status: 504,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

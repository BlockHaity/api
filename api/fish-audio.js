export const config = {
  runtime: 'edge',
};

const TARGET_BASE = 'https://api.fish.audio';

const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'origin',
  'referer',
  'cookie',
  'set-cookie',
];

const FORWARD_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'transfer-encoding',
  'last-modified',
  'etag',
  'cache-control',
  'accept-ranges',
  'content-range',
  'content-disposition',
  'x-request-id',
  'x-trace-id',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function resolvePath(url) {
  let proxyPath;
  const __path = url.searchParams.get('__path');
  if (__path !== null) {
    proxyPath = '/' + __path.replace(/^\/+/, '');
  } else {
    proxyPath = url.pathname.replace(/^\/api\/fish-audio|^\/fish-audio-api/, '') || '/';
  }

  if (proxyPath === '/' || proxyPath === '') {
    proxyPath = '/';
  } else if (!proxyPath.startsWith('/')) {
    proxyPath = '/' + proxyPath;
  }
  return proxyPath;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const proxyPath = resolvePath(url);

    const targetUrl = new URL(proxyPath, TARGET_BASE);
    url.searchParams.forEach((value, key) => {
      if (key !== '__path') {
        targetUrl.searchParams.set(key, value);
      }
    });

    const headers = new Headers();
    for (const [key, value] of req.headers) {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.arrayBuffer();
    }

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body,
      redirect: 'follow',
    });

    const responseHeaders = new Headers();
    for (const key of FORWARD_RESPONSE_HEADERS) {
      const value = response.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/event-stream')) {
      responseHeaders.set('Cache-Control', 'no-cache, no-transform');
      responseHeaders.set('X-Accel-Buffering', 'no');
    }

    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      responseHeaders.set(key, value);
    }
    responseHeaders.delete('X-Frame-Options');
    responseHeaders.delete('X-Content-Type-Options');
    responseHeaders.delete('Content-Security-Policy');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Fish Audio proxy error:', error);
    return new Response(JSON.stringify({ error: `代理请求失败: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

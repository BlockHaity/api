export const config = {
  runtime: 'edge',
};

const TARGET_BASE = 'https://apihub.agnes-ai.com';

const HOP_BY_HOP_HEADERS = new Set([
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
]);

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
  'x-oneapi-request-id',
];

function buildTargetUrl(pathname, searchParams) {
  let proxyPath = pathname.replace(/^\/api\/agnes-api|^\/agnes-api/, '') || '/';

  if (!proxyPath.startsWith('/v1/')) {
    if (proxyPath === '/' || proxyPath === '') {
      proxyPath = '/v1/';
    } else {
      proxyPath = '/v1' + (proxyPath.startsWith('/') ? proxyPath : '/' + proxyPath);
    }
  }

  const targetUrl = new URL(proxyPath, TARGET_BASE);

  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  return targetUrl;
}

function buildResponseHeaders(upstreamHeaders) {
  const headers = new Headers();

  for (const key of FORWARD_RESPONSE_HEADERS) {
    const value = upstreamHeaders.get(key);
    if (value) {
      headers.set(key, value);
    }
  }

  const contentType = upstreamHeaders.get('content-type') || '';
  const isStreaming = contentType.includes('text/event-stream');

  if (isStreaming) {
    headers.set('Cache-Control', 'no-cache, no-transform');
    headers.set('X-Accel-Buffering', 'no');
  }

  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.delete('X-Frame-Options');
  headers.delete('X-Content-Type-Options');
  headers.delete('Content-Security-Policy');
  headers.delete('Content-Security-Policy-Report-Only');

  return headers;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const url = new URL(req.url);

    const targetUrl = buildTargetUrl(url.pathname, url.searchParams);

    const headers = new Headers();
    for (const [key, value] of req.headers) {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    headers.set('Host', 'apihub.agnes-ai.com');

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = await req.arrayBuffer();
    }

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body,
      redirect: 'follow',
    });

    const responseHeaders = buildResponseHeaders(response.headers);

    const responseBody = response.body;
    if (!responseBody || req.method === 'HEAD') {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Agnes API proxy error:', error);
    return new Response(
      JSON.stringify({ error: `代理请求失败: ${error.message}` }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
}
export const config = {
  runtime: 'edge',
};

const TARGET_BASE = 'https://apihub.agnes-ai.com';

const PROXY_FILE_HOSTS = ['platform-outputs.agnes-ai.space', 'storage.googleapis.com'];

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
  'x-oneapi-request-id',
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
    proxyPath = url.pathname.replace(/^\/api\/agnes-media|^\/agnes-media/, '') || '/';
  }

  if (proxyPath === '/download') {
    return proxyPath;
  }
  if (proxyPath === '/' || proxyPath === '') {
    proxyPath = '/v1/';
  } else if (!proxyPath.startsWith('/v1/') && !proxyPath.startsWith('/agnesapi')) {
    proxyPath = '/v1' + (proxyPath.startsWith('/') ? proxyPath : '/' + proxyPath);
  }
  return proxyPath;
}

function rewriteIfFileUrl(value, origin) {
  if (typeof value !== 'string') return value;
  try {
    const u = new URL(value);
    if (PROXY_FILE_HOSTS.includes(u.hostname)) {
      return `${origin}/agnes-media/download?url=${encodeURIComponent(value)}`;
    }
  } catch {}
  return value;
}

function walkAndRewrite(node, origin) {
  if (Array.isArray(node)) {
    for (const item of node) walkAndRewrite(item, origin);
    return;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      const value = node[key];
      if (key === 'url' && typeof value === 'string') {
        node[key] = rewriteIfFileUrl(value, origin);
      } else {
        walkAndRewrite(value, origin);
      }
    }
  }
}

async function handleDownload(url) {
  const fileUrl = url.searchParams.get('url');
  if (!fileUrl) {
    return new Response(JSON.stringify({ error: '缺少 url 参数' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const upstream = await fetch(fileUrl, { redirect: 'follow' });

  const headers = new Headers();
  for (const key of FORWARD_RESPONSE_HEADERS) {
    const value = upstream.headers.get(key);
    if (value) headers.set(key, value);
  }
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const url = new URL(req.url);
    const proxyPath = resolvePath(url);

    if (proxyPath === '/download') {
      return handleDownload(url);
    }

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

    if (contentType.includes('application/json')) {
      const buffer = await response.arrayBuffer();
      try {
        const json = JSON.parse(new TextDecoder().decode(buffer));
        walkAndRewrite(json, url.origin);
        const rewrittenBody = JSON.stringify(json);
        responseHeaders.set('content-type', 'application/json; charset=utf-8');
        responseHeaders.set('content-length', String(new TextEncoder().encode(rewrittenBody).byteLength));
        for (const [key, value] of Object.entries(CORS_HEADERS)) {
          responseHeaders.set(key, value);
        }
        return new Response(rewrittenBody, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch {}
    }

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
    console.error('Agnes Media proxy error:', error);
    return new Response(JSON.stringify({ error: `代理请求失败: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}

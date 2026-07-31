import {
  AGNES_API_TARGET,
  AGNES_MODEL_MAP,
  AGNES_MODEL_ENDPOINTS,
  AGNES_MODEL_FALLBACKS,
  AGNES_DEFAULT_MODEL,
} from '../config.js';
import { errorResponse } from '../utils.js';

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
  let proxyPath = pathname.replace(/^\/agnes-api/, '') || '/';

  if (!proxyPath.startsWith('/v1/')) {
    if (proxyPath === '/' || proxyPath === '') {
      proxyPath = '/v1/';
    } else {
      proxyPath = '/v1' + (proxyPath.startsWith('/') ? proxyPath : '/' + proxyPath);
    }
  }

  const targetUrl = new URL(proxyPath, AGNES_API_TARGET.base);

  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  return targetUrl;
}

function getEndpointKey(pathname) {
  const match = pathname.match(/\/v1(\/[^/]+\/[^/]+)/);
  if (match) return match[1];
  const match2 = pathname.match(/\/v1(\/[^/]+)/);
  if (match2) return match2[1];
  return null;
}

function getFallbackModel(pathname) {
  const endpointKey = getEndpointKey(pathname);
  const endpointType = AGNES_MODEL_ENDPOINTS[endpointKey];
  if (endpointType) {
    return AGNES_MODEL_FALLBACKS[endpointType];
  }
  return AGNES_DEFAULT_MODEL;
}

function resolveModel(model, pathname) {
  if (!model || typeof model !== 'string') {
    return getFallbackModel(pathname);
  }

  const mapped = AGNES_MODEL_MAP[model];
  if (mapped) {
    return mapped;
  }

  return model;
}

async function processRequestBody(pathname, body) {
  if (!body) return { body: null, isModified: false };

  try {
    const bodyText = new TextDecoder().decode(body);
    const bodyObj = JSON.parse(bodyText);

    let isModified = false;
    const resolved = resolveModel(bodyObj.model, pathname);

    if (resolved !== bodyObj.model) {
      bodyObj.model = resolved;
      isModified = true;
    }

    if (!bodyObj.model) {
      bodyObj.model = getFallbackModel(pathname);
      isModified = true;
    }

    if (!isModified) {
      return { body, isModified: false };
    }

    const newBody = JSON.stringify(bodyObj);
    return { body: new TextEncoder().encode(newBody), isModified: true };
  } catch {
    return { body, isModified: false };
  }
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
  headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  );
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization',
  );
  headers.delete('X-Frame-Options');
  headers.delete('X-Content-Type-Options');
  headers.delete('Content-Security-Policy');
  headers.delete('Content-Security-Policy-Report-Only');

  return headers;
}

async function isModelNotFoundError(response) {
  if (response.status !== 400 && response.status !== 401 && response.status !== 404) {
    return false;
  }
  try {
    const text = await response.text();
    const obj = JSON.parse(text);
    const msg = (obj.error?.message || obj.message || '').toLowerCase();
    return (
      msg.includes('model') &&
      (msg.includes('not found') ||
        msg.includes('not exist') ||
        msg.includes('不存在') ||
        msg.includes('not found') ||
        msg.includes('invalid model') ||
        msg.includes('unsupported model'))
    );
  } catch {
    return false;
  }
}

export async function handleAgnesApi(request) {
  const url = new URL(request.url);

  try {
    const targetUrl = buildTargetUrl(url.pathname, url.searchParams);

    const headers = new Headers();
    for (const [key, value] of request.headers) {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    }
    headers.set('Host', 'apihub.agnes-ai.com');

    let rawBody = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const buf = await request.arrayBuffer();
        rawBody = new Uint8Array(buf);
      } catch {
        rawBody = null;
      }
    }

    const { body: processedBody, isModified } = await processRequestBody(
      targetUrl.pathname,
      rawBody,
    );

    if (processedBody) {
      headers.set('Content-Length', String(processedBody.byteLength));
    }

    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body: processedBody || undefined,
      redirect: 'follow',
    });

    const responseHeaders = buildResponseHeaders(response.headers);

    const responseBody = response.body;
    if (!responseBody || request.method === 'HEAD') {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    if (response.status === 400 || response.status === 401) {
      const willRetry = await isModelNotFoundError(response);
      if (willRetry && isModified === false) {
        try {
          const bodyObj = JSON.parse(new TextDecoder().decode(rawBody));
          const fallback = getFallbackModel(targetUrl.pathname);
          bodyObj.model = fallback;

          const retryBody = new TextEncoder().encode(JSON.stringify(bodyObj));
          headers.set('Content-Length', String(retryBody.byteLength));

          const retryResponse = await fetch(targetUrl.toString(), {
            method: request.method,
            headers,
            body: retryBody,
            redirect: 'follow',
          });

          const retryHeaders = buildResponseHeaders(retryResponse.headers);
          const retryResponseBody = retryResponse.body;

          if (!retryResponseBody || request.method === 'HEAD') {
            return new Response(null, {
              status: retryResponse.status,
              statusText: retryResponse.statusText,
              headers: retryHeaders,
            });
          }

          return new Response(retryResponseBody, {
            status: retryResponse.status,
            statusText: retryResponse.statusText,
            headers: retryHeaders,
          });
        } catch {
          // retry failed, return original response
        }
      }
    }

    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Agnes API proxy error:', error);
    return errorResponse(`代理请求失败: ${error.message}`, 500);
  }
}
import { FISH_AUDIO_BASE_URL } from '../config.js';
import { errorResponse } from '../utils.js';

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

export async function handleFishAudio(request) {
  try {
    const url = new URL(request.url);
    let proxyPath = url.pathname.replace(/^\/fish-audio-api/, '') || '/';

    if (proxyPath === '/' || proxyPath === '') {
      proxyPath = '/';
    } else if (!proxyPath.startsWith('/')) {
      proxyPath = '/' + proxyPath;
    }

    const targetUrl = new URL(proxyPath, FISH_AUDIO_BASE_URL);
    url.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));

    const headers = new Headers();
    for (const [key, value] of request.headers) {
      if (!HOP_BY_HOP_HEADERS.includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    let body;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = request.body;
    }

    const response = await fetch(targetUrl.toString(), {
      method: request.method,
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
    return errorResponse(`代理请求失败: ${error.message}`, 500);
  }
}

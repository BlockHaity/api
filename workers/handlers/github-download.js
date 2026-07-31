import { GITHUB_PROXY_DOMAINS, CACHE_TTL } from '../config.js';
import { errorResponse } from '../utils.js';

export async function handleGitHubDownload(request) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return errorResponse('缺少 url 参数\n\n使用方式: /gh-download?url=<原始github链接>');
  }

  let githubUrl;
  try {
    githubUrl = new URL(targetUrl);
  } catch (e) {
    return errorResponse('无效的 URL 格式');
  }

  const isAllowedDomain = GITHUB_PROXY_DOMAINS.some(
    (domain) =>
      githubUrl.hostname === domain || githubUrl.hostname.endsWith('.' + domain),
  );

  if (!isAllowedDomain) {
    return errorResponse(
      `不允许代理的域名: ${githubUrl.hostname}\n允许的域名: ${GITHUB_PROXY_DOMAINS.join(', ')}`,
      403,
    );
  }

  try {
    const headers = new Headers();
    for (const [key, value] of request.headers) {
      if (!['host', 'origin', 'referer'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    headers.set('Host', githubUrl.hostname);
    headers.set(
      'User-Agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    );
    headers.set('Accept', '*/*');

    if (githubUrl.hostname.includes('githubassets.com')) {
      headers.set('Referer', 'https://github.com/');
    }

    const response = await fetch(githubUrl.toString(), {
      method: 'GET',
      headers,
      cf: {
        cacheTtl: CACHE_TTL,
        cacheEverything: true,
      },
    });

    if (!response.ok) {
      return new Response(`GitHub 请求失败: ${response.status} ${response.statusText}`, {
        status: response.status,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    responseHeaders.set('Cache-Control', 'public, max-age=86400');
    responseHeaders.set('CDN-Cache-Control', 'public, max-age=86400');
    responseHeaders.delete('X-Frame-Options');
    responseHeaders.delete('X-Content-Type-Options');

    const contentType = responseHeaders.get('Content-Type') || '';
    if (contentType.includes('text/') || contentType.includes('application/javascript')) {
      responseHeaders.set('Content-Type', contentType.replace(/;.*$/, '') + '; charset=utf-8');
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return errorResponse(`代理请求失败: ${error.message}`, 500);
  }
}
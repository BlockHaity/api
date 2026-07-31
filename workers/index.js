import { REDIRECT_TARGET } from './config.js';
import { errorResponse } from './utils.js';
import { handleImageRequest } from './handlers/image.js';
import { handleGitHubDownload } from './handlers/github-download.js';
import { handleGetBAAH } from './handlers/getbaah.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/') {
      return Response.redirect(REDIRECT_TARGET, 302);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'GET') {
      return errorResponse('只支持GET请求', 405);
    }

    if (pathname === '/getbaah') {
      return handleGetBAAH(request);
    }

    if (pathname === '/gh-download') {
      return handleGitHubDownload(request);
    }

    if (pathname.startsWith('/images')) {
      return handleImageRequest(request);
    }

    return errorResponse('路径不存在', 404);
  },
};
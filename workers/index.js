import { REDIRECT_TARGET } from './config.js';
import { errorResponse } from './utils.js';
import { handleImageRequest } from './handlers/image.js';
import { handleGitHubDownload } from './handlers/github-download.js';
import { handleGetBAAH } from './handlers/getbaah.js';
import { handleFishAudio } from './handlers/fish-audio.js';
import { handleFishAudioOpenAI } from './handlers/fish-audio-openai.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // CF 反代优选：4 级域名包含 -source 标记时，删除该标记后重定向
    const hostLabels = url.hostname.split('.');
    if (hostLabels.length === 4 && hostLabels[0].includes('-source')) {
      hostLabels[0] = hostLabels[0].replace('-source', '');
      url.hostname = hostLabels.join('.');
      return Response.redirect(url.toString(), 302);
    }

    if (pathname === '/') {
      return Response.redirect(REDIRECT_TARGET, 302);
    }

    // 将 /img/* 映射到静态资源（资源根目录即 img/，需去掉 /img 前缀）
    if (pathname.startsWith('/img/') && env.ASSETS) {
      const assetResponse = await env.ASSETS.fetch(
        new Request(new URL(pathname.slice(4), request.url)),
      );
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    if (pathname.startsWith('/fish-audio-api/openai')) {
      return handleFishAudioOpenAI(request);
    }

    if (pathname.startsWith('/fish-audio-api')) {
      return handleFishAudio(request);
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
      return handleImageRequest(request, env);
    }

    return errorResponse('路径不存在', 404);
  },
};
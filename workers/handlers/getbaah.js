import { GITHUB_API_URL, BACKUP_API_URL } from '../config.js';
import { errorResponse } from '../utils.js';

export async function handleGetBAAH(request) {
  const url = new URL(request.url);

  try {
    const target = url.searchParams.get('target') || '0';
    const jsonFormat = url.searchParams.get('json') === 'true';

    let releases;
    try {
      const response = await fetch(GITHUB_API_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API 响应错误: ${response.status}`);
      }

      releases = await response.json();
    } catch (error) {
      console.log('GitHub API访问失败，切换到备用API:', error.message);
      const backupResponse = await fetch(BACKUP_API_URL);

      if (!backupResponse.ok) {
        throw new Error(`备用API也失败了: ${backupResponse.status}`);
      }

      releases = await backupResponse.json();
    }

    if (!releases || releases.length === 0) {
      if (jsonFormat) {
        return errorResponse('No releases found', 404);
      }
      return new Response('No releases found', {
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const firstRelease = releases[0];

    if (!firstRelease.assets || firstRelease.assets.length === 0) {
      if (jsonFormat) {
        return errorResponse('No assets found in the latest release', 404);
      }
      return new Response('No assets found in the latest release', {
        status: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    }

    const assetIndex = parseInt(target);
    if (isNaN(assetIndex) || assetIndex < 0 || assetIndex >= firstRelease.assets.length) {
      if (jsonFormat) {
        return errorResponse(
          `Invalid target parameter. Please use a value between 0 and ${firstRelease.assets.length - 1}`,
          400,
        );
      }
      return new Response(
        `Invalid target parameter. Please use a value between 0 and ${firstRelease.assets.length - 1}`,
        {
          status: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
        },
      );
    }

    const selectedAsset = firstRelease.assets[assetIndex];
    let currentDomain = new URL(request.url).origin;

    if (currentDomain === 'https://api-cloudflare.blockhaity.dpdns.org') {
      currentDomain = 'https://api-cloudflare.blockhaity.qzz.io';
    }

    const downloadUrl =
      currentDomain + '/gh-download?url=' + encodeURIComponent(selectedAsset.browser_download_url);

    if (jsonFormat) {
      return new Response(
        JSON.stringify({
          name: selectedAsset.name,
          downloadUrl,
          size: selectedAsset.size,
          contentType: selectedAsset.content_type,
          redirectUrl: downloadUrl,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: downloadUrl,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error fetching release data:', error);
    if (url.searchParams.get('json') === 'true') {
      return errorResponse('Failed to fetch release data', 500);
    }
    return new Response('Failed to fetch release data', {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
}
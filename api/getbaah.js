export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  try {
    // 获取 URL 和查询参数
    const url = new URL(request.url);
    // 获取target参数，默认为0
    const target = url.searchParams.get('target') || '1';
    // 检查是否需要JSON格式返回
    const jsonFormat = url.searchParams.get('json') === 'true';

    // 从GitHub API获取发布信息，如果失败则使用备用API
    let releases;
    try {
      const response = await fetch('https://api.github.com/repos/BlueArchiveArisHelper/BAAH/releases');
      releases = await response.json();
    } catch (error) {
      console.log('GitHub API访问失败，切换到备用API');
      const backupResponse = await fetch('https://api-vercel.blockhaity.dpdns.org/cache/baah.json');
      releases = await backupResponse.json();
    }

    // 检查是否有发布信息
    if (!releases || releases.length === 0) {
      if (jsonFormat) {
        return new Response(JSON.stringify({ error: 'No releases found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('No releases found', { status: 404 });
    }

    // 获取第一个发布
    const firstRelease = releases[0];

    // 检查是否有assets
    if (!firstRelease.assets || firstRelease.assets.length === 0) {
      if (jsonFormat) {
        return new Response(JSON.stringify({ error: 'No assets found in the latest release' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('No assets found in the latest release', { status: 404 });
    }

    // 验证target参数是否有效
    const assetIndex = parseInt(target);
    if (isNaN(assetIndex) || assetIndex < 0 || assetIndex >= firstRelease.assets.length) {
      if (jsonFormat) {
        return new Response(JSON.stringify({
          error: `Invalid target parameter. Please use a value between 0 and ${firstRelease.assets.length - 1}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(`Invalid target parameter. Please use a value between 0 and ${firstRelease.assets.length - 1}`, {
        status: 400
      });
    }

    // 获取选定的asset
    const selectedAsset = firstRelease.assets[assetIndex];
    let currentDomain = new URL(request.url).origin;
    if (currentDomain === "https://api.blockhaity.dpdns.org") {
      currentDomain = "https://api.blockhaity.qzz.io";
    }
    const downloadUrl = currentDomain + "/gh-download?url=" + selectedAsset.browser_download_url;

    // 如果请求JSON格式，返回JSON信息
    if (jsonFormat) {
      return new Response(JSON.stringify({
        name: selectedAsset.name,
        downloadUrl: downloadUrl,
        size: selectedAsset.size,
        contentType: selectedAsset.content_type,
        redirectUrl: downloadUrl
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 否则直接重定向到下载链接
    return new Response(null, {
      status: 302,
      headers: {
        'Location': downloadUrl,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('Error fetching release data:', error);
    if (jsonFormat) {
      return new Response(JSON.stringify({ error: 'Failed to fetch release data' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response('Failed to fetch release data', { status: 500 });
  }
}
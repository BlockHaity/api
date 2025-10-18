export const config = {
  runtime: 'edge',
};

// api/github-release.js
export default async function handler(req, res) {
  try {
    // 获取target参数，默认为0
    const { target = 0 } = req.query;

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
      return res.status(404).json({ error: 'No releases found' });
    }
    
    // 获取第一个发布
    const firstRelease = releases[0];
    
    // 检查是否有assets
    if (!firstRelease.assets || firstRelease.assets.length === 0) {
      return res.status(404).json({ error: 'No assets found in the latest release' });
    }
    
    // 验证target参数是否有效
    const assetIndex = parseInt(target);
    if (isNaN(assetIndex) || assetIndex < 0 || assetIndex >= firstRelease.assets.length) {
      return res.status(400).json({ 
        error: `Invalid target parameter. Please use a value between 0 and ${firstRelease.assets.length - 1}` 
      });
    }
    
    // 返回指定asset的下载链接
    const selectedAsset = firstRelease.assets[assetIndex];
    res.status(200).json({
      name: selectedAsset.name,
      downloadUrl: "https://api-vercel.blockhaity.dpdns.org/gh-download?url="+selectedAsset.browser_download_url,
      size: selectedAsset.size,
      contentType: selectedAsset.content_type
    });
    
  } catch (error) {
    console.error('Error fetching release data:', error);
    res.status(500).json({ error: 'Failed to fetch release data' });
  }
}

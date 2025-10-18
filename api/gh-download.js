export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // 只允许 GET 请求
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    // 从查询参数中获取 GitHub 文件 URL
    const fileUrl = url.searchParams.get('url');

    if (!fileUrl) {
      return new Response('Missing file URL parameter', { status: 400 });
    }

    // 验证是否是 GitHub 相关 URL
    const allowedDomains = [
      'github.com',
      'raw.githubusercontent.com',
      'api.github.com',
      'gist.github.com',
      'objects.githubusercontent.com',
      'archive.org',
      'githubassets.com'
    ];
    
    const isValidDomain = allowedDomains.some(domain => 
      fileUrl.startsWith(`https://${domain}/`) || 
      fileUrl.startsWith(`http://${domain}/`)
    );
    
    if (!isValidDomain) {
      return new Response('Invalid GitHub URL', { status: 400 });
    }

    // 创建新的请求头
    const headers = new Headers();
    // 保持原始请求中的一些重要头部
    const allowedHeaders = ['accept', 'accept-encoding', 'range', 'user-agent'];
    allowedHeaders.forEach(header => {
      const value = req.headers.get(header);
      if (value) headers.set(header, value);
    });

    // 添加自定义 User-Agent
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    // 获取文件信息
    let fileInfo = null;
    try {
      const headResponse = await fetch(fileUrl, { 
        method: 'HEAD',
        headers
      });
      if (headResponse.ok) {
        const contentLength = headResponse.headers.get('content-length');
        const acceptRanges = headResponse.headers.get('accept-ranges');
        const contentType = headResponse.headers.get('content-type');
        const lastModified = headResponse.headers.get('last-modified');
        
        fileInfo = {
          size: contentLength,
          acceptRanges,
          contentType,
          lastModified
        };
      }
    } catch (error) {
      console.error('Failed to get file info:', error);
    }

    // 创建 fetch 请求
    const response = await fetch(fileUrl, {
      headers,
      method: req.method,
    });

    // 如果响应不成功，返回错误
    if (!response.ok) {
      return new Response(`Failed to fetch file: ${response.statusText}`, {
        status: response.status,
      });
    }

    // 创建新的响应头
    const responseHeaders = new Headers();
    
    // 添加文件信息头
    if (fileInfo) {
      responseHeaders.set('X-File-Size', fileInfo.size || '0');
      responseHeaders.set('X-File-Last-Modified', fileInfo.lastModified || '');
      responseHeaders.set('X-File-Type', fileInfo.contentType || '');
      responseHeaders.set('X-Accept-Ranges', fileInfo.acceptRanges || 'none');
    }

    // 复制重要的响应头
    const responseAllowedHeaders = [
      'content-type',
      'content-length',
      'last-modified',
      'etag',
      'cache-control',
      'content-disposition',
      'accept-ranges',
      'content-range'
    ];

    responseAllowedHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) responseHeaders.set(header, value);
    });

    // 添加 CORS 头
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, X-Requested-With');
    responseHeaders.set('Access-Control-Expose-Headers', 
      'Content-Length, Content-Range, X-File-Size, X-File-Last-Modified, X-File-Type, X-Accept-Ranges'
    );

    // 返回响应
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

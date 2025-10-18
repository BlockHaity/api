import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  try {
    // 获取请求路径
    const path = req.nextUrl.pathname.replace('/api/gh-download/', '');
    
    // 构建GitHub URL
    const githubUrl = `https://github.com/${path}`;
    
    // 获取请求头
    const headers = new Headers(req.headers);
    
    // 设置必要的请求头
    headers.set('Host', 'github.com');
    headers.set('Origin', 'https://github.com');
    
    // 创建新的请求
    const response = await fetch(githubUrl, {
      method: req.method,
      headers: headers,
      body: req.body,
    });

    // 创建响应头
    const responseHeaders = new Headers();
    
    // 复制重要的响应头
    const importantHeaders = [
      'content-type',
      'content-length',
      'cache-control',
      'etag',
      'last-modified',
      'content-disposition',
    ];

    importantHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    // 添加CORS头
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');

    // 处理HEAD请求
    if (req.method === 'HEAD') {
      return new Response(null, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // 返回响应
    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Proxy error occurred' },
      { status: 500 }
    );
  }
}

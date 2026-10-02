import { CATEGORY_CONFIG, BASE_JSON_URL, GITHUB_RAW_BASE, CACHE_TTL } from '../config.js';
import { errorResponse, getRandomItem } from '../utils.js';

function localPathname(localUrl) {
  try {
    return new URL(localUrl).pathname;
  } catch {
    return localUrl.startsWith('/') ? localUrl : `/${localUrl}`;
  }
}

// 静态资源目录根即 img/，因此 ASSETS 路径需去掉 /img 前缀
function toAssetPath(pathname) {
  return pathname.replace(/^\/img/, '') || '/';
}

// 优先从当前访问域名的 /img 下获取列表：先走静态资源绑定，再走 HTTP，最后回退规范域名
async function fetchCategoryData(category, currentOrigin, env) {
  const fileName = CATEGORY_CONFIG[category];
  if (!fileName) {
    throw new Error(`分类 ${category} 不存在`);
  }

  const candidates = [];

  if (env && env.ASSETS) {
    candidates.push(async () => {
      const response = await env.ASSETS.fetch(
        new Request(`${currentOrigin}${toAssetPath(`/img/${fileName}`)}`),
      );
      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }
      return response;
    });
  }

  candidates.push(async () => {
    const response = await fetch(`${currentOrigin}/img/${fileName}`);
    if (!response.ok) {
      throw new Error(`HTTP错误! 状态: ${response.status}`);
    }
    return response;
  });

  candidates.push(async () => {
    const response = await fetch(`${BASE_JSON_URL}${fileName}`);
    if (!response.ok) {
      throw new Error(`HTTP错误! 状态: ${response.status}`);
    }
    return response;
  });

  let lastError;
  for (const getCandidate of candidates) {
    try {
      const response = await getCandidate();
      const data = await response.json();
      if (!Array.isArray(data)) {
        throw new Error('返回的数据不是数组');
      }
      return data;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`获取分类 ${category} 数据失败: ${lastError.message}`);
}

async function fetchAllCategoriesData(currentOrigin, env) {
  const categories = Object.keys(CATEGORY_CONFIG);
  const allPromises = categories.map((category) => fetchCategoryData(category, currentOrigin, env));

  try {
    const results = await Promise.allSettled(allPromises);

    const allData = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allData.push(...result.value);
      } else {
        console.error(`获取分类 ${categories[index]} 失败:`, result.reason);
      }
    });

    if (allData.length === 0) {
      throw new Error('所有分类的数据获取都失败了');
    }

    return allData;
  } catch (error) {
    throw new Error(`获取所有分类数据失败: ${error.message}`);
  }
}

// 优先从当前访问域名的 /img 下获取图片，失败时回退到 GitHub Raw
async function fetchLocalImage(localUrl, currentOrigin, env) {
  const pathname = localPathname(localUrl);

  if (env && env.ASSETS) {
    try {
      const response = await env.ASSETS.fetch(
        new Request(`${currentOrigin}${toAssetPath(pathname)}`),
      );
      if (response.ok) {
        return response;
      }
    } catch {
      // 继续回退
    }
  } else {
    try {
      const response = await fetch(`${currentOrigin}${pathname}`);
      if (response.ok) {
        return response;
      }
    } catch {
      // 继续回退
    }
  }

  return fetch(`${GITHUB_RAW_BASE}${pathname}`, {
    cf: {
      cacheTtl: CACHE_TTL,
      cacheEverything: true,
    },
  });
}

export async function handleImageRequest(request, env) {
  const url = new URL(request.url);
  const currentOrigin = url.origin;

  const category = url.searchParams.get('category') || 'all';
  const color = url.searchParams.get('color');

  try {
    let data;

    if (category === 'all') {
      data = await fetchAllCategoriesData(currentOrigin, env);
    } else if (CATEGORY_CONFIG[category]) {
      data = await fetchCategoryData(category, currentOrigin, env);
    } else {
      return errorResponse(`分类 ${category} 不存在`, 404);
    }

    if (!Array.isArray(data) || data.length === 0) {
      return errorResponse(`分类 ${category} 没有可用的图片数据`, 404);
    }

    if (color) {
      data = data.filter((item) => item.color === color);
      if (data.length === 0) {
        return errorResponse(`分类 ${category} 中没有颜色为 ${color} 的图片`, 404);
      }
    }

    const randomItem = getRandomItem(data);

    const useSource = url.searchParams.get('source') === 'true';
    let imageResponse;
    if (useSource) {
      if (!randomItem.source) {
        return errorResponse('图片URL不存在', 404);
      }
      imageResponse = await fetch(randomItem.source, {
        cf: {
          cacheTtl: CACHE_TTL,
          cacheEverything: true,
        },
      });
    } else {
      if (!randomItem.local) {
        return errorResponse('图片URL不存在', 404);
      }
      imageResponse = await fetchLocalImage(randomItem.local, currentOrigin, env);
    }

    if (!imageResponse.ok) {
      return errorResponse('无法获取图片', 500);
    }

    const headers = new Headers(imageResponse.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Cache-Control', 'public, max-age=86400');

    return new Response(imageResponse.body, {
      status: imageResponse.status,
      headers,
    });
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

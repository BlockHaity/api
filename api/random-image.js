export const config = {
  runtime: 'edge',
};

const CATEGORY_CONFIG = {
  'bluearchive': 'bluearchive.json',
  'miku': 'miku.json',
};

// 兜底数据源：当前访问域名下 /img 不可用时回退到规范域名
const BASE_JSON_URL = 'https://api-vercel.blockhaity.eu.org/img/';

function errorResponse(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// 优先从当前访问域名的 /img 下获取列表，失败时回退到规范域名
async function fetchCategoryData(category, currentOrigin) {
  const fileName = CATEGORY_CONFIG[category];
  if (!fileName) {
    throw new Error(`分类 ${category} 不存在`);
  }

  const candidateUrls = [`${currentOrigin}/img/${fileName}`, `${BASE_JSON_URL}${fileName}`];
  let lastError;

  for (const jsonUrl of candidateUrls) {
    try {
      const response = await fetch(jsonUrl);

      if (!response.ok) {
        throw new Error(`HTTP错误! 状态: ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('返回的数据不是数组');
      }

      // 记录数据来源域名，图片也将从同一域名下获取
      const base = new URL(jsonUrl).origin;
      return data.map((item) => ({ ...item, __base: base }));
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`获取分类 ${category} 数据失败: ${lastError.message}`);
}

async function fetchAllCategoriesData(currentOrigin) {
  const categories = Object.keys(CATEGORY_CONFIG);
  const allPromises = categories.map((category) => fetchCategoryData(category, currentOrigin));

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

// 将列表中的 local 图片路径解析到数据来源域名（即当前访问域名）下的 /img
function resolveLocalUrl(item) {
  const local = item.local;
  if (!local) {
    return '';
  }
  try {
    const url = new URL(local);
    return `${item.__base}${url.pathname}`;
  } catch {
    return `${item.__base}${local.startsWith('/') ? '' : '/'}${local}`;
  }
}

async function handleImageRequest(request) {
  const url = new URL(request.url);
  const currentOrigin = url.origin;

  const category = url.searchParams.get('category') || 'all';
  const color = url.searchParams.get('color');

  try {
    let data;

    if (category === 'all') {
      data = await fetchAllCategoriesData(currentOrigin);
    } else if (CATEGORY_CONFIG[category]) {
      data = await fetchCategoryData(category, currentOrigin);
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
    const imageUrl = useSource ? randomItem.source : resolveLocalUrl(randomItem);

    if (!imageUrl) {
      return errorResponse('图片URL不存在', 404);
    }

    return Response.redirect(imageUrl, 302);
  } catch (error) {
    return errorResponse(error.message, 500);
  }
}

// CF 反代优选：4 级域名包含 -source 标记时，删除该标记后重定向
function sourceRedirect(url) {
  const labels = url.hostname.split('.');
  if (labels.length === 4 && labels[0].includes('-source')) {
    labels[0] = labels[0].replace('-source', '');
    url.hostname = labels.join('.');
    return Response.redirect(url.toString(), 302);
  }
  return null;
}

export default async function handler(request) {
  const redirect = sourceRedirect(new URL(request.url));
  if (redirect) {
    return redirect;
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

  return handleImageRequest(request);
}

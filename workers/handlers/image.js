import { CATEGORY_CONFIG, BASE_JSON_URL, GITHUB_RAW_BASE, CACHE_TTL } from '../config.js';
import { errorResponse, getRandomItem } from '../utils.js';

async function fetchCategoryData(category) {
  const fileName = CATEGORY_CONFIG[category];
  if (!fileName) {
    throw new Error(`分类 ${category} 不存在`);
  }

  const jsonUrl = `${BASE_JSON_URL}${fileName}`;

  try {
    const response = await fetch(jsonUrl);

    if (!response.ok) {
      throw new Error(`HTTP错误! 状态: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('返回的数据不是数组');
    }

    return data;
  } catch (error) {
    throw new Error(`获取分类 ${category} 数据失败: ${error.message}`);
  }
}

async function fetchAllCategoriesData() {
  const categories = Object.keys(CATEGORY_CONFIG);
  const allPromises = categories.map((category) => fetchCategoryData(category));

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

function localToGithubRaw(localUrl) {
  try {
    const url = new URL(localUrl);
    return `${GITHUB_RAW_BASE}${url.pathname}`;
  } catch {
    return `${GITHUB_RAW_BASE}${localUrl}`;
  }
}

export async function handleImageRequest(request) {
  const url = new URL(request.url);

  const category = url.searchParams.get('category') || 'all';
  const color = url.searchParams.get('color');

  try {
    let data;

    if (category === 'all') {
      data = await fetchAllCategoriesData();
    } else if (CATEGORY_CONFIG[category]) {
      data = await fetchCategoryData(category);
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
    const imageUrl = useSource ? randomItem.source : localToGithubRaw(randomItem.local);

    if (!imageUrl) {
      return errorResponse('图片URL不存在', 404);
    }

    const imageResponse = await fetch(imageUrl, {
      cf: {
        cacheTtl: CACHE_TTL,
        cacheEverything: true,
      },
    });

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
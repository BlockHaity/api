export const config = {
    path: ["/images","/images/*"]
};

const CATEGORY_CONFIG = {
    'bluearchive': 'bluearchive.json',
    'miku': 'miku.json',
    // 可以添加更多分类
};

// 远程JSON数据的基础URL
const BASE_JSON_URL = 'https://api-vercel.blockhaity.dpdns.org/img/';

// 错误响应函数
function errorResponse(message, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

// 获取随机数组项
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// 从远程获取JSON数据
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

// 获取所有分类的数据并合并
async function fetchAllCategoriesData() {
    const categories = Object.keys(CATEGORY_CONFIG);
    const allPromises = categories.map(category => fetchCategoryData(category));

    try {
        const results = await Promise.allSettled(allPromises);

        // 合并所有成功获取的数据
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

// 处理图片请求
async function handleImageRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // 解析分类 - 从路径中提取，例如 /images/bluearchive -> bluearchive
    // 由于配置路径已经是 /images/*，所以路径会是 /images/bluearchive
    // 分割后得到 ['', 'images', 'bluearchive']，取索引2
    let category = pathname.split('/').filter(Boolean)[1] || 'all';

    // 支持直接通过查询参数指定分类
    const queryCategory = url.searchParams.get('category');
    if (queryCategory) {
        category = queryCategory;
    }

    try {
        let data;

        // 处理'all'分类 - 合并所有分类的数据
        if (category === 'all') {
            data = await fetchAllCategoriesData();
        } else if (CATEGORY_CONFIG[category]) {
            // 获取特定分类的数据
            data = await fetchCategoryData(category);
        } else {
            return errorResponse(`分类 ${category} 不存在`, 404);
        }

        if (!Array.isArray(data) || data.length === 0) {
            return errorResponse(`分类 ${category} 没有可用的图片数据`, 404);
        }

        // 获取随机图片
        const randomItem = getRandomItem(data);

        // 确定返回source还是local
        const useSource = url.searchParams.get('source') === 'true';
        let imageUrl = useSource ? randomItem.source : randomItem.local;

        if (!imageUrl) {
            return errorResponse('图片URL不存在', 404);
        }

        // 确保URL是有效的绝对URL
        try {
            new URL(imageUrl);
        } catch (e) {
            // 如果不是有效的URL，尝试修复
            if (imageUrl.startsWith('/')) {
                // 如果是相对路径，添加基础URL
                const baseUrl = new URL(BASE_JSON_URL);
                imageUrl = `${baseUrl.origin}${imageUrl}`;
            } else {
                return errorResponse(`无效的图片URL: ${imageUrl}`, 400);
            }
        }

        // 获取图片
        const imageResponse = await fetch(imageUrl);

        if (!imageResponse.ok) {
            return errorResponse('无法获取图片', 500);
        }

        // 创建新的响应，复制图片响应的内容和头部
        const headers = new Headers(imageResponse.headers);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Cache-Control', 'public, max-age=60'); // 修改为缓存1分钟

        return new Response(imageResponse.body, {
            status: imageResponse.status,
            headers: headers
        });

    } catch (error) {
        return errorResponse(error.message, 500);
    }
}

// Netlify Edge Function 主函数
export default async (request, context) => {
    const url = new URL(request.url);

    // 处理OPTIONS预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });
    }

    // 只允许GET请求
    if (request.method !== 'GET') {
        return errorResponse('只支持GET请求', 405);
    }

    return handleImageRequest(request);
};

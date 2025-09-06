import { promises as fs } from 'fs';
import path from 'path';

// 定义分类与JSON文件的映射
const categoryMap = {
  'all': 'public/img/all.json',
  'miku': 'public/img/miku.json',
  'bluearchive': 'public/img/bluearchive.json'
};

export default async function handler(req, res) {
  // 获取查询参数
  const { category = 'all', source = 'false' } = req.query;
  
  // 检查分类是否有效
  if (!categoryMap[category]) {
    return res.status(404).json({
      error: 'Category not found',
      availableCategories: Object.keys(categoryMap)
    });
  }
  
  try {
    // 读取对应分类的JSON文件
    const dataPath = path.join(process.cwd(), categoryMap[category]);
    const jsonData = await fs.readFile(dataPath, 'utf8');
    const images = JSON.parse(jsonData);
    
    // 检查是否有图片
    if (!images || images.length === 0) {
      return res.status(404).json({ error: 'No images found for this category' });
    }
    
    // 随机选择一张图片
    const randomIndex = Math.floor(Math.random() * images.length);
    const selectedImage = images[randomIndex];
    
    // 根据source参数决定返回的URL
    const useSource = source.toLowerCase() === 'true';
    const returnUrl = useSource ? selectedImage.source : selectedImage.local;
    
    // 返回结果
    res.status(200).json({
      url: returnUrl,
      category: category,
      index: randomIndex,
      total: images.length,
      timestamp: new Date().toISOString(),
      sourceUsed: useSource
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
/**
 * 处理HTML内容中的图片标签
 * 统计图片数量并将图片标签替换为【图片x张】文本
 *
 * @param content - HTML格式的字符串内容
 * @returns 处理后的字符串，图片被替换为【图片x张】标记
 */
export function processImagesInHtml(content: string): string {
  if (!content || typeof content !== 'string') {
    return content;
  }

  // 正则匹配 <img> 标签（包括自闭合和普通形式）
  const imgRegex = /<img\s+[^>]*?src=['"][^'"]*?['"][^>]*?>/gi;
  const matches = content.match(imgRegex);
  const imgCount = matches ? matches.length : 0;

  // 如果没有图片，返回原内容
  if (imgCount === 0) {
    return content;
  }

  // 移除所有 <img> 标签
  let processedContent = content.replace(imgRegex, '');

  // 清理多余的空白字符
  processedContent = processedContent.replace(/\s+/g, ' ').trim();

  // 在内容末尾添加【图片x张】标记
  const imageNote = imgCount === 1 ? '【图片1张】' : `【图片${imgCount}张】`;

  // 如果内容为空或只有空格，只返回图片标记
  if (!processedContent) {
    return imageNote;
  }

  return `${processedContent}\n\n${imageNote}`;
}

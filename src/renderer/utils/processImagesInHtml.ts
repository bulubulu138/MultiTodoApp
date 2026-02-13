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

  // 先处理流程图标签，避免缩略图被误判为普通图片。
  const flowchartRegex = /<flowchart-preview[^>]*>[\s\S]*?<\/flowchart-preview>/gi;
  const flowchartMatches = content.match(flowchartRegex);
  const flowchartCount = flowchartMatches ? flowchartMatches.length : 0;

  const contentWithoutFlowchart = content.replace(flowchartRegex, '[流程图]');

  // 正则匹配 <img> 标签（包括自闭合和普通形式）
  const imgRegex = /<img\s+[^>]*?src=['"][^'"]*?['"][^>]*?>/gi;
  const matches = contentWithoutFlowchart.match(imgRegex);
  const imgCount = matches ? matches.length : 0;

  // 如果没有图片和流程图，返回原内容
  if (imgCount === 0 && flowchartCount === 0) {
    return content;
  }

  // 移除所有 <img> 标签
  let processedContent = contentWithoutFlowchart.replace(imgRegex, '');

  // 清理多余的空白字符
  processedContent = processedContent.replace(/\s+/g, ' ').trim();

  const imageNote = imgCount === 1 ? '【图片1张】' : `【图片${imgCount}张】`;
  const flowchartNote = flowchartCount > 0
    ? (flowchartCount === 1 ? '【流程图1个】' : `【流程图${flowchartCount}个】`)
    : '';

  const notes = [flowchartNote, imgCount > 0 ? imageNote : ''].filter(Boolean).join('\n');

  if (!processedContent) {
    return notes;
  }

  return notes ? `${processedContent}\n\n${notes}` : processedContent;
}

import * as crypto from 'crypto';

/**
 * 生成待办内容的哈希值
 * @param title 标题
 * @param content 内容
 * @returns SHA-256 哈希值
 */
export function generateContentHash(title: string, content: string): string {
  // 移除HTML标签，只保留纯文本
  const stripHtml = (html: string): string => {
    return html.replace(/<[^>]*>/g, '').trim();
  };

  // 标准化文本：转小写、去除多余空白
  const normalizeText = (text: string): string => {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  };

  const normalizedTitle = normalizeText(stripHtml(title));
  const normalizedContent = normalizeText(stripHtml(content));
  
  // 使用分隔符组合，避免哈希碰撞
  const combined = `${normalizedTitle}|||${normalizedContent}`;
  
  // 生成 SHA-256 哈希
  return crypto.createHash('sha256').update(combined, 'utf8').digest('hex');
}


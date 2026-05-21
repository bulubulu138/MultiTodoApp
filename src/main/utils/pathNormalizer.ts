import * as path from 'path';

/**
 * 路径标准化工具
 * 处理不同浏览器和平台对 file:// 协议URL的格式差异
 */

/**
 * URL协议类型常量
 */
export const URL_PROTOCOLS = {
  HTTP: 'http://',
  HTTPS: 'https://',
  FILE: 'file://',
  DATA: 'data:',
} as const;

/**
 * 检查是否为data URL
 * @param url - 待检查的URL
 * @returns 是否为data URL
 */
export function isDataURL(url: string): boolean {
  return url.startsWith(URL_PROTOCOLS.DATA);
}

/**
 * 标准化 file:// 协议路径
 * 处理多种可能的格式变体：
 * - file://D:/path
 * - file:///D:/path
 * - file:/D:/path
 * - file:///D:/path (带有额外斜杠)
 *
 * @param filePath - 原始文件路径
 * @returns 标准化后的 file:// 协议路径
 */
export function normalizeFileProtocolPath(filePath: string): string {
  if (!filePath || typeof filePath !== 'string') {
    return filePath;
  }

  // 如果不是 file:// 协议，直接返回
  if (!filePath.startsWith('file://')) {
    return filePath;
  }

  console.log(`[PathNormalizer] Normalizing path: ${filePath}`);

  // 移除 file:// 前缀，保留后面的路径部分
  let normalizedPath = filePath.replace(/^file:\/\/\/?/, '');

  // Windows 特殊处理：移除开头的斜杠
  if (process.platform === 'win32' && normalizedPath.startsWith('/')) {
    normalizedPath = normalizedPath.substring(1);
  }

  // 统一路径分隔符为正斜杠（用于 file:// URL）
  const forwardSlashesPath = normalizedPath.replace(/\\/g, '/');

  // 重新构建标准化的 file:// URL
  const standardizedPath = `file://${forwardSlashesPath}`;

  console.log(`[PathNormalizer] Normalized to: ${standardizedPath}`);

  return standardizedPath;
}

/**
 * 提取 file:// 协议路径中的本地文件系统路径
 * @param fileUrl - file:// 协议URL
 * @returns 本地文件系统路径
 */
export function extractLocalPath(fileUrl: string): string {
  if (!fileUrl || !fileUrl.startsWith('file://')) {
    return fileUrl;
  }

  console.log(`[PathNormalizer] Extracting local path from: ${fileUrl}`);

  // 移除 file:// 前缀
  let localPath = fileUrl.replace(/^file:\/\/\/?/, '');

  // Windows 特殊处理：移除开头的斜杠
  if (process.platform === 'win32' && localPath.startsWith('/')) {
    localPath = localPath.substring(1);
  }

  console.log(`[PathNormalizer] Extracted local path: ${localPath}`);

  return localPath;
}

/**
 * 检查路径是否为有效的 file:// 协议路径
 * 有效的格式包括：
 * - file://D:/path (Windows)
 * - file:///D:/path (Windows with extra slash)
 * - file:///path (Unix-like)
 * - file://path (Unix-like minimal)
 *
 * @param filePath - 待检查的路径
 * @returns 是否为有效的 file:// 协议路径
 */
export function isValidFileProtocolPath(filePath: string): boolean {
  if (!filePath || typeof filePath !== 'string') {
    return false;
  }

  if (!filePath.startsWith('file://')) {
    return false;
  }

  // 移除 file:// 前缀
  const pathPart = filePath.replace(/^file:\/\/\/?/, '');

  // 检查路径部分是否有效
  // 至少需要有一个字符，且不能是明显的错误格式
  if (!pathPart || pathPart.length === 0) {
    return false;
  }

  // 检查是否为已知的错误格式（如 //:0）
  if (pathPart.startsWith('//:') || pathPart === '/' || pathPart.startsWith('//')) {
    return false;
  }

  // 检查路径是否包含有效的路径字符（至少有驱动器或目录名）
  const hasValidPathContent = /^[A-Za-z]:{1,2}\//.test(pathPart) || /[^/]+/.test(pathPart);
  if (!hasValidPathContent) {
    return false;
  }

  return true;
}

/**
 * 修复可能损坏的 file:// 路径
 * 尝试修复常见的路径损坏问题
 *
 * @param corruptedPath - 可能损坏的路径
 * @param fallbackPath - 如果无法修复时的回退路径
 * @returns 修复后的路径或回退路径
 */
export function repairCorruptedPath(corruptedPath: string, fallbackPath?: string): string | null {
  if (!corruptedPath || typeof corruptedPath !== 'string') {
    return fallbackPath || null;
  }

  console.log(`[PathNormalizer] Attempting to repair corrupted path: ${corruptedPath}`);

  // 优先修复已知的格式问题，即使路径看起来"有效"
  // 1. 修复 file:/// 多余斜杠问题（需要标准化为 file://）
  if (corruptedPath.startsWith('file:///')) {
    const repaired = corruptedPath.replace('file:///', 'file://');
    if (isValidFileProtocolPath(repaired)) {
      console.log(`[PathNormalizer] Repaired multiple slashes: ${repaired}`);
      return repaired;
    }
  }

  // 2. 如果已经是标准的 file:// 格式，直接返回
  if (corruptedPath.startsWith('file://') && !corruptedPath.startsWith('file:///')) {
    return corruptedPath;
  }

  // 2. 修复 file:/ 单斜杠问题
  if (corruptedPath.startsWith('file:/') && !corruptedPath.startsWith('file://')) {
    const repaired = corruptedPath.replace('file:/', 'file://');
    if (isValidFileProtocolPath(repaired)) {
      console.log(`[PathNormalizer] Repaired single slash: ${repaired}`);
      return repaired;
    }
  }

  // 3. 尝试从 //:0 等明显错误格式恢复
  if (corruptedPath === '//:0' || corruptedPath === '/' || corruptedPath === '//') {
    console.warn(`[PathNormalizer] Cannot repair severely corrupted path: ${corruptedPath}`);
    return fallbackPath || null;
  }

  // 如果无法修复，返回回退路径
  console.warn(`[PathNormalizer] Unable to repair path, using fallback: ${fallbackPath || 'null'}`);
  return fallbackPath || null;
}

/**
 * 统一图片路径处理
 * 将各种格式的图片路径统一转换为标准 file:// 协议路径
 *
 * @param imagePath - 原始图片路径（可能是相对路径、file:// 路径等）
 * @param storagePath - 存储根路径（用于处理相对路径）
 * @returns 标准化的 file:// 协议路径
 */
export function normalizeImagePath(imagePath: string, storagePath?: string): string {
  if (!imagePath || typeof imagePath !== 'string') {
    return imagePath;
  }

  console.log(`[PathNormalizer] Normalizing image path: ${imagePath}`);

  // 如果是 data: 协议（base64编码的图片），直接返回，不进行任何转换
  if (isDataURL(imagePath)) {
    console.log(`[PathNormalizer] Preserving data URL unchanged: ${imagePath.substring(0, 50)}...`);
    return imagePath;
  }

  // 如果是 http:// 或 https://，直接返回
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // 如果是有效的 file:// 路径，进行标准化
  if (imagePath.startsWith('file://')) {
    return normalizeFileProtocolPath(imagePath);
  }

  // 如果是相对路径且有 storagePath，转换为 file:// 协议
  if (storagePath && (!imagePath.startsWith('/') || imagePath.startsWith('./'))) {
    const fullPath = path.join(storagePath, imagePath);
    const normalizedPath = fullPath.replace(/\\/g, '/');
    const fileUrl = `file://${normalizedPath}`;
    console.log(`[PathNormalizer] Converted relative path to: ${fileUrl}`);
    return fileUrl;
  }

  console.log(`[PathNormalizer] Keeping path unchanged: ${imagePath}`);
  // 其他情况保持原样
  return imagePath;
}
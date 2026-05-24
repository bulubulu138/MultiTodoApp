/**
 * 路径解析工具类
 * 用于在 Obsidian 风格存储和浏览器显示层之间转换图片路径
 */

/**
 * 获取存储路径（待办文件存储目录）
 * @returns 存储路径字符串
 */
export async function getStoragePath(): Promise<string> {
  try {
    // 通过 IPC 获取存储路径配置
    if (window.electronAPI?.storage?.getStoragePath) {
      const storagePath = await window.electronAPI.storage.getStoragePath();

      // 防御性检查：验证路径有效性
      if (storagePath && storagePath.length > 0) {
        // 检查是否是默认路径（可能是错误的）
        const defaultPathPattern = /Roaming\/Electron\/todos$/;
        const isDefaultPath = defaultPathPattern.test(storagePath);

        if (isDefaultPath) {
          console.warn('[PathResolver] ⚠️ Warning: Detected possibly incorrect default path:', storagePath);
        }

        return storagePath;
      }

      return '';
    }
    return '';
  } catch (error) {
    console.error('[PathResolver] ❌ Error getting storage path:', error);
    return '';
  }
}

/**
 * 转换相对路径为绝对路径（用于文件访问）
 * @param relativePath - 相对路径（如 ./filename.ext）
 * @param basePath - 基础目录路径
 * @returns 绝对路径
 */
export function convertToAbsolutePath(relativePath: string, basePath: string): string {
  if (!relativePath || !basePath) {
    console.warn('[PathResolver] ⚠️ Missing required parameters for path conversion');
    return relativePath;
  }

  try {
    // 只处理相对路径
    if (!isRelativePath(relativePath)) {
      return relativePath;
    }

    // 防御性检查：验证基础路径不是默认路径
    const defaultPathPattern = /Roaming\/Electron\/todos$/;
    if (defaultPathPattern.test(basePath)) {
      console.warn('[PathResolver] ⚠️ Warning: Using potentially incorrect default base path:', basePath);
    }

    // 移除 ./ 前缀
    const cleanRelativePath = relativePath.replace(/^\.\//, '');

    // 规范化基础路径
    const normalizedBasePath = basePath.replace(/\\/g, '/');

    // 确保基础路径以 / 结尾
    const baseWithTrailingSlash = normalizedBasePath.endsWith('/')
      ? normalizedBasePath
      : normalizedBasePath + '/';

    // 组合路径
    const fullPath = baseWithTrailingSlash + cleanRelativePath;
    console.log(`[PathResolver] Converted: ${relativePath} -> ${fullPath}`);

    return fullPath;
  } catch (error) {
    console.error('[PathResolver] ❌ Error converting to absolute path:', error);
    return relativePath; // 降级：返回原始路径
  }
}

/**
 * 规范化图片路径
 * @param imagePath - 图片路径
 * @returns 规范化后的路径
 */
export function normalizeImagePath(imagePath: string): string {
  if (!imagePath) {
    return imagePath;
  }

  try {
    // 规范化路径分隔符（统一使用 /）
    let normalizedPath = imagePath.replace(/\\/g, '/');

    // 移除多余的 ./ 前缀（如果已经是绝对路径）
    if (normalizedPath.startsWith('/') && normalizedPath.startsWith('./')) {
      normalizedPath = normalizedPath.replace(/^\.\//, '');
    }

    // 确保相对路径以 ./ 开头
    if (!normalizedPath.startsWith('./') &&
        !normalizedPath.startsWith('/') &&
        !normalizedPath.startsWith('http') &&
        !normalizedPath.startsWith('data:')) {
      normalizedPath = `./${normalizedPath}`;
    }

    return normalizedPath;
  } catch (error) {
    console.error('[PathResolver] Error normalizing image path:', error);
    return imagePath;
  }
}

/**
 * 处理 HTML 内容中的所有图片路径
 * 将相对路径转换为 file:// 协议的绝对路径以便浏览器显示
 * @param html - HTML 内容
 * @param basePath - 基础目录路径
 * @returns 处理后的 HTML 内容
 */
export function processImagePathsInHtml(html: string, basePath: string): string {
  if (!html || !basePath) {
    return html;
  }

  try {
    return html.replace(/<img([^>]*?)\s+src\s*=\s*["']([^"']+)["']([^>]*?)>/gi, (match, beforeSrc, srcValue, afterSrc) => {
      // 处理相对路径
      if (isRelativePath(srcValue)) {
        const absolutePath = convertToAbsolutePath(srcValue, basePath);
        const fileProtocolPath = convertToFileProtocol(absolutePath);
        console.log(`[PathResolver] Converted relative path: ${srcValue} -> ${fileProtocolPath}`);
        return `<img${beforeSrc} src="${fileProtocolPath}"${afterSrc}>`;
      }
      // 保持其他路径不变
      return match;
    });
  } catch (error) {
    console.error('[PathResolver] Error processing image paths:', error);
    return html;
  }
}

/**
 * 将绝对路径转换为 file:// 协议
 * @param absolutePath - 绝对路径
 * @returns file:// 协议路径
 */
export function convertToFileProtocol(absolutePath: string): string {
  try {
    const normalizedPath = absolutePath.replace(/\\/g, '/');

    if (process.platform === 'win32') {
      // Windows: file:///C:/path/to/file.ext
      return 'file:///' + normalizedPath;
    } else {
      // Unix-like: file:///path/to/file.ext
      return 'file://' + normalizedPath;
    }
  } catch (error) {
    console.error('[PathResolver] Error converting to file protocol:', error);
    return absolutePath;
  }
}

/**
 * 将相对路径图片引用转换为 file:// 协议的绝对路径
 * @param html - 包含相对路径图片引用的 HTML 内容
 * @param basePath - 基础目录路径（待办文件的存储目录）
 * @returns 转换后的 HTML，图片路径为 file:// 协议
 */
export function convertRelativePathsToFileProtocol(html: string, basePath: string): string {
  if (!html || !basePath) {
    return html;
  }

  try {
    // 匹配所有 img 标签的 src 属性
    return html.replace(/<img([^>]*?)\s+src\s*=\s*["']([^"']+)["']([^>]*?)>/gi, (match, beforeSrc, srcValue, afterSrc) => {
      // 只处理相对路径
      if (srcValue.startsWith('./') || srcValue.startsWith('../')) {
        const absolutePath = resolveRelativePath(srcValue, basePath);
        console.log(`[PathResolver] Converted relative path: ${srcValue} -> ${absolutePath}`);
        return `<img${beforeSrc} src="${absolutePath}"${afterSrc}>`;
      }
      // 保持其他路径不变
      return match;
    });
  } catch (error) {
    console.error('[PathResolver] Error converting paths:', error);
    return html;
  }
}

/**
 * 解析相对路径为绝对路径
 * @param relativePath - 相对路径（如 ./filename.ext）
 * @param basePath - 基础目录路径
 * @returns file:// 协议的绝对路径
 */
function resolveRelativePath(relativePath: string, basePath: string): string {
  try {
    // 移除 ./ 前缀
    const cleanRelativePath = relativePath.replace(/^\.\//, '');

    // 规范化基础路径
    const normalizedBasePath = basePath.replace(/\\/g, '/');

    // 确保基础路径以 / 结尾
    const baseWithTrailingSlash = normalizedBasePath.endsWith('/')
      ? normalizedBasePath
      : normalizedBasePath + '/';

    // 组合路径
    const fullPath = baseWithTrailingSlash + cleanRelativePath;

    // 转换为 file:// 协议
    if (process.platform === 'win32') {
      // Windows: file:///C:/path/to/file.ext
      return 'file:///' + fullPath.replace(/\//g, '/');
    } else {
      // Unix-like: file:///path/to/file.ext
      return 'file://' + fullPath;
    }
  } catch (error) {
    console.error('[PathResolver] Error resolving path:', error);
    return relativePath;
  }
}

/**
 * 从 file:// 协议路径提取相对路径
 * @param fileProtocolPath - file:// 协议路径
 * @returns 相对路径（如 ./filename.ext）
 */
export function extractRelativePathFromFileProtocol(fileProtocolPath: string): string {
  try {
    // 移除 file:// 或 file:/// 前缀
    let cleanPath = fileProtocolPath.replace(/^file:\/\/\//, '').replace(/^file:\//, '');

    // 对于 Windows 路径，移除开头的 /
    if (process.platform === 'win32' && cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }

    // 提取文件名
    const fileName = cleanPath.split('/').pop() || cleanPath.split('\\').pop();

    if (fileName) {
      return `./${fileName}`;
    }

    return fileProtocolPath;
  } catch (error) {
    console.error('[PathResolver] Error extracting relative path:', error);
    return fileProtocolPath;
  }
}

/**
 * 验证路径是否为 file:// 协议
 * @param path - 待验证的路径
 * @returns 是否为 file:// 协议路径
 */
export function isFileProtocolPath(path: string): boolean {
  return path.startsWith('file://');
}

/**
 * 验证路径是否为相对路径
 * @param path - 待验证的路径
 * @returns 是否为相对路径
 */
export function isRelativePath(path: string): boolean {
  return path.startsWith('./') || path.startsWith('../');
}
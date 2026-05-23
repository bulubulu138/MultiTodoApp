import * as fs from 'fs';
import * as path from 'path';
import {
  normalizeFileProtocolPath,
  isValidFileProtocolPath,
  normalizeImagePath
} from './pathNormalizer';

/**
 * 图片提取结果接口
 */
export interface ImageExtractionResult {
  /**
   * 提取的图片信息
   */
  images: ImageData[];
  /**
   * 更新后的HTML内容（图片源已替换为相对路径）
   */
  updatedHtml: string;
}

/**
 * 单个图片数据接口
 */
export interface ImageData {
  /**
   * 原始图片源（Base64数据或文件路径）
   */
  source: string;
  /**
   * 图片类型（base64, file, http, relative）
   */
  type: 'base64' | 'file' | 'http' | 'relative';
  /**
   * 图片扩展名
   */
  extension: string;
  /**
   * 生成的文件名
   */
  fileName?: string;
}

/**
 * 图片处理结果接口
 */
export interface ImageProcessingResult {
  /**
   * 生成的相对路径
   */
  relativePath: string;
  /**
   * 文件名
   */
  fileName: string;
  /**
   * 是否成功
   */
  success: boolean;
}

/**
 * 图片提取器 - 统一处理不同来源的图片
 */
export class ImageExtractor {
  private static readonly BASE64_PATTERN = /^data:image\/(\w+);base64,(.+)$/;
  private static readonly FILE_PROTOCOL_PATTERN = /^file:\/\/(.+)$/;
  private static readonly IMG_TAG_PATTERN = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  private static readonly MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * 从HTML内容中提取图片（需要传入storagePath来生成正确的file://路径）
   * @param html - 原始HTML内容
   * @param baseName - 基础文件名（用于生成图片文件名）
   * @param storagePath - 存储路径（用于生成file://协议路径）
   * @returns 提取结果，包含图片数组和更新后的HTML
   */
  extractImagesFromHtml(html: string, baseName: string, storagePath?: string): ImageExtractionResult {
    const images: ImageData[] = [];
    let imageIndex = 1;

    console.log(`[ImageExtractor] Processing HTML content, length: ${html.length}`);
    console.log(`[ImageExtractor] HTML content: ${html.substring(0, 100)}`);

    // 使用正则表达式提取所有img标签的src属性
    const matches = Array.from(html.matchAll(ImageExtractor.IMG_TAG_PATTERN));
    console.log(`[ImageExtractor] Found ${matches.length} img tags`);

    // 收集需要替换的映射（先收集，再统一替换，避免重复替换问题）
    const replacements: Array<{ originalImgTag: string; newSrc: string }> = [];

    for (const match of matches) {
      const [fullMatch, src] = match;
      console.log(`[ImageExtractor] Processing img src: ${src}`);

      // 使用增强的路径验证函数检查错误路径格式
      const isValidPath = isValidFileProtocolPath(src);

      if (!isValidPath && (src.startsWith('file://') || src === '//:0' || src === '/' || src === '')) {
        console.warn(`[ImageExtractor] Found corrupted/invalid image path: "${src}", removing from HTML`);
        // 移除错误的img标签
        replacements.push({ originalImgTag: fullMatch, newSrc: '' });
        continue;
      }

      const imageData = this.classifyImageSource(src);
      console.log(`[ImageExtractor] Image type: ${imageData.type}, extension: ${imageData.extension}`);

      // 只处理Base64和file://协议的图片
      if (imageData.type === 'base64' || imageData.type === 'file') {
        const fileName = this.generateImageFileName(baseName, imageIndex, imageData.extension);
        imageData.fileName = fileName;
        images.push(imageData);

        // For Obsidian-style storage, use only relative paths in markdown
        // Don't use file:// protocol - keep only relative paths like ./filename.ext
        const relativePath = `./${fileName}`;

        console.log(`[ImageExtractor] Replacing ${src.substring(0, 50)}... -> ${relativePath}`);

        // 收集替换映射（存储完整的 <img> 标签，避免部分字符串替换）
        replacements.push({ originalImgTag: fullMatch, newSrc: relativePath });
        imageIndex++;
      } else if (imageData.type === 'relative') {
        // 对于相对路径，使用新的路径标准化函数
        const normalizedPath = normalizeImagePath(src, storagePath);

        // 如果路径发生改变，需要替换
        if (normalizedPath !== src) {
          console.log(`[ImageExtractor] Normalized relative path: ${src} -> ${normalizedPath}`);
          replacements.push({ originalImgTag: fullMatch, newSrc: normalizedPath });
        } else {
          console.log(`[ImageExtractor] Keeping relative path unchanged: ${src}`);
        }
      }
    }

    // 统一进行替换（避免循环中的重复替换问题）
    let updatedHtml = html;

    // 首先处理移除的错误路径
    for (const replacement of replacements) {
      if (replacement.newSrc === '') {
        // 移除错误的img标签
        updatedHtml = updatedHtml.replace(replacement.originalImgTag, '');
      }
    }

    // 然后处理路径替换（只替换完整标签的src属性，避免部分字符串匹配）
    for (const replacement of replacements) {
      if (replacement.newSrc !== '') {
        // 替换完整 <img> 标签中的 src 属性，避免部分字符串替换
        const updatedImgTag = replacement.originalImgTag.replace(
          /src=["'][^"']*["']/,
          `src="${replacement.newSrc}"`
        );
        updatedHtml = updatedHtml.replace(replacement.originalImgTag, updatedImgTag);
      }
    }

    console.log(`[ImageExtractor] Final HTML length: ${updatedHtml.length}`);
    console.log(`[ImageExtractor] Final HTML: ${updatedHtml.substring(0, 100)}`);

    return {
      images,
      updatedHtml
    };
  }

  /**
   * 分类图片源类型
   */
  private classifyImageSource(src: string): ImageData {
    // 检测Base64图片
    const base64Match = src.match(ImageExtractor.BASE64_PATTERN);
    if (base64Match) {
      return {
        source: src,
        type: 'base64',
        extension: base64Match[1]
      };
    }

    // 检测file://协议
    const fileMatch = src.match(ImageExtractor.FILE_PROTOCOL_PATTERN);
    if (fileMatch) {
      const filePath = fileMatch[1];
      const extension = this.extractExtensionFromPath(filePath);
      return {
        source: filePath,
        type: 'file',
        extension: extension || 'png'
      };
    }

    // 检测http://或https://协议
    if (src.startsWith('http://') || src.startsWith('https://')) {
      const extension = this.extractExtensionFromPath(src);
      return {
        source: src,
        type: 'http',
        extension: extension || 'png'
      };
    }

    // 默认为相对路径
    const extension = this.extractExtensionFromPath(src);
    return {
      source: src,
      type: 'relative',
      extension: extension || 'png'
    };
  }

  /**
   * 从文件路径中提取扩展名
   */
  private extractExtensionFromPath(filePath: string): string {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex > 0) {
      const extension = filePath.substring(lastDotIndex + 1);
      // 移除可能的查询参数
      const queryIndex = extension.indexOf('?');
      return queryIndex > 0 ? extension.substring(0, queryIndex) : extension;
    }
    return 'png'; // 默认扩展名
  }

  /**
   * 统一图片命名策略
   * @param baseName - 基础文件名
   * @param index - 图片序号
   * @param extension - 图片扩展名
   */
  generateImageFileName(baseName: string, index: number, extension: string): string {
    // 移除基础文件名中的.md扩展名
    const cleanBaseName = baseName.replace(/\.md$/, '');
    // 限制文件名长度，避免文件系统限制
    const truncatedBaseName = cleanBaseName.substring(0, 200);
    return `${truncatedBaseName}_content_${index}.${extension}`;
  }

  /**
   * 处理并保存图片到文件系统
   * @param imageData - 图片数据
   * @param storagePath - 存储路径
   * @param fileName - 目标文件名
   * @returns 处理结果
   */
  async processAndSaveImage(
    imageData: ImageData,
    storagePath: string,
    fileName: string
  ): Promise<ImageProcessingResult> {
    try {
      const filePath = path.join(storagePath, fileName);

      switch (imageData.type) {
        case 'base64':
          return await this.processBase64Image(imageData.source, storagePath, fileName);
        case 'file':
          return await this.processFilePathImage(imageData.source, storagePath, fileName);
        case 'http':
          // 暂不支持HTTP图片下载，保持原引用
          return {
            relativePath: imageData.source,
            fileName,
            success: true
          };
        case 'relative':
          // 相对路径图片无需处理
          return {
            relativePath: imageData.source,
            fileName,
            success: true
          };
        default:
          return {
            relativePath: '',
            fileName,
            success: false
          };
      }
    } catch (error) {
      console.error(`[ImageExtractor] Failed to process image ${fileName}:`, error);
      return {
        relativePath: '',
        fileName,
        success: false
      };
    }
  }

  /**
   * 处理Base64图片数据
   */
  private async processBase64Image(
    base64Data: string,
    storagePath: string,
    fileName: string
  ): Promise<ImageProcessingResult> {
    try {
      const matches = base64Data.match(ImageExtractor.BASE64_PATTERN);
      if (!matches) {
        console.warn('[ImageExtractor] Invalid Base64 format:', base64Data.substring(0, 50));
        return {
          relativePath: '',
          fileName,
          success: false
        };
      }

      const ext = matches[1];
      const base64Content = matches[2];
      const buffer = Buffer.from(base64Content, 'base64');

      // 验证图片大小
      if (buffer.length > ImageExtractor.MAX_IMAGE_SIZE) {
        console.warn(`[ImageExtractor] Image too large: ${buffer.length} bytes`);
        return {
          relativePath: '',
          fileName,
          success: false
        };
      }

      // 调整文件扩展名
      const adjustedFileName = fileName.replace(/\.\w+$/, `.${ext}`);
      const filePath = path.join(storagePath, adjustedFileName);

      // 写入文件
      await fs.promises.writeFile(filePath, buffer);

      console.log(`[ImageExtractor] Saved Base64 image: ${adjustedFileName} (${buffer.length} bytes)`);

      // Return only relative path for Obsidian-style storage
      return {
        relativePath: `./${adjustedFileName}`,
        fileName: adjustedFileName,
        success: true
      };
    } catch (error) {
      console.error('[ImageExtractor] Base64 processing error:', error);
      return {
        relativePath: '',
        fileName,
        success: false
      };
    }
  }

  /**
   * 处理文件路径图片
   */
  private async processFilePathImage(
    filePath: string,
    storagePath: string,
    fileName: string
  ): Promise<ImageProcessingResult> {
    try {
      // 规范化路径，处理Windows反斜杠
      const normalizedPath = filePath.replace(/\\/g, '/');

      // 检查文件是否存在
      if (!fs.existsSync(normalizedPath)) {
        console.warn(`[ImageExtractor] File not found: ${normalizedPath}`);
        return {
          relativePath: '',
          fileName,
          success: false
        };
      }

      // 获取原始文件扩展名
      const originalExtension = this.extractExtensionFromPath(normalizedPath);
      const adjustedFileName = fileName.replace(/\.\w+$/, `.${originalExtension}`);
      const targetPath = path.join(storagePath, adjustedFileName);

      // 复制文件
      await fs.promises.copyFile(normalizedPath, targetPath);

      console.log(`[ImageExtractor] Copied file image: ${normalizedPath} -> ${adjustedFileName}`);

      return {
        relativePath: `./${adjustedFileName}`,
        fileName: adjustedFileName,
        success: true
      };
    } catch (error) {
      console.error('[ImageExtractor] File path processing error:', error);
      return {
        relativePath: '',
        fileName,
        success: false
      };
    }
  }

  /**
   * 验证图片数据有效性
   */
  static validateImageData(imageData: string): boolean {
    if (!imageData || typeof imageData !== 'string') {
      return false;
    }

    // 验证Base64格式
    if (imageData.startsWith('data:')) {
      return ImageExtractor.BASE64_PATTERN.test(imageData);
    }

    // 验证file://协议
    if (imageData.startsWith('file://')) {
      const filePath = imageData.replace('file://', '');
      return fs.existsSync(filePath);
    }

    // 验证HTTP协议（只检查格式，不检查可达性）
    if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
      try {
        new URL(imageData);
        return true;
      } catch {
        return false;
      }
    }

    // 相对路径视为有效
    return true;
  }
}
import { toPng } from 'html-to-image';

/**
 * ImageExporter - 图片导出器
 * 
 * 将流程图导出为 PNG 图片
 */
export class ImageExporter {
  /**
   * 导出为 PNG 图片
   */
  static async exportToPng(
    element: HTMLElement,
    filename: string
  ): Promise<void> {
    try {
      // 使用 html-to-image 渲染为图片
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2 // 2x 分辨率，提高清晰度
      });

      // 下载图片
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to export image:', error);
      throw new Error('导出图片失败');
    }
  }

  /**
   * 复制图片到剪贴板
   */
  static async copyToClipboard(element: HTMLElement): Promise<void> {
    try {
      // 渲染为 Blob
      const dataUrl = await toPng(element, {
        cacheBust: true,
        backgroundColor: '#ffffff',
        pixelRatio: 2
      });

      // 将 data URL 转换为 Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // 复制到剪贴板
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
      throw new Error('复制图片到剪贴板失败');
    }
  }
}

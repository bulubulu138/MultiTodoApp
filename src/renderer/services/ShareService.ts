import { FlowchartSchema, PersistedNode, PersistedEdge } from '../../shared/types';
import pako from 'pako';

/**
 * ShareService - 流程图分享服务
 * 
 * 提供 URL 编码分享功能，支持通过链接分享流程图
 */
export class ShareService {
  /**
   * 将流程图编码为 URL 参数
   * 使用 gzip 压缩 + base64 编码以减小 URL 长度
   */
  static encodeToURL(
    schema: FlowchartSchema,
    nodes: PersistedNode[],
    edges: PersistedEdge[]
  ): string {
    try {
      // 构建数据对象
      const data = {
        version: '1.0',
        flowchart: {
          name: schema.name,
          description: schema.description,
          viewport: schema.viewport
        },
        nodes,
        edges
      };

      // 转换为 JSON 字符串
      const jsonString = JSON.stringify(data);

      // 使用 pako 进行 gzip 压缩
      const compressed = pako.deflate(jsonString, { level: 9 });

      // 转换为 base64
      const base64 = btoa(String.fromCharCode.apply(null, Array.from(compressed)));

      // 生成 URL（使用 URL-safe base64）
      const urlSafe = base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      // 构建完整 URL
      const baseUrl = window.location.origin;
      return `${baseUrl}/#/flowchart/view?data=${urlSafe}`;
    } catch (error) {
      console.error('Failed to encode flowchart to URL:', error);
      throw new Error('编码流程图失败');
    }
  }

  /**
   * 从 URL 参数解码流程图
   */
  static decodeFromURL(urlParam: string): {
    schema: Partial<FlowchartSchema>;
    nodes: PersistedNode[];
    edges: PersistedEdge[];
  } {
    try {
      // 还原 URL-safe base64
      const base64 = urlParam
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      // 补齐 padding
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

      // 解码 base64
      const binaryString = atob(padded);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // 使用 pako 解压缩
      const decompressed = pako.inflate(bytes, { to: 'string' });

      // 解析 JSON
      const data = JSON.parse(decompressed);

      // 验证数据格式
      if (!data.flowchart || !data.nodes || !data.edges) {
        throw new Error('Invalid data format');
      }

      return {
        schema: {
          name: data.flowchart.name,
          description: data.flowchart.description,
          viewport: data.flowchart.viewport
        },
        nodes: data.nodes,
        edges: data.edges
      };
    } catch (error) {
      console.error('Failed to decode flowchart from URL:', error);
      throw new Error('解码流程图失败，链接可能已损坏');
    }
  }

  /**
   * 复制分享链接到剪贴板
   */
  static async copyShareLink(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error('Failed to copy share link:', error);
      throw new Error('复制链接失败');
    }
  }

  /**
   * 检查 URL 长度是否超过限制
   * 大多数浏览器支持的 URL 长度约为 2000-8000 字符
   */
  static isURLTooLong(url: string): boolean {
    return url.length > 2000;
  }

  /**
   * 生成短链接提示信息
   */
  static getURLLengthWarning(url: string): string | null {
    if (url.length > 8000) {
      return '流程图过大，建议使用导出 JSON 文件的方式分享';
    } else if (url.length > 2000) {
      return '链接较长，部分浏览器可能不支持，建议使用较新的浏览器';
    }
    return null;
  }
}

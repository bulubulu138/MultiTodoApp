import { FlowchartSchema, PersistedNode, PersistedEdge, ExportResult } from '../../shared/types';

/**
 * ExportService - 流程图导出服务
 * 
 * 提供多种格式的导出功能：JSON, Mermaid, Text, PNG
 */
export class ExportService {
  /**
   * 导出为 JSON 格式
   */
  static toJSON(
    schema: FlowchartSchema,
    nodes: PersistedNode[],
    edges: PersistedEdge[]
  ): ExportResult {
    const data = {
      version: '1.0',
      flowchart: schema,
      nodes,
      edges,
      exportedAt: new Date().toISOString()
    };

    const content = JSON.stringify(data, null, 2);
    const filename = `${schema.name}-${Date.now()}.json`;

    return {
      format: 'json',
      content,
      filename
    };
  }

  /**
   * 从 JSON 导入
   */
  static fromJSON(jsonContent: string): {
    schema: FlowchartSchema;
    nodes: PersistedNode[];
    edges: PersistedEdge[];
  } {
    const data = JSON.parse(jsonContent);

    // 验证数据格式
    if (!data.flowchart || !data.nodes || !data.edges) {
      throw new Error('Invalid JSON format: missing required fields');
    }

    return {
      schema: data.flowchart,
      nodes: data.nodes,
      edges: data.edges
    };
  }

  /**
   * 复制到剪贴板
   */
  static async copyToClipboard(content: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      throw new Error('复制到剪贴板失败');
    }
  }

  /**
   * 下载文件
   */
  static downloadFile(content: string, filename: string, mimeType: string = 'application/json'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

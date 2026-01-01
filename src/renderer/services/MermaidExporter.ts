import { PersistedNode, PersistedEdge, NodeType, EdgeType, ExportResult, FlowchartSchema } from '../../shared/types';

/**
 * MermaidExporter - Mermaid 格式导出器
 * 
 * 将流程图导出为 Mermaid 语法
 */
export class MermaidExporter {
  /**
   * 导出为 Mermaid 格式
   */
  static export(
    schema: FlowchartSchema,
    nodes: PersistedNode[],
    edges: PersistedEdge[]
  ): ExportResult {
    const lines: string[] = [];

    // Mermaid 图表头部
    lines.push('flowchart TD');
    lines.push('');

    // 导出节点
    nodes.forEach(node => {
      const nodeId = this.sanitizeId(node.id);
      const label = this.escapeLabel(node.data.label);
      const shape = this.getNodeShape(node.type);

      lines.push(`    ${nodeId}${shape.start}${label}${shape.end}`);
    });

    lines.push('');

    // 导出边
    edges.forEach(edge => {
      const sourceId = this.sanitizeId(edge.source);
      const targetId = this.sanitizeId(edge.target);
      const arrow = this.getEdgeArrow(edge.type);
      const label = edge.label ? `|${this.escapeLabel(edge.label)}|` : '';

      lines.push(`    ${sourceId} ${arrow}${label} ${targetId}`);
    });

    const content = lines.join('\n');
    const filename = `${schema.name}-${Date.now()}.mmd`;

    return {
      format: 'mermaid',
      content,
      filename
    };
  }

  /**
   * 转义标签中的特殊字符
   */
  private static escapeLabel(label: string): string {
    return label
      .replace(/"/g, '#quot;')
      .replace(/\[/g, '#91;')
      .replace(/\]/g, '#93;')
      .replace(/\(/g, '#40;')
      .replace(/\)/g, '#41;')
      .replace(/\{/g, '#123;')
      .replace(/\}/g, '#125;')
      .replace(/</g, '#60;')
      .replace(/>/g, '#62;')
      .replace(/\|/g, '#124;')
      .replace(/\n/g, '<br/>');
  }

  /**
   * 清理节点 ID（移除特殊字符）
   */
  private static sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  /**
   * 获取节点形状
   */
  private static getNodeShape(type: NodeType): { start: string; end: string } {
    const shapes: Record<NodeType, { start: string; end: string }> = {
      'rectangle': { start: '[', end: ']' },
      'rounded-rectangle': { start: '(', end: ')' },
      'diamond': { start: '{', end: '}' },
      'circle': { start: '((', end: '))' },
      'todo': { start: '[', end: ']' }
    };

    return shapes[type] || shapes['rectangle'];
  }

  /**
   * 获取边的箭头样式
   */
  private static getEdgeArrow(type?: EdgeType): string {
    const arrows: Record<string, string> = {
      'default': '-->',
      'smoothstep': '-->',
      'step': '-->',
      'straight': '--->'
    };

    return arrows[type || 'default'] || '-->';
  }
}

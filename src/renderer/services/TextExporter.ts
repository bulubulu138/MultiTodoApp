import { PersistedNode, PersistedEdge, ExportResult, FlowchartSchema } from '../../shared/types';

/**
 * TextExporter - 纯文本导出器
 * 
 * 将流程图导出为人类可读的文本描述
 */
export class TextExporter {
  /**
   * 导出为纯文本格式
   */
  static export(
    schema: FlowchartSchema,
    nodes: PersistedNode[],
    edges: PersistedEdge[]
  ): ExportResult {
    const lines: string[] = [];

    // 标题
    lines.push(`流程图: ${schema.name}`);
    if (schema.description) {
      lines.push(`描述: ${schema.description}`);
    }
    lines.push(`创建时间: ${new Date(schema.createdAt).toLocaleString('zh-CN')}`);
    lines.push(`更新时间: ${new Date(schema.updatedAt).toLocaleString('zh-CN')}`);
    lines.push('');
    lines.push('='.repeat(60));
    lines.push('');

    // 节点列表
    lines.push('节点列表:');
    lines.push('');
    nodes.forEach((node, index) => {
      lines.push(`${index + 1}. [${node.id}] ${node.data.label}`);
      lines.push(`   类型: ${this.getNodeTypeName(node.type)}`);
      if (node.data.todoId) {
        lines.push(`   关联任务: ${node.data.todoId}`);
      }
      if (node.data.isLocked) {
        lines.push(`   状态: 已锁定`);
      }
      lines.push('');
    });

    lines.push('='.repeat(60));
    lines.push('');

    // 连接关系
    lines.push('连接关系:');
    lines.push('');
    if (edges.length === 0) {
      lines.push('  (无连接)');
    } else {
      edges.forEach((edge, index) => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        const sourceName = sourceNode?.data.label || edge.source;
        const targetName = targetNode?.data.label || edge.target;

        lines.push(`${index + 1}. ${sourceName} → ${targetName}`);
        if (edge.label) {
          lines.push(`   标签: ${edge.label}`);
        }
        lines.push('');
      });
    }

    lines.push('='.repeat(60));
    lines.push('');
    lines.push(`总计: ${nodes.length} 个节点, ${edges.length} 个连接`);

    const content = lines.join('\n');
    const filename = `${schema.name}-${Date.now()}.txt`;

    return {
      format: 'text',
      content,
      filename
    };
  }

  /**
   * 获取节点类型的中文名称
   */
  private static getNodeTypeName(type: string): string {
    const typeNames: Record<string, string> = {
      'rectangle': '矩形',
      'rounded-rectangle': '圆角矩形',
      'diamond': '菱形',
      'circle': '圆形',
      'todo': '待办任务'
    };

    return typeNames[type] || type;
  }
}

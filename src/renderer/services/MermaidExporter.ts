import { PersistedNode, PersistedEdge, NodeType, EdgeType, ExportResult, FlowchartSchema, Todo } from '../../shared/types';

/**
 * MermaidExporter - Mermaid 格式导出器
 * 
 * 将流程图导出为 Mermaid 语法，包含待办任务信息
 */
export class MermaidExporter {
  /**
   * 导出为 Mermaid 格式
   */
  static export(
    schema: FlowchartSchema,
    nodes: PersistedNode[],
    edges: PersistedEdge[],
    todos?: Todo[]
  ): ExportResult {
    const lines: string[] = [];

    // 创建 Todo Map 以便快速查找
    const todoMap = new Map(
      (todos || [])
        .filter(t => t.id !== undefined)
        .map(t => [String(t.id), t])
    );

    // Mermaid 图表头部
    lines.push('flowchart TD');
    lines.push('');

    // 添加标题和描述作为注释
    lines.push(`    %% 流程图: ${schema.name}`);
    if (schema.description) {
      lines.push(`    %% 描述: ${schema.description}`);
    }
    lines.push(`    %% 创建时间: ${new Date(schema.createdAt).toLocaleString('zh-CN')}`);
    lines.push('');

    // 导出节点
    nodes.forEach(node => {
      const nodeId = this.sanitizeId(node.id);
      let label = this.escapeLabel(node.data.label);
      
      // 如果关联了待办任务，添加任务信息
      if (node.data.todoId) {
        const todo = todoMap.get(node.data.todoId);
        if (todo) {
          const statusIcon = this.getTodoStatusIcon(todo.status);
          const priorityText = this.getTodoPriorityText(todo.priority);
          label = `${statusIcon} ${label}<br/>[${priorityText}]`;
        }
      }

      const shape = this.getNodeShape(node.type);
      lines.push(`    ${nodeId}${shape.start}${label}${shape.end}`);

      // 添加样式类
      if (node.data.todoId) {
        const todo = todoMap.get(node.data.todoId);
        if (todo) {
          const styleClass = this.getTodoStyleClass(todo.status);
          lines.push(`    class ${nodeId} ${styleClass}`);
        }
      }
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

    lines.push('');

    // 添加样式定义
    lines.push('    %% 样式定义');
    lines.push('    classDef pendingStyle fill:#fff3cd,stroke:#ffc107,stroke-width:2px');
    lines.push('    classDef inProgressStyle fill:#cfe2ff,stroke:#0d6efd,stroke-width:2px');
    lines.push('    classDef completedStyle fill:#d1e7dd,stroke:#198754,stroke-width:2px');
    lines.push('    classDef pausedStyle fill:#e2e3e5,stroke:#6c757d,stroke-width:2px');

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

  /**
   * 获取待办状态图标
   */
  private static getTodoStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'pending': '⏳',
      'in_progress': '🔄',
      'completed': '✅',
      'paused': '⏸️'
    };

    return icons[status] || '📋';
  }

  /**
   * 获取待办优先级文本
   */
  private static getTodoPriorityText(priority: string): string {
    const texts: Record<string, string> = {
      'high': '高优先级',
      'medium': '中优先级',
      'low': '低优先级'
    };

    return texts[priority] || priority;
  }

  /**
   * 获取待办状态对应的样式类
   */
  private static getTodoStyleClass(status: string): string {
    const classes: Record<string, string> = {
      'pending': 'pendingStyle',
      'in_progress': 'inProgressStyle',
      'completed': 'completedStyle',
      'paused': 'pausedStyle'
    };

    return classes[status] || 'pendingStyle';
  }
}

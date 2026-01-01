import { PersistedNode, PersistedEdge, ExportResult, FlowchartSchema, Todo } from '../../shared/types';

/**
 * TextExporter - 纯文本导出器
 * 
 * 将流程图导出为人类可读的文本描述，包含完整的业务信息
 */
export class TextExporter {
  /**
   * 导出为纯文本格式
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

    // 计算节点层级
    const nodeLevels = this.calculateNodeLevels(nodes, edges);

    // 节点列表（按层级排序）
    lines.push('节点列表（按层级）:');
    lines.push('');

    const sortedNodes = [...nodes].sort((a, b) => {
      const levelA = nodeLevels.get(a.id) || 0;
      const levelB = nodeLevels.get(b.id) || 0;
      return levelA - levelB;
    });

    sortedNodes.forEach((node, index) => {
      const level = nodeLevels.get(node.id) || 0;
      const indent = '  '.repeat(level);
      
      lines.push(`${indent}${index + 1}. [${node.id}] ${node.data.label}`);
      lines.push(`${indent}   类型: ${this.getNodeTypeName(node.type)}`);
      lines.push(`${indent}   层级: ${level}`);
      lines.push(`${indent}   位置: (${Math.round(node.position.x)}, ${Math.round(node.position.y)})`);
      
      // 关联的待办任务信息
      if (node.data.todoId) {
        const todo = todoMap.get(node.data.todoId);
        if (todo) {
          lines.push(`${indent}   关联任务: ${todo.title}`);
          lines.push(`${indent}   任务状态: ${this.getTodoStatusName(todo.status)}`);
          lines.push(`${indent}   任务优先级: ${this.getTodoPriorityName(todo.priority)}`);
          if (todo.deadline) {
            lines.push(`${indent}   截止时间: ${new Date(todo.deadline).toLocaleString('zh-CN')}`);
          }
        } else {
          lines.push(`${indent}   关联任务: ${node.data.todoId} (已删除)`);
        }
      }
      
      if (node.data.isLocked) {
        lines.push(`${indent}   状态: 已锁定`);
      }

      // 显示该节点的输入和输出连接
      const incomingEdges = edges.filter(e => e.target === node.id);
      const outgoingEdges = edges.filter(e => e.source === node.id);

      if (incomingEdges.length > 0) {
        const sources = incomingEdges.map(e => {
          const sourceNode = nodes.find(n => n.id === e.source);
          return sourceNode?.data.label || e.source;
        });
        lines.push(`${indent}   输入: ${sources.join(', ')}`);
      }

      if (outgoingEdges.length > 0) {
        const targets = outgoingEdges.map(e => {
          const targetNode = nodes.find(n => n.id === e.target);
          return targetNode?.data.label || e.target;
        });
        lines.push(`${indent}   输出: ${targets.join(', ')}`);
      }

      lines.push('');
    });

    lines.push('='.repeat(60));
    lines.push('');

    // 连接关系（详细）
    lines.push('连接关系详情:');
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
        if (edge.type && edge.type !== 'default') {
          lines.push(`   类型: ${edge.type}`);
        }
        lines.push('');
      });
    }

    lines.push('='.repeat(60));
    lines.push('');

    // 统计信息
    lines.push('统计信息:');
    lines.push(`  节点总数: ${nodes.length}`);
    lines.push(`  连接总数: ${edges.length}`);
    lines.push(`  最大层级: ${Math.max(...Array.from(nodeLevels.values()), 0)}`);
    
    const linkedTodos = nodes.filter(n => n.data.todoId).length;
    if (linkedTodos > 0) {
      lines.push(`  关联任务: ${linkedTodos}`);
    }

    const lockedNodes = nodes.filter(n => n.data.isLocked).length;
    if (lockedNodes > 0) {
      lines.push(`  锁定节点: ${lockedNodes}`);
    }

    // 节点类型统计
    const nodeTypeCount = new Map<string, number>();
    nodes.forEach(node => {
      const count = nodeTypeCount.get(node.type) || 0;
      nodeTypeCount.set(node.type, count + 1);
    });

    lines.push('');
    lines.push('节点类型分布:');
    nodeTypeCount.forEach((count, type) => {
      lines.push(`  ${this.getNodeTypeName(type)}: ${count}`);
    });

    const content = lines.join('\n');
    const filename = `${schema.name}-${Date.now()}.txt`;

    return {
      format: 'text',
      content,
      filename
    };
  }

  /**
   * 计算节点层级（基于拓扑排序）
   */
  private static calculateNodeLevels(
    nodes: PersistedNode[],
    edges: PersistedEdge[]
  ): Map<string, number> {
    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    // 初始化
    nodes.forEach(node => {
      inDegree.set(node.id, 0);
      adjacencyList.set(node.id, []);
    });

    // 构建图
    edges.forEach(edge => {
      const current = inDegree.get(edge.target) || 0;
      inDegree.set(edge.target, current + 1);
      
      const neighbors = adjacencyList.get(edge.source) || [];
      neighbors.push(edge.target);
      adjacencyList.set(edge.source, neighbors);
    });

    // BFS 计算层级
    const queue: string[] = [];
    
    // 找到所有入度为 0 的节点（起始节点）
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) {
        queue.push(nodeId);
        levels.set(nodeId, 0);
      }
    });

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levels.get(current) || 0;
      const neighbors = adjacencyList.get(current) || [];

      neighbors.forEach(neighbor => {
        const degree = inDegree.get(neighbor) || 0;
        inDegree.set(neighbor, degree - 1);

        // 更新层级为所有父节点的最大层级 + 1
        const neighborLevel = levels.get(neighbor) || 0;
        levels.set(neighbor, Math.max(neighborLevel, currentLevel + 1));

        if (degree - 1 === 0) {
          queue.push(neighbor);
        }
      });
    }

    // 对于没有连接的孤立节点，设置为层级 0
    nodes.forEach(node => {
      if (!levels.has(node.id)) {
        levels.set(node.id, 0);
      }
    });

    return levels;
  }

  /**
   * 获取节点类型的中文名称
   */
  private static getNodeTypeName(type: string): string {
    const typeNames: Record<string, string> = {
      'rectangle': '矩形',
      'rounded-rectangle': '圆角矩形',
      'diamond': '菱形（决策）',
      'circle': '圆形（起止）',
      'todo': '待办任务'
    };

    return typeNames[type] || type;
  }

  /**
   * 获取待办状态的中文名称
   */
  private static getTodoStatusName(status: string): string {
    const statusNames: Record<string, string> = {
      'pending': '待办',
      'in_progress': '进行中',
      'completed': '已完成',
      'paused': '已暂停'
    };

    return statusNames[status] || status;
  }

  /**
   * 获取待办优先级的中文名称
   */
  private static getTodoPriorityName(priority: string): string {
    const priorityNames: Record<string, string> = {
      'high': '高',
      'medium': '中',
      'low': '低'
    };

    return priorityNames[priority] || priority;
  }
}

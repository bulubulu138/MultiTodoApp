import { PersistedNode, PersistedEdge, FlowchartSchema } from '../../shared/types';

/**
 * 流程图模板接口
 */
export interface FlowchartTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: PersistedNode[];
  edges: PersistedEdge[];
}

/**
 * TemplateService - 流程图模板服务
 * 
 * 提供预定义的流程图模板
 */
export class TemplateService {
  /**
   * 获取所有模板
   */
  static getAllTemplates(): FlowchartTemplate[] {
    return [
      this.getBlankTemplate(),
      this.getProjectFlowTemplate(),
      this.getLearningPathTemplate()
    ];
  }

  /**
   * 空白画布模板
   */
  static getBlankTemplate(): FlowchartTemplate {
    return {
      id: 'blank',
      name: '空白画布',
      description: '从零开始创建流程图',
      category: 'basic',
      nodes: [],
      edges: []
    };
  }

  /**
   * 项目流程模板
   */
  static getProjectFlowTemplate(): FlowchartTemplate {
    const nodes: PersistedNode[] = [
      {
        id: 'start',
        type: 'circle',
        position: { x: 250, y: 50 },
        data: {
          label: '开始',
          style: {
            backgroundColor: '#52c41a',
            borderColor: '#52c41a',
            borderWidth: 2
          }
        }
      },
      {
        id: 'requirement',
        type: 'rectangle',
        position: { x: 200, y: 150 },
        data: {
          label: '需求分析',
          style: {
            backgroundColor: '#1890ff',
            borderColor: '#1890ff',
            borderWidth: 2
          }
        }
      },
      {
        id: 'design',
        type: 'rectangle',
        position: { x: 200, y: 250 },
        data: {
          label: '设计方案',
          style: {
            backgroundColor: '#1890ff',
            borderColor: '#1890ff',
            borderWidth: 2
          }
        }
      },
      {
        id: 'review',
        type: 'diamond',
        position: { x: 225, y: 350 },
        data: {
          label: '方案评审',
          style: {
            backgroundColor: '#faad14',
            borderColor: '#faad14',
            borderWidth: 2
          }
        }
      },
      {
        id: 'implement',
        type: 'rectangle',
        position: { x: 200, y: 470 },
        data: {
          label: '开发实现',
          style: {
            backgroundColor: '#1890ff',
            borderColor: '#1890ff',
            borderWidth: 2
          }
        }
      },
      {
        id: 'test',
        type: 'rectangle',
        position: { x: 200, y: 570 },
        data: {
          label: '测试验证',
          style: {
            backgroundColor: '#1890ff',
            borderColor: '#1890ff',
            borderWidth: 2
          }
        }
      },
      {
        id: 'deploy',
        type: 'rectangle',
        position: { x: 200, y: 670 },
        data: {
          label: '部署上线',
          style: {
            backgroundColor: '#1890ff',
            borderColor: '#1890ff',
            borderWidth: 2
          }
        }
      },
      {
        id: 'end',
        type: 'circle',
        position: { x: 250, y: 770 },
        data: {
          label: '完成',
          style: {
            backgroundColor: '#52c41a',
            borderColor: '#52c41a',
            borderWidth: 2
          }
        }
      }
    ];

    const edges: PersistedEdge[] = [
      { id: 'e1', source: 'start', target: 'requirement', type: 'default' },
      { id: 'e2', source: 'requirement', target: 'design', type: 'default' },
      { id: 'e3', source: 'design', target: 'review', type: 'default' },
      { id: 'e4', source: 'review', target: 'implement', type: 'default', label: '通过' },
      { id: 'e5', source: 'review', target: 'design', type: 'default', label: '不通过' },
      { id: 'e6', source: 'implement', target: 'test', type: 'default' },
      { id: 'e7', source: 'test', target: 'deploy', type: 'default' },
      { id: 'e8', source: 'deploy', target: 'end', type: 'default' }
    ];

    return {
      id: 'project-flow',
      name: '项目流程',
      description: '标准的项目开发流程模板',
      category: 'project',
      nodes,
      edges
    };
  }

  /**
   * 学习路径模板
   */
  static getLearningPathTemplate(): FlowchartTemplate {
    const nodes: PersistedNode[] = [
      {
        id: 'basics',
        type: 'rounded-rectangle',
        position: { x: 200, y: 50 },
        data: {
          label: '基础知识',
          style: {
            backgroundColor: '#1890ff',
            borderColor: '#1890ff',
            borderWidth: 2
          }
        }
      },
      {
        id: 'intermediate',
        type: 'rounded-rectangle',
        position: { x: 200, y: 150 },
        data: {
          label: '进阶学习',
          style: {
            backgroundColor: '#faad14',
            borderColor: '#faad14',
            borderWidth: 2
          }
        }
      },
      {
        id: 'advanced',
        type: 'rounded-rectangle',
        position: { x: 200, y: 250 },
        data: {
          label: '高级主题',
          style: {
            backgroundColor: '#ff4d4f',
            borderColor: '#ff4d4f',
            borderWidth: 2
          }
        }
      },
      {
        id: 'practice',
        type: 'rounded-rectangle',
        position: { x: 200, y: 350 },
        data: {
          label: '实践项目',
          style: {
            backgroundColor: '#52c41a',
            borderColor: '#52c41a',
            borderWidth: 2
          }
        }
      }
    ];

    const edges: PersistedEdge[] = [
      { id: 'e1', source: 'basics', target: 'intermediate', type: 'default' },
      { id: 'e2', source: 'intermediate', target: 'advanced', type: 'default' },
      { id: 'e3', source: 'advanced', target: 'practice', type: 'default' }
    ];

    return {
      id: 'learning-path',
      name: '学习路径',
      description: '知识学习和技能提升路径模板',
      category: 'learning',
      nodes,
      edges
    };
  }

  /**
   * 根据模板创建新的流程图
   */
  static createFromTemplate(
    template: FlowchartTemplate,
    name: string
  ): {
    schema: FlowchartSchema;
    nodes: PersistedNode[];
    edges: PersistedEdge[];
  } {
    const now = Date.now();

    const schema: FlowchartSchema = {
      id: `flowchart-${now}`,
      name: name || template.name,
      description: `基于模板"${template.name}"创建`,
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: now,
      updatedAt: now
    };

    // 深拷贝节点和边，避免修改模板
    const templateNodes: PersistedNode[] = JSON.parse(JSON.stringify(template.nodes));
    const templateEdges: PersistedEdge[] = JSON.parse(JSON.stringify(template.edges));

    // 生成全局唯一的节点ID映射
    const nodeIdMap = new Map<string, string>();
    templateNodes.forEach(node => {
      // 为每个节点生成全局唯一的ID：时间戳 + 随机字符串
      const uniqueId = `node-${now}-${Math.random().toString(36).substr(2, 9)}`;
      nodeIdMap.set(node.id, uniqueId);
    });

    // 更新节点ID
    const nodes = templateNodes.map(node => ({
      ...node,
      id: nodeIdMap.get(node.id) || node.id
    }));

    // 更新边的source和target引用
    const edges = templateEdges.map(edge => ({
      ...edge,
      id: `edge-${now}-${Math.random().toString(36).substr(2, 9)}`,
      source: nodeIdMap.get(edge.source) || edge.source,
      target: nodeIdMap.get(edge.target) || edge.target
    }));

    return { schema, nodes, edges };
  }
}

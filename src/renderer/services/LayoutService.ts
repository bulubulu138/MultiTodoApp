import dagre from 'dagre';
import { PersistedNode, PersistedEdge, FlowchartPatch } from '../../shared/types';

/**
 * LayoutService - 自动布局服务
 * 
 * 使用 dagre 算法实现流程图的自动布局
 */
export class LayoutService {
  /**
   * 层次布局（从上到下）
   */
  static hierarchical(
    nodes: PersistedNode[],
    edges: PersistedEdge[],
    options: {
      rankdir?: 'TB' | 'BT' | 'LR' | 'RL';
      nodesep?: number;
      ranksep?: number;
      animate?: boolean;
    } = {}
  ): FlowchartPatch[] {
    const {
      rankdir = 'TB',
      nodesep = 50,
      ranksep = 100,
      animate = true
    } = options;

    // 创建 dagre 图
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir,
      nodesep,
      ranksep,
      marginx: 20,
      marginy: 20
    });
    g.setDefaultEdgeLabel(() => ({}));

    // 添加节点（跳过锁定的节点）
    const unlockedNodes = nodes.filter(node => !node.data.isLocked);
    const lockedNodes = nodes.filter(node => node.data.isLocked);

    unlockedNodes.forEach(node => {
      // 使用固定的节点尺寸
      g.setNode(node.id, {
        width: 200,
        height: 80
      });
    });

    // 添加边（只考虑未锁定节点之间的边）
    edges.forEach(edge => {
      const sourceUnlocked = unlockedNodes.some(n => n.id === edge.source);
      const targetUnlocked = unlockedNodes.some(n => n.id === edge.target);
      
      if (sourceUnlocked && targetUnlocked) {
        g.setEdge(edge.source, edge.target);
      }
    });

    // 执行布局
    dagre.layout(g);

    // 生成位置更新的 Patches
    const patches: FlowchartPatch[] = [];

    unlockedNodes.forEach(node => {
      const dagreNode = g.node(node.id);
      if (dagreNode) {
        // dagre 返回的是节点中心点，需要转换为左上角坐标
        const newPosition = {
          x: dagreNode.x - dagreNode.width / 2,
          y: dagreNode.y - dagreNode.height / 2
        };

        // 只有位置发生变化时才生成 patch
        if (
          Math.abs(newPosition.x - node.position.x) > 1 ||
          Math.abs(newPosition.y - node.position.y) > 1
        ) {
          patches.push({
            type: 'updateNode',
            id: node.id,
            changes: {
              position: newPosition
            }
          });
        }
      }
    });

    return patches;
  }

  /**
   * 力导向布局（可选实现）
   */
  static forceDirected(
    nodes: PersistedNode[],
    edges: PersistedEdge[]
  ): FlowchartPatch[] {
    // 简单的力导向布局实现
    // 这里可以使用 d3-force 或其他力导向算法库
    // 暂时返回空数组，表示未实现
    console.warn('Force-directed layout not implemented yet');
    return [];
  }

  /**
   * 网格对齐
   */
  static snapToGrid(
    nodes: PersistedNode[],
    gridSize: number = 20
  ): FlowchartPatch[] {
    const patches: FlowchartPatch[] = [];

    nodes.forEach(node => {
      if (node.data.isLocked) return;

      const snappedPosition = {
        x: Math.round(node.position.x / gridSize) * gridSize,
        y: Math.round(node.position.y / gridSize) * gridSize
      };

      if (
        snappedPosition.x !== node.position.x ||
        snappedPosition.y !== node.position.y
      ) {
        patches.push({
          type: 'updateNode',
          id: node.id,
          changes: {
            position: snappedPosition
          }
        });
      }
    });

    return patches;
  }
}

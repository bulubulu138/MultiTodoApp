import { PersistedEdge } from '../../shared/types';

/**
 * 检测添加新边是否会创建循环
 * 
 * 使用深度优先搜索（DFS）检测有向图中的循环
 */
export function wouldCreateCycle(
  edges: PersistedEdge[],
  sourceId: string,
  targetId: string
): boolean {
  // 如果源和目标相同，直接返回 true（自环）
  if (sourceId === targetId) {
    return true;
  }

  // 构建邻接表
  const adjacencyList = new Map<string, Set<string>>();
  
  // 添加现有的边
  edges.forEach(edge => {
    if (!adjacencyList.has(edge.source)) {
      adjacencyList.set(edge.source, new Set());
    }
    adjacencyList.get(edge.source)!.add(edge.target);
  });

  // 添加新边
  if (!adjacencyList.has(sourceId)) {
    adjacencyList.set(sourceId, new Set());
  }
  adjacencyList.get(sourceId)!.add(targetId);

  // 使用 DFS 检测从 targetId 是否能到达 sourceId
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adjacencyList.get(nodeId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        // 如果邻居在递归栈中，说明找到了循环
        if (recursionStack.has(neighbor)) {
          return true;
        }
        // 如果邻居未访问过，递归检查
        if (!visited.has(neighbor) && dfs(neighbor)) {
          return true;
        }
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  // 从 targetId 开始 DFS，看是否能回到 sourceId
  return dfs(targetId);
}

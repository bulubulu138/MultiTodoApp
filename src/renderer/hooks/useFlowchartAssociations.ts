import { useState, useEffect, useMemo, useCallback } from 'react';
import { FlowchartAssociation } from '../../shared/types';

/**
 * useFlowchartAssociations Hook
 * 
 * 管理流程图关联数据的查询和缓存
 * 
 * 功能：
 * - 批量查询多个待办的流程图关联
 * - 自动缓存查询结果
 * - 监听 todoIds 变化，自动重新查询
 * - 提供 refresh 方法手动刷新
 * - 错误处理：查询失败时返回空 Map，不阻塞 UI
 */

interface UseFlowchartAssociationsResult {
  // 按 todoId 索引的关联数据
  associationsByTodo: Map<number, FlowchartAssociation[]>;
  // 加载状态
  loading: boolean;
  // 错误信息
  error: Error | null;
  // 刷新方法
  refresh: () => Promise<void>;
}

export function useFlowchartAssociations(
  todoIds: number[]
): UseFlowchartAssociationsResult {
  const [associationsData, setAssociationsData] = useState<Record<string, FlowchartAssociation[]>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // 查询关联数据的核心方法
  const fetchAssociations = useCallback(async (ids: number[]) => {
    if (!ids || ids.length === 0) {
      setAssociationsData({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.flowchart.getAssociationsByTodoIds(ids);
      setAssociationsData(result);
    } catch (err) {
      console.error('Failed to load flowchart associations:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // 返回空对象，不阻塞 UI
      setAssociationsData({});
    } finally {
      setLoading(false);
    }
  }, []);

  // 监听 todoIds 变化，自动重新查询
  useEffect(() => {
    fetchAssociations(todoIds);
  }, [todoIds, fetchAssociations]);

  // 将 Record 转换为 Map（使用 useMemo 缓存）
  const associationsByTodo = useMemo(() => {
    const map = new Map<number, FlowchartAssociation[]>();
    
    Object.entries(associationsData).forEach(([todoIdStr, associations]) => {
      const todoId = parseInt(todoIdStr, 10);
      if (!isNaN(todoId)) {
        map.set(todoId, associations);
      }
    });
    
    return map;
  }, [associationsData]);

  // 刷新方法（使用 useCallback 缓存）
  const refresh = useCallback(async () => {
    await fetchAssociations(todoIds);
  }, [todoIds, fetchAssociations]);

  return {
    associationsByTodo,
    loading,
    error,
    refresh
  };
}

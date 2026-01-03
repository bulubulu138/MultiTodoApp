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
 * - 性能优化：超过 100 个待办时分批查询
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

// 批量查询的批次大小
const BATCH_SIZE = 100;

export function useFlowchartAssociations(
  todoIds: number[]
): UseFlowchartAssociationsResult {
  const [associationsData, setAssociationsData] = useState<Record<string, FlowchartAssociation[]>>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // 分批查询方法（性能优化）
  const fetchAssociationsInBatches = useCallback(async (ids: number[]) => {
    if (!ids || ids.length === 0) {
      return {};
    }

    // 如果数量少于批次大小，直接查询
    if (ids.length <= BATCH_SIZE) {
      return await window.electronAPI.flowchart.getAssociationsByTodoIds(ids);
    }

    // 分批查询
    console.log(`[性能优化] 待办数量 ${ids.length} 超过阈值，使用分批查询`);
    const batches: number[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      batches.push(ids.slice(i, i + BATCH_SIZE));
    }

    // 并行执行所有批次
    const results = await Promise.all(
      batches.map(batch => window.electronAPI.flowchart.getAssociationsByTodoIds(batch))
    );

    // 合并结果
    const merged: Record<string, FlowchartAssociation[]> = {};
    results.forEach(result => {
      Object.assign(merged, result);
    });

    console.log(`[性能优化] 分批查询完成，共 ${batches.length} 批`);
    return merged;
  }, []);

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
      const result = await fetchAssociationsInBatches(ids);
      setAssociationsData(result);
    } catch (err) {
      console.error('Failed to load flowchart associations:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      // 返回空对象，不阻塞 UI
      setAssociationsData({});
    } finally {
      setLoading(false);
    }
  }, [fetchAssociationsInBatches]);

  // 监听 todoIds 变化，自动重新查询
  // 使用 JSON.stringify 来比较数组内容而不是引用
  useEffect(() => {
    fetchAssociations(todoIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(todoIds)]);

  // 监听流程图删除事件，自动刷新关联数据
  useEffect(() => {
    const handleFlowchartDeleted = () => {
      console.log('[useFlowchartAssociations] 检测到流程图删除，刷新关联数据');
      fetchAssociations(todoIds);
    };

    window.addEventListener('flowchart-deleted', handleFlowchartDeleted);
    return () => {
      window.removeEventListener('flowchart-deleted', handleFlowchartDeleted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(todoIds)]);

  // 将 Record 转换为 Map（使用 useMemo 缓存）
  const associationsByTodo = useMemo(() => {
    console.log('[useFlowchartAssociations] Converting associationsData to Map');
    console.log('[useFlowchartAssociations] associationsData keys:', Object.keys(associationsData));
    
    const map = new Map<number, FlowchartAssociation[]>();
    
    Object.entries(associationsData).forEach(([todoIdStr, associations]) => {
      console.log('[useFlowchartAssociations] Processing todoIdStr:', todoIdStr, 'type:', typeof todoIdStr);
      const todoId = parseInt(todoIdStr, 10);
      if (!isNaN(todoId)) {
        console.log('[useFlowchartAssociations] Setting Map entry:', todoId, '→', associations.length, 'associations');
        map.set(todoId, associations);
      }
    });
    
    console.log('[useFlowchartAssociations] Final Map keys:', Array.from(map.keys()));
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

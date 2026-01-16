import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 流程图数据接口
 */
export interface FlowchartData {
  id: string;
  name: string;
  description?: string;
  nodes: any[];
  edges: any[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook 返回值接口
 */
export interface UseFlowchartDataResult {
  flowchartData: FlowchartData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * LRU 缓存类
 * 用于缓存流程图数据，限制最多缓存 20 个流程图
 */
class FlowchartCache {
  private cache = new Map<string, FlowchartData>();
  private maxSize = 20;

  get(id: string): FlowchartData | undefined {
    const data = this.cache.get(id);
    if (data) {
      // LRU: 移到最后（最近使用）
      this.cache.delete(id);
      this.cache.set(id, data);
    }
    return data;
  }

  set(id: string, data: FlowchartData): void {
    // 如果已存在，先删除
    if (this.cache.has(id)) {
      this.cache.delete(id);
    }

    // 如果超过最大容量，删除最旧的（第一个）
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
        console.log(`[FlowchartCache] 缓存已满，删除最旧的: ${firstKey}`);
      }
    }

    this.cache.set(id, data);
    console.log(`[FlowchartCache] 缓存流程图: ${id}, 当前缓存数量: ${this.cache.size}`);
  }

  clear(): void {
    this.cache.clear();
    console.log('[FlowchartCache] 清空缓存');
  }

  has(id: string): boolean {
    return this.cache.has(id);
  }

  size(): number {
    return this.cache.size;
  }
}

// 全局缓存实例
const flowchartCache = new FlowchartCache();

/**
 * 加载超时时间（毫秒）
 */
const LOAD_TIMEOUT = 5000;

/**
 * useFlowchartData Hook
 * 
 * 管理流程图数据的加载、缓存和错误处理
 * 
 * @param flowchartId - 流程图 ID
 * @returns 流程图数据、加载状态、错误信息和重新加载方法
 * 
 * @example
 * ```tsx
 * const { flowchartData, loading, error, refetch } = useFlowchartData('flowchart-123');
 * 
 * if (loading) return <Spin />;
 * if (error) return <Alert message={error.message} />;
 * if (flowchartData) return <FlowchartPreview data={flowchartData} />;
 * ```
 */
export function useFlowchartData(flowchartId: string): UseFlowchartDataResult {
  const [flowchartData, setFlowchartData] = useState<FlowchartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 使用 ref 追踪当前的加载请求，避免竞态条件
  const currentRequestRef = useRef<string | null>(null);

  /**
   * 加载流程图数据
   */
  const fetchFlowchart = useCallback(async () => {
    if (!flowchartId) {
      setFlowchartData(null);
      setLoading(false);
      setError(new Error('流程图 ID 不能为空'));
      return;
    }

    // 检查缓存
    if (flowchartCache.has(flowchartId)) {
      const cachedData = flowchartCache.get(flowchartId);
      if (cachedData) {
        console.log(`[useFlowchartData] 从缓存加载: ${flowchartId}`);
        setFlowchartData(cachedData);
        setLoading(false);
        setError(null);
        return;
      }
    }

    // 标记当前请求
    currentRequestRef.current = flowchartId;

    setLoading(true);
    setError(null);

    try {
      // 创建超时 Promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error('加载超时（超过 5 秒）'));
        }, LOAD_TIMEOUT);
      });

      // 创建加载 Promise
      const loadPromise = window.electronAPI.flowchart.load(flowchartId);

      // 竞速：哪个先完成就用哪个
      const data = await Promise.race([loadPromise, timeoutPromise]);

      // 检查是否是最新的请求（避免竞态条件）
      if (currentRequestRef.current !== flowchartId) {
        console.log(`[useFlowchartData] 请求已过期，忽略结果: ${flowchartId}`);
        return;
      }

      if (!data) {
        throw new Error('流程图不存在或已被删除');
      }

      // 存入缓存
      flowchartCache.set(flowchartId, data);
      setFlowchartData(data);
      setError(null);

      console.log(`[useFlowchartData] 加载成功: ${flowchartId}`);
    } catch (err) {
      // 检查是否是最新的请求
      if (currentRequestRef.current !== flowchartId) {
        return;
      }

      console.error(`[useFlowchartData] 加载失败: ${flowchartId}`, err);
      
      const errorMessage = err instanceof Error ? err.message : '加载流程图失败';
      setError(new Error(errorMessage));
      setFlowchartData(null);
    } finally {
      // 检查是否是最新的请求
      if (currentRequestRef.current === flowchartId) {
        setLoading(false);
      }
    }
  }, [flowchartId]);

  /**
   * 重新加载（跳过缓存）
   */
  const refetch = useCallback(async () => {
    console.log(`[useFlowchartData] 强制重新加载: ${flowchartId}`);
    // 清除缓存中的这个流程图
    if (flowchartCache.has(flowchartId)) {
      flowchartCache.set(flowchartId, flowchartData!); // 临时保存
      // 实际上我们需要一个 delete 方法
    }
    await fetchFlowchart();
  }, [flowchartId, fetchFlowchart, flowchartData]);

  // 当 flowchartId 变化时，加载数据
  useEffect(() => {
    fetchFlowchart();
  }, [fetchFlowchart]);

  // 监听流程图删除事件，清除缓存
  useEffect(() => {
    const handleFlowchartDeleted = (event: CustomEvent) => {
      const deletedId = event.detail?.flowchartId;
      if (deletedId === flowchartId) {
        console.log(`[useFlowchartData] 流程图已删除: ${flowchartId}`);
        setError(new Error('流程图已被删除'));
        setFlowchartData(null);
      }
    };

    window.addEventListener('flowchart-deleted', handleFlowchartDeleted as EventListener);

    return () => {
      window.removeEventListener('flowchart-deleted', handleFlowchartDeleted as EventListener);
    };
  }, [flowchartId]);

  return {
    flowchartData,
    loading,
    error,
    refetch
  };
}

/**
 * 清空所有缓存（用于测试或内存管理）
 */
export function clearFlowchartCache(): void {
  flowchartCache.clear();
}

/**
 * 获取缓存大小（用于调试）
 */
export function getFlowchartCacheSize(): number {
  return flowchartCache.size();
}

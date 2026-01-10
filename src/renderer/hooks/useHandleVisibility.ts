import { useState, useCallback, CSSProperties } from 'react';

/**
 * Handle 可见性状态
 */
export type HandleVisibilityMode = 'hidden' | 'hover' | 'connecting' | 'visible';

export interface HandleVisibilityState {
  mode: HandleVisibilityMode;
  connectingNodeId: string | null;
  hoveredNodeId: string | null;
}

/**
 * Handle 可见性控制 Hook
 * 
 * 管理流程图中连接点的可见性状态，提供简洁的界面体验
 */
export const useHandleVisibility = () => {
  const [state, setState] = useState<HandleVisibilityState>({
    mode: 'hidden',
    connectingNodeId: null,
    hoveredNodeId: null
  });

  /**
   * 设置悬停节点
   */
  const setHoveredNode = useCallback((nodeId: string | null) => {
    setState(prev => ({
      ...prev,
      mode: nodeId ? 'hover' : 'hidden',
      hoveredNodeId: nodeId
    }));
  }, []);

  /**
   * 设置连接状态
   */
  const setConnecting = useCallback((nodeId: string | null) => {
    setState(prev => ({
      ...prev,
      mode: nodeId ? 'connecting' : 'hidden',
      connectingNodeId: nodeId
    }));
  }, []);

  /**
   * 获取 Handle 样式
   */
  const getHandleStyle = useCallback((
    nodeId: string,
    handleId: string
  ): CSSProperties => {
    const baseStyle: CSSProperties = {
      background: '#555',
      width: '10px',
      height: '10px',
      border: '2px solid #fff',
      transition: 'all 0.2s ease',
      zIndex: 10
    };

    // 默认：半透明
    if (state.mode === 'hidden') {
      return { ...baseStyle, opacity: 0.3 };
    }

    // 悬停：完全显示
    if (state.mode === 'hover' && state.hoveredNodeId === nodeId) {
      return { 
        ...baseStyle, 
        opacity: 1, 
        transform: 'scale(1.2)',
        boxShadow: '0 0 4px rgba(0,0,0,0.3)'
      };
    }

    // 连接中：高亮可连接的 Handle
    if (state.mode === 'connecting') {
      // 如果是正在连接的节点，显示所有 Handle
      if (state.connectingNodeId === nodeId) {
        return {
          ...baseStyle,
          opacity: 1,
          background: '#1890ff'
        };
      }
      
      // 其他节点：高亮显示可连接的 Handle
      return {
        ...baseStyle,
        opacity: 1,
        background: '#52c41a',
        transform: 'scale(1.3)',
        boxShadow: '0 0 6px rgba(82, 196, 26, 0.6)'
      };
    }

    // 始终可见模式
    if (state.mode === 'visible') {
      return { ...baseStyle, opacity: 1 };
    }

    return baseStyle;
  }, [state]);

  return {
    state,
    setHoveredNode,
    setConnecting,
    getHandleStyle
  };
};

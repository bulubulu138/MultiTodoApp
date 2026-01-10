import React, { createContext, useContext, CSSProperties } from 'react';

/**
 * Handle 可见性 Context
 * 
 * 用于在节点组件中访问 Handle 可见性状态和样式
 */
interface HandleVisibilityContextType {
  getHandleStyle: (nodeId: string, handleId: string) => CSSProperties;
  setHoveredNode: (nodeId: string | null) => void;
  setConnecting: (nodeId: string | null) => void;
}

const HandleVisibilityContext = createContext<HandleVisibilityContextType | null>(null);

export const HandleVisibilityProvider = HandleVisibilityContext.Provider;

/**
 * 使用 Handle 可见性 Context 的 Hook
 */
export const useHandleVisibilityContext = () => {
  const context = useContext(HandleVisibilityContext);
  if (!context) {
    // 如果没有 Provider，返回默认实现
    return {
      getHandleStyle: () => ({
        background: '#555',
        width: '10px',
        height: '10px',
        border: '2px solid #fff',
        zIndex: 10
      }),
      setHoveredNode: () => {},
      setConnecting: () => {}
    };
  }
  return context;
};

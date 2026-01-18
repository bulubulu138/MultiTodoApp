import React, { useState, useEffect, useRef } from 'react';
import { Card, Skeleton } from 'antd';
import { FlowchartPreviewCard } from './FlowchartPreviewCard';

interface LazyFlowchartPreviewCardProps {
  /** 流程图 ID */
  flowchartId: string;
  /** 流程图名称 */
  flowchartName: string;
  /** 流程图描述（可选） */
  flowchartDescription?: string;
  /** 需要高亮的节点 ID（节点级别关联） */
  highlightedNodeId?: string;
  /** 点击预览时的回调 */
  onPreviewClick: (flowchartId: string, nodeId?: string) => void;
  /** 预览高度（可选，默认 300px） */
  previewHeight?: number;
  /** 是否显示操作按钮 */
  showActions?: boolean;
  /** Intersection Observer 阈值（默认 0.1） */
  threshold?: number;
}

/**
 * 占位符组件
 */
const PreviewPlaceholder: React.FC<{ height: number; name: string }> = ({ height, name }) => (
  <Card bodyStyle={{ padding: 16 }}>
    <Skeleton active paragraph={{ rows: 1 }} />
    <div
      style={{
        height: `${height}px`,
        backgroundColor: '#f5f5f5',
        borderRadius: '4px',
        marginTop: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <span style={{ color: '#999' }}>准备加载 {name}...</span>
    </div>
  </Card>
);

/**
 * LazyFlowchartPreviewCard 组件
 * 
 * 带懒加载功能的流程图预览卡片
 * 使用 Intersection Observer API 实现懒加载
 * 只有当卡片进入可视区域时才加载流程图数据
 * 
 * 特性：
 * - 自动检测卡片是否进入可视区域
 * - 进入可视区域后才加载真实的预览组件
 * - 显示占位符直到进入可视区域
 * - 一旦加载后不会再卸载（避免重复加载）
 * 
 * @example
 * ```tsx
 * <LazyFlowchartPreviewCard
 *   flowchartId="flowchart-123"
 *   flowchartName="用户注册流程"
 *   onPreviewClick={handleOpenFlowchart}
 *   threshold={0.1}
 * />
 * ```
 */
export const LazyFlowchartPreviewCard: React.FC<LazyFlowchartPreviewCardProps> = ({
  flowchartId,
  flowchartName,
  flowchartDescription,
  highlightedNodeId,
  onPreviewClick,
  previewHeight = 300,
  showActions = true,
  threshold = 0.1
}) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // 重置 Intersection Observer
    setShouldLoad(false);
    
    // 创建 Intersection Observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 进入可视区域，开始加载
            console.log(`[LazyLoad] 流程图进入可视区域: ${flowchartName}`);
            setShouldLoad(true);
            
            // 加载后断开观察，避免重复触发
            if (observerRef.current) {
              observerRef.current.disconnect();
            }
          }
        });
      },
      {
        // 阈值：元素可见多少比例时触发
        threshold: threshold,
        // 根元素：默认为视口
        root: null,
        // 根边距：提前一点加载（向下滚动时提前 100px）
        rootMargin: '100px 0px'
      }
    );

    // 开始观察
    if (cardRef.current) {
      observerRef.current.observe(cardRef.current);
    }

    // 清理
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [flowchartId, flowchartName, threshold]); // 添加 flowchartId 作为依赖

  return (
    <div ref={cardRef}>
      {shouldLoad ? (
        <FlowchartPreviewCard
          flowchartId={flowchartId}
          flowchartName={flowchartName}
          flowchartDescription={flowchartDescription}
          highlightedNodeId={highlightedNodeId}
          onPreviewClick={onPreviewClick}
          previewHeight={previewHeight}
          showActions={showActions}
        />
      ) : (
        <PreviewPlaceholder height={previewHeight} name={flowchartName} />
      )}
    </div>
  );
};

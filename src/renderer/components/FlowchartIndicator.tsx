import React, { useState, useMemo, useCallback } from 'react';
import { Tag, Popover, Tooltip, Space, Typography } from 'antd';
import { PartitionOutlined } from '@ant-design/icons';
import { FlowchartAssociation } from '../../shared/types';

const { Text } = Typography;

interface FlowchartIndicatorProps {
  todoId: number;
  associations: FlowchartAssociation[];
  onNavigate: (flowchartId: string, nodeId: string) => void;
  size?: 'small' | 'default';
  showLabel?: boolean;
}

/**
 * FlowchartIndicator Component
 * 
 * 在待办项中显示流程图关联指示器
 * 
 * 功能：
 * - 显示关联的流程图数量徽章
 * - 悬停显示 Tooltip
 * - 点击显示 Popover 列表
 * - 支持点击跳转到流程图
 * - 性能优化：使用 React.memo 避免不必要的重渲染
 */
export const FlowchartIndicator: React.FC<FlowchartIndicatorProps> = React.memo(({
  todoId,
  associations,
  onNavigate,
  size = 'default',
  showLabel = false
}) => {
  const [popoverVisible, setPopoverVisible] = useState(false);

  // 如果没有关联，不显示指示器
  if (!associations || associations.length === 0) {
    return null;
  }

  const count = associations.length;

  // Tooltip 文本（使用 useMemo 缓存）
  const tooltipText = useMemo(() => `关联了 ${count} 个流程图节点`, [count]);

  // 处理点击流程图项（使用 useCallback 缓存）
  const handleFlowchartClick = React.useCallback((flowchartId: string, nodeId: string) => {
    setPopoverVisible(false);
    onNavigate(flowchartId, nodeId);
  }, [onNavigate]);

  // Popover 内容（使用 useMemo 缓存）
  const popoverContent = useMemo(() => (
    <div style={{ maxWidth: 300, maxHeight: 400, overflow: 'auto' }}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {associations.map((assoc, index) => (
          <div
            key={`${assoc.flowchartId}-${assoc.nodeId}-${index}`}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'background-color 0.2s',
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(114, 46, 209, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => handleFlowchartClick(assoc.flowchartId, assoc.nodeId)}
          >
            <Space direction="vertical" size={0}>
              <Text strong style={{ fontSize: '13px' }}>
                {assoc.flowchartName}
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                节点: {assoc.nodeLabel}
              </Text>
            </Space>
          </div>
        ))}
      </Space>
    </div>
  ), [associations, handleFlowchartClick]);

  return (
    <Tooltip title={tooltipText} placement="top">
      <Popover
        content={popoverContent}
        title="关联的流程图"
        trigger="click"
        open={popoverVisible}
        onOpenChange={setPopoverVisible}
        placement="bottomLeft"
      >
        <Tag
          icon={<PartitionOutlined />}
          color="purple"
          style={{
            cursor: 'pointer',
            fontSize: size === 'small' ? '12px' : '14px',
            padding: size === 'small' ? '0 4px' : '0 8px',
            margin: '0 4px',
            userSelect: 'none'
          }}
        >
          {showLabel && '流程图 '}
          {count > 1 && `×${count}`}
        </Tag>
      </Popover>
    </Tooltip>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只在关键 props 变化时重新渲染
  return (
    prevProps.todoId === nextProps.todoId &&
    prevProps.associations === nextProps.associations &&
    prevProps.onNavigate === nextProps.onNavigate &&
    prevProps.size === nextProps.size &&
    prevProps.showLabel === nextProps.showLabel
  );
});

FlowchartIndicator.displayName = 'FlowchartIndicator';

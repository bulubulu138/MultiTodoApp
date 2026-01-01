import React, { useState, useMemo } from 'react';
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
 */
export const FlowchartIndicator: React.FC<FlowchartIndicatorProps> = ({
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

  // Tooltip 文本
  const tooltipText = `关联了 ${count} 个流程图节点`;

  // 处理点击流程图项
  const handleFlowchartClick = (flowchartId: string, nodeId: string) => {
    setPopoverVisible(false);
    onNavigate(flowchartId, nodeId);
  };

  // Popover 内容
  const popoverContent = (
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
  );

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
};

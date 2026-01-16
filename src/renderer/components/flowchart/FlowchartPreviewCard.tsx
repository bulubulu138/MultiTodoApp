import React, { useState } from 'react';
import { Card, Typography, Space, Button, Alert, Skeleton, Spin } from 'antd';
import { FileTextOutlined, EditOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { ReactFlowProvider } from 'reactflow';
import { useFlowchartData } from '../../hooks/useFlowchartData';
import { FlowchartPreviewCanvas } from './FlowchartPreviewCanvas';
import { useThemeColors } from '../../hooks/useThemeColors';

const { Text, Paragraph } = Typography;

interface FlowchartPreviewCardProps {
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
}

/**
 * 预览骨架屏组件
 */
const PreviewSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div
    style={{
      height: `${height}px`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f5f5f5',
      borderRadius: '4px'
    }}
  >
    <Space direction="vertical" align="center">
      <Spin size="large" />
      <Text type="secondary">加载流程图预览...</Text>
    </Space>
  </div>
);

/**
 * 预览错误组件
 */
const PreviewError: React.FC<{
  error: Error;
  onRetry: (e: React.MouseEvent) => void;
  onOpenEditor: (e: React.MouseEvent) => void;
}> = ({ error, onRetry, onOpenEditor }) => (
  <Alert
    type="error"
    message="预览加载失败"
    description={error.message}
    action={
      <Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
          重试
        </Button>
        <Button size="small" type="primary" icon={<EditOutlined />} onClick={onOpenEditor}>
          打开编辑器
        </Button>
      </Space>
    }
    style={{ marginTop: 8 }}
  />
);

/**
 * 预览头部组件
 */
const PreviewHeader: React.FC<{
  name: string;
  description?: string;
  highlightedNodeId?: string;
}> = ({ name, description, highlightedNodeId }) => (
  <div style={{ marginBottom: 12 }}>
    <Space>
      <FileTextOutlined style={{ fontSize: 20, color: '#52c41a' }} />
      <Text strong style={{ fontSize: 16 }}>
        {name}
      </Text>
      {highlightedNodeId && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          (节点关联)
        </Text>
      )}
    </Space>
    {description && (
      <Paragraph
        type="secondary"
        style={{ fontSize: 12, marginTop: 4, marginBottom: 0 }}
        ellipsis={{ rows: 2 }}
      >
        {description}
      </Paragraph>
    )}
  </div>
);

/**
 * 预览底部操作栏组件
 */
const PreviewFooter: React.FC<{
  onView: (e: React.MouseEvent) => void;
  onEdit: (e: React.MouseEvent) => void;
}> = ({ onView, onEdit }) => (
  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
    <Button size="small" icon={<EyeOutlined />} onClick={onView}>
      查看详情
    </Button>
    <Button size="small" type="primary" icon={<EditOutlined />} onClick={onEdit}>
      编辑
    </Button>
  </div>
);

/**
 * FlowchartPreviewCard 组件
 * 
 * 流程图预览卡片，包含预览画布和交互控制
 * 
 * 特性：
 * - 自动加载流程图数据（带缓存）
 * - 显示加载状态和错误状态
 * - 支持节点高亮显示
 * - 点击卡片或按钮打开流程图编辑器
 * - 悬停效果（边框高亮、阴影）
 * 
 * @example
 * ```tsx
 * <FlowchartPreviewCard
 *   flowchartId="flowchart-123"
 *   flowchartName="用户注册流程"
 *   flowchartDescription="描述用户注册的完整流程"
 *   highlightedNodeId="node-456"
 *   onPreviewClick={(id, nodeId) => handleOpenFlowchart(id, nodeId)}
 *   previewHeight={300}
 *   showActions={true}
 * />
 * ```
 */
export const FlowchartPreviewCard: React.FC<FlowchartPreviewCardProps> = ({
  flowchartId,
  flowchartName,
  flowchartDescription,
  highlightedNodeId,
  onPreviewClick,
  previewHeight = 300,
  showActions = true
}) => {
  const colors = useThemeColors();
  const [isHovered, setIsHovered] = useState(false);

  // 加载流程图数据
  const { flowchartData, loading, error, refetch } = useFlowchartData(flowchartId);

  // 处理点击事件
  const handleCardClick = () => {
    if (!loading && !error) {
      onPreviewClick(flowchartId, highlightedNodeId);
    }
  };

  // 处理查看详情
  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPreviewClick(flowchartId, highlightedNodeId);
  };

  // 处理编辑
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPreviewClick(flowchartId, highlightedNodeId);
  };

  // 处理重试
  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    refetch();
  };

  // 处理打开编辑器（错误状态下）
  const handleOpenEditor = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPreviewClick(flowchartId, highlightedNodeId);
  };

  return (
    <Card
      hoverable={!loading && !error}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
      style={{
        cursor: loading || error ? 'default' : 'pointer',
        borderColor: isHovered && !loading && !error ? '#1890ff' : colors.borderColor,
        borderWidth: isHovered && !loading && !error ? '2px' : '1px',
        borderLeft: highlightedNodeId ? '4px solid #1890ff' : undefined,
        boxShadow: isHovered && !loading && !error ? '0 4px 12px rgba(0, 0, 0, 0.15)' : undefined,
        transition: 'all 0.3s ease'
      }}
      bodyStyle={{ padding: 16 }}
    >
      {/* 头部：名称和描述 */}
      <PreviewHeader
        name={flowchartName}
        description={flowchartDescription}
        highlightedNodeId={highlightedNodeId}
      />

      {/* 预览画布或加载/错误状态 */}
      {loading && <PreviewSkeleton height={previewHeight} />}

      {error && (
        <PreviewError
          error={error}
          onRetry={handleRetry}
          onOpenEditor={handleOpenEditor}
        />
      )}

      {flowchartData && !loading && !error && (
        <ReactFlowProvider>
          <FlowchartPreviewCanvas
            data={flowchartData}
            height={previewHeight}
            highlightedNodeId={highlightedNodeId}
            readOnly={true}
          />
        </ReactFlowProvider>
      )}

      {/* 底部操作栏 */}
      {showActions && flowchartData && !loading && !error && (
        <PreviewFooter onView={handleView} onEdit={handleEdit} />
      )}
    </Card>
  );
};

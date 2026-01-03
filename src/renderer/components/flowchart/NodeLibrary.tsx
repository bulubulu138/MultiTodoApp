import React from 'react';
import { Card, Space, Typography } from 'antd';
import {
  BorderOutlined,
  CheckSquareOutlined,
  DashOutlined,
  NodeIndexOutlined
} from '@ant-design/icons';
import { NodeType } from '../../../shared/types';

const { Text } = Typography;

interface NodeTemplate {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: 'rectangle',
    label: '矩形',
    icon: <BorderOutlined style={{ fontSize: '24px' }} />,
    description: '通用流程步骤'
  },
  {
    type: 'rounded-rectangle',
    label: '圆角矩形',
    icon: <BorderOutlined style={{ fontSize: '24px', borderRadius: '4px' }} />,
    description: '开始/结束'
  },
  {
    type: 'diamond',
    label: '菱形',
    icon: <DashOutlined style={{ fontSize: '24px', transform: 'rotate(45deg)' }} />,
    description: '判断/决策'
  },
  {
    type: 'circle',
    label: '圆形',
    icon: <NodeIndexOutlined style={{ fontSize: '24px' }} />,
    description: '连接点'
  },
  {
    type: 'todo',
    label: '待办任务',
    icon: <CheckSquareOutlined style={{ fontSize: '24px' }} />,
    description: '关联待办'
  }
];

interface NodeLibraryProps {
  onDragStart: (nodeType: NodeType) => void;
}

/**
 * NodeLibrary - 节点库面板
 * 
 * 展示可用节点类型，支持拖拽到画布
 */
export const NodeLibrary: React.FC<NodeLibraryProps> = ({ onDragStart }) => {
  // 获取当前主题
  const [theme, setTheme] = React.useState(document.documentElement.dataset.theme || 'light');
  
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.dataset.theme || 'light';
      setTheme(newTheme);
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    return () => observer.disconnect();
  }, []);

  const handleDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
    onDragStart(nodeType);
  };

  return (
    <div style={{ 
      padding: '16px', 
      backgroundColor: theme === 'dark' ? '#0a0a0a' : '#f5f5f5', 
      height: '100%', 
      overflowY: 'auto' 
    }}>
      <Typography.Title level={5} style={{ 
        marginBottom: '16px',
        color: theme === 'dark' ? '#e8e8e8' : undefined
      }}>
        节点库
      </Typography.Title>

      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {nodeTemplates.map((template) => (
          <Card
            key={template.type}
            size="small"
            hoverable
            draggable
            onDragStart={(e) => handleDragStart(e, template.type)}
            style={{
              cursor: 'grab',
              border: `1px solid ${theme === 'dark' ? '#404040' : '#d9d9d9'}`,
              borderRadius: '8px',
              backgroundColor: theme === 'dark' ? '#141414' : '#fff'
            }}
            bodyStyle={{ padding: '12px' }}
          >
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ color: theme === 'dark' ? '#40a9ff' : '#1890ff' }}>
                  {template.icon}
                </div>
                <Text strong style={{ color: theme === 'dark' ? '#e8e8e8' : undefined }}>
                  {template.label}
                </Text>
              </div>
              <Text type="secondary" style={{ 
                fontSize: '12px',
                color: theme === 'dark' ? '#a8a8a8' : undefined
              }}>
                {template.description}
              </Text>
            </Space>
          </Card>
        ))}
      </Space>

      <div style={{ 
        marginTop: '16px', 
        padding: '12px', 
        backgroundColor: theme === 'dark' ? '#141414' : '#fff', 
        borderRadius: '8px' 
      }}>
        <Text type="secondary" style={{ 
          fontSize: '12px',
          color: theme === 'dark' ? '#a8a8a8' : undefined
        }}>
          💡 提示：拖拽节点到画布上即可创建
        </Text>
      </div>
    </div>
  );
};

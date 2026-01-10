import React, { useState } from 'react';
import { Button, Space, Dropdown, message, Typography, Input } from 'antd';
import {
  SaveOutlined,
  DownloadOutlined,
  PictureOutlined,
  UndoOutlined,
  RedoOutlined,
  PlusOutlined,
  ShareAltOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Title } = Typography;

interface FlowchartToolbarProps {
  flowchartName?: string;
  onNameChange?: (newName: string) => void;
  onSave: () => void;
  onExport: (format: 'json' | 'mermaid' | 'text' | 'png') => void;
  onShare: (action: 'link' | 'image') => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewFlowchart: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isSaving?: boolean;
}

/**
 * FlowchartToolbar - 流程图工具栏
 * 
 * 提供保存、导出、自动布局等功能按钮
 */
export const FlowchartToolbar: React.FC<FlowchartToolbarProps> = ({
  flowchartName,
  onNameChange,
  onSave,
  onExport,
  onShare,
  onUndo,
  onRedo,
  onNewFlowchart,
  canUndo,
  canRedo,
  isSaving = false
}) => {
  // 获取当前主题
  const [theme, setTheme] = React.useState(document.documentElement.dataset.theme || 'light');
  
  // 编辑名称状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  
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

  // 开始编辑名称
  const handleStartEdit = () => {
    setEditingName(flowchartName || '');
    setIsEditingName(true);
  };

  // 确认编辑
  const handleConfirmEdit = () => {
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== flowchartName) {
      onNameChange?.(trimmedName);
      message.success('流程图名称已更新');
    }
    setIsEditingName(false);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditingName('');
  };

  // 处理回车键
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // 导出菜单
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'json',
      label: 'JSON 格式',
      icon: <DownloadOutlined />,
      onClick: () => onExport('json')
    },
    {
      key: 'mermaid',
      label: 'Mermaid 格式',
      icon: <DownloadOutlined />,
      onClick: () => onExport('mermaid')
    },
    {
      key: 'text',
      label: '纯文本格式',
      icon: <DownloadOutlined />,
      onClick: () => onExport('text')
    },
    {
      type: 'divider'
    },
    {
      key: 'png',
      label: '导出为图片',
      icon: <PictureOutlined />,
      onClick: () => onExport('png')
    }
  ];

  // 分享菜单
  const shareMenuItems: MenuProps['items'] = [
    {
      key: 'link',
      label: '生成分享链接',
      icon: <ShareAltOutlined />,
      onClick: () => onShare('link')
    },
    {
      key: 'image',
      label: '导出为图片',
      icon: <PictureOutlined />,
      onClick: () => onShare('image')
    }
  ];

  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#f0f0f0'}`,
        backgroundColor: theme === 'dark' ? '#1f1f1f' : '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onNewFlowchart}
        >
          新建流程图
        </Button>

        {/* 流程图名称编辑 */}
        {flowchartName && (
          <Space>
            {isEditingName ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onPressEnter={handleConfirmEdit}
                  style={{ width: 200 }}
                  autoFocus
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={handleConfirmEdit}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleCancelEdit}
                />
              </>
            ) : (
              <>
                <Title level={5} style={{ 
                  margin: 0, 
                  display: 'inline-block',
                  color: theme === 'dark' ? '#e8e8e8' : undefined
                }}>
                  {flowchartName}
                </Title>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={handleStartEdit}
                  title="编辑名称"
                />
              </>
            )}
          </Space>
        )}

        <Button
          icon={<SaveOutlined />}
          onClick={onSave}
          loading={isSaving}
        >
          保存
        </Button>

        <Dropdown menu={{ items: exportMenuItems }} placement="bottomLeft">
          <Button icon={<DownloadOutlined />}>
            导出
          </Button>
        </Dropdown>

        <Dropdown menu={{ items: shareMenuItems }} placement="bottomLeft">
          <Button icon={<ShareAltOutlined />}>
            分享
          </Button>
        </Dropdown>
      </Space>

      <Space>
        <Button
          icon={<UndoOutlined />}
          onClick={onUndo}
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
        />

        <Button
          icon={<RedoOutlined />}
          onClick={onRedo}
          disabled={!canRedo}
          title="重做 (Ctrl+Y)"
        />
      </Space>
    </div>
  );
};

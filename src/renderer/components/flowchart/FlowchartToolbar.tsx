import React from 'react';
import { Button, Space, Dropdown, message } from 'antd';
import {
  SaveOutlined,
  DownloadOutlined,
  PictureOutlined,
  LayoutOutlined,
  UndoOutlined,
  RedoOutlined,
  PlusOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

interface FlowchartToolbarProps {
  onSave: () => void;
  onExport: (format: 'json' | 'mermaid' | 'text' | 'png') => void;
  onShare: (action: 'link' | 'image') => void;
  onAutoLayout: () => void;
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
  onSave,
  onExport,
  onShare,
  onAutoLayout,
  onUndo,
  onRedo,
  onNewFlowchart,
  canUndo,
  canRedo,
  isSaving = false
}) => {
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
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#fff',
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

        <Button
          icon={<LayoutOutlined />}
          onClick={onAutoLayout}
        >
          自动布局
        </Button>
      </Space>
    </div>
  );
};

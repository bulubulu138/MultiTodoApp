import React, { useState } from 'react';
import { Button, Space, Tooltip, Modal, Input } from 'antd';
import {
  BoldOutlined,
  ItalicOutlined,
  StrikethroughOutlined,
  UnderlineOutlined,
  LinkOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';

interface MarkdownToolbarProps {
  onInsertMarkdown: (type: 'bold' | 'italic' | 'strike' | 'underline' | 'link' | 'checkbox', value?: string) => void;
  disabled?: boolean;
}

const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onInsertMarkdown, disabled = false }) => {
  const [linkModalVisible, setLinkModalVisible] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const handleLinkClick = () => {
    setLinkModalVisible(true);
    setLinkUrl('');
  };

  const handleLinkConfirm = () => {
    if (linkUrl.trim()) {
      onInsertMarkdown('link', linkUrl.trim());
    }
    setLinkModalVisible(false);
    setLinkUrl('');
  };

  const toolbarButtons = [
    {
      key: 'bold',
      icon: <BoldOutlined />,
      tooltip: '加粗',
      type: 'bold' as const,
    },
    {
      key: 'italic',
      icon: <ItalicOutlined />,
      tooltip: '斜体',
      type: 'italic' as const,
    },
    {
      key: 'strike',
      icon: <StrikethroughOutlined />,
      tooltip: '删除线',
      type: 'strike' as const,
    },
    {
      key: 'underline',
      icon: <UnderlineOutlined />,
      tooltip: '下划线',
      type: 'underline' as const,
    },
    {
      key: 'link',
      icon: <LinkOutlined />,
      tooltip: '链接',
      type: 'link' as const,
      customHandler: handleLinkClick,
    },
    {
      key: 'checkbox',
      icon: <CheckSquareOutlined />,
      tooltip: '插入待办事项',
      type: 'checkbox' as const,
    },
  ];

  return (
    <>
      <div
        style={{
          borderBottom: '1px solid #d9d9d9',
          borderLeft: '1px solid #d9d9d9',
          borderRight: '1px solid #d9d9d9',
          borderTop: '1px solid #d9d9d9',
          borderRadius: '6px 6px 0 0',
          padding: '8px 12px',
          backgroundColor: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <Space size="small">
          {toolbarButtons.map((button) => (
            <Tooltip key={button.key} title={button.tooltip}>
              <Button
                size="small"
                icon={button.icon}
                disabled={disabled}
                onClick={() => {
                  if (button.customHandler) {
                    button.customHandler();
                  } else {
                    onInsertMarkdown(button.type);
                  }
                }}
                type="text"
                style={{
                  minWidth: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>
          ))}
        </Space>
      </div>

      {/* 链接输入弹窗 */}
      <Modal
        title="插入链接"
        open={linkModalVisible}
        onOk={handleLinkConfirm}
        onCancel={() => {
          setLinkModalVisible(false);
          setLinkUrl('');
        }}
        okText="确认"
        cancelText="取消"
      >
        <Input
          placeholder="请输入链接地址（如：https://example.com）"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          onPressEnter={handleLinkConfirm}
          autoFocus
        />
      </Modal>
    </>
  );
};

export default MarkdownToolbar;
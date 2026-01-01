import React, { useEffect, useRef } from 'react';
import { Menu } from 'antd';
import {
  SettingOutlined,
  LockOutlined,
  UnlockOutlined,
  CopyOutlined,
  DeleteOutlined
} from '@ant-design/icons';

interface NodeContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string | null;
  isLocked: boolean;
  onOpenDetailEdit: () => void;
  onToggleLock: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * NodeContextMenu - 节点右键上下文菜单
 * 
 * 提供节点操作快捷入口
 */
export const NodeContextMenu: React.FC<NodeContextMenuProps> = ({
  visible,
  x,
  y,
  nodeId,
  isLocked,
  onOpenDetailEdit,
  onToggleLock,
  onCopy,
  onDelete,
  onClose
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // 延迟添加监听器，避免立即触发
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [visible, onClose]);

  if (!visible || !nodeId) return null;

  const menuItems = [
    {
      key: 'detail',
      icon: <SettingOutlined />,
      label: '详细设置',
      onClick: () => {
        onOpenDetailEdit();
        onClose();
      }
    },
    {
      key: 'lock',
      icon: isLocked ? <UnlockOutlined /> : <LockOutlined />,
      label: isLocked ? '解锁位置' : '锁定位置',
      onClick: () => {
        onToggleLock();
        onClose();
      }
    },
    {
      type: 'divider' as const
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: '复制节点',
      onClick: () => {
        onCopy();
        onClose();
      }
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除节点',
      danger: true,
      onClick: () => {
        onDelete();
        onClose();
      }
    }
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}
    >
      <Menu
        items={menuItems}
        style={{ border: 'none' }}
      />
    </div>
  );
};

import React, { memo } from 'react';
import { Avatar, Tooltip } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { getTodoOwnerAvatarText, getTodoOwnerColor, normalizeTodoOwner } from '../utils/todoOwner';

interface TodoOwnerAvatarProps {
  owner?: string;
  size?: number;
  showTooltip?: boolean;
  className?: string;
}

const TodoOwnerAvatar: React.FC<TodoOwnerAvatarProps> = memo(({
  owner,
  size = 24,
  showTooltip = true,
  className,
}) => {
  const normalizedOwner = normalizeTodoOwner(owner);

  if (!normalizedOwner) {
    return null;
  }

  const avatar = (
    <Avatar
      className={className}
      aria-label={`负责人：${normalizedOwner}`}
      size={size}
      style={{
        backgroundColor: getTodoOwnerColor(normalizedOwner),
        color: '#fff',
        flexShrink: 0,
        fontSize: Math.max(10, Math.round(size * 0.45)),
        fontWeight: 600,
      }}
      icon={!getTodoOwnerAvatarText(normalizedOwner) ? <UserOutlined /> : undefined}
    >
      {getTodoOwnerAvatarText(normalizedOwner)}
    </Avatar>
  );

  if (!showTooltip) {
    return avatar;
  }

  return <Tooltip title={normalizedOwner}>{avatar}</Tooltip>;
});

TodoOwnerAvatar.displayName = 'TodoOwnerAvatar';

export default TodoOwnerAvatar;

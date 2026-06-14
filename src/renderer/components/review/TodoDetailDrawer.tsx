import React from 'react';
import { Drawer, Space, Tag, Typography, Divider } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { Todo } from '../../../shared/types';
import dayjs from 'dayjs';
import './TodoDetailDrawer.css';

const { Title, Text, Paragraph } = Typography;

interface TodoDetailDrawerProps {
  visible: boolean;
  todo: Todo | null;
  onClose: () => void;
}

const TodoDetailDrawer: React.FC<TodoDetailDrawerProps> = ({
  visible,
  todo,
  onClose,
}) => {
  if (!todo) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待办池';
      case 'in_progress': return '今日事';
      case 'completed': return '已完成';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'mental': return 'blue';
      case 'communication': return 'orange';
      case 'trivial': return 'default';
      default: return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'mental': return '脑力劳动';
      case 'communication': return '沟通对齐';
      case 'trivial': return '临时小活';
      default: return priority;
    }
  };

  // 从富文本 HTML 中提取纯文本
  const extractPlainText = (html: string): string => {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    // 移除所有图片
    const images = temp.querySelectorAll('img');
    images.forEach(img => img.remove());

    // 获取纯文本
    const text = temp.textContent || temp.innerText || '';

    // 清理多余空白
    return text.trim().replace(/\s+/g, ' ');
  };

  return (
    <Drawer
      title="待办详情"
      placement="left"
      width={320}
      open={visible}
      onClose={onClose}
      className="todo-detail-drawer"
    >
      <div className="todo-detail-content">
        {/* Title */}
        <div className="todo-detail-section">
          <Title level={4} style={{ marginBottom: 8 }}>
            {todo.title}
          </Title>
        </div>

        {/* Status and Priority */}
        <div className="todo-detail-section">
          <Space size="small">
            <Tag color={getStatusColor(todo.status)}>
              {getStatusText(todo.status)}
            </Tag>
            <Tag color={getPriorityColor(todo.priority)}>
              {getPriorityText(todo.priority)}
            </Tag>
          </Space>
        </div>

        {/* Tags */}
        {todo.tags && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <div className="todo-detail-section">
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                标签
              </Text>
              <Space size={4} wrap>
                {todo.tags.split(',').filter(tag => tag.trim()).map((tag, index) => (
                  <Tag key={index} color="blue">
                    {tag.trim()}
                  </Tag>
                ))}
              </Space>
            </div>
          </>
        )}

        {/* Content */}
        {todo.content && (
          <>
            <Divider style={{ margin: '16px 0' }} />
            <div className="todo-detail-section">
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                内容
              </Text>
              <Paragraph
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 300,
                  overflowY: 'auto',
                  fontSize: 13,
                }}
              >
                {extractPlainText(todo.content)}
              </Paragraph>
            </div>
          </>
        )}

        {/* Time Information */}
        <Divider style={{ margin: '16px 0' }} />
        <div className="todo-detail-section">
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
            时间信息
          </Text>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {todo.startTime && (
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <PlayCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                <Text type="secondary">开始时间：</Text>
                <Text style={{ marginLeft: 4 }}>
                  {dayjs(todo.startTime).format('YYYY-MM-DD HH:mm')}
                </Text>
              </div>
            )}
            {todo.deadline && (
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <ClockCircleOutlined style={{ marginRight: 8, color: '#ff4d4f' }} />
                <Text type="secondary">截止时间：</Text>
                <Text style={{ marginLeft: 4 }}>
                  {dayjs(todo.deadline).format('YYYY-MM-DD HH:mm')}
                </Text>
              </div>
            )}
            {todo.completedAt && (
              <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
                <CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />
                <Text type="secondary">完成时间：</Text>
                <Text style={{ marginLeft: 4 }}>
                  {dayjs(todo.completedAt).format('YYYY-MM-DD HH:mm')}
                </Text>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
              <Text type="secondary">创建时间：</Text>
              <Text style={{ marginLeft: 4 }}>
                {dayjs(todo.createdAt).format('YYYY-MM-DD HH:mm')}
              </Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>
              <Text type="secondary">更新时间：</Text>
              <Text style={{ marginLeft: 4 }}>
                {dayjs(todo.updatedAt).format('YYYY-MM-DD HH:mm')}
              </Text>
            </div>
          </Space>
        </div>
      </div>
    </Drawer>
  );
};

export default TodoDetailDrawer;

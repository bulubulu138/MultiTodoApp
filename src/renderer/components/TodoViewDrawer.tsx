import { Todo, TodoRelation } from '../../shared/types';
import React, { useMemo, useCallback } from 'react';
import { Drawer, Descriptions, Tag, Space, Button, Typography, Divider, message, Image } from 'antd';
import { EditOutlined, ClockCircleOutlined, TagsOutlined, CopyOutlined } from '@ant-design/icons';
import RelationContext from './RelationContext';
import { copyTodoToClipboard } from '../utils/copyTodo';
import { useThemeColors } from '../hooks/useThemeColors';

const { Title, Text, Paragraph } = Typography;

interface TodoViewDrawerProps {
  visible: boolean;
  todo: Todo | null;
  allTodos: Todo[];
  relations: TodoRelation[];
  onClose: () => void;
  onEdit: (todo: Todo) => void;
}

const TodoViewDrawer: React.FC<TodoViewDrawerProps> = ({
  visible,
  todo,
  allTodos,
  relations,
  onClose,
  onEdit
}) => {
  const colors = useThemeColors();
  
  // 处理内容点击事件，拦截链接点击
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      e.preventDefault();
      const href = target.getAttribute('href');
      if (href) {
        window.electronAPI.openExternal(href);
      }
    }
  }, []);

  // 将HTML内容转换为可预览图片的组件
  const renderContentWithImagePreview = useMemo(() => {
    if (!todo || !todo.content) return null;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = todo.content;
    const images = Array.from(tempDiv.querySelectorAll('img'));
    
    if (images.length === 0) {
      // 没有图片，直接返回HTML
      return (
        <div
          className="todo-view-content"
          style={{
            marginTop: 8,
            padding: 12,
            backgroundColor: colors.contentBg,
            color: '#000000',
            borderRadius: 4,
            minHeight: 100,
            maxHeight: 600,
            overflowY: 'auto'
          }}
          dangerouslySetInnerHTML={{ __html: todo.content }}
          onClick={handleContentClick}
        />
      );
    }

    // 提取图片URLs
    const imageUrls = images.map(img => img.src);
    
    // 为每个图片添加唯一标识
    images.forEach((img, index) => {
      img.setAttribute('data-image-index', String(index));
    });

    return (
      <Image.PreviewGroup>
        <div
          className="todo-view-content"
          style={{
            marginTop: 8,
            padding: 12,
            backgroundColor: colors.contentBg,
            color: '#000000',
            borderRadius: 4,
            minHeight: 100,
            maxHeight: 600,
            overflowY: 'auto'
          }}
          onClick={(e) => {
            handleContentClick(e);
            const target = e.target as HTMLElement;
            if (target.tagName === 'IMG') {
              e.preventDefault();
              const index = parseInt(target.getAttribute('data-image-index') || '0');
              // 触发对应图片的预览
              const imageElement = document.querySelector(`img[data-image-index="${index}"]`) as HTMLElement;
              if (imageElement) {
                imageElement.click();
              }
            }
          }}
          dangerouslySetInnerHTML={{ __html: tempDiv.innerHTML }}
        />
        {/* 隐藏的Image组件用于预览 */}
        {imageUrls.map((url, index) => (
          <Image
            key={index}
            src={url}
            style={{ display: 'none' }}
          />
        ))}
      </Image.PreviewGroup>
    );
  }, [todo?.content, colors.contentBg, handleContentClick]);
  
  if (!todo) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      case 'paused': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待办';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      case 'paused': return '暂停';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return priority;
    }
  };

  const renderTags = (tagsString: string) => {
    if (!tagsString) return <Text type="secondary">无标签</Text>;
    
    const tags = tagsString.split(',').filter(tag => tag.trim());
    if (tags.length === 0) return <Text type="secondary">无标签</Text>;

    return (
      <Space wrap>
        {tags.map((tag, index) => (
          <Tag key={index} color="blue" icon={<TagsOutlined />}>
            {tag.trim()}
          </Tag>
        ))}
      </Space>
    );
  };


  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const showRelationContext = allTodos.length > 0;

  return (
    <Drawer
      title={
        <Space>
          <span>待办详情</span>
          <Tag color={getStatusColor(todo.status)}>
            {getStatusText(todo.status)}
          </Tag>
        </Space>
      }
      placement="right"
      width={showRelationContext ? 1000 : 600}
      onClose={onClose}
      open={visible}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button 
              icon={<CopyOutlined />}
              onClick={async () => {
                const result = await copyTodoToClipboard(todo);
                if (result.success) {
                  message.success(result.message);
                } else {
                  message.error(result.message);
                }
              }}
            >
              复制
            </Button>
            <Button onClick={onClose}>关闭</Button>
            <Button 
              type="primary" 
              icon={<EditOutlined />}
              onClick={() => {
                onClose();
                onEdit(todo);
              }}
            >
              编辑此待办
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ display: 'flex', gap: 16 }}>
        {/* 左侧：主要内容 */}
        <div style={{ flex: showRelationContext ? 2 : 1 }}>
          {/* 标题 */}
          <Title level={3} style={{ marginTop: 0 }}>
            {todo.title}
          </Title>

          {/* 基本信息 */}
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="状态">
              <Tag color={getStatusColor(todo.status)}>
                {getStatusText(todo.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="优先级">
              <Tag color={getPriorityColor(todo.priority)}>
                {getPriorityText(todo.priority)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>
              <Space>
                <ClockCircleOutlined />
                {formatTime(todo.createdAt)}
              </Space>
            </Descriptions.Item>
            {todo.updatedAt !== todo.createdAt && (
              <Descriptions.Item label="更新时间" span={2}>
                <Space>
                  <ClockCircleOutlined />
                  {formatTime(todo.updatedAt)}
                </Space>
              </Descriptions.Item>
            )}
            {todo.startTime && (
              <Descriptions.Item label="开始时间" span={2}>
                <Space>
                  <ClockCircleOutlined style={{ color: '#52c41a' }} />
                  {formatTime(todo.startTime)}
                </Space>
              </Descriptions.Item>
            )}
            {todo.deadline && (
              <Descriptions.Item label="截止时间" span={2}>
                <Space>
                  <ClockCircleOutlined style={{ color: '#ff4d4f' }} />
                  {formatTime(todo.deadline)}
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>

          {/* 标签 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>标签：</Text>
            <div style={{ marginTop: 8 }}>
              {renderTags(todo.tags)}
            </div>
          </div>

          <Divider />

          {/* 内容 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>内容：</Text>
            {todo.content ? (
              renderContentWithImagePreview
            ) : (
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                无内容
              </Paragraph>
            )}
          </div>
        </div>

        {/* 右侧：关系上下文 */}
        {showRelationContext && (
          <div style={{ 
            flex: 1, 
            borderLeft: `1px solid ${colors.borderColor}`, 
            paddingLeft: 16 
          }}>
            <Title level={5}>关联上下文</Title>
            <RelationContext
              currentTodo={todo}
              allTodos={allTodos}
              relations={relations}
            />
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default TodoViewDrawer;


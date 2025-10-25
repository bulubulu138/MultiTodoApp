import { Todo, TodoRelation } from '../../shared/types';
import React, { useMemo, useCallback, useState } from 'react';
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // 复制图片到剪贴板
  const copyImageToClipboard = async (imageUrl: string) => {
    try {
      // 方案1: 尝试使用 Clipboard API 复制图片
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      message.success('图片已复制到剪贴板');
    } catch (error) {
      // 方案2: 降级到复制图片URL
      try {
        await navigator.clipboard.writeText(imageUrl);
        message.info('图片URL已复制到剪贴板');
      } catch (err) {
        message.error('复制失败');
        console.error('Error copying image:', error);
      }
    }
  };
  
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

  // 处理图片点击，打开预览
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      const src = target.getAttribute('src');
      if (src) {
        setPreviewImage(src);
        setPreviewOpen(true);
      }
    }
  }, []);

  // 将文本中的 URL 转换为可点击的链接
  const linkifyContent = useCallback((html: string): string => {
    if (!html) return '';
    
    // URL 正则表达式（匹配 http/https 开头的链接）
    const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
    
    // 创建临时 DOM 来解析 HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 遍历所有文本节点
    const processTextNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        if (urlRegex.test(text)) {
          // 创建新的 HTML，将 URL 转换为链接
          const linkedText = text.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
          });
          
          // 创建临时容器并替换节点
          const tempContainer = document.createElement('span');
          tempContainer.innerHTML = linkedText;
          
          const parent = node.parentNode;
          if (parent) {
            // 将所有新节点插入到原节点位置
            while (tempContainer.firstChild) {
              parent.insertBefore(tempContainer.firstChild, node);
            }
            parent.removeChild(node);
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // 跳过已经是链接或代码块的元素
        const element = node as Element;
        if (element.tagName !== 'A' && element.tagName !== 'CODE' && element.tagName !== 'PRE') {
          // 递归处理子节点（需要转换为数组以避免动态修改问题）
          Array.from(node.childNodes).forEach(processTextNodes);
        }
      }
    };
    
    processTextNodes(tempDiv);
    return tempDiv.innerHTML;
  }, []);

  // 渲染内容（支持图片和链接）
  const renderContentWithImagePreview = useMemo(() => {
    if (!todo || !todo.content) return null;

    // 自动将 URL 文本转换为链接
    const processedContent = linkifyContent(todo.content);

    return (
      <div
        className="todo-view-content"
        style={{
          marginTop: 8,
          padding: 16,
          backgroundColor: colors.contentBg,
          color: '#000000',
          borderRadius: 4,
          minHeight: 200,
          // 移除 maxHeight 和 overflowY，让内容完整展示
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          // 优先处理链接点击
          if (target.tagName === 'A') {
            handleContentClick(e);
          } else if (target.tagName === 'IMG') {
            handleImageClick(e);
          }
        }}
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    );
  }, [todo?.content, colors.contentBg, handleContentClick, handleImageClick, linkifyContent]);
  
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
      width={showRelationContext ? 1200 : 800}
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
      
      {/* 图片预览组件 - 带复制功能 */}
      <Image
        style={{ display: 'none' }}
        preview={{
          visible: previewOpen,
          src: previewImage,
          onVisibleChange: (visible) => setPreviewOpen(visible),
          toolbarRender: (originalNode, info) => (
            <Space>
              {originalNode}
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => copyImageToClipboard(previewImage)}
              >
                复制图片
              </Button>
            </Space>
          ),
        }}
      />
    </Drawer>
  );
};

export default TodoViewDrawer;


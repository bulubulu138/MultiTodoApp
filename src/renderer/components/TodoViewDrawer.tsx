import { Todo, TodoRelation, FlowchartAssociation, FlowchartAssociationDisplay } from '../../shared/types';
import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { Drawer, Descriptions, Tag, Space, Button, Typography, Divider, message, Image, Card, Empty, Spin } from 'antd';
import { EditOutlined, ClockCircleOutlined, TagsOutlined, CopyOutlined, NodeIndexOutlined, FileTextOutlined } from '@ant-design/icons';
import RelationContext from './RelationContext';
import { copyTodoToClipboard } from '../utils/copyTodo';
import { useThemeColors } from '../hooks/useThemeColors';
import { useFlowchartAssociations } from '../hooks/useFlowchartAssociations';

const { Title, Text, Paragraph } = Typography;

interface TodoViewDrawerProps {
  visible: boolean;
  todo: Todo | null;
  allTodos: Todo[];
  relations: TodoRelation[];
  onClose: () => void;
  onEdit: (todo: Todo) => void;
  onOpenFlowchart?: (flowchartId: string, nodeId?: string) => void; // 修改：nodeId改为可选
}

const TodoViewDrawer: React.FC<TodoViewDrawerProps> = ({
  visible,
  todo,
  allTodos,
  relations,
  onClose,
  onEdit,
  onOpenFlowchart // 新增
}) => {
  const colors = useThemeColors();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState('');

  // 流程图级别关联状态
  const [flowchartLevelAssociations, setFlowchartLevelAssociations] = useState<FlowchartAssociationDisplay[]>([]);
  const [flowchartLevelLoading, setFlowchartLevelLoading] = useState(false);

  // 查询流程图级别关联
  useEffect(() => {
    const loadFlowchartLevelAssociations = async () => {
      if (!todo?.id) {
        setFlowchartLevelAssociations([]);
        return;
      }

      setFlowchartLevelLoading(true);
      try {
        const associations = await window.electronAPI.flowchartTodoAssociation.queryByTodo(todo.id);
        // 转换为统一的显示格式
        const displayAssociations: FlowchartAssociationDisplay[] = associations.map(assoc => ({
          type: 'flowchart' as const,
          flowchartId: assoc.flowchartId,
          flowchartName: assoc.flowchartName,
          flowchartDescription: assoc.flowchartDescription,
          createdAt: assoc.createdAt
        }));
        setFlowchartLevelAssociations(displayAssociations);
      } catch (error) {
        console.error('查询流程图级别关联失败:', error);
        setFlowchartLevelAssociations([]);
      } finally {
        setFlowchartLevelLoading(false);
      }
    };

    loadFlowchartLevelAssociations();
  }, [todo?.id]);

  // 缓存 todoIds 数组，避免每次渲染都创建新数组
  const todoIds = useMemo(() => {
    return todo?.id ? [todo.id] : [];
  }, [todo?.id]);

  // 查询节点级别关联（使用现有的hook）
  const { associationsByTodo, loading: nodeLevelLoading } = useFlowchartAssociations(todoIds);

  // 获取当前待办的节点级别关联
  const nodeLevelAssociations = useMemo(() => {
    if (!todo?.id) return [];
    const nodeAssocs = associationsByTodo.get(todo.id) || [];
    // 转换为统一的显示格式
    return nodeAssocs.map(assoc => ({
      type: 'node' as const,
      flowchartId: assoc.flowchartId,
      flowchartName: assoc.flowchartName,
      nodeId: assoc.nodeId,
      nodeLabel: assoc.nodeLabel
    } as FlowchartAssociationDisplay));
  }, [todo?.id, associationsByTodo]);

  // 合并两种类型的关联
  const allAssociations = useMemo(() => {
    return [...flowchartLevelAssociations, ...nodeLevelAssociations];
  }, [flowchartLevelAssociations, nodeLevelAssociations]);

  // 关联加载状态
  const associationsLoading = flowchartLevelLoading || nodeLevelLoading;

  // 转换为PNG格式
  const convertToPng = async (blob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((pngBlob) => {
            if (pngBlob) {
              resolve(pngBlob);
            } else {
              reject(new Error('转换失败'));
            }
          }, 'image/png');
        };
        img.onerror = reject;
        img.src = reader.result as string; // Use data URL instead of blob URL
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob); // Convert blob to data URL
    });
  };

  // 复制图片到剪贴板
  const copyImageToClipboard = async (imageUrl: string) => {
    try {
      let blob: Blob;
      
      console.log('开始复制图片:', imageUrl);
      
      // 处理不同类型的图片URL
      if (imageUrl.startsWith('data:')) {
        // Base64 图片 - 直接转换（避免 CSP 限制）
        console.log('处理 Base64 图片');
        const base64Data = imageUrl.split(',')[1];
        const mimeType = imageUrl.match(/data:([^;]+);/)?.[1] || 'image/png';
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mimeType });
      } else if (imageUrl.startsWith('file://') || imageUrl.startsWith('file:')) {
        // 本地文件 - 使用 Electron 读取
        console.log('处理本地文件图片');
        const arrayBuffer = await window.electronAPI.image.readLocalFile(imageUrl);
        blob = new Blob([arrayBuffer]);
      } else {
        // HTTP URL - 直接加载（不使用 no-cors）
        console.log('处理 HTTP 图片');
        const response = await fetch(imageUrl);
        blob = await response.blob();
      }
      
      console.log('原始 Blob 类型:', blob.type, '大小:', blob.size);
      
      // 强制转换为 PNG 格式以确保兼容性
      console.log('转换为 PNG 格式...');
      const pngBlob = await convertToPng(blob);
      console.log('PNG Blob 大小:', pngBlob.size);
      
      // 复制到剪贴板
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': pngBlob })
      ]);
      
      message.success('图片已复制到剪贴板');
      console.log('图片复制成功');
    } catch (error: any) {
      console.error('复制图片详细错误:', error);
      message.error(`复制图片失败: ${error.message || '请重试'}`);
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

  // 根据文件扩展名获取对应的图标（移到组件外部，避免循环依赖）
  const getFileIcon = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      // 文档类
      'pdf': '📄',
      'doc': '📝', 'docx': '📝',
      'xls': '📊', 'xlsx': '📊',
      'ppt': '📊', 'pptx': '📊',
      'txt': '📃',
      // 图片类
      'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'bmp': '🖼️', 'svg': '🖼️', 'webp': '🖼️',
      // 压缩包
      'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
      // 代码类
      'js': '📜', 'ts': '📜', 'jsx': '📜', 'tsx': '📜',
      'py': '🐍', 'java': '☕', 'c': '©️', 'cpp': '©️', 'cs': '©️',
      'html': '🌐', 'css': '🎨', 'json': '{}',
      // 视频音频
      'mp4': '🎬', 'avi': '🎬', 'mov': '🎬', 'mkv': '🎬', 'wmv': '🎬',
      'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵',
      // 其他
      'exe': '⚙️', 'msi': '⚙️',
      'md': '📋', 'markdown': '📋',
    };
    return iconMap[ext || ''] || '📎'; // 默认图标
  };

  // 将文本中的 URL 转换为可点击的链接（扩展支持本地文件路径）
  const linkifyContent = useCallback((html: string): string => {
    if (!html) return '';
    
    // URL 正则表达式（匹配 http/https 开头的链接）
    const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
    
    // 本地文件路径正则
    // Windows 绝对路径: C:\path\file.ext 或 D:\path\file.ext
    const windowsPathRegex = /[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n\s]+\\)*[^\\/:*?"<>|\r\n\s]+\.[a-zA-Z0-9]+/g;
    // UNC 网络路径: \\server\share\file.ext
    const uncPathRegex = /\\\\[^\s\\/:*?"<>|\r\n]+\\[^\s\\/:*?"<>|\r\n]+(?:\\[^\\/:*?"<>|\r\n\s]+)*\.[a-zA-Z0-9]+/g;
    
    // 创建临时 DOM 来解析 HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // 遍历所有文本节点
    const processTextNodes = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || '';
        let linkedText = text;
        let hasMatch = false;
        
        // 优先处理 HTTP/HTTPS URL
        if (urlRegex.test(text)) {
          linkedText = linkedText.replace(urlRegex, (url) => {
            return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
          });
          hasMatch = true;
        }
        
        // 处理 Windows 路径（C:\path\file）
        if (windowsPathRegex.test(linkedText) && !hasMatch) {
          linkedText = linkedText.replace(windowsPathRegex, (path) => {
            const fileUrl = `file:///${path.replace(/\\/g, '/')}`;
            const icon = getFileIcon(path);
            return `<a href="${fileUrl}" class="local-file-link" title="点击打开本地文件: ${path}" style="color: #722ed1; text-decoration: none;">${icon} ${path}</a>`;
          });
          hasMatch = true;
        }
        
        // 处理 UNC 路径（\\server\share\file）
        if (uncPathRegex.test(linkedText) && !hasMatch) {
          linkedText = linkedText.replace(uncPathRegex, (path) => {
            const fileUrl = `file:${path.replace(/\\/g, '/')}`;
            const icon = getFileIcon(path);
            return `<a href="${fileUrl}" class="local-file-link" title="点击打开网络文件: ${path}" style="color: #722ed1; text-decoration: none;">${icon} ${path}</a>`;
          });
          hasMatch = true;
        }
        
        if (hasMatch) {
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
  }, [todo?.content, colors.contentBg, linkifyContent, handleContentClick, handleImageClick]);
  
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
            {todo.completedAt && (
              <Descriptions.Item label="完成时间" span={2}>
                <Space>
                  <ClockCircleOutlined style={{ color: '#52c41a' }} />
                  {formatTime(todo.completedAt)}
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

          <Divider />

          {/* 流程图关联 */}
          <div style={{ marginBottom: 16 }}>
            <Text strong>关联的流程图：</Text>
            {associationsLoading ? (
              <div style={{ marginTop: 8, textAlign: 'center', padding: 16 }}>
                <Spin size="small" />
                <Text type="secondary" style={{ marginLeft: 8 }}>加载中...</Text>
              </div>
            ) : allAssociations.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无关联的流程图"
                style={{ marginTop: 8 }}
              />
            ) : (
              <Space direction="vertical" style={{ width: '100%', marginTop: 8 }} size="small">
                {/* 流程图级别关联 */}
                {flowchartLevelAssociations.length > 0 && (
                  <>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                      流程图级别关联 ({flowchartLevelAssociations.length})
                    </Text>
                    {flowchartLevelAssociations.map((assoc) => (
                      <Card
                        key={`flowchart-${assoc.flowchartId}`}
                        size="small"
                        hoverable
                        onClick={() => {
                          if (onOpenFlowchart) {
                            onOpenFlowchart(assoc.flowchartId);
                            onClose();
                          }
                        }}
                        style={{
                          cursor: onOpenFlowchart ? 'pointer' : 'default',
                          borderColor: colors.borderColor,
                          borderLeft: '4px solid #52c41a'
                        }}
                      >
                        <Space>
                          <FileTextOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                          <div>
                            <Text strong>{assoc.flowchartName}</Text>
                            {assoc.flowchartDescription && (
                              <>
                                <br />
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {assoc.flowchartDescription}
                                </Text>
                              </>
                            )}
                          </div>
                        </Space>
                      </Card>
                    ))}
                  </>
                )}

                {/* 节点级别关联 */}
                {nodeLevelAssociations.length > 0 && (
                  <>
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 8 }}>
                      节点级别关联 ({nodeLevelAssociations.length})
                    </Text>
                    {nodeLevelAssociations.map((assoc) => (
                      <Card
                        key={`node-${assoc.flowchartId}-${assoc.nodeId}`}
                        size="small"
                        hoverable
                        onClick={() => {
                          if (onOpenFlowchart && assoc.nodeId) {
                            onOpenFlowchart(assoc.flowchartId, assoc.nodeId);
                            onClose();
                          }
                        }}
                        style={{
                          cursor: onOpenFlowchart ? 'pointer' : 'default',
                          borderColor: colors.borderColor,
                          borderLeft: '4px solid #1890ff'
                        }}
                      >
                        <Space>
                          <NodeIndexOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                          <div>
                            <Text strong>{assoc.flowchartName}</Text>
                            <br />
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              节点: {assoc.nodeLabel}
                            </Text>
                          </div>
                        </Space>
                      </Card>
                    ))}
                  </>
                )}
              </Space>
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
          toolbarRender: (originalNode) => (
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


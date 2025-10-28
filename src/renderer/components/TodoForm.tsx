import { Todo, TodoRelation, TodoRecommendation } from '../../shared/types';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Form, Input, Select, Button, App, Tag, Space, Switch, DatePicker, InputNumber, Card, Divider, Empty, Spin, Typography } from 'antd';
const { Text } = Typography;
import { PlusOutlined, EditOutlined, FileTextOutlined, CopyOutlined, LinkOutlined, BulbOutlined } from '@ant-design/icons';
import RichTextEditor from './RichTextEditor';
import PlainTextFallback from './PlainTextFallback';
import RelationContext from './RelationContext';
import { copyTodoToClipboard } from '../utils/copyTodo';
import dayjs from 'dayjs';
// import TipTapEditor from './TipTapEditor'; // Temporarily disabled until dependencies are installed

const { Option } = Select;

interface TodoFormProps {
  visible: boolean;
  todo?: Todo | null;
  quickCreateContent?: string | null;
  onSubmit: (data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  allTodos?: Todo[];
  relations?: TodoRelation[];
}

const TodoForm: React.FC<TodoFormProps> = ({
  visible,
  todo,
  quickCreateContent,
  onSubmit,
  onCancel,
  allTodos = [],
  relations = []
}) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [tags, setTags] = useState<string[]>([]);
  const [richContent, setRichContent] = useState<string>('');
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [useRichEditor, setUseRichEditor] = useState(true);
  const [editorError, setEditorError] = useState(false);
  const [recommendations, setRecommendations] = useState<TodoRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [pendingRelations, setPendingRelations] = useState<Array<{targetId: number; relationType: string}>>([]);

  // 提取所有历史标签并按使用频率排序
  const historyTags = useMemo(() => {
    const tagFrequency: Record<string, number> = {};
    
    allTodos.forEach(todo => {
      if (todo.tags) {
        todo.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) {
            tagFrequency[trimmed] = (tagFrequency[trimmed] || 0) + 1;
          }
        });
      }
    });

    // 按使用频率排序，高频标签在前
    return Object.keys(tagFrequency).sort((a, b) => 
      tagFrequency[b] - tagFrequency[a]
    );
  }, [allTodos]);

  useEffect(() => {
    if (visible) {
      if (todo) {
        // 编辑模式
        form.setFieldsValue({
          title: todo.title,
          status: todo.status,
          priority: todo.priority,
          startTime: todo.startTime ? dayjs(todo.startTime) : undefined,
          deadline: todo.deadline ? dayjs(todo.deadline) : undefined,
          displayOrder: todo.displayOrder,
        });
        
        // 设置富文本内容
        setRichContent(todo.content || '');
        
        // 设置标签
        const todoTags = todo.tags ? todo.tags.split(',').filter(tag => tag.trim()) : [];
        setTags(todoTags);
      } else {
        // 新建模式
        form.resetFields();
        // 新建时默认开始时间为当前时间
        form.setFieldsValue({
          startTime: dayjs(),
        });
        // 如果有快速创建内容，使用它；否则清空
        setRichContent(quickCreateContent || '');
        setTags([]);
      }
      
      // 延迟标记编辑器准备就绪，确保 Modal 完全打开
      setTimeout(() => {
        setIsEditorReady(true);
      }, 150);
      
      // 重置推荐状态
      setRecommendations([]);
      setPendingRelations([]);
    } else {
      // Modal 关闭时重置编辑器状态
      setIsEditorReady(false);
      setEditorError(false);
      setUseRichEditor(true);
      setRecommendations([]);
      setPendingRelations([]);
    }
  }, [visible, todo, form, quickCreateContent]);

  // 从富文本内容中提取纯文本的第一行
  const extractFirstLineFromContent = (html: string): string => {
    if (!html) return '';
    
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // 移除所有图片
    const images = temp.querySelectorAll('img');
    images.forEach(img => img.remove());
    
    // 获取纯文本
    const text = (temp.textContent || temp.innerText || '').trim();
    
    if (!text) return '';
    
    // 取第一行，最多50个字符
    const firstLine = text.split('\n')[0].trim();
    if (firstLine.length > 50) {
      return firstLine.substring(0, 50) + '...';
    }
    
    return firstLine;
  };

  // 防抖获取推荐
  const fetchRecommendations = useCallback(
    async (title: string, content: string) => {
      // 清洗内容（移除HTML标签）
      const cleanContent = extractFirstLineFromContent(content);
      const fullText = `${title} ${cleanContent}`;
      
      // 内容太短，不获取推荐
      if (fullText.trim().length < 5) {
        setRecommendations([]);
        return;
      }
      
      setLoadingRecommendations(true);
      try {
        const results = await window.electronAPI.keywords.getRecommendations(
          title || '',
          content || '',
          todo?.id
        );
        setRecommendations(results || []);
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
        setRecommendations([]);
      } finally {
        setLoadingRecommendations(false);
      }
    },
    [todo?.id]
  );

  // 防抖effect
  useEffect(() => {
    if (!visible || todo) return; // 仅在新建模式下获取推荐
    
    const timer = setTimeout(() => {
      const title = form.getFieldValue('title') || '';
      fetchRecommendations(title, richContent);
    }, 800); // 800ms防抖
    
    return () => clearTimeout(timer);
  }, [visible, richContent, form, fetchRecommendations, todo]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      // 如果标题为空，自动从内容中提取
      let title = values.title?.trim();
      if (!title) {
        title = extractFirstLineFromContent(richContent);
        if (!title) {
          title = '未命名待办';
        }
      }
      
      // 生成内容哈希
      const contentHash = await window.electronAPI.todo.generateHash(title, richContent);
      
      // 检测重复（编辑时排除自己）
      const duplicate = await window.electronAPI.todo.findDuplicate(contentHash, todo?.id);
      
      const todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'> = {
        title: title,
        content: richContent,
        status: values.status || 'pending',
        startTime: values.startTime ? values.startTime.toISOString() : new Date().toISOString(),
        deadline: values.deadline ? values.deadline.toISOString() : undefined,
        priority: values.priority || 'medium',
        tags: tags.join(','),
        images: '', // 图片现在嵌入在富文本中
        displayOrder: values.displayOrder,
        contentHash: contentHash,
      };

      // 如果检测到重复，弹出确认对话框
      if (duplicate) {
        Modal.confirm({
          title: '检测到重复待办',
          content: `与待办"${duplicate.title}"的内容完全相同，是否继续${todo ? '保存' : '创建'}？`,
          okText: '继续',
          cancelText: '取消',
          onOk: async () => {
            onSubmit(todoData);
            // 创建待处理的关系
            await createPendingRelations();
          },
        });
      } else {
        onSubmit(todoData);
        // 创建待处理的关系
        await createPendingRelations();
      }
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  // 创建待处理的关系
  const createPendingRelations = async () => {
    if (pendingRelations.length === 0) return;
    
    try {
      // 等待待办创建后再建立关系
      // 注意：这里假设onSubmit是异步的，实际需要在父组件处理
      console.log('Pending relations to create:', pendingRelations);
      // 这部分逻辑需要在App.tsx中处理，因为需要等待新待办被创建后才能建立关系
    } catch (error) {
      console.error('Failed to create pending relations:', error);
    }
  };

  // 添加待处理关系
  const handleAddPendingRelation = (targetId: number, relationType: string) => {
    const exists = pendingRelations.some(r => r.targetId === targetId && r.relationType === relationType);
    if (!exists) {
      setPendingRelations(prev => [...prev, { targetId, relationType }]);
      message.success('已添加到待建立关系列表');
    }
  };

  // 移除待处理关系
  const handleRemovePendingRelation = (targetId: number, relationType: string) => {
    setPendingRelations(prev => prev.filter(r => !(r.targetId === targetId && r.relationType === relationType)));
  };

  // 标签选择/输入处理（Select mode="tags" 自动处理）
  const handleTagsChange = (value: string[]) => {
    // 允许任意数量的标签
    setTags(value);
  };

  // 判断是否显示关联上下文
  const showRelationContext = todo && todo.id && allTodos.length > 0;

  return (
    <Modal
      title={todo ? '编辑待办事项' : '新建待办事项'}
      open={visible}
      onCancel={onCancel}
      width={showRelationContext ? 1200 : 800}
      style={{ top: 20 }}
      styles={{
        body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }
      }}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {todo && (
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
          )}
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" onClick={handleSubmit}>
              保存
            </Button>
          </Space>
        </div>
      }
      afterOpenChange={(open) => {
        if (open) {
          // Modal 完全打开后确保编辑器准备就绪
          setTimeout(() => {
            setIsEditorReady(true);
          }, 100);
        }
      }}
    >
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <Form
        form={form}
        layout="vertical"
        initialValues={{
          status: 'pending',
          priority: 'medium'
        }}
      >
        <Form.Item
          name="title"
          label="标题"
          rules={[{ required: false }]}
        >
          <Input placeholder="留空则自动从内容第一行生成" />
        </Form.Item>

        <Form.Item
          label={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span>内容描述</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileTextOutlined />
                <Switch
                  size="small"
                  checked={useRichEditor}
                  onChange={setUseRichEditor}
                  checkedChildren={<EditOutlined />}
                  unCheckedChildren="纯文本"
                />
                <span style={{ fontSize: '12px', color: '#666' }}>
                  {useRichEditor ? '富文本' : '纯文本'}
                </span>
              </div>
            </div>
          }
        >
          {isEditorReady ? (
            useRichEditor && !editorError ? (
              <RichTextEditor
                value={richContent}
                onChange={setRichContent}
                placeholder="输入内容，支持格式化文本、粘贴图片等..."
              />
            ) : (
              <PlainTextFallback
                value={richContent}
                onChange={setRichContent}
                placeholder="输入内容..."
              />
            )
          ) : (
            <div style={{ 
              minHeight: '250px', 
              padding: '10px', 
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999'
            }}>
              正在加载编辑器...
            </div>
          )}
        </Form.Item>

        <Form.Item
          name="priority"
          label="优先级"
        >
          <Select>
            <Option value="low">低</Option>
            <Option value="medium">中</Option>
            <Option value="high">高</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="status"
          label="状态"
        >
          <Select>
            <Option value="pending">待办</Option>
            <Option value="in_progress">进行中</Option>
            <Option value="completed">已完成</Option>
            <Option value="paused">暂停</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="displayOrder"
          label="显示序号"
          tooltip="用于手动排序，数字越小越靠前。留空则按默认规则排序"
        >
          <InputNumber 
            min={0} 
            placeholder="可选，用于手动排序" 
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="startTime"
          label="预计开始时间"
        >
          <DatePicker 
            showTime 
            format="YYYY-MM-DD HH:mm"
            placeholder="选择开始时间"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="deadline"
          label="截止时间"
        >
          <DatePicker 
            showTime 
            format="YYYY-MM-DD HH:mm"
            placeholder="选择截止时间"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item 
          label="标签"
          extra={`已添加 ${tags.length} 个标签${historyTags.length > 0 ? `，可从 ${historyTags.length} 个历史标签中选择` : ''}`}
        >
          <Select
            mode="tags"
            value={tags}
            onChange={handleTagsChange}
            placeholder="选择已有标签或输入新标签后按回车"
            style={{ width: '100%' }}
            options={historyTags.map(tag => ({
              label: tag,
              value: tag,
            }))}
            maxTagCount="responsive"
            tokenSeparators={[',']}
            showSearch
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>

        {/* 推荐关联待办 */}
        {!todo && (
          <Form.Item label={<span><BulbOutlined /> 推荐关联</span>}>
            {loadingRecommendations ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="正在分析相关待办..." />
              </div>
            ) : recommendations.length > 0 ? (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {recommendations.map((rec) => {
                    const hasPendingRelation = (type: string) => 
                      pendingRelations.some(r => r.targetId === rec.todo.id && r.relationType === type);
                    
                    return (
                      <Card
                        key={rec.todo.id}
                        size="small"
                        style={{ borderLeft: `3px solid ${rec.similarity > 0.5 ? '#52c41a' : '#1890ff'}` }}
                      >
                        <div style={{ marginBottom: 8 }}>
                          <Text strong>{rec.todo.title}</Text>
                          <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>
                            {(rec.similarity * 100).toFixed(0)}% 相似
                          </Tag>
                        </div>
                        
                        {rec.matchedKeywords.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>关键词: </Text>
                            {rec.matchedKeywords.map(kw => (
                              <Tag key={kw} color="geekblue" style={{ fontSize: 11 }}>{kw}</Tag>
                            ))}
                          </div>
                        )}
                        
                        <Space size="small">
                          <Button
                            size="small"
                            type={hasPendingRelation('extends') ? 'primary' : 'default'}
                            icon={<LinkOutlined />}
                            onClick={() => {
                              if (hasPendingRelation('extends')) {
                                handleRemovePendingRelation(rec.todo.id!, 'extends');
                              } else {
                                handleAddPendingRelation(rec.todo.id!, 'extends');
                              }
                            }}
                          >
                            {hasPendingRelation('extends') ? '已选扩展' : '扩展'}
                          </Button>
                          <Button
                            size="small"
                            type={hasPendingRelation('background') ? 'primary' : 'default'}
                            onClick={() => {
                              if (hasPendingRelation('background')) {
                                handleRemovePendingRelation(rec.todo.id!, 'background');
                              } else {
                                handleAddPendingRelation(rec.todo.id!, 'background');
                              }
                            }}
                          >
                            {hasPendingRelation('background') ? '已选背景' : '背景'}
                          </Button>
                          <Button
                            size="small"
                            type={hasPendingRelation('parallel') ? 'primary' : 'default'}
                            onClick={() => {
                              if (hasPendingRelation('parallel')) {
                                handleRemovePendingRelation(rec.todo.id!, 'parallel');
                              } else {
                                handleAddPendingRelation(rec.todo.id!, 'parallel');
                              }
                            }}
                          >
                            {hasPendingRelation('parallel') ? '已选并列' : '并列'}
                          </Button>
                        </Space>
                      </Card>
                    );
                  })}
                </Space>
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无推荐，输入更多内容以获取相关待办推荐"
                style={{ padding: '20px 0' }}
              />
            )}
            
            {pendingRelations.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: '#f0f2f5', borderRadius: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  待建立关系: {pendingRelations.length} 个（保存后自动创建）
                </Text>
              </div>
            )}
          </Form.Item>
        )}
      </Form>
        </div>
        
        {/* 关联上下文面板 */}
        {showRelationContext && (
          <div style={{
            width: 350,
            maxHeight: 'calc(100vh - 240px)',
            overflowY: 'auto',
            borderLeft: '1px solid #f0f0f0',
            paddingLeft: 16
          }}>
            <RelationContext
              currentTodo={todo}
              allTodos={allTodos}
              relations={relations}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TodoForm;

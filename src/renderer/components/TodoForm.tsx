import { Todo, TodoRelation } from '../../shared/types';
import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Select, Button, App, Tag, Space, Switch, DatePicker, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, FileTextOutlined, CopyOutlined } from '@ant-design/icons';
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
  onSubmit: (data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  allTodos?: Todo[];
  relations?: TodoRelation[];
}

const TodoForm: React.FC<TodoFormProps> = ({
  visible,
  todo,
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
        setRichContent('');
        setTags([]);
      }
      
      // 延迟标记编辑器准备就绪，确保 Modal 完全打开
      setTimeout(() => {
        setIsEditorReady(true);
      }, 150);
    } else {
      // Modal 关闭时重置编辑器状态
      setIsEditorReady(false);
      setEditorError(false);
      setUseRichEditor(true);
    }
  }, [visible, todo, form]);

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
      };

      onSubmit(todoData);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
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

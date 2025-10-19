import { Todo, TodoRelation } from '../../shared/types';
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, App, Tag, Space, Switch, DatePicker } from 'antd';
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
  const [inputTag, setInputTag] = useState('');
  const [richContent, setRichContent] = useState<string>('');
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [useRichEditor, setUseRichEditor] = useState(true);
  const [editorError, setEditorError] = useState(false);

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

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      const todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'> = {
        title: values.title,
        content: richContent,
        status: values.status || 'pending',
        startTime: values.startTime ? values.startTime.toISOString() : new Date().toISOString(),
        deadline: values.deadline ? values.deadline.toISOString() : undefined,
        priority: values.priority || 'medium',
        tags: tags.join(','),
        images: '', // 图片现在嵌入在富文本中
      };

      onSubmit(todoData);
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handleAddTag = () => {
    if (inputTag && !tags.includes(inputTag)) {
      setTags([...tags, inputTag]);
      setInputTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
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
          rules={[{ required: true, message: '请输入待办事项标题' }]}
        >
          <Input placeholder="请输入待办事项标题" />
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

        <Form.Item label="标签">
          <div style={{ marginBottom: 8 }}>
            {tags.map(tag => (
              <Tag
                key={tag}
                closable
                onClose={() => handleRemoveTag(tag)}
                style={{ marginBottom: 4 }}
              >
                {tag}
              </Tag>
            ))}
          </div>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              style={{ width: 'calc(100% - 80px)' }}
              value={inputTag}
              onChange={(e) => setInputTag(e.target.value)}
              onPressEnter={handleAddTag}
              placeholder="输入标签后按回车添加"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddTag}
              style={{ width: 80 }}
            >
              添加
            </Button>
          </Space.Compact>
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

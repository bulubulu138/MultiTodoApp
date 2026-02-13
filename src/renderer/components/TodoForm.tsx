import { Todo, TodoRelation } from '../../shared/types';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Modal, Form, Input, Select, Button, App, Tag, Space, Switch, DatePicker, InputNumber, Typography } from 'antd';
const { Text } = Typography;
import { EditOutlined, FileTextOutlined, CopyOutlined } from '@ant-design/icons';
import RichTextEditor from './RichTextEditor';
import PlainTextFallback from './PlainTextFallback';
import { copyTodoToClipboard } from '../utils/copyTodo';
import dayjs from 'dayjs';
// import TipTapEditor from './TipTapEditor'; // Temporarily disabled until dependencies are installed

const { Option } = Select;

interface TodoFormProps {
  visible: boolean;
  todo?: Todo | null;
  quickCreateContent?: string | null;
  onSubmit: (
    data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
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

  // 添加编辑器焦点状态追踪
  const editorHasFocusRef = React.useRef(false);

  // 添加输入法状态追踪，避免输入法期间触发推荐系统
  const isComposingRef = React.useRef(false);

  // 包装的内容变化处理函数
  const handleContentChange = useCallback((content: string) => {
    setRichContent(content);
  }, []);

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

      // 优化：直接标记编辑器准备就绪，依赖编辑器自身的初始化
      // 移除不必要的延迟，避免状态不同步
      setIsEditorReady(true);
    } else {
      // Modal 关闭时重置编辑器状态
      setIsEditorReady(false);
      setEditorError(false);
      setUseRichEditor(true);
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
          },
        });
      } else {
        onSubmit(todoData);
      }
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  // 标签选择/输入处理（Select mode="tags" 自动处理）
  const handleTagsChange = (value: string[]) => {
    // 允许任意数量的标签
    setTags(value);
  };

  return (
    <Modal
      title={todo ? '编辑待办事项' : '新建待办事项'}
      open={visible}
      onCancel={onCancel}
      width={800}
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
    >
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
              <div
                onCompositionStart={() => {
                  console.log('[TodoForm] 输入法开始');
                  isComposingRef.current = true;
                }}
                onCompositionEnd={() => {
                  console.log('[TodoForm] 输入法结束');
                  isComposingRef.current = false;
                }}
              >
                <RichTextEditor
                  value={richContent}
                  onChange={handleContentChange}
                  placeholder="输入内容，支持格式化文本、粘贴图片等..."
                  enableFlowchartEmbed={true}
                  flowchartContext={{
                    todoId: todo?.id,
                    todoTitle: todo?.title || '待办事项',
                  }}
                />
              </div>
            ) : (
              <PlainTextFallback
                value={richContent}
                onChange={handleContentChange}
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
    </Modal>
  );
};

export default TodoForm;

import React, { useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import MDEditor from '@uiw/react-md-editor';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button, Space, Tooltip, Modal, Input } from 'antd';
import { SaveOutlined, LinkOutlined, LoadingOutlined } from '@ant-design/icons';
import type { Todo } from '../../../shared/types';
import TodoLinkRenderer from './TodoLinkRenderer';
import './MarkdownEditorReview.css';

interface MarkdownEditorReviewProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  todos: Todo[];
  saving?: boolean;
  lastSaved?: Date | null;
}

export interface MarkdownEditorReviewRef {
  insertTodoLink: (todo: Todo) => void;
}

const MarkdownEditorReview = forwardRef<MarkdownEditorReviewRef, MarkdownEditorReviewProps>(({
  value,
  onChange,
  onSave,
  todos,
  saving = false,
  lastSaved = null,
}, ref) => {
  const editorRef = useRef<any>(null);
  const [showTodoSelector, setShowTodoSelector] = useState(false);
  const [todoSearchText, setTodoSearchText] = useState('');
  const [cursorPosition, setCursorPosition] = useState<{ start: number; end: number } | null>(null);

  // 过滤代办列表
  const filteredTodos = todoSearchText
    ? todos.filter(todo =>
        todo.title.toLowerCase().includes(todoSearchText.toLowerCase())
      )
    : todos;

  // 插入代办链接
  const handleInsertTodoLink = useCallback((todo: Todo) => {
    const link = `[${todo.title}](todo://${todo.id})`;

    if (cursorPosition) {
      const before = value.substring(0, cursorPosition.start);
      const after = value.substring(cursorPosition.end);
      const newValue = before + link + after;
      onChange(newValue);
    } else {
      // 如果没有光标位置，追加到末尾
      onChange(value + (value ? '\n' : '') + link);
    }

    setShowTodoSelector(false);
    setTodoSearchText('');
  }, [value, onChange, cursorPosition]);

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    insertTodoLink: (todo: Todo) => {
      const link = `[${todo.title}](todo://${todo.id})`;
      // 直接在末尾添加
      onChange(value + (value ? '\n' : '') + link);
    },
  }), [value, onChange]);

  // 打开代办选择器
  const handleOpenTodoSelector = useCallback(() => {
    // 保存当前光标位置
    const textarea = document.querySelector('.w-md-editor-text-input') as HTMLTextAreaElement;
    if (textarea) {
      setCursorPosition({
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
      });
    }
    setShowTodoSelector(true);
  }, []);

  // 保存状态文本
  const getSaveStatusText = () => {
    if (saving) {
      return <><LoadingOutlined /> 保存中...</>;
    }
    if (lastSaved) {
      const now = new Date();
      const diff = Math.floor((now.getTime() - lastSaved.getTime()) / 1000);
      if (diff < 60) {
        return `已保存（刚刚）`;
      } else if (diff < 3600) {
        return `已保存（${Math.floor(diff / 60)}分钟前）`;
      } else {
        return `已保存（${Math.floor(diff / 3600)}小时前）`;
      }
    }
    return '未保存';
  };

  // 自定义Markdown渲染组件
  const customComponents = {
    a: ({ node, href, children, ...props }: any) => {
      // 检查是否是todo://协议的链接
      if (href && href.startsWith('todo://')) {
        const todoId = href.replace('todo://', '');
        return <TodoLinkRenderer todoId={todoId}>{children}</TodoLinkRenderer>;
      }
      // 普通链接
      return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
  };

  return (
    <div className="markdown-editor-review">
      <div className="markdown-editor-toolbar">
        <Space>
          {onSave && (
            <Tooltip title="手动保存">
              <Button
                icon={<SaveOutlined />}
                onClick={onSave}
                type="primary"
                disabled={saving}
              >
                保存
              </Button>
            </Tooltip>
          )}
        </Space>

        <div className="save-status">
          {getSaveStatusText()}
        </div>
      </div>

      <div className="markdown-editor-content">
        <MDEditor
          ref={editorRef}
          value={value}
          onChange={(val) => onChange(val || '')}
          height={600}
          preview="live"
          hideToolbar={false}
          enableScroll={true}
          highlightEnable={true}
          previewOptions={{
            components: customComponents,
            remarkPlugins: [remarkGfm],
          }}
        />
      </div>

      {/* 代办选择器Modal */}
      <Modal
        title="选择代办"
        open={showTodoSelector}
        onCancel={() => {
          setShowTodoSelector(false);
          setTodoSearchText('');
        }}
        footer={null}
        width={600}
      >
        <div className="todo-selector-modal">
          <Input.Search
            placeholder="搜索代办标题..."
            value={todoSearchText}
            onChange={(e) => setTodoSearchText(e.target.value)}
            style={{ marginBottom: 16 }}
            allowClear
          />

          <div className="todo-selector-list">
            {filteredTodos.length === 0 ? (
              <div className="todo-selector-empty">
                {todoSearchText ? '没有找到匹配的代办' : '暂无代办'}
              </div>
            ) : (
              filteredTodos.map(todo => (
                <div
                  key={todo.id}
                  className="todo-selector-item"
                  onClick={() => handleInsertTodoLink(todo)}
                >
                  <div className="todo-selector-item-title">{todo.title}</div>
                  <div className="todo-selector-item-meta">
                    <span className={`status-tag status-${todo.status}`}>
                      {todo.status === 'pending' ? '待处理' :
                       todo.status === 'in_progress' ? '进行中' :
                       todo.status === 'completed' ? '已完成' : '暂停'}
                    </span>
                    <span className={`priority-tag priority-${todo.priority}`}>
                      {todo.priority === 'mental' ? '脑力' :
                       todo.priority === 'communication' ? '沟通' : '琐碎'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
});

MarkdownEditorReview.displayName = 'MarkdownEditorReview';

export default MarkdownEditorReview;

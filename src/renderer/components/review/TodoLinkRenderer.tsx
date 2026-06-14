import React, { useState, useEffect } from 'react';
import { Modal, Button, Space, Tag, Spin } from 'antd';
import { CloseOutlined, EditOutlined } from '@ant-design/icons';
import type { Todo } from '../../../shared/types';
import dayjs from 'dayjs';
import './TodoLinkRenderer.css';

interface TodoLinkProps {
  todoId: string;
  children: React.ReactNode;
}

const TodoLinkRenderer: React.FC<TodoLinkProps> = ({ todoId, children }) => {
  const [todo, setTodo] = useState<Todo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // 加载代办信息
  useEffect(() => {
    const loadTodo = async () => {
      try {
        setLoading(true);
        const todoData = await window.electronAPI.todo.getById(todoId);
        setTodo(todoData);
      } catch (error) {
        console.error('Failed to load todo:', error);
        setTodo(null);
      } finally {
        setLoading(false);
      }
    };

    loadTodo();
  }, [todoId]);

  // 如果代办不存在或已删除
  if (loading) {
    return (
      <span className="todo-link todo-link-loading">
        <Spin size="small" /> {children}
      </span>
    );
  }

  if (!todo) {
    return (
      <span
        className="todo-link todo-link-deleted"
        title="该代办已被删除"
      >
        {children}
      </span>
    );
  }

  // 正常的代办链接
  return (
    <>
      <a
        href="#"
        className={`todo-link todo-link-active todo-link-status-${todo.status}`}
        onClick={(e) => {
          e.preventDefault();
          setShowPreview(true);
        }}
        title={`点击查看代办详情：${todo.title}`}
      >
        {children}
      </a>

      {/* 代办详情预览Modal */}
      <Modal
        title={
          <div className="todo-preview-header">
            <span>{todo.title}</span>
            <Space size="small">
              <Tag color={
                todo.status === 'completed' ? 'success' :
                todo.status === 'in_progress' ? 'processing' :
                todo.status === 'paused' ? 'default' : 'warning'
              }>
                {todo.status === 'pending' ? '待处理' :
                 todo.status === 'in_progress' ? '进行中' :
                 todo.status === 'completed' ? '已完成' : '暂停'}
              </Tag>
              <Tag color={
                todo.priority === 'mental' ? 'magenta' :
                todo.priority === 'communication' ? 'blue' : 'default'
              }>
                {todo.priority === 'mental' ? '脑力' :
                 todo.priority === 'communication' ? '沟通' : '琐碎'}
              </Tag>
            </Space>
          </div>
        }
        open={showPreview}
        onCancel={() => setShowPreview(false)}
        width={700}
        footer={[
          <Button key="close" onClick={() => setShowPreview(false)}>
            关闭
          </Button>,
          <Button
            key="edit"
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              setShowPreview(false);
              // TODO: 跳转到主界面并高亮该代办
              // 这需要在App.tsx中实现一个jumpToTodo方法
            }}
          >
            在主界面中编辑
          </Button>,
        ]}
        className="todo-preview-modal"
      >
        <div className="todo-preview-content">
          {todo.tags && (
            <div className="todo-preview-field">
              <strong>标签：</strong>
              {todo.tags.split(',').map((tag, index) => (
                <Tag key={index} style={{ marginLeft: 4 }}>
                  {tag.trim()}
                </Tag>
              ))}
            </div>
          )}

          {todo.startTime && (
            <div className="todo-preview-field">
              <strong>开始时间：</strong>
              {dayjs(todo.startTime).format('YYYY-MM-DD HH:mm')}
            </div>
          )}

          {todo.deadline && (
            <div className="todo-preview-field">
              <strong>截止时间：</strong>
              {dayjs(todo.deadline).format('YYYY-MM-DD HH:mm')}
            </div>
          )}

          <div className="todo-preview-field">
            <strong>内容：</strong>
            <div
              className="todo-preview-content-body"
              dangerouslySetInnerHTML={{ __html: todo.content || '无内容' }}
            />
          </div>

          <div className="todo-preview-meta">
            <div>创建时间：{dayjs(todo.createdAt).format('YYYY-MM-DD HH:mm')}</div>
            <div>更新时间：{dayjs(todo.updatedAt).format('YYYY-MM-DD HH:mm')}</div>
            {todo.completedAt && (
              <div>完成时间：{dayjs(todo.completedAt).format('YYYY-MM-DD HH:mm')}</div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
};

export default TodoLinkRenderer;

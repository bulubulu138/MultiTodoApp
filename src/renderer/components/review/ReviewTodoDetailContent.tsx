import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';
import dayjs from 'dayjs';
import type { Todo } from '../../../shared/types';

interface ReviewTodoDetailContentProps {
  todo: Todo;
}

const ReviewTodoDetailContent: React.FC<ReviewTodoDetailContentProps> = ({ todo }) => {
  const sanitizedContent = useMemo(() => {
    return todo.content ? DOMPurify.sanitize(todo.content) : '';
  }, [todo.content]);

  return (
    <div>
      <div className="todo-detail-meta-row">
        <span className={`status-badge status-${todo.status}`}>
          {todo.status === 'pending' ? '待处理' :
           todo.status === 'in_progress' ? '进行中' :
           todo.status === 'completed' ? '已完成' : '暂停'}
        </span>
        <span className={`priority-badge priority-${todo.priority}`}>
          {todo.priority === 'mental' ? '脑力' :
           todo.priority === 'communication' ? '沟通' : '琐碎'}
        </span>
      </div>

      {todo.tags && (
        <div className="todo-detail-section">
          <div className="todo-detail-label">标签</div>
          <div className="todo-detail-tags">
            {todo.tags.split(',').filter(Boolean).map(tag => (
              <span key={tag.trim()} className="todo-detail-tag">{tag.trim()}</span>
            ))}
          </div>
        </div>
      )}

      {(todo.startTime || todo.deadline || todo.completedAt) && (
        <div className="todo-detail-section">
          {todo.startTime && (
            <div className="todo-detail-time">
              <span className="todo-detail-label">开始时间：</span>
              {dayjs(todo.startTime).format('YYYY-MM-DD HH:mm')}
            </div>
          )}
          {todo.deadline && (
            <div className="todo-detail-time">
              <span className="todo-detail-label">截止时间：</span>
              {dayjs(todo.deadline).format('YYYY-MM-DD HH:mm')}
            </div>
          )}
          {todo.completedAt && (
            <div className="todo-detail-time">
              <span className="todo-detail-label">完成时间：</span>
              {dayjs(todo.completedAt).format('YYYY-MM-DD HH:mm')}
            </div>
          )}
        </div>
      )}

      {todo.content && (
        <div className="todo-detail-section">
          <div className="todo-detail-label">内容</div>
          <div
            className="todo-detail-rich-content ql-editor"
            dangerouslySetInnerHTML={{ __html: sanitizedContent }}
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(ReviewTodoDetailContent);

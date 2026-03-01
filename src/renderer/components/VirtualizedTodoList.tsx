import { Todo, TodoRelation } from '../../shared/types';
import React, { useState, useMemo, useCallback, memo } from 'react';
import { Card, Tag, Button, Space, Popconfirm, Select, Typography, Tooltip, InputNumber, App } from 'antd';
import { EditOutlined, DeleteOutlined, LinkOutlined, EyeOutlined, EyeInvisibleOutlined, CopyOutlined, PlayCircleOutlined, ClockCircleOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { List as VirtualList } from 'react-window';
import { SortOption, ViewMode } from './Toolbar';
import RelationsModal from './RelationsModal';
import RelationContext from './RelationContext';
import RelationIndicators from './RelationIndicators';
import TodoLinksPreview from './TodoLinksPreview';
import { copyTodoToClipboard } from '../utils/copyTodo';
import { useThemeColors } from '../hooks/useThemeColors';
import { formatCompletedTime } from '../utils/timeFormatter';
import { optimizedMotionVariants, shouldReduceMotion } from '../utils/optimizedMotionVariants';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

interface VirtualizedTodoListProps {
  todos: Todo[];
  allTodos?: Todo[];
  loading: boolean;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  relations?: TodoRelation[];
  onRelationsChange?: () => Promise<void>;
  sortOption?: SortOption;
  activeTab: string;
  onUpdateDisplayOrder?: (id: number, tabKey: string, order: number | null) => Promise<void>;
  viewMode?: ViewMode;
  onUpdateInPlace?: (id: number, updates: Partial<Todo>) => void;
  getUrlTitlesForTodo?: (todoId: number) => Map<string, string>;
}

// 虚拟化列表项的高度
const ITEM_HEIGHT = 240; // 根据实际卡片高度调整

// VirtualizedTodoItem props interface
interface VirtualizedTodoItemProps {
  todo: Todo;
  allTodos?: Todo[];
  index: number;
  style: React.CSSProperties;
  relations?: TodoRelation[];
  sortOption?: SortOption;
  activeTab: string;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  onRelationsChange?: () => Promise<void>;
  onUpdateDisplayOrder?: (id: number, tabKey: string, order: number | null) => Promise<void>;
  urlTitles?: Map<string, string>;
}

// 优化的单个待办事项组件
const VirtualizedTodoItem = memo<VirtualizedTodoItemProps>(({
  todo,
  allTodos,
  index,
  style,
  relations = [],
  sortOption,
  activeTab,
  onEdit,
  onDelete,
  onStatusChange,
  onView,
  onRelationsChange,
  onUpdateDisplayOrder,
  urlTitles
}) => {
  const { message } = App.useApp();
  const colors = useThemeColors();
  const [expandedRelations, setExpandedRelations] = useState(false);
  const [editingOrder, setEditingOrder] = useState<number | null>(null);

  // 工具函数
  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      case 'paused': return 'default';
      default: return 'default';
    }
  }, []);

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'default';
    }
  }, []);

  const getPriorityText = useCallback((priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return priority;
    }
  }, []);

  const extractPlainText = useCallback((html: string): string => {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const images = temp.querySelectorAll('img');
    images.forEach(img => img.remove());

    const text = temp.textContent || temp.innerText || '';
    return text.trim().replace(/\s+/g, ' ');
  }, []);

  const getFirstLine = useCallback((text: string, maxLength: number = 80): string => {
    if (!text) return '(无内容)';

    const firstLine = text.split('\n')[0];

    if (firstLine.length > maxLength) {
      return firstLine.substring(0, maxLength) + '...';
    }

    return firstLine;
  }, []);

  const formatCompactTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  }, []);

  const renderTags = useCallback((tagsString: string) => {
    if (!tagsString) return null;

    const tags = tagsString.split(',').filter(tag => tag.trim());
    if (tags.length === 0) return null;

    return (
      <>
        {tags.map((tag, index) => (
          <Tag key={index} color="blue" style={{ margin: 0, fontSize: 12, padding: '0 6px', lineHeight: '20px' }}>
            {tag.trim()}
          </Tag>
        ))}
      </>
    );
  }, []);

  const handleStatusChange = useCallback((todoId: number, newStatus: string) => {
    const updates: Partial<Todo> = { status: newStatus as Todo['status'] };
    onStatusChange(todoId, updates);
  }, [onStatusChange]);

  const handleCopy = useCallback(async (todo: Todo) => {
    const result = await copyTodoToClipboard(todo);
    if (result.success) {
      message.success(result.message);
    } else {
      message.error(result.message);
    }
  }, [message]);

  const handleOrderChange = useCallback((value: number | null) => {
    setEditingOrder(value);
  }, []);

  const handleOrderSave = useCallback(async () => {
    if (onUpdateDisplayOrder && editingOrder !== null) {
      try {
        await onUpdateDisplayOrder(todo.id!, activeTab, editingOrder);
        setEditingOrder(null);
      } catch (error) {
        message.error('更新排序失败');
      }
    }
  }, [editingOrder, onUpdateDisplayOrder, todo.id, activeTab, message]);

  const currentDisplayOrder = editingOrder ?? (todo.displayOrders?.[activeTab]);

  return (
    <div
      style={style}
    >
      <Card
        className="todo-card"
        style={{
          height: '100%',
          borderLeft: todo.id && relations.some(r => r.relation_type === 'parallel' &&
            (r.source_id === todo.id || r.target_id === todo.id)) ? '4px solid #fa8c16' : undefined,
          backgroundColor: todo.status === 'completed' ? colors.completedBg : undefined,
        }}
        styles={{ body: { padding: '12px', height: '100%' } }}
        variant="borderless"
      >
        {/* 标题行 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 8,
          gap: 8
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Space wrap size={4}>
              {todo.deadline &&
               todo.status !== 'completed' &&
               dayjs(todo.deadline).isBefore(dayjs()) && (
                <Tag color="error" icon={<WarningOutlined />} style={{ margin: 0 }}>
                  逾期 {dayjs().diff(dayjs(todo.deadline), 'hour')}h
                </Tag>
              )}
              <Text
                strong
                style={{
                  fontSize: 15,
                  cursor: 'pointer',
                  transition: 'color 0.3s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#40a9ff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'inherit'}
                onClick={() => onView(todo)}
              >
                {todo.title}
              </Text>
              {todo.id && (
                <RelationIndicators
                  todoId={todo.id}
                  relations={relations}
                  allTodos={allTodos || []}
                  size="small"
                  showLabels={false}
                  onViewRelations={() => onView(todo)}
                />
              )}
              {renderTags(todo.tags)}
            </Space>
          </div>

          <Space size={2}>
            <Tooltip title="复制">
              <Button
                type="text"
                icon={<CopyOutlined />}
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy(todo);
                }}
                style={{ padding: '0 4px' }}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                onClick={() => onEdit(todo)}
                style={{ padding: '0 4px' }}
              />
            </Tooltip>
            <Tooltip title="关联">
              <Button
                type="text"
                icon={<LinkOutlined />}
                size="small"
                onClick={() => {
                  // 实现关联逻辑
                }}
                style={{ padding: '0 4px' }}
              />
            </Tooltip>
            <Tooltip title={expandedRelations ? "收起上下文" : "查看上下文"}>
              <Button
                type="text"
                icon={expandedRelations ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                size="small"
                onClick={() => setExpandedRelations(!expandedRelations)}
                style={{ padding: '0 4px' }}
              />
            </Tooltip>
            <Popconfirm
              title="确定要删除吗？"
              onConfirm={() => onDelete(todo.id!)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  style={{ padding: '0 4px' }}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        </div>

        {/* 时间信息标签 */}
        {(todo.startTime || todo.deadline) && (
          <div style={{ marginBottom: 8 }}>
            <Space size={4}>
              {todo.startTime && (
                <Tag icon={<PlayCircleOutlined />} color="green" style={{ fontSize: 11, padding: '0 6px', lineHeight: '20px' }}>
                  开始: {formatCompactTime(todo.startTime)}
                </Tag>
              )}
              {todo.deadline && (
                <Tag icon={<ClockCircleOutlined />} color="red" style={{ fontSize: 11, padding: '0 6px', lineHeight: '20px' }}>
                  截止: {formatCompactTime(todo.deadline)}
                </Tag>
              )}
            </Space>
          </div>
        )}

        {/* 内容预览 */}
        {todo.content && (
          <TodoLinksPreview
            content={todo.content}
            urlTitles={urlTitles || new Map()}
          />
        )}

        {/* 底部：优先级 + 状态 + 时间信息 */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 8
        }}>
          <Space size={8}>
            {sortOption === 'manual' && (
              <Tooltip title="输入序号后按回车或点击其他地方保存">
                <InputNumber
                  size="small"
                  min={0}
                  value={currentDisplayOrder}
                  onChange={handleOrderChange}
                  onBlur={handleOrderSave}
                  onPressEnter={(e) => {
                    e.currentTarget.blur();
                  }}
                  placeholder="序号"
                  style={{ width: 70 }}
                />
              </Tooltip>
            )}
            <Tag color={getPriorityColor(todo.priority)} style={{ margin: 0 }}>
              {getPriorityText(todo.priority)}
            </Tag>
            <Select
              value={todo.status}
              onChange={(value) => handleStatusChange(todo.id!, value)}
              size="small"
              style={{ minWidth: 90 }}
            >
              <Option value="pending">待办</Option>
              <Option value="in_progress">进行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="paused">暂停</Option>
            </Select>
          </Space>

          <div style={{
            fontSize: 11,
            color: '#999',
            whiteSpace: 'nowrap',
            lineHeight: '16px'
          }}>
            <Space size={8} split={<span>|</span>}>
              <span>创建: {formatCompactTime(todo.createdAt)}</span>
              {todo.updatedAt !== todo.createdAt && (
                <span>更新: {formatCompactTime(todo.updatedAt)}</span>
              )}
              {todo.status === 'completed' && todo.completedAt && (
                <span style={{ color: '#52c41a' }}>
                  <CheckCircleOutlined /> 完成于 {formatCompletedTime(todo.completedAt)}
                </span>
              )}
            </Space>
          </div>
        </div>

        {/* 关联上下文展开区域 */}
        {expandedRelations && todo.id && (
          <div style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: colors.contentBg,
            borderRadius: 6,
            borderTop: `1px solid ${colors.borderColor}`
          }}>
            <RelationContext
              currentTodo={todo}
              allTodos={allTodos || []}
              relations={relations}
              compact
            />
          </div>
        )}
      </Card>
    </div>
  );
});

VirtualizedTodoItem.displayName = 'VirtualizedTodoItem';

// 虚拟化待办列表主组件
const VirtualizedTodoList: React.FC<VirtualizedTodoListProps> = React.memo(({
  todos,
  allTodos,
  loading,
  onEdit,
  onDelete,
  onStatusChange,
  onView,
  relations,
  onRelationsChange,
  sortOption,
  activeTab,
  onUpdateDisplayOrder,
  viewMode,
  onUpdateInPlace,
  getUrlTitlesForTodo
}) => {
  const [showRelationsModal, setShowRelationsModal] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);

  const handleShowRelations = useCallback((todo: Todo) => {
    setSelectedTodo(todo);
    setShowRelationsModal(true);
  }, []);

  // 创建行组件的props（不包括index和style，这些由List自动提供）
  type RowPropsType = {
    todos: Todo[];
    allTodos?: Todo[];
    relations?: TodoRelation[];
    sortOption?: SortOption;
    activeTab: string;
    onEdit: (todo: Todo) => void;
    onDelete: (id: number) => void;
    onStatusChange: (id: number, updates: Partial<Todo>) => void;
    onView: (todo: Todo) => void;
    onRelationsChange?: () => Promise<void>;
    onUpdateDisplayOrder?: (id: number, tabKey: string, order: number | null) => Promise<void>;
    getUrlTitlesForTodo?: (todoId: number) => Map<string, string>;
  };

  const rowPropsData: RowPropsType = useMemo(() => ({
    todos,
    allTodos,
    relations,
    sortOption,
    activeTab,
    onEdit,
    onDelete,
    onStatusChange,
    onView,
    onRelationsChange,
    onUpdateDisplayOrder,
    getUrlTitlesForTodo
  }), [todos, allTodos, relations, sortOption, activeTab, onEdit, onDelete, onStatusChange, onView, onRelationsChange, onUpdateDisplayOrder, getUrlTitlesForTodo]);

  // 渲染虚拟化列表项 - 接收List自动提供的index和style，以及我们传入的rowProps
  const RowComponent = useCallback((props: {
    index: number;
    style: React.CSSProperties;
  } & RowPropsType) => {
    const { index, style, todos, allTodos, relations, sortOption, activeTab, onEdit, onDelete, onStatusChange, onView, onRelationsChange, onUpdateDisplayOrder, getUrlTitlesForTodo } = props;
    const todo = todos[index];
    if (!todo || !todo.id) return <div style={style} />;

    return (
      <VirtualizedTodoItem
        todo={todo}
        allTodos={allTodos}
        index={index}
        style={style}
        relations={relations}
        sortOption={sortOption}
        activeTab={activeTab}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onView={onView}
        onRelationsChange={onRelationsChange}
        onUpdateDisplayOrder={onUpdateDisplayOrder}
        urlTitles={getUrlTitlesForTodo ? getUrlTitlesForTodo(todo.id) : undefined}
      />
    );
  }, []);

  return (
    <>
      <RelationsModal
        visible={showRelationsModal}
        todo={selectedTodo}
        todos={allTodos || todos}
        onClose={() => {
          setShowRelationsModal(false);
          setSelectedTodo(null);
        }}
        onRelationsChange={onRelationsChange}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>加载中...</div>
      ) : (
        <VirtualList
          defaultHeight={window.innerHeight - 200} // 动态计算高度
          rowCount={todos.length}
          rowHeight={ITEM_HEIGHT}
          style={{ width: '100%' }}
          overscanCount={3} // 预渲染3个额外项，提升滚动体验
          rowComponent={RowComponent}
          rowProps={rowPropsData as any}
        />
      )}
    </>
  );
});

VirtualizedTodoList.displayName = 'VirtualizedTodoList';

export default VirtualizedTodoList;
import { Todo, TodoRelation } from '../../shared/types';
import React, { useState, useCallback, memo } from 'react';
import { Card, Tag, Button, Space, Popconfirm, Select, Typography, Tooltip, InputNumber, App } from 'antd';
import { EditOutlined, DeleteOutlined, LinkOutlined, EyeOutlined, EyeInvisibleOutlined, CopyOutlined, PlayCircleOutlined, ClockCircleOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { SortOption } from './Toolbar';
import RelationContext from './RelationContext';
import RelationIndicators from './RelationIndicators';
import { FlowchartIndicator } from './FlowchartIndicator';
import { copyTodoToClipboard } from '../utils/copyTodo';
import { useThemeColors } from '../hooks/useThemeColors';
import { formatCompletedTime } from '../utils/timeFormatter';
import dayjs from 'dayjs';

const { Text } = Typography;
const { Option } = Select;

interface TodoCardProps {
  todo: Todo;
  allTodos?: Todo[];
  index: number;
  relations: TodoRelation[];
  sortOption?: SortOption;
  activeTab: string;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  onShowRelations: (todo: Todo) => void;
  onUpdateDisplayOrder?: (id: number, tabKey: string, order: number | null) => Promise<void>;
  onNavigateToFlowchart?: (flowchartId: string, nodeId: string) => void;
  associationsByTodo: Map<number, any[]>;
  parallelRelationsByTodo: Map<number, TodoRelation[]>;
  parallelGroups: Map<number, Set<number>>;
  prevTodo: Todo | null;
  nextTodo: Todo | null;
}

// 优化的TodoCard组件，使用React.memo避免不必要的重渲染
const TodoCard: React.FC<TodoCardProps> = memo(({
  todo,
  allTodos,
  index,
  relations,
  sortOption,
  activeTab,
  onEdit,
  onDelete,
  onStatusChange,
  onView,
  onShowRelations,
  onUpdateDisplayOrder,
  onNavigateToFlowchart,
  associationsByTodo,
  parallelRelationsByTodo,
  parallelGroups,
  prevTodo,
  nextTodo
}) => {
  const { message } = App.useApp();
  const colors = useThemeColors();
  const [expandedRelations, setExpandedRelations] = useState(false);
  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  // 性能优化：使用useCallback缓存函数
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
        {tags.map((tag, idx) => (
          <Tag key={idx} color="blue" style={{ margin: 0, fontSize: 12, padding: '0 6px', lineHeight: '20px' }}>
            {tag.trim()}
          </Tag>
        ))}
      </>
    );
  }, []);

  const handleStatusChange = useCallback((newStatus: string) => {
    const updates: Partial<Todo> = { status: newStatus as Todo['status'] };
    onStatusChange(todo.id!, updates);
  }, [onStatusChange, todo.id]);

  const handleCopy = useCallback(async () => {
    const result = await copyTodoToClipboard(todo);
    if (result.success) {
      message.success(result.message);
    } else {
      message.error(result.message);
    }
  }, [todo, message]);

  const handleOrderChange = useCallback((value: number | null) => {
    setEditingOrder(value);
  }, []);

  const handleOrderSave = useCallback(async () => {
    if (!onUpdateDisplayOrder || editingOrder === null) return;
    
    setSavingOrder(true);
    try {
      await onUpdateDisplayOrder(todo.id!, activeTab, editingOrder);
      setEditingOrder(null);
    } catch (error) {
      message.error('更新排序失败');
    } finally {
      setSavingOrder(false);
    }
  }, [editingOrder, onUpdateDisplayOrder, todo.id, activeTab, message]);

  const toggleRelationContext = useCallback(() => {
    setExpandedRelations(prev => !prev);
  }, []);

  // 计算显示序号
  const currentDisplayOrder = editingOrder !== null ? editingOrder : (todo.displayOrders?.[activeTab]);

  // 计算并列关系
  const parallelRelations = parallelRelationsByTodo.get(todo.id!) || [];
  const hasParallel = parallelRelations.length > 0;

  // 计算分组信息
  const parallelGroup = parallelGroups.get(todo.id!);
  const isInParallelGroup = parallelGroup && parallelGroup.size > 1;
  const isInGroup = isInParallelGroup &&
    (
      (prevTodo && parallelGroup?.has(prevTodo.id!)) ||
      (nextTodo && parallelGroup?.has(nextTodo.id!))
    );
  const isGroupStart = isInGroup && (!prevTodo || !parallelGroup?.has(prevTodo.id!));
  const isGroupEnd = isInGroup && (!nextTodo || !parallelGroup?.has(nextTodo.id!));

  return (
    <div style={{
      width: '100%',
      borderTop: isGroupStart && isInGroup ? '2px dashed #fa8c16' : undefined,
      borderBottom: isGroupEnd && isInGroup ? '2px dashed #fa8c16' : undefined,
      borderLeft: isInGroup ? '3px solid #fa8c16' : undefined,
      borderRight: isInGroup ? '3px solid rgba(250, 140, 22, 0.3)' : undefined,
      paddingTop: isGroupStart && isInGroup ? 12 : 0,
      paddingBottom: isGroupEnd && isInGroup ? 12 : 0,
      paddingLeft: isInGroup ? 12 : 0,
      paddingRight: isInGroup ? 12 : 0,
      backgroundColor: isInGroup ? 'rgba(250, 140, 22, 0.08)' : undefined,
      borderRadius: isInGroup ? 6 : undefined,
      position: 'relative',
    }}>
      {/* 分组标签 */}
      {isGroupStart && isInGroup && (
        <div style={{
          position: 'absolute',
          top: -10,
          left: 12,
          backgroundColor: '#fa8c16',
          color: 'white',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 'bold',
        }}>
          分组 #{currentDisplayOrder}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'flex-start' }}>
        {/* 序号输入框 */}
        {sortOption === 'manual' && (
          <Tooltip title={
            isInGroup && !isGroupStart
              ? "分组内待办的序号由第一个待办统一控制"
              : "输入序号后按回车或点击其他地方保存"
          }>
            <InputNumber
              size="small"
              min={0}
              value={currentDisplayOrder}
              onChange={handleOrderChange}
              onBlur={handleOrderSave}
              onPressEnter={(e) => e.currentTarget.blur()}
              disabled={savingOrder || !!(isInGroup && !isGroupStart)}
              placeholder="序号"
              style={{
                width: 70,
                flexShrink: 0,
                opacity: (isInGroup && !isGroupStart) ? 0.5 : 1
              }}
            />
          </Tooltip>
        )}

        {/* 卡片主体 */}
        <Card
          className="todo-card"
          style={{
            flex: 1,
            borderLeft: hasParallel ? '4px solid #fa8c16' : undefined
          }}
          styles={{ body: { padding: '8px' } }}
          variant="borderless"
        >
          {/* 标题行 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 6,
            gap: 8
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Space wrap size={4}>
                {hasParallel && (
                  <Tag color="orange" style={{ margin: 0 }}>并列</Tag>
                )}
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
                <RelationIndicators
                  todoId={todo.id!}
                  relations={relations}
                  allTodos={allTodos || []}
                  size="small"
                  showLabels={false}
                  onViewRelations={() => onView(todo)}
                />
                {onNavigateToFlowchart && (
                  <FlowchartIndicator
                    todoId={todo.id!}
                    associations={associationsByTodo.get(todo.id!) || []}
                    onNavigate={onNavigateToFlowchart}
                    size="small"
                    showLabel={false}
                  />
                )}
                {renderTags(todo.tags)}
              </Space>
            </div>

            {/* 操作按钮组 */}
            <Space size={2}>
              <Tooltip title="复制">
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  size="small"
                  onClick={handleCopy}
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
                  onClick={() => onShowRelations(todo)}
                  style={{ padding: '0 4px' }}
                />
              </Tooltip>
              <Tooltip title={expandedRelations ? "收起上下文" : "查看上下文"}>
                <Button
                  type="text"
                  icon={expandedRelations ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  size="small"
                  onClick={toggleRelationContext}
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
            <div style={{ marginBottom: 6, marginTop: 6 }}>
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
            <div style={{ marginBottom: 6 }}>
              {getFirstLine(extractPlainText(todo.content))}
            </div>
          )}

          {/* 底部：优先级 + 状态 + 时间信息 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6
          }}>
            <Space size={8}>
              <Tag color={getPriorityColor(todo.priority)} style={{ margin: 0 }}>
                {getPriorityText(todo.priority)}
              </Tag>
              <Select
                value={todo.status}
                onChange={handleStatusChange}
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
          {expandedRelations && (
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
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只在关键props改变时重新渲染
  return (
    prevProps.todo.id === nextProps.todo.id &&
    prevProps.todo.updatedAt === nextProps.todo.updatedAt &&
    prevProps.todo.status === nextProps.todo.status &&
    prevProps.todo.title === nextProps.todo.title &&
    prevProps.activeTab === nextProps.activeTab &&
    prevProps.sortOption === nextProps.sortOption &&
    prevProps.relations.length === nextProps.relations.length
  );
});

TodoCard.displayName = 'TodoCard';

export default TodoCard;

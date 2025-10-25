import { Todo, TodoRelation } from '../../shared/types';
import React, { useState } from 'react';
import { List, Card, Tag, Button, Space, Popconfirm, Select, Typography, Image, Tooltip, App, InputNumber } from 'antd';
import { EditOutlined, DeleteOutlined, LinkOutlined, EyeOutlined, EyeInvisibleOutlined, CopyOutlined, PlayCircleOutlined, ClockCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { SortOption } from './Toolbar';
import RelationsModal from './RelationsModal';
import RelationContext from './RelationContext';
import { copyTodoToClipboard } from '../utils/copyTodo';
import { useThemeColors } from '../hooks/useThemeColors';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;
const { Option } = Select;

interface TodoListProps {
  todos: Todo[];
  allTodos?: Todo[]; // Full list for finding related todos across all statuses
  loading: boolean;
  onEdit: (todo: Todo) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  relations?: TodoRelation[];
  onRelationsChange?: () => Promise<void>; // Callback to refresh global relations
  sortOption?: SortOption; // 当前排序选项
  onUpdateDisplayOrder?: (id: number, order: number | null) => Promise<void>; // 更新显示序号
}

const TodoList: React.FC<TodoListProps> = ({
  todos,
  allTodos,
  loading,
  onEdit,
  onDelete,
  onStatusChange,
  onView,
  relations = [],
  onRelationsChange,
  sortOption,
  onUpdateDisplayOrder
}) => {
  const { message } = App.useApp();
  const colors = useThemeColors();
  const [showRelationsModal, setShowRelationsModal] = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [expandedRelations, setExpandedRelations] = useState<Set<number>>(new Set());
  const [editingOrder, setEditingOrder] = useState<{[key: number]: number | null}>({});
  const [savingOrder, setSavingOrder] = useState<Set<number>>(new Set());
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

  const handleStatusChange = (todoId: number, newStatus: string) => {
    const updates: Partial<Todo> = { status: newStatus as Todo['status'] };
    if (newStatus === 'completed') {
      updates.updatedAt = new Date().toISOString();
    }
    onStatusChange(todoId, updates);
  };

  // 从富文本 HTML 中提取纯文本
  const extractPlainText = (html: string): string => {
    if (!html) return '';
    
    // 创建临时 DOM 元素
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // 移除所有图片
    const images = temp.querySelectorAll('img');
    images.forEach(img => img.remove());
    
    // 获取纯文本
    const text = temp.textContent || temp.innerText || '';
    
    // 清理多余空白
    return text.trim().replace(/\s+/g, ' ');
  };

  // 获取第一行文本（最多 80 个字符）
  const getFirstLine = (text: string, maxLength: number = 80): string => {
    if (!text) return '(无内容)';
    
    // 按换行符分割，取第一行
    const firstLine = text.split('\n')[0];
    
    // 如果第一行太长，截断并添加省略号
    if (firstLine.length > maxLength) {
      return firstLine.substring(0, maxLength) + '...';
    }
    
    return firstLine;
  };

  const renderTags = (tagsString: string) => {
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
  };

  const handleShowRelations = (todo: Todo) => {
    setSelectedTodo(todo);
    setShowRelationsModal(true);
  };

  const toggleRelationContext = (todoId: number) => {
    const newExpanded = new Set(expandedRelations);
    if (newExpanded.has(todoId)) {
      newExpanded.delete(todoId);
    } else {
      newExpanded.add(todoId);
    }
    setExpandedRelations(newExpanded);
  };

  const formatCompactTime = (dateString: string) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  // 处理序号变化
  const handleOrderChange = (todoId: number, value: number | null) => {
    setEditingOrder(prev => ({ ...prev, [todoId]: value }));
  };

  // 保存序号
  const handleOrderSave = async (todoId: number, currentValue: number | undefined) => {
    const newOrder = editingOrder[todoId];
    
    // 如果没有变化，不保存
    if (newOrder === undefined || newOrder === currentValue) {
      setEditingOrder(prev => {
        const next = { ...prev };
        delete next[todoId];
        return next;
      });
      return;
    }

    if (!onUpdateDisplayOrder || newOrder === null) return;

    // 添加到保存中状态
    setSavingOrder(prev => new Set(prev).add(todoId));

    try {
      // 1. 获取所有有序号的待办（包括allTodos，因为可能跨tab）
      const allTodosWithOrder = (allTodos || todos).filter(t => t.displayOrder != null);
      
      // 2. 找出需要调整的待办（序号 >= newOrder 且不是当前待办）
      const toAdjust = allTodosWithOrder.filter(t => 
        t.id !== todoId && 
        t.displayOrder! >= newOrder
      );
      
      // 3. 如果有需要调整的待办，批量更新
      if (toAdjust.length > 0) {
        const updates = toAdjust.map(t => ({
          id: t.id!,
          displayOrder: t.displayOrder! + 1
        }));
        
        // 批量更新受影响的待办
        await window.electronAPI.todo.batchUpdateDisplayOrder(updates);
        message.success(`已自动调整 ${toAdjust.length} 个待办的序号`);
      }
      
      // 4. 检查是否是分组的第一个待办，如果是则同步整组
      const currentTodo = (allTodos || todos).find(t => t.id === todoId);
      if (currentTodo && currentValue !== undefined) {
        // 找出同组的其他待办（具有相同的旧displayOrder）
        const groupTodos = (allTodos || todos).filter(t => 
          t.displayOrder === currentValue && t.id !== todoId
        );
        
        if (groupTodos.length > 0) {
          // 批量更新同组待办到新的displayOrder
          const groupUpdates = groupTodos.map(t => ({
            id: t.id!,
            displayOrder: newOrder
          }));
          await window.electronAPI.todo.batchUpdateDisplayOrder(groupUpdates);
        }
      }
      
      // 5. 设置当前待办的序号
      await onUpdateDisplayOrder(todoId, newOrder);
      
      // 清除编辑状态
      setEditingOrder(prev => {
        const next = { ...prev };
        delete next[todoId];
        return next;
      });
    } catch (error) {
      message.error('更新排序失败');
      // 恢复原值
      setEditingOrder(prev => {
        const next = { ...prev };
        delete next[todoId];
        return next;
      });
    } finally {
      // 移除保存中状态
      setSavingOrder(prev => {
        const next = new Set(prev);
        next.delete(todoId);
        return next;
      });
    }
  };

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
    <List
      loading={loading}
      dataSource={todos}
      renderItem={(todo, index) => {
        // Data validation guard
        if (!todo || !todo.id) return null;
        
        // 获取当前显示的序号值（编辑中的值或原始值）
        const currentDisplayOrder = editingOrder[todo.id!] !== undefined 
          ? editingOrder[todo.id!] 
          : todo.displayOrder;
        
        // 检查是否是并列待办
        const parallelRelations = relations.filter(r => 
          r.relation_type === 'parallel' && 
          (r.source_id === todo.id || r.target_id === todo.id)
        );
        const hasParallel = parallelRelations.length > 0;
        
        // 检测分组边界（仅在手动排序模式下）
        const prevTodo = index > 0 ? todos[index - 1] : null;
        const nextTodo = index < todos.length - 1 ? todos[index + 1] : null;
        
        const isGroupStart = !prevTodo || prevTodo.displayOrder !== todo.displayOrder;
        const isGroupEnd = !nextTodo || nextTodo.displayOrder !== todo.displayOrder;
        const isInGroup = sortOption === 'manual' && todo.displayOrder != null && (
          (prevTodo && prevTodo.displayOrder === todo.displayOrder) ||
          (nextTodo && nextTodo.displayOrder === todo.displayOrder)
        );
        
        // 调试日志
        if (isInGroup) {
          console.log(`Todo ${todo.id} (order=${todo.displayOrder}): isGroupStart=${isGroupStart}, isGroupEnd=${isGroupEnd}`);
        }
        
        return (
          <List.Item 
            key={todo.id} 
            style={{ 
              marginBottom: isGroupEnd && isInGroup ? 16 : 6,
              padding: 0
            }}
          >
            {/* 分组容器 */}
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
                  分组 #{todo.displayOrder}
                </div>
              )}
              
              {/* 原有内容 */}
              <div style={{ 
                display: 'flex', 
                gap: 8, 
                width: '100%', 
                alignItems: 'flex-start'
              }}>
              {/* 序号输入框（仅手动排序模式显示） */}
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
                    onChange={(value) => handleOrderChange(todo.id!, value)}
                    onBlur={() => handleOrderSave(todo.id!, todo.displayOrder)}
                    onPressEnter={(e) => {
                      e.currentTarget.blur();
                    }}
                    disabled={savingOrder.has(todo.id!) || (isInGroup && !isGroupStart)}
                    placeholder="序号"
                    style={{ 
                      width: 70,
                      flexShrink: 0,
                      opacity: (isInGroup && !isGroupStart) ? 0.5 : 1
                    }}
                  />
                </Tooltip>
              )}
              
              {/* 原有卡片 */}
              <Card
                className="todo-card"
                style={{ 
                  flex: 1,
                  borderLeft: hasParallel ? '4px solid #fa8c16' : undefined
                }}
                bodyStyle={{ padding: '8px' }}
                bordered={false}
              >
              {/* 标题行：标题 + 标签 + 操作按钮 */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: 6,
                gap: 8
              }}>
                {/* 左侧：标题 + 标签 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Space wrap size={4}>
                    {/* 并列待办标识 */}
                    {hasParallel && (
                      <Tag color="orange" style={{ margin: 0 }}>
                        并列
                      </Tag>
                    )}
                    {/* 逾期标识 */}
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
                    {renderTags(todo.tags)}
                  </Space>
                </div>
                
                {/* 右侧：操作按钮组 */}
                <Space size={2}>
                  <Tooltip title="复制">
                    <Button 
                      type="text" 
                      icon={<CopyOutlined />} 
                      size="small"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const result = await copyTodoToClipboard(todo);
                        if (result.success) {
                          message.success(result.message);
                        } else {
                          message.error(result.message);
                        }
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
                      onClick={() => handleShowRelations(todo)}
                      style={{ padding: '0 4px' }}
                    />
                  </Tooltip>
                  <Tooltip title={expandedRelations.has(todo.id!) ? "收起上下文" : "查看上下文"}>
                    <Button 
                      type="text" 
                      icon={expandedRelations.has(todo.id!) ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      size="small"
                      onClick={() => toggleRelationContext(todo.id!)}
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

              {/* 内容预览 - 仅显示第一行纯文本 */}
              {todo.content && (
                <div 
                  className="todo-content-preview"
                  style={{
                    marginBottom: 6,
                    color: '#666',
                    fontSize: 13,
                    lineHeight: '20px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
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
                {/* 左侧：优先级和状态控件 */}
                <Space size={8}>
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
                
                {/* 右侧：时间信息 */}
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
                  </Space>
                </div>
              </div>
            
            {/* 关联上下文展开区域 */}
            {expandedRelations.has(todo.id!) && (
              <div style={{
                marginTop: 16,
                padding: 12,
                backgroundColor: colors.contentBg,
                borderRadius: 6,
                borderTop: `1px solid ${colors.borderColor}`
              }}>
                <RelationContext
                  currentTodo={todo}
                  allTodos={allTodos || todos}
                  relations={relations}
                  compact
                />
              </div>
            )}
            </Card>
              </div>
              {/* 关闭内容div */}
            </div>
            {/* 关闭分组容器div */}
          </List.Item>
        );
      }}
    />
    </>
  );
};

export default TodoList;

import { Todo, CalendarViewSize } from '../../shared/types';
import React, { useState, useMemo } from 'react';
import { Drawer, Calendar, Badge, List, Typography, Tag, Space, Divider } from 'antd';
import { ClockCircleOutlined, PlayCircleOutlined, WarningOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useThemeColors } from '../hooks/useThemeColors';

const { Title, Text } = Typography;

interface CalendarDrawerProps {
  visible: boolean;
  todos: Todo[];
  onClose: () => void;
  onSelectTodo: (todo: Todo) => void;
  viewSize?: CalendarViewSize;
}

const CalendarDrawer: React.FC<CalendarDrawerProps> = ({
  visible,
  todos,
  onClose,
  onSelectTodo,
  viewSize = 'compact'
}) => {
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const colors = useThemeColors();

  // 判断是否逾期
  const isOverdue = (todo: Todo): boolean => {
    if (!todo.deadline || todo.status === 'completed') return false;
    return dayjs(todo.deadline).isBefore(dayjs());
  };

  // 获取逾期小时数
  const getOverdueHours = (todo: Todo): number => {
    if (!todo.deadline) return 0;
    return dayjs().diff(dayjs(todo.deadline), 'hour');
  };

  // 获取日历样式配置
  const getCalendarStyle = (size: CalendarViewSize) => {
    switch (size) {
      case 'compact':
        return { fontSize: '11px', cellHeight: 40 };  // 从 15px 恢复到 40px
      case 'standard':
        return { fontSize: '12px', cellHeight: 50 };  // 从 25px 恢复到 50px
      case 'comfortable':
        return { fontSize: '14px', cellHeight: 60 };  // 从 30px 恢复到 60px
      default:
        return { fontSize: '11px', cellHeight: 40 };
    }
  };

  const calendarStyle = getCalendarStyle(viewSize);

  // 获取优先级颜色
  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return '#ff4d4f';
      case 'medium': return '#faad14';
      case 'low': return '#52c41a';
      default: return '#1890ff';
    }
  };

  // 获取优先级文本
  const getPriorityText = (priority: string): string => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return priority;
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = dayjs(dateString);
    return date.format('HH:mm');
  };

  // 日期单元格内容渲染
  const dateCellRender = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    
    // 使用精确的日期比较，而不是 startsWith
    const startingTodos = todos.filter(todo => 
      todo && todo.startTime && dayjs(todo.startTime).format('YYYY-MM-DD') === dateStr
    );
    
    // 找出当天截止的待办
    const deadlineTodos = todos.filter(todo => 
      todo && todo.deadline && dayjs(todo.deadline).format('YYYY-MM-DD') === dateStr
    );
    
    // 找出逾期的待办（截止日期在这一天，且未完成，且已过期）
    const overdueTodos = deadlineTodos.filter(todo => 
      todo.status !== 'completed' && dayjs(todo.deadline).isBefore(dayjs())
    );
    
    if (startingTodos.length === 0 && deadlineTodos.length === 0) {
      return null;
    }
    
    // 所有模式都使用 Badge 显示
    return (
      <div className="calendar-cell-content" style={{ 
        minHeight: viewSize === 'compact' ? 15 : (viewSize === 'standard' ? 20 : 25)
      }}>
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
          {/* 逾期的待办 - 红色数字 Badge */}
          {overdueTodos.length > 0 && (
            <Badge 
              count={overdueTodos.length}
              style={{ 
                backgroundColor: '#ff4d4f',
                fontSize: viewSize === 'compact' ? 9 : (viewSize === 'standard' ? 10 : 11),
                height: viewSize === 'compact' ? 14 : (viewSize === 'standard' ? 16 : 18),
                lineHeight: viewSize === 'compact' ? '14px' : (viewSize === 'standard' ? '16px' : '18px'),
                minWidth: viewSize === 'compact' ? 14 : (viewSize === 'standard' ? 16 : 18)
              }}
            />
          )}
          {/* 开始的待办 */}
          {startingTodos.slice(0, 3).map(todo => (
            <Badge 
              key={`start-${todo.id}`}
              status="processing"
              color={getPriorityColor(todo.priority)}
            />
          ))}
          {/* 截止的待办 */}
          {deadlineTodos.slice(0, 3).map(todo => (
            <Badge 
              key={`deadline-${todo.id}`}
              status="error"
              color={getPriorityColor(todo.priority)}
            />
          ))}
        </div>
      </div>
    );
  };

  // 点击日期
  const onSelect = (date: Dayjs) => {
    setSelectedDate(date);
  };

  // 获取选中日期的待办 - 使用 useMemo 优化性能
  const selectedTodoLists = useMemo(() => {
    if (!selectedDate) return { overdue: [], starting: [], deadline: [] };
    
    const dateStr = selectedDate.format('YYYY-MM-DD');
    const now = dayjs();
    
    // 使用精确的日期比较
    const starting = todos.filter(todo => 
      todo && todo.startTime && dayjs(todo.startTime).format('YYYY-MM-DD') === dateStr
    );
    
    const deadline = todos.filter(todo => 
      todo && todo.deadline && dayjs(todo.deadline).format('YYYY-MM-DD') === dateStr
    );
    
    // 筛选逾期的待办（从 deadline 中筛选未完成且已过期的）
    const overdue = deadline.filter(todo => 
      todo && todo.status !== 'completed' && dayjs(todo.deadline).isBefore(now)
    ).sort((a, b) => {
      // 按逾期时长排序（逾期越久越靠前）
      return dayjs(a.deadline!).diff(dayjs(b.deadline!));
    });
    
    return { overdue, starting, deadline };
  }, [selectedDate, todos]);

  const { overdue, starting, deadline } = selectedTodoLists;
  const hasSelectedTodos = overdue.length > 0 || starting.length > 0 || deadline.length > 0;

  return (
    <Drawer
      title="📅 待办日历视图"
      width="85%"
      open={visible}
      onClose={onClose}
      placement="right"
    >
      <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 16 }}>
        {/* 左侧：待办列表面板 */}
        <div className="todo-list-panel" style={{ 
          flex: '0 0 40%', 
          overflowY: 'auto', 
          paddingRight: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {!selectedDate ? (
            // 默认提示
            <div style={{ 
              textAlign: 'center', 
              padding: 40, 
              color: '#999',
              marginTop: 60
            }}>
              <ClockCircleOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div>
                <Text type="secondary">请在右侧日历中选择日期查看当日待办</Text>
              </div>
            </div>
          ) : (
            // 选中日期后显示待办列表
            <>
              <Title level={4} style={{ margin: 0 }}>
                📅 {selectedDate.format('YYYY年MM月DD日')}
              </Title>
          
          {/* 逾期的待办 */}
          {overdue.length > 0 && (
            <>
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 14, color: colors.textColor }}>
                  <WarningOutlined style={{ marginRight: 4 }} />
                  ⚠️ 逾期的待办 ({overdue.length})
                </Text>
              </div>
              <List
                size="small"
                dataSource={overdue}
                renderItem={(todo) => (
                  <List.Item 
                    onClick={() => {
                      onSelectTodo(todo);
                      onClose();
                    }}
                    style={{ 
                      cursor: 'pointer',
                      padding: '6px 10px',
                      background: colors.listItemOverdueBg,
                      color: '#000000',
                      marginBottom: 6,
                      borderRadius: 4,
                      border: '2px solid #ff4d4f',
                      fontSize: 13
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.listItemOverdueHoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.background = colors.listItemOverdueBg}
                  >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Tag color="#ff4d4f">逾期 {getOverdueHours(todo)}h</Tag>
                        <Tag color={getPriorityColor(todo.priority)}>
                          {getPriorityText(todo.priority)}
                        </Tag>
                        <Text style={{ color: '#ff4d4f' }}>{todo.title}</Text>
                      </Space>
                      {todo.deadline && (
                        <Text type="danger" style={{ fontSize: 12, color: '#ff4d4f' }}>
                          {formatTime(todo.deadline)}
                        </Text>
                      )}
                    </Space>
                  </List.Item>
                )}
                style={{ marginBottom: 16 }}
              />
              <Divider style={{ margin: '12px 0' }} />
            </>
          )}
          
          {/* 开始的待办 */}
          {starting.length > 0 && (
            <>
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 14, color: colors.textColor }}>
                  <PlayCircleOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                  开始的待办 ({starting.length})
                </Text>
              </div>
              <List
                size="small"
                dataSource={starting}
                renderItem={(todo) => (
                  <List.Item 
                    onClick={() => {
                      onSelectTodo(todo);
                      onClose();
                    }}
                    style={{ 
                      cursor: 'pointer',
                      padding: '6px 10px',
                      background: colors.listItemBg,
                      color: '#000000',
                      marginBottom: 6,
                      borderRadius: 4,
                      border: `1px solid ${colors.borderColor}`,
                      fontSize: 13
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = colors.listItemHoverBg}
                    onMouseLeave={(e) => e.currentTarget.style.background = colors.listItemBg}
                  >
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Space>
                        <Tag color={getPriorityColor(todo.priority)}>
                          {getPriorityText(todo.priority)}
                        </Tag>
                        <Text style={{ color: '#000000' }}>{todo.title}</Text>
                      </Space>
                      {todo.startTime && (
                        <Text type="secondary" style={{ fontSize: 12, color: '#666666' }}>
                          {formatTime(todo.startTime)}
                        </Text>
                      )}
                    </Space>
                  </List.Item>
                )}
                style={{ marginBottom: 16 }}
              />
            </>
          )}
          
          {/* 截止的待办 */}
          {deadline.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 14, color: colors.textColor }}>
                  <ClockCircleOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                  截止的待办 ({deadline.length})
                </Text>
              </div>
              <List
                size="small"
                dataSource={deadline}
                renderItem={(todo) => {
                  const overdueFlag = isOverdue(todo);
                  return (
                    <List.Item 
                      onClick={() => {
                        onSelectTodo(todo);
                        onClose();
                      }}
                      style={{ 
                        cursor: 'pointer',
                        padding: '6px 10px',
                        background: overdueFlag ? colors.listItemOverdueBg : colors.listItemBg,
                        color: '#000000',
                        marginBottom: 6,
                        borderRadius: 4,
                        border: overdueFlag ? '1px solid #ff4d4f' : `1px solid ${colors.borderColor}`,
                        fontSize: 13
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = overdueFlag ? colors.listItemOverdueHoverBg : colors.listItemHoverBg}
                      onMouseLeave={(e) => e.currentTarget.style.background = overdueFlag ? colors.listItemOverdueBg : colors.listItemBg}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <Space>
                          {overdueFlag && <Tag color="#ff4d4f">逾期</Tag>}
                          <Tag color={getPriorityColor(todo.priority)}>
                            {getPriorityText(todo.priority)}
                          </Tag>
                          <Text style={{ color: overdueFlag ? '#ff4d4f' : '#000000' }}>
                            {todo.title}
                          </Text>
                        </Space>
                        {todo.deadline && (
                          <Text type={overdueFlag ? 'danger' : 'secondary'} style={{ fontSize: 12, color: overdueFlag ? '#ff4d4f' : '#666666' }}>
                            {formatTime(todo.deadline)}
                          </Text>
                        )}
                      </Space>
                    </List.Item>
                  );
                }}
              />
            </>
          )}
              
              {!hasSelectedTodos && (
                <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  <Text type="secondary">该日期没有安排待办事项</Text>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* 右侧：日历面板 */}
        <div style={{ 
          flex: '1', 
          overflowY: 'auto', 
          paddingLeft: 12, 
          borderLeft: '1px solid var(--border-color, #f0f0f0)' 
        }}>
          <Calendar 
            fullscreen={false}
            cellRender={dateCellRender}
            onSelect={onSelect}
            className={`calendar-${viewSize}`}
            style={{ fontSize: calendarStyle.fontSize }}
          />
        </div>
      </div>
    </Drawer>
  );
};

export default CalendarDrawer;


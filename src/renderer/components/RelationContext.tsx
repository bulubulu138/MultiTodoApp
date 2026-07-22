import React, { useMemo } from 'react';
import { Card, Space, Typography, Collapse, Tag, Popover } from 'antd';
import { Todo, TodoRelation } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';
import { getRelationContextGroups } from '../utils/relationContext';

const { Text } = Typography;

interface RelationContextProps {
  currentTodo: Todo;
  allTodos: Todo[];
  relations: TodoRelation[];
  compact?: boolean;
}

interface TodoContextCardProps {
  todo: Todo;
  type: 'background' | 'extends' | 'current' | 'parallel';
  highlighted?: boolean;
  compact?: boolean;
}

// 待办卡片组件
const TodoContextCard: React.FC<TodoContextCardProps> = ({
  todo,
  type,
  highlighted = false,
  compact = false
}) => {
  const colors = useThemeColors();
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '⏳';
      default: return '📋';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'background': return '#722ed1';
      case 'extends': return '#1890ff';
      case 'current': return '#52c41a';
      case 'parallel': return '#fa8c16';
      default: return '#d9d9d9';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待办池';
      case 'in_progress': return '今日事';
      case 'completed': return '已完成';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'mental': return 'blue';
      case 'communication': return 'orange';
      case 'trivial': return 'default';
      default: return 'default';
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'mental': return '脑力劳动';
      case 'communication': return '沟通对齐';
      case 'trivial': return '临时小活';
      default: return priority;
    }
  };

  const previewContent = (
    <div style={{ maxWidth: 400 }}>
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ color: '#000000' }}>标题: </Text>
        <Text style={{ color: '#000000' }}>{todo.title}</Text>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ color: '#000000' }}>状态: </Text>
        <Tag color={getStatusColor(todo.status)}>{getStatusText(todo.status)}</Tag>
      </div>
      <div style={{ marginBottom: 8 }}>
        <Text strong style={{ color: '#000000' }}>优先级: </Text>
        <Tag color={getPriorityColor(todo.priority)}>{getPriorityText(todo.priority)}</Tag>
      </div>
      {todo.content && (
        <div style={{ marginBottom: 8 }}>
          <Text strong style={{ color: '#000000' }}>内容:</Text>
          <div 
            style={{ 
              maxHeight: 200, 
              overflow: 'auto',
              marginTop: 4,
              padding: 8,
              backgroundColor: colors.contentBg,
              color: '#000000',
              borderRadius: 4
            }}
            dangerouslySetInnerHTML={{ __html: todo.content.substring(0, 500) + (todo.content.length > 500 ? '...' : '') }}
          />
        </div>
      )}
      <div>
        <Text type="secondary" style={{ fontSize: '12px', color: '#666666' }}>
          创建时间: {new Date(todo.createdAt).toLocaleString()}
        </Text>
      </div>
    </div>
  );

  return (
    <Popover content={previewContent} title="待办预览" trigger="hover" placement="right">
      <Card
        size="small"
        style={{
          marginBottom: compact ? 4 : 8,
          borderLeft: `3px solid ${getTypeColor(type)}`,
          backgroundColor: highlighted ? colors.listItemCurrentBg : colors.listItemBg,
          color: '#000000',
          cursor: 'pointer'
        }}
      >
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong style={{ fontSize: compact ? '12px' : '14px', color: '#000000' }}>
              {getStatusIcon(todo.status)} {todo.title}
            </Text>
            {highlighted && <Tag color="green">当前</Tag>}
          </div>
          <Text type="secondary" style={{ fontSize: compact ? '11px' : '12px', color: '#666666' }}>
            {new Date(todo.createdAt).toLocaleDateString()}
          </Text>
        </Space>
      </Card>
    </Popover>
  );
};

const RelationContext: React.FC<RelationContextProps> = ({
  currentTodo,
  allTodos,
  relations,
  compact = false
}) => {
  const colors = useThemeColors();
  const { backgrounds, backgroundExtensions, extensions, parallels } = useMemo(
    () => getRelationContextGroups(currentTodo, allTodos, relations),
    [currentTodo, allTodos, relations]
  );

  const hasRelations = backgrounds.length + backgroundExtensions.length + extensions.length + parallels.length > 0;

  if (!hasRelations) {
    return compact ? null : (
      <div style={{
        padding: 16,
        textAlign: 'center',
        color: '#999',
        fontSize: '14px'
      }}>
        暂无关联上下文
      </div>
    );
  }

  return (
    <div className={`relation-context ${compact ? 'compact' : ''}`}>
      {/* 背景事项 */}
      {backgrounds.length > 0 && (
        <Collapse
          defaultActiveKey={compact ? [] : ['backgrounds']}
          style={{ marginBottom: 8 }}
          size="small"
          items={[
            {
              key: 'backgrounds',
              label: `📋 父待办 (${backgrounds.length})`,
              children: backgrounds.map(todo => (
                <TodoContextCard
                  key={todo.id}
                  todo={todo}
                  type="background"
                  compact={compact}
                />
              ))
            }
          ]}
        />
      )}

      {/* 背景的延续 */}
      {backgroundExtensions.length > 0 && (
        <Collapse
          defaultActiveKey={compact ? [] : ['backgroundExtensions']}
          style={{ marginBottom: 8 }}
          size="small"
          items={[
            {
              key: 'backgroundExtensions',
              label: `📝 兄弟待办 (${backgroundExtensions.length})`,
              children: backgroundExtensions.map(todo => (
                <TodoContextCard
                  key={todo.id}
                  todo={todo}
                  type="extends"
                  compact={compact}
                />
              ))
            }
          ]}
        />
      )}

      {/* 当前待办 */}
      <div className="relation-current" style={{ marginBottom: 8 }}>
        <div className="relation-group-header" style={{
          fontSize: compact ? '12px' : '14px',
          fontWeight: 600,
          marginBottom: 8,
          paddingBottom: 4,
          borderBottom: `1px solid ${colors.borderColor}`
        }}>
          🎯 当前待办
        </div>
        <TodoContextCard
          todo={currentTodo}
          type="current"
          highlighted
          compact={compact}
        />
      </div>

      {/* 延伸事项 */}
      {extensions.length > 0 && (
        <Collapse
          defaultActiveKey={compact ? [] : ['extensions']}
          style={{ marginBottom: 8 }}
          size="small"
          items={[
            {
              key: 'extensions',
              label: `📤 子待办 (${extensions.length})`,
              children: extensions.map(todo => (
                <TodoContextCard
                  key={todo.id}
                  todo={todo}
                  type="extends"
                  compact={compact}
                />
              ))
            }
          ]}
        />
      )}

      {/* 并列事项 */}
      {parallels.length > 0 && (
        <Collapse
          defaultActiveKey={compact ? [] : ['parallels']}
          size="small"
          items={[
            {
              key: 'parallels',
              label: `⚡ 并列事项 (${parallels.length})`,
              children: parallels.map(todo => (
                <TodoContextCard
                  key={todo.id}
                  todo={todo}
                  type="parallel"
                  compact={compact}
                />
              ))
            }
          ]}
        />
      )}
    </div>
  );
};

export default RelationContext;


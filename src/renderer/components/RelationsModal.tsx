import React, { useState, useEffect } from 'react';
import { Modal, List, Card, Button, Space, Tag, Select, App, Typography, Segmented, Timeline } from 'antd';
import { LinkOutlined, DeleteOutlined, PlusOutlined, ClockCircleOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Todo, TodoRelation } from '../../shared/types';

const { Option } = Select;
const { Text } = Typography;

interface RelationsModalProps {
  visible: boolean;
  todo: Todo | null;
  todos: Todo[];
  onClose: () => void;
  onRelationsChange?: () => Promise<void>;
}

const RelationsModal: React.FC<RelationsModalProps> = ({
  visible,
  todo,
  todos,
  onClose,
  onRelationsChange
}) => {
  const { message } = App.useApp();
  const [relations, setRelations] = useState<TodoRelation[]>([]);
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [newRelationType, setNewRelationType] = useState<'extends' | 'background' | 'parallel'>('background');
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');

  useEffect(() => {
    if (visible && todo) {
      loadRelations();
    }
  }, [visible, todo]);

  const loadRelations = async () => {
    if (!todo?.id) return;
    
    try {
      const todoRelations = await window.electronAPI.relations.getByTodoId(todo.id);
      setRelations(todoRelations);
    } catch (error) {
      console.error('Error loading relations:', error);
      message.error('加载关系失败');
    }
  };

  const handleAddRelation = async () => {
    if (!todo?.id || !selectedTodoId) {
      message.warning('请先选择要关联的待办事项');
      return;
    }
    
    const targetTodo = todos.find(t => t.id === selectedTodoId);
    if (!targetTodo || !targetTodo.id) {
      message.error('选择的待办事项不存在');
      return;
    }

    try {
      let sourceId: number = todo.id;
      let targetId: number = targetTodo.id;
      let relationType = newRelationType;

      // 处理关系方向和类型
      if (newRelationType === 'extends') {
        // 当前todo extends targetTodo（子待办关系）
        // 含义：当前todo是targetTodo的子待办
        // 存储：source=当前todo, target=targetTodo, type='extends'
        sourceId = todo.id!;
        targetId = targetTodo.id!;
        relationType = 'extends';
      } else if (newRelationType === 'background') {
        // targetTodo background 当前todo（父待办关系）
        // 含义：targetTodo是当前todo的父待办
        // 存储：source=targetTodo, target=当前todo, type='background'
        sourceId = targetTodo.id!;
        targetId = todo.id!;
        relationType = 'background';
      } else if (newRelationType === 'parallel') {
        // 并列关系，保持原样（无方向性，双向查询时会自动匹配）
        sourceId = todo.id!;
        targetId = targetTodo.id!;
        relationType = 'parallel';
      }

      // 性能优化：使用客户端内存中的关系数据检查，避免数据库查询
      const exists = relations.some(r => 
        r.source_id === sourceId && 
        r.target_id === targetId && 
        r.relation_type === relationType
      );

      if (exists) {
        message.warning('该关系已存在');
        return;
      }

      // 对于并列关系，也要检查反向是否存在
      if (relationType === 'parallel') {
        const reverseExists = relations.some(r =>
          r.source_id === targetId && 
          r.target_id === sourceId && 
          r.relation_type === relationType
        );
        if (reverseExists) {
          message.warning('该关系已存在');
          return;
        }
      }

      // 乐观更新：先更新 UI，提升响应速度
      const tempRelation: TodoRelation = {
        id: Date.now(), // 临时 ID
        source_id: sourceId,
        target_id: targetId,
        relation_type: relationType,
        created_at: new Date().toISOString() // 添加创建时间
      };
      setRelations([...relations, tempRelation]);
      setSelectedTodoId(null);
      message.success('关联关系添加成功');

      // 后台创建关系
      try {
        const createdRelation = await window.electronAPI.relations.create({
          source_id: sourceId,
          target_id: targetId,
          relation_type: relationType
        });

        // 如果是并列关系，自动同步displayOrder
        if (relationType === 'parallel') {
          const sourceTodo = todos.find(t => t.id === sourceId);
          const targetTodoItem = todos.find(t => t.id === targetId);
          
          if (sourceTodo && targetTodoItem) {
            // 使用较小的displayOrder，或者如果都没有则使用较小的ID
            const syncOrder = sourceTodo.displayOrder ?? targetTodoItem.displayOrder ?? Math.min(sourceId, targetId);
            
            // 更新两个待办的displayOrder
            const updates: Promise<void>[] = [];
            if (sourceTodo.displayOrder !== syncOrder) {
              updates.push(window.electronAPI.todo.update(sourceId, { displayOrder: syncOrder }));
            }
            if (targetTodoItem.displayOrder !== syncOrder) {
              updates.push(window.electronAPI.todo.update(targetId, { displayOrder: syncOrder }));
            }
            
            if (updates.length > 0) {
              await Promise.all(updates);
              message.info(`已自动同步并列待办的显示序号为 ${syncOrder}`);
            }
          }
        }

        // 后台刷新全局关系状态
        await onRelationsChange?.();
      } catch (error: any) {
        // 后台创建失败，回滚 UI 更新
        setRelations(relations);
        
        if (error.message && error.message.includes('already exists')) {
          message.warning('该关系已存在');
        } else {
          message.error('添加关联关系失败');
        }
        console.error('Error adding relation:', error);
      }
    } catch (error: any) {
      // 前置检查失败
      if (error.message && error.message.includes('already exists')) {
        message.warning('该关系已存在');
      } else {
        message.error('添加关联关系失败');
      }
      console.error('Error adding relation:', error);
    }
  };

  const handleRemoveRelation = async (relationId: number) => {
    if (!relationId) return;

    try {
      await window.electronAPI.relations.delete(relationId);
      await loadRelations();
      await onRelationsChange?.(); // Refresh global relations state
      message.success('关联关系删除成功');
    } catch (error) {
      message.error('删除关联关系失败');
      console.error('Error removing relation:', error);
    }
  };

  const getRelationTypeText = (type: string) => {
    switch (type) {
      case 'extends': return '子待办';
      case 'background': return '父待办';
      case 'parallel': return '并列';
      default: return type;
    }
  };

  const getRelationTypeColor = (type: string) => {
    switch (type) {
      case 'extends': return 'blue';
      case 'background': return 'purple';
      case 'parallel': return 'orange';
      default: return 'default';
    }
  };

  const getRelationTypeIcon = (type: string) => {
    switch (type) {
      case 'extends': return '📝';
      case 'background': return '📋';
      case 'parallel': return '⚡';
      default: return '🔗';
    }
  };

  const getRelatedTodo = (relation: TodoRelation): Todo | undefined => {
    const targetId = relation.source_id === todo?.id ? relation.target_id : relation.source_id;
    return todos.find(t => t.id === targetId);
  };

  // 获取显示的关系类型和相关待办
  const getDisplayRelation = (relation: TodoRelation): { 
    relatedTodo: Todo | undefined; 
    displayType: 'background' | 'extends' | 'parallel';
  } => {
    if (relation.relation_type === 'parallel') {
      // 并列关系，双向显示
      const relatedTodoId = relation.source_id === todo?.id ? relation.target_id : relation.source_id;
      return {
        relatedTodo: todos.find(t => t.id === relatedTodoId),
        displayType: 'parallel'
      };
    } else if (relation.relation_type === 'background') {
      // 判断方向
      if (relation.target_id === todo?.id) {
        // source 是当前 todo 的背景
        return {
          relatedTodo: todos.find(t => t.id === relation.source_id),
          displayType: 'background'
        };
      } else if (relation.source_id === todo?.id) {
        // target 是当前 todo 的延伸
        return {
          relatedTodo: todos.find(t => t.id === relation.target_id),
          displayType: 'extends'
        };
      }
    }
    return { relatedTodo: undefined, displayType: 'background' };
  };

  // 获取所有关联的待办（包括递归查找）
  const getAllRelatedTodos = (): { todo: Todo; relation: TodoRelation; displayType: 'background' | 'extends' | 'parallel' }[] => {
    const result: { todo: Todo; relation: TodoRelation; displayType: 'background' | 'extends' | 'parallel' }[] = [];
    const visited = new Set<number>();

    relations.forEach(relation => {
      const { relatedTodo, displayType } = getDisplayRelation(relation);
      if (relatedTodo && !visited.has(relatedTodo.id!)) {
        result.push({ todo: relatedTodo, relation, displayType });
        visited.add(relatedTodo.id!);
      }
    });

    return result;
  };

  // 按时间排序的关联事项
  const sortedRelatedTodos = getAllRelatedTodos().sort((a, b) => {
    return new Date(a.todo.createdAt).getTime() - new Date(b.todo.createdAt).getTime();
  });

  if (!todo) return null;

  return (
    <>
      <Modal
        title={`"${todo.title}" 的关联关系`}
        open={visible}
        onCancel={onClose}
        width={700}
        footer={[
          <Button key="close" onClick={onClose}>
            关闭
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Select
              value={newRelationType}
              onChange={setNewRelationType}
              style={{ width: 120 }}
            >
              <Option value="background">父待办</Option>
              <Option value="extends">子待办</Option>
              <Option value="parallel">并列</Option>
            </Select>
            <Select
              placeholder="选择待办事项"
              value={selectedTodoId}
              onChange={setSelectedTodoId}
              style={{ width: 250 }}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={todos
                .filter(t => t.id !== todo.id) // 排除当前待办
                .map(t => ({
                  value: t.id,
                  label: t.title
                }))}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddRelation}
              disabled={!selectedTodoId}
            >
              添加关联
            </Button>
          </Space>
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as 'timeline' | 'list')}
            options={[
              { label: '时间轴', value: 'timeline', icon: <ClockCircleOutlined /> },
              { label: '列表', value: 'list', icon: <UnorderedListOutlined /> }
            ]}
          />
        </div>

        {viewMode === 'timeline' ? (
          // 时间轴视图
          <Timeline
            mode="left"
            items={[
              // 添加当前待办作为中心点
              ...sortedRelatedTodos.map((item, index) => {
                const isCurrentTodo = item.todo.id === todo.id;
                const isBefore = new Date(item.todo.createdAt) < new Date(todo.createdAt);
                
                return {
                  color: isCurrentTodo ? 'green' : getRelationTypeColor(item.displayType),
                  dot: isCurrentTodo ? '🎯' : getRelationTypeIcon(item.displayType),
                  children: (
                    <Card 
                      size="small" 
                      style={{ 
                        marginBottom: 8,
                        borderLeft: `3px solid ${
                          isCurrentTodo ? '#52c41a' : 
                          item.displayType === 'extends' ? '#1890ff' :
                          item.displayType === 'background' ? '#722ed1' : '#fa8c16'
                        }`,
                        opacity: isBefore ? 0.85 : 1
                      }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space>
                            <Tag color={getRelationTypeColor(item.displayType)}>
                              {isCurrentTodo ? '当前' : getRelationTypeText(item.displayType)}
                            </Tag>
                            <Text strong>{item.todo.title}</Text>
                          </Space>
                          {!isCurrentTodo && (
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemoveRelation(item.relation.id!)}
                            />
                          )}
                        </div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {new Date(item.todo.createdAt).toLocaleString()} · {item.todo.status === 'completed' ? '✅已完成' : item.todo.status === 'in_progress' ? '⏳进行中' : '📋待办'}
                        </Text>
                        {item.todo.content && (
                          <Text 
                            type="secondary" 
                            ellipsis={{ tooltip: item.todo.content.replace(/<[^>]*>/g, '') }}
                            style={{ fontSize: '13px' }}
                          >
                            {item.todo.content.replace(/<[^>]*>/g, '').substring(0, 50)}...
                          </Text>
                        )}
                      </Space>
                    </Card>
                  )
                };
              }),
              // 如果当前待办不在列表中，添加它
              ...(sortedRelatedTodos.every(item => item.todo.id !== todo.id) ? [{
                color: 'green',
                dot: '🎯',
                children: (
                  <Card 
                    size="small" 
                    style={{ 
                      marginBottom: 8,
                      borderLeft: '3px solid #52c41a'
                    }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <div>
                        <Tag color="green">当前</Tag>
                        <Text strong>{todo.title}</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {new Date(todo.createdAt).toLocaleString()} · {todo.status === 'completed' ? '✅已完成' : todo.status === 'in_progress' ? '⏳进行中' : '📋待办'}
                      </Text>
                    </Space>
                  </Card>
                )
              }] : [])
            ]}
          />
        ) : (
          // 列表视图
          <List
            dataSource={relations}
            renderItem={(relation) => {
              const { relatedTodo, displayType } = getDisplayRelation(relation);
              if (!relatedTodo) return null;

              return (
                <List.Item
                  key={relation.id}
                  actions={[
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveRelation(relation.id!)}
                    >
                      删除
                    </Button>
                  ]}
                >
                  <Card size="small" style={{ width: '100%' }}>
                    <Card.Meta
                      title={
                        <Space>
                          <span>{getRelationTypeIcon(displayType)}</span>
                          <Tag color={getRelationTypeColor(displayType)}>
                            {getRelationTypeText(displayType)}
                          </Tag>
                          <Text strong>{relatedTodo.title}</Text>
                        </Space>
                      }
                      description={
                        <div>
                          {relatedTodo.content && (
                            <Text 
                              type="secondary" 
                              ellipsis={{ tooltip: relatedTodo.content.replace(/<[^>]*>/g, '') }}
                              style={{ display: 'block', marginBottom: 4 }}
                            >
                              {relatedTodo.content.replace(/<[^>]*>/g, '')}
                            </Text>
                          )}
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            创建于: {new Date(relatedTodo.createdAt).toLocaleString()}
                          </Text>
                        </div>
                      }
                    />
                  </Card>
                </List.Item>
              );
            }}
            locale={{ emptyText: '暂无关联关系' }}
          />
        )}
      </Modal>
    </>
  );
};

export default RelationsModal;

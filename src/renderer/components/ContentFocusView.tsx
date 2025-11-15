import { Todo, TodoRelation } from '../../shared/types';
import React, { useState, useMemo, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Divider, Button, Checkbox, Space, Spin, Empty, App, InputNumber, Tag, Tooltip } from 'antd';
import { SaveOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import RichTextEditor from './RichTextEditor';
import RelationIndicators from './RelationIndicators';
import { formatCompletedTime } from '../utils/timeFormatter';

interface ContentFocusViewProps {
  todos: Todo[];
  allTodos?: Todo[];
  onUpdate: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  loading: boolean;
  activeTab: string;
  relations: TodoRelation[];
  onUpdateDisplayOrder: (todoId: number, tabKey: string, displayOrder: number) => Promise<void>;
}

// 暴露给父组件的方法
export interface ContentFocusViewRef {
  saveAll: () => Promise<void>;
}

// 单个待办项组件接口
interface ContentFocusItemProps {
  todo: Todo;
  onUpdate: (id: number, updates: Partial<Todo>) => void;
  onView: (todo: Todo) => void;
  isLast: boolean;
  activeTab: string;
  allTodos: Todo[];
  relations: TodoRelation[];
  parallelGroup?: Set<number>;
  prevTodo: Todo | null;
  nextTodo: Todo | null;
  onUpdateDisplayOrder: (todoId: number, tabKey: string, displayOrder: number) => Promise<void>;
}

// 暴露给父组件的方法
export interface ContentFocusItemRef {
  saveNow: () => Promise<void>;
}

// 单个待办项组件（使用 forwardRef 暴露保存方法）
const ContentFocusItem = React.memo(
  forwardRef<ContentFocusItemRef, ContentFocusItemProps>(({ 
    todo, 
    onUpdate, 
    onView, 
    isLast,
    activeTab,
    allTodos,
    relations,
    parallelGroup,
    prevTodo,
    nextTodo,
    onUpdateDisplayOrder
  }, ref) => {
    const { message } = App.useApp();
    const [editedContent, setEditedContent] = useState<string>(todo.content);
    const [isSaving, setIsSaving] = useState(false);
    const [editingOrder, setEditingOrder] = useState<number | undefined>(undefined);
    const [savingOrder, setSavingOrder] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isComposingRef = useRef(false); // 追踪输入法状态
    
    const lastSavedContentRef = useRef(todo.content);

    // 同步外部更新的 todo.content（仅在保存完成后更新）
    useEffect(() => {
      // 只有当外部内容变化且不是由当前组件保存触发时，才更新本地状态
      if (todo.content !== lastSavedContentRef.current && !isSaving) {
        setEditedContent(todo.content);
        lastSavedContentRef.current = todo.content;
      }
    }, [todo.content, isSaving]);

    // 检查内容是否被修改
    const hasChanges = useMemo(() => {
      return editedContent !== lastSavedContentRef.current;
    }, [editedContent]);

    // 保存内容（静默保存，不显示提示）
    const handleSave = useCallback(async () => {
      if (!hasChanges || !todo.id) return;
      
      // 如果内容与上次保存的内容相同，跳过保存
      if (editedContent === lastSavedContentRef.current) return;
      
      setIsSaving(true);
      try {
        await onUpdate(todo.id, { content: editedContent });
        // 更新最后保存的内容引用
        lastSavedContentRef.current = editedContent;
        // 静默保存，不显示提示
      } catch (error) {
        message.error('保存失败');
        console.error('Save error:', error);
      } finally {
        setIsSaving(false);
      }
    }, [hasChanges, todo.id, editedContent, onUpdate, message]);

    // 智能保存调度函数 - 检查输入法状态
    const scheduleAutoSave = useCallback(() => {
      // 如果正在使用输入法，直接返回，不调度保存
      if (isComposingRef.current) {
        return;
      }

      // 清除之前的定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 设置新的保存定时器 - 2.5秒防抖，减少频繁保存提升性能
      saveTimeoutRef.current = setTimeout(() => {
        // 再次检查输入法状态（防止在定时器执行时正在使用输入法）
        if (!isComposingRef.current) {
          handleSave();
        }
      }, 2500); // 增加到2.5秒，减少保存频率
    }, [handleSave]);

    // 暴露给父组件的保存方法
    useImperativeHandle(ref, () => ({
      saveNow: async () => {
        if (hasChanges && editedContent !== lastSavedContentRef.current) {
          // 清除防抖定时器
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
          // 立即保存（即使在输入法状态也保存，因为是用户主动触发）
          await handleSave();
        }
      }
    }), [hasChanges, editedContent, handleSave]);

    // 组件卸载时保存未保存的更改
    useEffect(() => {
      return () => {
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        // 如果有未保存的更改，立即保存
        const currentContent = editedContent;
        const currentTodoId = todo.id;
        if (currentContent !== todo.content && currentTodoId) {
          onUpdate(currentTodoId, { content: currentContent });
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // 仅在组件卸载时执行

    // 切换完成状态
    const handleToggleComplete = useCallback(async (checked: boolean) => {
      if (!todo.id) return;
      
      const newStatus = checked ? 'completed' : 'pending';
      const updates: Partial<Todo> = { 
        status: newStatus
        // 注意：completedAt 和 updatedAt 由数据库层自动处理
      };
      
      try {
        await onUpdate(todo.id, updates);
        message.success(checked ? '已标记为完成' : '已标记为待办');
      } catch (error) {
        message.error('更新状态失败');
        console.error('Status update error:', error);
      }
    }, [todo.id, onUpdate, message]);

    // 查看详情
    const handleViewDetails = useCallback(() => {
      onView(todo);
    }, [todo, onView]);

    // 保存排序序号（复用TodoList的冲突解决算法）
    const handleOrderSave = useCallback(async () => {
      if (!todo.id || editingOrder === undefined) return;
      
      const currentValue = todo.displayOrders && todo.displayOrders[activeTab];
      if (editingOrder === currentValue) {
        setEditingOrder(undefined);
        return;
      }
      
      const newOrder = editingOrder;
      setSavingOrder(true);
      
      try {
        // 1. 获取当前 tab 所有有序号的待办（排除当前待办）
        const currentTabTodos = allTodos.filter(t => 
          t.id !== todo.id &&
          t.displayOrders && 
          t.displayOrders[activeTab] != null
        );
        
        // 2. 构建序号到待办的映射（用于快速查找）
        const orderToTodoMap = new Map<number, Todo>();
        currentTabTodos.forEach(t => {
          const order = t.displayOrders![activeTab]!;
          orderToTodoMap.set(order, t);
        });
        
        // 3. 递归式冲突解决：收集所有需要调整的待办
        const adjustments: Array<{id: number; oldOrder: number; newOrder: number}> = [];
        
        const resolveConflict = (targetOrder: number): void => {
          const conflictTodo = orderToTodoMap.get(targetOrder);
          
          if (!conflictTodo) {
            // 没有冲突，这个序号可以使用
            return;
          }
          
          // 有冲突，需要将冲突的待办移到下一个序号
          const nextOrder = targetOrder + 1;
          
          // 递归检查下一个序号是否也有冲突
          resolveConflict(nextOrder);
          
          // 记录这个待办需要被移动
          adjustments.push({
            id: conflictTodo.id!,
            oldOrder: targetOrder,
            newOrder: nextOrder
          });
          
          // 更新映射（模拟移动后的状态）
          orderToTodoMap.delete(targetOrder);
          orderToTodoMap.set(nextOrder, conflictTodo);
        };
        
        // 从新序号开始检查冲突
        resolveConflict(newOrder);
        
        // 4. 批量更新需要调整的待办
        if (adjustments.length > 0) {
          const updates = adjustments.map(adj => ({
            id: adj.id,
            tabKey: activeTab,
            displayOrder: adj.newOrder
          }));
          
          await window.electronAPI.todo.batchUpdateDisplayOrders(updates);
          message.success(`序号 ${newOrder} 已占用，已自动调整 ${adjustments.length} 个待办的序号`);
        }
        
        // 5. 检查是否是并列分组，如果是则同步整组
        if (parallelGroup && parallelGroup.size > 1) {
          const groupUpdates = Array.from(parallelGroup)
            .filter(id => id !== todo.id)
            .map(id => ({
              id,
              tabKey: activeTab,
              displayOrder: newOrder
            }));
          
          if (groupUpdates.length > 0) {
            await window.electronAPI.todo.batchUpdateDisplayOrders(groupUpdates);
          }
        }
        
        // 6. 设置当前待办的序号
        await onUpdateDisplayOrder(todo.id, activeTab, newOrder);
        
        // 清除编辑状态
        setEditingOrder(undefined);
        message.success('序号已保存');
      } catch (error) {
        message.error('更新排序失败');
        console.error('Order save error:', error);
        // 恢复原值
        setEditingOrder(undefined);
      } finally {
        // 移除保存中状态
        setSavingOrder(false);
      }
    }, [todo.id, editingOrder, activeTab, allTodos, parallelGroup, onUpdateDisplayOrder, message, todo.displayOrders]);

    // 输入法开始事件
    const handleCompositionStart = useCallback(() => {
      console.log('[AutoSave] 输入法开始');
      isComposingRef.current = true;
      
      // 清除所有待触发的保存定时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    }, []);

    // 输入法结束事件
    const handleCompositionEnd = useCallback(() => {
      console.log('[AutoSave] 输入法结束');
      isComposingRef.current = false;
      
      // 输入法结束后，重新启动防抖保存
      scheduleAutoSave();
    }, [scheduleAutoSave]);

    // 内容变化处理
    const handleContentChange = useCallback((content: string) => {
      // 立即更新本地内容（不影响输入）
      setEditedContent(content);
      
      // 只在非输入法状态下启动保存调度
      if (!isComposingRef.current) {
        scheduleAutoSave();
      }
      // 如果在输入法状态，不做任何保存操作
    }, [scheduleAutoSave]);

    // 失去焦点时立即保存
    const handleBlur = useCallback(() => {
      // 失去焦点时，如果不在输入法状态且有更改，立即保存
      if (!isComposingRef.current && hasChanges) {
        // 清除防抖定时器
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
        // 立即保存
        handleSave();
      }
    }, [hasChanges, handleSave]);

    // 键盘事件处理 - Ctrl+S / Cmd+S 手动保存
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
      // 检测 Ctrl+S (Windows/Linux) 或 Cmd+S (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault(); // 阻止浏览器默认的保存行为
        
        // 立即保存（即使在输入法状态也保存）
        if (hasChanges) {
          // 清除自动保存定时器
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
          }
          
          // 立即保存
          handleSave();
          
          // 显示保存提示
          message.success('已手动保存', 1);
        } else {
          message.info('没有需要保存的更改', 1);
        }
      }
    }, [hasChanges, handleSave, message]);

    // 计算分组边界和并列关系
    const isInParallelGroup = parallelGroup && parallelGroup.size > 1;
    const isInGroup = isInParallelGroup && (
      (prevTodo && parallelGroup?.has(prevTodo.id!)) ||
      (nextTodo && parallelGroup?.has(nextTodo.id!))
    );
    const isGroupStart = isInGroup && (!prevTodo || !parallelGroup?.has(prevTodo.id!));
    const isGroupEnd = isInGroup && (!nextTodo || !parallelGroup?.has(nextTodo.id!));
    
    // 检查是否有并列关系
    const hasParallel = relations.some(r => 
      r.relation_type === 'parallel' && 
      (r.source_id === todo.id || r.target_id === todo.id)
    );
    
    // 获取当前显示的序号
    const currentDisplayOrder = editingOrder !== undefined 
      ? editingOrder 
      : (todo.displayOrders && todo.displayOrders[activeTab]);

    return (
      <div 
        className="content-focus-item"
        style={{
          borderTop: isGroupStart ? '2px dashed #fa8c16' : undefined,
          borderBottom: isGroupEnd ? '2px dashed #fa8c16' : undefined,
          borderLeft: isInGroup ? '3px solid #fa8c16' : undefined,
          borderRight: isInGroup ? '3px solid rgba(250, 140, 22, 0.3)' : undefined,
          paddingTop: isGroupStart ? 12 : 0,
          paddingBottom: isGroupEnd ? 12 : 0,
          paddingLeft: isInGroup ? 12 : 0,
          paddingRight: isInGroup ? 12 : 0,
        }}
      >
        {/* 顶部工具栏 */}
        <div className="content-focus-item-header">
          <Space>
            <Checkbox
              checked={todo.status === 'completed'}
              onChange={(e) => handleToggleComplete(e.target.checked)}
            >
              {todo.status === 'completed' ? '已完成' : '标记完成'}
            </Checkbox>
            
            {/* 完成时间显示 */}
            {todo.status === 'completed' && todo.completedAt && (
              <span style={{ fontSize: 11, color: '#52c41a' }}>
                {formatCompletedTime(todo.completedAt)}完成
              </span>
            )}
            
            {/* 并列待办标识 */}
            {hasParallel && (
              <Tag color="orange" style={{ margin: 0, fontSize: 12 }}>
                并列
              </Tag>
            )}
            
            {/* 分组标签 */}
            {isGroupStart && isInGroup && (
              <Tag color="orange" style={{ margin: 0, fontSize: 11, padding: '0 4px' }}>
                并列分组
              </Tag>
            )}
            
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={handleViewDetails}
            >
              查看详情
            </Button>
            
            {/* 关联指示器 */}
            {todo.id && (
              <RelationIndicators
                todoId={todo.id}
                relations={relations}
                allTodos={allTodos}
                size="small"
                showLabels={false}
                onViewRelations={handleViewDetails}
              />
            )}
          </Space>

          {/* 右侧：排序序号 + 保存状态 */}
          <Space size={8}>
            {/* 排序序号 */}
            <Space size={4} style={{ fontSize: 12 }}>
              <span style={{ color: '#999' }}>序号:</span>
              {editingOrder !== undefined ? (
                <Tooltip title={
                  isInGroup && !isGroupStart 
                    ? "分组内待办的序号由第一个待办统一控制" 
                    : "输入序号后按回车或点击其他地方保存"
                }>
                  <InputNumber
                    size="small"
                    value={editingOrder}
                    onChange={(value) => setEditingOrder(value ?? undefined)}
                    onPressEnter={handleOrderSave}
                    onBlur={handleOrderSave}
                    min={0}
                    disabled={savingOrder || !!(isInGroup && !isGroupStart)}
                    style={{ 
                      width: 70,
                      opacity: (isInGroup && !isGroupStart) ? 0.5 : 1
                    }}
                    placeholder="设置序号"
                  />
                </Tooltip>
              ) : (
                <Tooltip title={
                  isInGroup && !isGroupStart 
                    ? "分组内待办的序号由第一个待办统一控制" 
                    : "点击编辑序号"
                }>
                  <span 
                    onClick={() => {
                      if (!!(isInGroup && !isGroupStart)) {
                        return; // 禁用点击
                      }
                      // 如果当前没有序号，设置为 0 作为默认值
                      setEditingOrder(currentDisplayOrder ?? 0);
                    }}
                    style={{ 
                      cursor: !!(isInGroup && !isGroupStart) ? 'not-allowed' : 'pointer', 
                      color: currentDisplayOrder !== undefined ? '#1890ff' : '#ccc',
                      opacity: !!(isInGroup && !isGroupStart) ? 0.5 : 1,
                    minWidth: 20,
                    textAlign: 'center',
                    display: 'inline-block'
                  }}
                >
                  {currentDisplayOrder ?? '-'}
                </span>
                </Tooltip>
              )}
            </Space>
            
            {/* 保存状态指示器 */}
            {isSaving && (
              <span style={{ fontSize: 12, color: '#1890ff' }}>
                <SaveOutlined /> 保存中...
              </span>
            )}
            {!isSaving && !hasChanges && !savingOrder && (
              <span style={{ fontSize: 12, color: '#52c41a' }}>
                <CheckCircleOutlined /> 已保存
              </span>
            )}
            {savingOrder && (
              <span style={{ fontSize: 12, color: '#1890ff' }}>
                <SaveOutlined /> 保存序号...
              </span>
            )}
          </Space>
        </div>

        {/* 富文本编辑器 - 添加输入法事件、失去焦点保存和键盘快捷键 */}
        <div 
          className="content-focus-item-editor" 
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          <RichTextEditor
            value={editedContent}
            onChange={handleContentChange}
            placeholder="编辑待办内容..."
            style={{ minHeight: '150px' }}
          />
        </div>

        {/* 分割线 */}
        {!isLast && <Divider className="content-focus-divider" />}
      </div>
    );
  })
);

ContentFocusItem.displayName = 'ContentFocusItem';

// 主组件 - 使用 forwardRef 暴露保存所有的方法
const ContentFocusView = forwardRef<ContentFocusViewRef, ContentFocusViewProps>(({
  todos,
  allTodos,
  onUpdate,
  onView,
  loading,
  activeTab,
  relations,
  onUpdateDisplayOrder,
}, ref) => {
  // 为每个待办项创建 ref
  const itemRefsMap = useRef<Map<number, ContentFocusItemRef>>(new Map());

  // 使用 DFS 构建并列关系分组 Map（复用自TodoList）
  const parallelGroups = useMemo(() => {
    const groups = new Map<number, Set<number>>();
    const visited = new Set<number>();
    
    const dfs = (todoId: number, groupSet: Set<number>) => {
      if (visited.has(todoId)) return;
      visited.add(todoId);
      groupSet.add(todoId);
      
      // 找到所有与该 todo 有并列关系的其他 todo
      const relatedIds = relations
        .filter(r => r.relation_type === 'parallel')
        .filter(r => r.source_id === todoId || r.target_id === todoId)
        .map(r => r.source_id === todoId ? r.target_id : r.source_id);
      
      for (const relatedId of relatedIds) {
        dfs(relatedId, groupSet);
      }
    };
    
    // 为每个有并列关系的 todo 构建分组
    todos.forEach(todo => {
      if (!todo.id) return;
      
      const hasParallel = relations.some(r => 
        r.relation_type === 'parallel' && 
        (r.source_id === todo.id || r.target_id === todo.id)
      );
      
      if (hasParallel && !visited.has(todo.id)) {
        const groupSet = new Set<number>();
        dfs(todo.id, groupSet);
        
        // 将这个分组应用到所有成员
        groupSet.forEach(id => {
          groups.set(id, groupSet);
        });
      }
    });
    
    return groups;
  }, [relations, todos]);

  // 暴露给父组件的保存所有方法
  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      const savePromises: Promise<void>[] = [];
      itemRefsMap.current.forEach((itemRef) => {
        if (itemRef && itemRef.saveNow) {
          savePromises.push(itemRef.saveNow());
        }
      });
      await Promise.all(savePromises);
    }
  }), []);

  if (loading) {
    return (
      <div className="content-focus-loading">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (todos.length === 0) {
    return (
      <div className="content-focus-empty">
        <Empty description="暂无待办事项" />
      </div>
    );
  }

  return (
    <div className="content-focus-view">
      {todos.map((todo, index) => (
        <ContentFocusItem
          key={todo.id}
          ref={(itemRef) => {
            if (itemRef && todo.id) {
              itemRefsMap.current.set(todo.id, itemRef);
            }
          }}
          todo={todo}
          onUpdate={onUpdate}
          onView={onView}
          isLast={index === todos.length - 1}
          activeTab={activeTab}
          allTodos={allTodos || todos}
          relations={relations}
          parallelGroup={parallelGroups.get(todo.id!)}
          prevTodo={index > 0 ? todos[index - 1] : null}
          nextTodo={index < todos.length - 1 ? todos[index + 1] : null}
          onUpdateDisplayOrder={onUpdateDisplayOrder}
        />
      ))}
    </div>
  );
});

ContentFocusView.displayName = 'ContentFocusView';

export default ContentFocusView;


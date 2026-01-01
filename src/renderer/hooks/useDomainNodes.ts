import { useMemo } from 'react';
import { PersistedNode, DomainNode, Todo, NodeStyle } from '../../shared/types';

/**
 * useDomainNodes Hook
 * 
 * 通过 selector 模式将持久化层节点转换为业务领域层节点
 * 实时解析 Todo 数据，不在数据库中冗余存储
 */
export function useDomainNodes(
  persistedNodes: PersistedNode[],
  todos: Todo[]
): DomainNode[] {
  return useMemo(() => {
    // 创建 Todo Map 以便快速查找
    const todoMap = new Map(todos.map(t => [String(t.id), t]));

    return persistedNodes.map(node => {
      // 如果节点关联了 Todo
      if (node.data.todoId) {
        const todo = todoMap.get(node.data.todoId);

        if (todo) {
          // Todo 存在，解析数据并计算样式
          return {
            ...node,
            data: {
              ...node.data,
              resolvedTodo: {
                title: todo.title,
                status: todo.status,
                priority: todo.priority
              },
              computedStyle: getStyleForTodoStatus(todo.status, node.data.style)
            }
          };
        } else {
          // Todo 已被删除，显示占位信息
          return {
            ...node,
            data: {
              ...node.data,
              resolvedTodo: undefined,
              computedStyle: node.data.style || getDefaultStyle()
            }
          };
        }
      }

      // 节点未关联 Todo，使用节点自身的 label 和样式
      return {
        ...node,
        data: {
          ...node.data,
          resolvedTodo: undefined,
          computedStyle: node.data.style || getDefaultStyle()
        }
      };
    });
  }, [persistedNodes, todos]);
}

/**
 * 根据 Todo 状态计算节点样式
 */
function getStyleForTodoStatus(
  status: Todo['status'],
  customStyle?: NodeStyle
): NodeStyle {
  const statusColors = {
    pending: '#1890ff',      // 蓝色
    'in_progress': '#faad14', // 黄色
    completed: '#52c41a',     // 绿色
    paused: '#8c8c8c'         // 灰色
  };

  return {
    backgroundColor: statusColors[status],
    borderColor: statusColors[status],
    borderWidth: 2,
    borderStyle: 'solid',
    ...customStyle
  };
}

/**
 * 获取默认样式
 */
function getDefaultStyle(): NodeStyle {
  return {
    backgroundColor: '#ffffff',
    borderColor: '#d9d9d9',
    borderWidth: 2,
    borderStyle: 'solid',
    fontSize: 14
  };
}

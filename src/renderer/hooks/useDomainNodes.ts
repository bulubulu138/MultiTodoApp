import { useMemo, useState, useEffect } from 'react';
import { PersistedNode, DomainNode, Todo, NodeStyle } from '../../shared/types';
import { TODO_NODE_STYLES } from '../config/todoNodeStyles';

/**
 * useDomainNodes Hook
 * 
 * 通过 selector 模式将持久化层节点转换为业务领域层节点
 * 实时解析 Todo 数据，不在数据库中冗余存储
 * 根据主题模式和待办状态计算节点样式
 */
export function useDomainNodes(
  persistedNodes: PersistedNode[],
  todos: Todo[]
): DomainNode[] {
  // 检测当前主题
  const [theme, setTheme] = useState<'light' | 'dark'>(
    (document.documentElement.dataset.theme as 'light' | 'dark') || 'light'
  );

  // 监听主题变化
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = (document.documentElement.dataset.theme as 'light' | 'dark') || 'light';
      setTheme(newTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  return useMemo(() => {
    // 创建 Todo Map 以便快速查找
    // 确保 todoId 统一使用字符串类型进行比较
    const todoMap = new Map(
      todos
        .filter(t => t.id !== undefined)
        .map(t => [String(t.id), t])
    );

    console.log('[useDomainNodes] Todo Map size:', todoMap.size);
    console.log('[useDomainNodes] Available todo IDs:', Array.from(todoMap.keys()));
    console.log('[useDomainNodes] Current theme:', theme);

    return persistedNodes.map(node => {
      // 如果节点关联了 Todo
      if (node.data.todoId) {
        const todoId = String(node.data.todoId);
        console.log(`[useDomainNodes] Node ${node.id} looking for todo:`, todoId);
        
        const todo = todoMap.get(todoId);

        if (todo) {
          console.log(`[useDomainNodes] Found todo for node ${node.id}:`, todo.title);
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
              computedStyle: computeTodoNodeStyle(todo, theme, node.data.style)
            }
          };
        } else {
          console.log(`[useDomainNodes] Todo not found for node ${node.id}, todoId:`, todoId);
          // Todo 已被删除，显示占位信息
          return {
            ...node,
            data: {
              ...node.data,
              resolvedTodo: undefined,
              computedStyle: node.data.style || getDefaultStyle(theme)
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
          computedStyle: node.data.style || getDefaultStyle(theme)
        }
      };
    });
  }, [persistedNodes, todos, theme]);
}

/**
 * 根据 Todo 状态和主题计算节点样式
 * 使用预定义的样式配置，确保对比度符合 WCAG AA 标准
 */
function computeTodoNodeStyle(
  todo: Todo,
  theme: 'light' | 'dark',
  customStyle?: NodeStyle
): NodeStyle {
  // 获取基于状态和主题的样式
  const baseStyle = TODO_NODE_STYLES[theme][todo.status];

  // 合并自定义样式（自定义样式优先级更高）
  return {
    ...baseStyle,
    ...customStyle
  };
}

/**
 * 获取默认样式（根据主题）
 */
function getDefaultStyle(theme: 'light' | 'dark'): NodeStyle {
  if (theme === 'dark') {
    return {
      backgroundColor: '#1a1a1a',
      borderColor: '#595959',
      borderWidth: 2,
      borderStyle: 'solid',
      fontSize: 14,
      color: '#e8e8e8' // 浅色文字，在深色背景上清晰可见
    };
  }

  return {
    backgroundColor: '#ffffff',
    borderColor: '#d9d9d9',
    borderWidth: 2,
    borderStyle: 'solid',
    fontSize: 14,
    color: '#262626' // 深色文字，在浅色背景上清晰可见
  };
}

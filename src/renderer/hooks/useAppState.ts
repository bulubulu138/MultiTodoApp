import { useReducer, useEffect, useRef, useCallback } from 'react';
import { AppState, appReducer, initialAppState, createAppActions } from './useAppReducer';
import { Todo, TodoRelation, CustomTab } from '../../shared/types';

export const useAppState = () => {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const actions = createAppActions;

  // 缓存引用
  const searchCacheRef = useRef<Map<string, Todo[]>>(new Map());
  const searchInputTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savingTodosRef = useRef<Set<number>>(new Set());
  const pendingSavesRef = useRef<Map<number, Promise<void>>>(new Map());

  // 防抖搜索逻辑
  const setDebouncedSearchText = useCallback((searchText: string) => {
    if (searchInputTimerRef.current) {
      clearTimeout(searchInputTimerRef.current);
    }

    searchInputTimerRef.current = setTimeout(() => {
      dispatch(actions.setDebouncedSearchText(searchText));
    }, 200); // 优化到200ms，提升响应性
  }, [actions]);

  // 搜索函数
  const searchTodos = useCallback((todos: Todo[], searchText: string, activeTab: string) => {
    if (!searchText.trim() || searchText.trim().length < 2) {
      return todos;
    }

    const searchLower = searchText.toLowerCase();
    const cacheKey = `${activeTab}-${searchLower}`;

    // 检查缓存
    if (searchCacheRef.current.has(cacheKey)) {
      return searchCacheRef.current.get(cacheKey)!;
    }

    // 执行搜索
    const searchStartTime = performance.now();
    const filtered = todos.filter(todo => {
      const titleMatch = todo.title?.toLowerCase().includes(searchLower);
      if (titleMatch) return true;
      const contentMatch = todo.content?.toLowerCase().includes(searchLower);
      return contentMatch;
    });

    const searchEndTime = performance.now();
    console.log(`[搜索] 搜索耗时: ${(searchEndTime - searchStartTime).toFixed(2)}ms, 结果数量: ${filtered.length}`);

    // 缓存管理
    if (searchCacheRef.current.size >= 30) {
      const firstKey = searchCacheRef.current.keys().next().value;
      if (firstKey !== undefined) {
        searchCacheRef.current.delete(firstKey);
      }
    }
    searchCacheRef.current.set(cacheKey, [...filtered]);

    return filtered;
  }, []);

  // 清理搜索缓存
  const clearSearchCache = useCallback(() => {
    searchCacheRef.current.clear();
  }, []);

  // 内存管理
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      if (searchCacheRef.current.size > 20) {
        const entries = Array.from(searchCacheRef.current.entries());
        searchCacheRef.current.clear();
        entries.slice(-20).forEach(([key, value]) => {
          searchCacheRef.current.set(key, value);
        });
        console.log(`[内存管理] 清理搜索缓存，保留20项，当前缓存大小: ${searchCacheRef.current.size}`);
      }
    }, 5 * 60 * 1000); // 每5分钟清理一次

    const handleBeforeUnload = () => {
      clearInterval(cleanupInterval);
      searchCacheRef.current.clear();
      console.log('[内存管理] 页面卸载，清理所有缓存');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(cleanupInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // 页面可见性变化时的处理
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // 这里可以添加自动保存逻辑
        console.log('[页面隐藏] 应用即将进入后台');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // 统计功能
  const getStatusCounts = useCallback((todos: Todo[]) => ({
    all: todos.filter(t => t && t.id).length,
    pending: todos.filter(t => t && t.status === 'pending').length,
    in_progress: todos.filter(t => t && t.status === 'in_progress').length,
    completed: todos.filter(t => t && t.status === 'completed').length,
    paused: todos.filter(t => t && t.status === 'paused').length
  }), []);

  const getExistingTags = useCallback((todos: Todo[]) => {
    const tagsSet = new Set<string>();
    todos.forEach(todo => {
      if (todo.tags) {
        todo.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) {
            tagsSet.add(trimmed);
          }
        });
      }
    });
    return Array.from(tagsSet).sort();
  }, []);

  // 数据加载函数
  const loadTodos = useCallback(async () => {
    try {
      dispatch(actions.setLoading(true));
      const todoList = await window.electronAPI.todo.getAll();
      dispatch(actions.setTodos(todoList.filter(todo => todo && todo.id)));
    } catch (error) {
      console.error('Error loading todos:', error);
    } finally {
      dispatch(actions.setLoading(false));
    }
  }, [actions]);

  const loadRelations = useCallback(async () => {
    try {
      const relationList = await window.electronAPI.relations.getAll();
      dispatch(actions.setRelations(relationList));
    } catch (error) {
      console.error('Error loading relations:', error);
    }
  }, [actions]);

  const loadSettings = useCallback(async () => {
    try {
      const appSettings = await window.electronAPI.settings.get();
      dispatch(actions.setSettings(appSettings));

      // 加载自定义Tab
      if (appSettings.customTabs) {
        try {
          const tabs = JSON.parse(appSettings.customTabs);
          dispatch(actions.setCustomTabs(tabs));
        } catch (e) {
          console.error('Failed to parse customTabs:', e);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }, [actions]);

  // 数据操作函数
  const createTodo = useCallback(async (todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newTodo = await window.electronAPI.todo.create(todoData);
      dispatch(actions.addTodo(newTodo));
      return newTodo;
    } catch (error) {
      console.error('Error creating todo:', error);
      throw error;
    }
  }, [actions]);

  const updateTodo = useCallback(async (id: number, updates: Partial<Todo>) => {
    try {
      const updatedTodo = await window.electronAPI.todo.update(id, updates);
      dispatch(actions.updateTodo(id, updates));
      return updatedTodo;
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  }, [actions]);

  const deleteTodo = useCallback(async (id: number) => {
    try {
      await window.electronAPI.todo.delete(id);
      dispatch(actions.deleteTodo(id));
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }, [actions]);

  const bulkUpdateTodos = useCallback(async (updates: Array<{ id: number; updates: Partial<Todo> }>) => {
    try {
      // 批量更新到数据库
      const promises = updates.map(({ id, updates }) =>
        window.electronAPI.todo.update(id, updates)
      );

      await Promise.all(promises);

      // 批量更新状态
      dispatch(actions.bulkUpdateTodos(updates));
    } catch (error) {
      console.error('Error bulk updating todos:', error);
      throw error;
    }
  }, [actions]);

  // 关系操作函数
  const createRelation = useCallback(async (relationData: Omit<TodoRelation, 'id'>) => {
    try {
      const newRelationId = await window.electronAPI.relations.create(relationData);
      const newRelation = { ...relationData, id: newRelationId };
      dispatch(actions.addRelation(newRelation));
      return newRelation;
    } catch (error) {
      console.error('Error creating relation:', error);
      throw error;
    }
  }, [actions]);

  const deleteRelation = useCallback(async (id: number) => {
    try {
      await window.electronAPI.relations.delete(id);
      dispatch(actions.deleteRelation(id));
    } catch (error) {
      console.error('Error deleting relation:', error);
      throw error;
    }
  }, [actions]);

  // 设置操作函数
  const updateSetting = useCallback(async (key: string, value: string) => {
    try {
      await window.electronAPI.settings.update({ [key]: value });
      dispatch(actions.updateSetting(key, value));
    } catch (error) {
      console.error('Error updating setting:', error);
      throw error;
    }
  }, [actions]);

  // Tab 操作函数
  const addCustomTab = useCallback(async (tabData: Omit<CustomTab, 'id'>) => {
    try {
      const newTab: CustomTab = {
        ...tabData,
        id: `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };

      const updatedTabs = [...state.customTabs, newTab];
      await updateSetting('customTabs', JSON.stringify(updatedTabs));
      dispatch(actions.addCustomTab(newTab));
      return newTab;
    } catch (error) {
      console.error('Error adding custom tab:', error);
      throw error;
    }
  }, [state.customTabs, actions, updateSetting]);

  const updateCustomTab = useCallback(async (id: string, updates: Partial<CustomTab>) => {
    try {
      const updatedTabs = state.customTabs.map(tab =>
        tab.id === id ? { ...tab, ...updates } : tab
      );
      await updateSetting('customTabs', JSON.stringify(updatedTabs));
      dispatch(actions.updateCustomTab(id, updates));
    } catch (error) {
      console.error('Error updating custom tab:', error);
      throw error;
    }
  }, [state.customTabs, actions, updateSetting]);

  const deleteCustomTab = useCallback(async (id: string) => {
    try {
      const updatedTabs = state.customTabs.filter(tab => tab.id !== id);
      await updateSetting('customTabs', JSON.stringify(updatedTabs));
      dispatch(actions.deleteCustomTab(id));
    } catch (error) {
      console.error('Error deleting custom tab:', error);
      throw error;
    }
  }, [state.customTabs, actions, updateSetting]);

  // 搜索处理
  const handleSearchTextChange = useCallback((text: string) => {
    dispatch(actions.setSearchText(text));
    setDebouncedSearchText(text);
  }, [actions, setDebouncedSearchText]);

  return {
    // 状态
    state,

    // 基础操作
    dispatch,
    actions: {
      ...actions,
      setDebouncedSearchText,
      searchTodos,
      clearSearchCache
    },

    // 数据操作
    loadTodos,
    loadRelations,
    loadSettings,
    createTodo,
    updateTodo,
    deleteTodo,
    bulkUpdateTodos,

    // 关系操作
    createRelation,
    deleteRelation,

    // 设置操作
    updateSetting,

    // Tab 操作
    addCustomTab,
    updateCustomTab,
    deleteCustomTab,

    // UI 操作
    handleSearchTextChange,
    getStatusCounts,
    getExistingTags,

    // 引用（用于外部访问）
    searchCacheRef,
    savingTodosRef,
    pendingSavesRef,
  };
};

export type UseAppStateReturn = ReturnType<typeof useAppState>;
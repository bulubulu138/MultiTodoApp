import { Todo, TodoRelation, CalendarViewSize, CustomTab } from '../shared/types';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Layout, App as AntApp, Tabs, ConfigProvider, FloatButton, Modal, Typography, Space, Tag } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { VerticalAlignTopOutlined } from '@ant-design/icons';
import TodoList from './components/TodoList';
import TodoForm from './components/TodoForm';
import Toolbar, { SortOption, ViewMode } from './components/Toolbar';
import SettingsModal from './components/SettingsModal';
import SearchModal from './components/SearchModal';
import ExportModal from './components/ExportModal';
import TodoViewDrawer from './components/TodoViewDrawer';
import NotesDrawer from './components/NotesDrawer';
import CalendarDrawer from './components/CalendarDrawer';
import CustomTabManager from './components/CustomTabManager';
import { getTheme, ThemeMode } from './theme/themes';
import { buildParallelGroups, selectGroupRepresentatives, sortWithGroups, getSortComparator } from './utils/sortWithGroups';
import dayjs from 'dayjs';

const { Content } = Layout;

// Tab 设置接口
interface TabSettings {
  sortOption: SortOption;
  viewMode: ViewMode;
}

// Tab 设置映射
type TabSettingsMap = {
  [tabKey: string]: TabSettings;
};

interface AppContentProps {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

// 内部组件，可以使用 App.useApp()
const AppContent: React.FC<AppContentProps> = ({ themeMode, onThemeChange }) => {
  const { message } = AntApp.useApp();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showViewDrawer, setShowViewDrawer] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showCustomTabManager, setShowCustomTabManager] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [viewingTodo, setViewingTodo] = useState<Todo | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('all');
  const [relations, setRelations] = useState<TodoRelation[]>([]);
  const [tabSettings, setTabSettings] = useState<TabSettingsMap>({});
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [quickCreateContent, setQuickCreateContent] = useState<string | null>(null);
  const [showHotkeyGuide, setShowHotkeyGuide] = useState(false);
  
  // 保存状态追踪（用于专注模式的乐观更新）
  const savingTodosRef = useRef<Set<number>>(new Set());
  const pendingSavesRef = useRef<Map<number, Promise<void>>>(new Map());

  // 加载数据
  useEffect(() => {
    loadTodos();
    loadSettings();
    loadRelations();
  }, []);

  // 监听快速创建待办事件
  useEffect(() => {
    const handleQuickCreate = (data: { content: string }) => {
      console.log('收到快速创建事件:', data);
      // 打开创建表单
      setShowForm(true);
      setEditingTodo(null); // 确保是创建模式
      
      // 设置初始内容
      setQuickCreateContent(data.content);
      
      // 显示提示消息
      message.success('已从剪贴板获取内容，请补充其他信息');
    };
    
    window.electronAPI.onQuickCreateTodo(handleQuickCreate);
    
    return () => {
      window.electronAPI.removeQuickCreateListener();
    };
  }, [message]);

  // 检查首次运行，显示快捷键引导
  useEffect(() => {
    const hasSeenHotkeyGuide = localStorage.getItem('hasSeenHotkeyGuide');
    if (!hasSeenHotkeyGuide) {
      // 延迟显示，避免与其他初始化冲突
      setTimeout(() => {
        setShowHotkeyGuide(true);
        localStorage.setItem('hasSeenHotkeyGuide', 'true');
      }, 1000);
    }
  }, []);

  // 检查报告提醒
  useEffect(() => {
    const checkReportReminders = () => {
      const now = dayjs();
      const dayOfWeek = now.day(); // 0-6, 0是周日
      const dayOfMonth = now.date();
      const today = now.format('YYYY-MM-DD');
      
      // 周五提醒写周报 (dayOfWeek === 5)
      if (dayOfWeek === 5) {
        const weeklyKey = `weeklyReportDismissed_${now.format('YYYY-WW')}`;
        if (!settings[weeklyKey]) {
          // 延迟显示，避免与其他提示冲突
          setTimeout(() => {
            const key = `weekly-report-${today}`;
            message.info({
              content: '📊 今天是周五，记得填写本周的工作周报哦！',
              duration: 10,
              key,
              onClick: () => {
                setShowCalendar(true);
                message.destroy(key);
              },
            });
            // 标记本周已提醒
            window.electronAPI.settings.update({ [weeklyKey]: 'true' });
          }, 2000);
        }
      }
      
      // 月初（1-3号）提醒写月报
      if (dayOfMonth >= 1 && dayOfMonth <= 3) {
        const monthlyKey = `monthlyReportDismissed_${now.format('YYYY-MM')}`;
        if (!settings[monthlyKey]) {
          // 延迟显示
          setTimeout(() => {
            const key = `monthly-report-${today}`;
            message.info({
              content: '📅 新的一月开始了，记得填写上月的工作月报哦！',
              duration: 10,
              key,
              onClick: () => {
                setShowCalendar(true);
                message.destroy(key);
              },
            });
            // 标记本月已提醒
            window.electronAPI.settings.update({ [monthlyKey]: 'true' });
          }, 3000);
        }
      }
    };
    
    // 延迟检查，确保应用已完全加载
    const timer = setTimeout(() => {
      if (Object.keys(settings).length > 0) {
        checkReportReminders();
      }
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [settings]);

  const loadTodos = async () => {
    try {
      setLoading(true);
      const todoList = await window.electronAPI.todo.getAll();
      // 过滤空值，确保数据完整性
      setTodos(todoList.filter(todo => todo && todo.id));
    } catch (error) {
      message.error('加载待办事项失败');
      console.error('Error loading todos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const appSettings = await window.electronAPI.settings.get();
      setSettings(appSettings);
      
      // 加载主题设置
      if (appSettings.theme) {
        onThemeChange(appSettings.theme as ThemeMode);
      }
      
      // 加载自定义Tab
      if (appSettings.customTabs) {
        try {
          const tabs = JSON.parse(appSettings.customTabs);
          setCustomTabs(tabs);
        } catch (e) {
          console.error('Failed to parse customTabs:', e);
        }
      }
      
      // 加载 Tab 设置（新格式）
      let loadedTabSettings: TabSettingsMap = {};
      if (appSettings.tabSettings) {
        try {
          loadedTabSettings = JSON.parse(appSettings.tabSettings);
        } catch (e) {
          console.error('Failed to parse tabSettings:', e);
        }
      }
      
      // 向后兼容：如果没有新格式的设置，但有旧的设置，则迁移
      if (Object.keys(loadedTabSettings).length === 0) {
        const defaultTab: TabSettings = {
          sortOption: (appSettings.sortOption as SortOption) || 'createdAt-desc',
          viewMode: (appSettings.viewMode as ViewMode) || 'card'
        };
        loadedTabSettings = {
          all: defaultTab
        };
      }
      
      setTabSettings(loadedTabSettings);
    } catch (error) {
      message.error('加载设置失败');
      console.error('Error loading settings:', error);
    }
  };

  const loadRelations = async () => {
    try {
      const allRelations = await window.electronAPI.relations.getAll();
      setRelations(allRelations);
      
      // 自动同步并列关系的displayOrder（静默执行）
      await syncParallelGroupsSilently();
    } catch (error) {
      console.error('Error loading relations:', error);
      message.error('加载关系失败');
    }
  };

  // 获取当前 Tab 的设置（带默认值）
  const getCurrentTabSettings = useCallback((): TabSettings => {
    return tabSettings[activeTab] || {
      sortOption: 'createdAt-desc',
      viewMode: 'card'
    };
  }, [tabSettings, activeTab]);

  // 保存 Tab 设置到数据库
  const saveTabSettings = async (settings: TabSettingsMap) => {
    try {
      await window.electronAPI.settings.update({
        tabSettings: JSON.stringify(settings)
      });
    } catch (error) {
      console.error('Error saving tab settings:', error);
    }
  };

  // 更新当前 Tab 的设置
  const updateCurrentTabSettings = useCallback((updates: Partial<TabSettings>) => {
    const newSettings = {
      ...tabSettings,
      [activeTab]: {
        ...getCurrentTabSettings(),
        ...updates
      }
    };
    setTabSettings(newSettings);
    // 保存到数据库
    saveTabSettings(newSettings);
  }, [tabSettings, activeTab, getCurrentTabSettings]);

  // 监听 Tab 切换，输出当前设置（便于调试）
  useEffect(() => {
    const settings = getCurrentTabSettings();
    console.log(`[Tab切换] ${activeTab}:`, settings);
  }, [activeTab, getCurrentTabSettings]);

  const handleCreateTodo = async (
    todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>,
    pendingRelations?: Array<{targetId: number; relationType: string}>
  ) => {
    try {
      const newTodo = await window.electronAPI.todo.create(todoData);
      
      // 如果有待创建的关系，创建它们
      if (pendingRelations && pendingRelations.length > 0 && newTodo.id) {
        let successCount = 0;
        for (const relation of pendingRelations) {
          try {
            await window.electronAPI.relations.create({
              sourceId: newTodo.id,
              targetId: relation.targetId,
              relationType: relation.relationType
            });
            successCount++;
          } catch (error) {
            console.error('Failed to create relation:', error);
            // 继续创建其他关系，不中断流程
          }
        }
        
        if (successCount > 0) {
          message.success(`待办事项创建成功，已建立 ${successCount} 个关系`);
        } else if (successCount === 0 && pendingRelations.length > 0) {
          message.warning('待办事项创建成功，但关系创建失败');
        }
      } else {
        message.success('待办事项创建成功');
      }
      
      // 重新加载所有待办，确保数据一致性（与更新操作保持一致）
      await loadTodos();
      // 同时刷新关联关系
      await loadRelations();
      setShowForm(false);
    } catch (error) {
      message.error('创建待办事项失败');
      console.error('Error creating todo:', error);
    }
  };

  const handleUpdateTodo = async (id: number, updates: Partial<Todo>) => {
    try {
      await window.electronAPI.todo.update(id, updates);
      // 重新加载所有待办，确保数据一致性
      await loadTodos();
      setEditingTodo(null);
      message.success('待办事项更新成功');
    } catch (error) {
      message.error('更新待办事项失败');
      console.error('Error updating todo:', error);
    }
  };

  // 专注模式专用：乐观更新（不刷新页面，保持滚动位置）
  const handleUpdateTodoInPlace = useCallback(async (id: number, updates: Partial<Todo>) => {
    // 1. 标记为正在保存
    savingTodosRef.current.add(id);
    
    // 2. 乐观更新本地状态（立即生效，不刷新页面）
    setTodos(prev => prev.map(todo => 
      todo.id === id 
        ? { ...todo, ...updates, updatedAt: new Date().toISOString() } 
        : todo
    ));
    
    // 3. 创建保存 Promise 并追踪
    const savePromise = (async () => {
      try {
        await window.electronAPI.todo.update(id, updates);
        // 保存成功，移除追踪
        savingTodosRef.current.delete(id);
        pendingSavesRef.current.delete(id);
      } catch (error) {
        // 保存失败，移除追踪并回滚
        console.error('Update error:', error);
        savingTodosRef.current.delete(id);
        pendingSavesRef.current.delete(id);
        
        // 重新加载确保数据一致性
        await loadTodos();
        message.error('保存失败，已回滚更改');
      }
    })();
    
    pendingSavesRef.current.set(id, savePromise);
  }, []);

  // 等待所有保存完成
  const waitForAllSaves = useCallback(async (): Promise<boolean> => {
    if (pendingSavesRef.current.size === 0) {
      return true;
    }

    const hide = message.loading('正在保存更改...', 0);
    
    try {
      // 等待所有保存操作完成（最多等待 10 秒）
      const allSaves = Array.from(pendingSavesRef.current.values());
      await Promise.race([
        Promise.all(allSaves),
        new Promise((_, reject) => setTimeout(() => reject(new Error('保存超时')), 10000))
      ]);
      
      hide();
      message.success('所有更改已保存');
      return true;
    } catch (error) {
      hide();
      message.error('部分更改保存超时');
      return false;
    }
  }, [message]);

  const handleDeleteTodo = async (id: number) => {
    try {
      await window.electronAPI.todo.delete(id);
      setTodos(prev => prev.filter(todo => todo.id !== id));
      message.success('待办事项删除成功');
    } catch (error) {
      message.error('删除待办事项失败');
      console.error('Error deleting todo:', error);
    }
  };

  const handleSettingsUpdate = async (newSettings: Record<string, string>) => {
    try {
      await window.electronAPI.settings.update(newSettings);
      setSettings(newSettings);
      
      // 更新主题
      if (newSettings.theme) {
        onThemeChange(newSettings.theme as ThemeMode);
      }
      
      setShowSettings(false);
      message.success('设置保存成功');
    } catch (error) {
      message.error('保存设置失败');
      console.error('Error updating settings:', error);
    }
  };

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTodo(null);
    setQuickCreateContent(null); // 清空快速创建内容
  };

  const handleViewTodo = (todo: Todo) => {
    setViewingTodo(todo);
    setShowViewDrawer(true);
  };

  const handleEditFromView = (todo: Todo) => {
    setShowViewDrawer(false);
    setViewingTodo(null);
    setEditingTodo(todo);
    setShowForm(true);
  };

  const handleSortChange = async (option: SortOption) => {
    updateCurrentTabSettings({ sortOption: option });
  };

  const handleViewModeChange = async (mode: ViewMode) => {
    updateCurrentTabSettings({ viewMode: mode });
  };

  const handleUpdateDisplayOrder = async (id: number, tabKey: string, displayOrder: number | null) => {
    try {
      // 读取当前 todo 的 displayOrders
      const todo = todos.find(t => t.id === id);
      if (!todo) {
        throw new Error('Todo not found');
      }
      
      console.log('[DEBUG] 更新序号:', {
        todoId: id,
        tabKey,
        displayOrder,
        currentDisplayOrders: todo.displayOrders
      });
      
      // 更新指定 tab 的序号
      const newDisplayOrders = { ...(todo.displayOrders || {}) };
      if (displayOrder === null) {
        delete newDisplayOrders[tabKey];
      } else {
        newDisplayOrders[tabKey] = displayOrder;
      }
      
      console.log('[DEBUG] 新的 displayOrders:', newDisplayOrders);
      
      await window.electronAPI.todo.update(id, { displayOrders: newDisplayOrders });
      await loadTodos();
      
      console.log('[DEBUG] 数据已重新加载');
      message.success('排序已更新');
    } catch (error) {
      message.error('更新排序失败');
      console.error('Error updating display order:', error);
      throw error;
    }
  };

  // 保存自定义Tab
  const handleSaveCustomTabs = async (tabs: CustomTab[]) => {
    try {
      await window.electronAPI.settings.update({ customTabs: JSON.stringify(tabs) });
      setCustomTabs(tabs);
      await loadSettings();
    } catch (error) {
      message.error('保存自定义Tab失败');
      console.error('Error saving custom tabs:', error);
    }
  };

  // 静默同步并列关系的displayOrder（不显示提示信息）
  const syncParallelGroupsSilently = async () => {
    try {
      const parallelRelations = relations.filter(r => r.relation_type === 'parallel');
      
      if (parallelRelations.length === 0) {
        return; // 静默返回
      }

      // 按关系分组 - 使用图算法找出所有连通分量
      const graph = new Map<number, Set<number>>();
      parallelRelations.forEach(r => {
        if (!graph.has(r.source_id)) graph.set(r.source_id, new Set());
        if (!graph.has(r.target_id)) graph.set(r.target_id, new Set());
        graph.get(r.source_id)!.add(r.target_id);
        graph.get(r.target_id)!.add(r.source_id);
      });

      // DFS找出所有连通分量
      const visited = new Set<number>();
      const groups: Set<number>[] = [];

      const dfs = (nodeId: number, currentGroup: Set<number>) => {
        visited.add(nodeId);
        currentGroup.add(nodeId);
        const neighbors = graph.get(nodeId);
        if (neighbors) {
          neighbors.forEach(neighbor => {
            if (!visited.has(neighbor)) {
              dfs(neighbor, currentGroup);
            }
          });
        }
      };

      graph.forEach((_, nodeId) => {
        if (!visited.has(nodeId)) {
          const group = new Set<number>();
          dfs(nodeId, group);
          groups.push(group);
        }
      });

      // 为每组设置相同的displayOrder
      for (const todoIds of groups) {
        const groupTodos = Array.from(todoIds)
          .map(id => todos.find(t => t.id === id))
          .filter((t): t is Todo => t !== undefined);
        
        if (groupTodos.length === 0) continue;

        // 使用组内最小的displayOrder，如果都没有则使用最小的ID
        const existingOrders = groupTodos
          .map(t => t.displayOrder)
          .filter((o): o is number => o !== undefined && o !== null);
        
        const syncOrder = existingOrders.length > 0 
          ? Math.min(...existingOrders)
          : Math.min(...Array.from(todoIds));

        // 批量更新
        const updates = groupTodos
          .filter(t => t.displayOrder !== syncOrder)
          .map(t => ({
            id: t.id!,
            displayOrder: syncOrder
          }));

        if (updates.length > 0) {
          await window.electronAPI.todo.batchUpdateDisplayOrder(updates);
        }
      }

      await loadTodos();
    } catch (error) {
      console.error('Error syncing parallel groups silently:', error);
      // 静默失败，不打扰用户
    }
  };

  // 获取所有现有标签
  const existingTags = useMemo(() => {
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
  }, [todos]);

  // 统计各状态的待办数量
  const statusCounts = useMemo(() => ({
    all: todos.filter(t => t && t.id).length,
    pending: todos.filter(t => t && t.status === 'pending').length,
    in_progress: todos.filter(t => t && t.status === 'in_progress').length,
    completed: todos.filter(t => t && t.status === 'completed').length,
    paused: todos.filter(t => t && t.status === 'paused').length
  }), [todos]);

  // 根据当前Tab过滤待办事项，并应用排序
  const filteredTodos = useMemo(() => {
    // 获取当前 Tab 的排序设置
    const currentSettings = getCurrentTabSettings();
    const sortOption = currentSettings.sortOption;
    
    const validTodos = todos.filter(todo => todo && todo.id);
    
    // 处理自定义标签Tab
    let filtered: Todo[];
    if (activeTab.startsWith('tag:')) {
      const targetTag = activeTab.replace('tag:', '').trim().toLowerCase();
      filtered = validTodos.filter(todo => {
        if (!todo.tags) return false;
        const tags = todo.tags.split(',')
          .map(t => t.trim().toLowerCase())
          .filter(Boolean);
        return tags.includes(targetTag);
      });
    } else {
      filtered = activeTab === 'all' ? validTodos : validTodos.filter(todo => todo.status === activeTab);
    }
    
    // 构建并列分组（用于所有排序模式）
    const parallelGroups = buildParallelGroups(filtered, relations);
    
    console.log('[DEBUG] parallelGroups size:', parallelGroups.size);
    if (parallelGroups.size > 0) {
      console.log('[DEBUG] parallelGroups:', Array.from(parallelGroups.entries()).map(([id, set]) => ({
        todoId: id,
        groupIds: Array.from(set)
      })));
    }
    
    // 手动排序模式（使用新的 displayOrders）
    if (sortOption === 'manual') {
      console.log('[DEBUG] 手动排序模式, activeTab:', activeTab);
      console.log('[DEBUG] filtered todos:', filtered.map(t => ({ 
        id: t.id, 
        title: t.title, 
        displayOrders: t.displayOrders 
      })));
      
      // 分为有序号和无序号两组（检查当前 tab 的序号）
      const withOrder = filtered.filter(todo => 
        todo.displayOrders && todo.displayOrders[activeTab] != null
      );
      const withoutOrder = filtered.filter(todo => 
        !todo.displayOrders || todo.displayOrders[activeTab] == null
      );
      
      console.log('[DEBUG] withOrder count:', withOrder.length);
      console.log('[DEBUG] withoutOrder count:', withoutOrder.length);
      console.log('[DEBUG] withOrder todos:', withOrder.map(t => ({
        id: t.id,
        order: t.displayOrders![activeTab]
      })));
      
      // 手动排序模式：使用序号比较器选择代表（序号相同时用 ID）
      const manualComparator = (a: Todo, b: Todo) => {
        const orderA = a.displayOrders?.[activeTab];
        const orderB = b.displayOrders?.[activeTab];
        // 如果都有序号，比较序号
        if (orderA != null && orderB != null) {
          if (orderA !== orderB) return orderA - orderB;
        }
        // 序号相同或都没序号，比较 ID
        return (a.id || 0) - (b.id || 0);
      };
      const groupRepresentatives = selectGroupRepresentatives(parallelGroups, filtered, manualComparator);
      console.log('[DEBUG] groupRepresentatives size:', groupRepresentatives.size);
      
      // 使用分组排序（保持并列待办在一起）
      const sorted = sortWithGroups(withOrder, parallelGroups, groupRepresentatives, (a, b) => {
        const orderA = a.displayOrders![activeTab]!;
        const orderB = b.displayOrders![activeTab]!;
        if (orderA !== orderB) return orderA - orderB;
        return (a.id || 0) - (b.id || 0);
      });
      
      console.log('[DEBUG] sorted (有序号):', sorted.map(t => ({
        id: t.id,
        order: t.displayOrders![activeTab]
      })));
      
      // 无序号的按创建时间降序排序（也保持分组）
      const sortedWithoutOrder = sortWithGroups(withoutOrder, parallelGroups, groupRepresentatives, (a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      
      console.log('[DEBUG] sortedWithoutOrder (无序号):', sortedWithoutOrder.map(t => t.id));
      
      // 合并：有序号的在前，无序号的在后
      const result = [...sorted, ...sortedWithoutOrder];
      console.log('[DEBUG] 排序后结果:', result.map(t => ({
        id: t.id,
        title: t.title.substring(0, 10),
        order: t.displayOrders?.[activeTab]
      })));
      return result;
    }
    
    // 其他排序模式：直接使用分组排序
    // 不再分为逾期/活跃/已完成三组，避免拆散并列待办
    console.log('[DEBUG] 非手动排序模式, sortOption:', sortOption);
    
    // 获取排序比较器
    const comparator = getSortComparator(sortOption);
    
    // 使用时间比较器选择代表
    const groupRepresentatives = selectGroupRepresentatives(parallelGroups, filtered, comparator);
    console.log('[DEBUG] groupRepresentatives size:', groupRepresentatives.size);
    
    // 直接对所有待办进行分组排序
    const result = sortWithGroups(filtered, parallelGroups, groupRepresentatives, comparator);
    
    console.log('[DEBUG] 排序后结果:', result.map(t => ({
      id: t.id,
      title: t.title.substring(0, 10),
      createdAt: t.createdAt,
      status: t.status
    })));
    
    return result;
  }, [todos, activeTab, tabSettings, relations, getCurrentTabSettings]);

  // Tab配置
  const tabItems = useMemo(() => {
    const defaultTabs = [
    {
      key: 'all',
      label: `全部 (${statusCounts.all})`,
    },
    {
      key: 'pending',
      label: `待办 (${statusCounts.pending})`,
    },
    {
      key: 'in_progress',
      label: `进行中 (${statusCounts.in_progress})`,
    },
    {
      key: 'completed',
      label: `已完成 (${statusCounts.completed})`,
    },
    {
      key: 'paused',
      label: `已暂停 (${statusCounts.paused})`,
    },
  ];

    // 添加自定义标签Tab
    const customTabItems = customTabs
      .sort((a, b) => a.order - b.order)
      .map(tab => {
        // 类型保护：确保tag是字符串（防止旧数据是数组）
        const tagValue = typeof tab.tag === 'string' ? tab.tag : 
                         Array.isArray(tab.tag) ? tab.tag[0] : 
                         String(tab.tag);
        
        // 计算该标签的待办数量（大小写不敏感）
        const targetTag = tagValue.trim().toLowerCase();
        const count = todos.filter(todo => {
          if (!todo.tags) return false;
          const tags = todo.tags.split(',')
            .map(t => t.trim().toLowerCase())
            .filter(Boolean);
          const matches = tags.includes(targetTag);
          
          // 调试日志
          console.log(`[Tab ${tab.label}] tag="${tagValue}", todo ${todo.id} tags=[${todo.tags}], matches=${matches}`);
          
          return matches;
        }).length;

        console.log(`[Tab ${tab.label}] Final count: ${count}`);

        return {
          key: `tag:${tagValue}`,
          label: `🏷️ ${tab.label} (${count})`,
        };
      });

    return [...defaultTabs, ...customTabItems];
  }, [statusCounts, customTabs, todos]);

  // 使用 useMemo 缓存当前 Tab 的设置
  const currentTabSettings = useMemo(() => getCurrentTabSettings(), [getCurrentTabSettings]);

  // Tab 切换处理（带未保存检查）
  const handleTabChange = useCallback((newTab: string) => {
    // 检查是否有正在保存的数据
    if (savingTodosRef.current.size > 0 || pendingSavesRef.current.size > 0) {
      Modal.confirm({
        title: '有未保存的更改',
        content: `检测到 ${savingTodosRef.current.size} 个待办正在保存，是否等待保存完成？`,
        okText: '等待保存',
        cancelText: '放弃更改',
        onOk: async () => {
          const success = await waitForAllSaves();
          if (success) {
            setActiveTab(newTab);
          }
        },
        onCancel: () => {
          // 清空待保存队列，直接切换
          savingTodosRef.current.clear();
          pendingSavesRef.current.clear();
          setActiveTab(newTab);
        }
      });
    } else {
      setActiveTab(newTab);
    }
  }, [waitForAllSaves]);

  return (
    <Layout style={{ height: '100vh' }} data-theme={themeMode}>
        <Toolbar
          onAddTodo={() => setShowForm(true)}
        onShowSettings={() => setShowSettings(true)}
        onShowSearch={() => setShowSearch(true)}
        onShowExport={() => setShowExport(true)}
        onShowNotes={() => setShowNotes(true)}
        onShowCalendar={() => setShowCalendar(true)}
        onShowCustomTabManager={() => setShowCustomTabManager(true)}
        sortOption={currentTabSettings.sortOption}
        onSortChange={handleSortChange}
        viewMode={currentTabSettings.viewMode}
        onViewModeChange={handleViewModeChange}
      />
        
        <Content className="content-area">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          className="status-tabs"
          size="large"
        />
        <div style={{ marginTop: 16 }}>
          <TodoList
            todos={filteredTodos}
            allTodos={todos}
            loading={loading}
            onEdit={handleEditTodo}
            onView={handleViewTodo}
            onDelete={handleDeleteTodo}
            onStatusChange={handleUpdateTodo}
            onUpdateInPlace={handleUpdateTodoInPlace}
            relations={relations}
            onRelationsChange={loadRelations}
            sortOption={currentTabSettings.sortOption}
            activeTab={activeTab}
            onUpdateDisplayOrder={handleUpdateDisplayOrder}
            viewMode={currentTabSettings.viewMode}
          />
        </div>
      </Content>

      {showForm && (
        <TodoForm
          visible={showForm}
          todo={editingTodo}
          quickCreateContent={quickCreateContent}
          onSubmit={editingTodo ? 
            (data, _pendingRelations) => handleUpdateTodo(editingTodo.id!, data) : 
            handleCreateTodo
          }
          onCancel={handleCloseForm}
          allTodos={todos}
          relations={relations}
        />
      )}

      <SearchModal
        visible={showSearch}
        todos={todos}
        onClose={() => setShowSearch(false)}
        onSelectTodo={(todo) => {
          setShowSearch(false);
          handleEditTodo(todo);
        }}
        onViewTodo={handleViewTodo}
      />

      <ExportModal
        visible={showExport}
        todos={todos}
        onClose={() => setShowExport(false)}
      />

      <SettingsModal
        visible={showSettings}
        settings={settings}
        todos={todos}
        onSave={handleSettingsUpdate}
        onCancel={() => setShowSettings(false)}
        onReload={loadTodos}
      />

      <TodoViewDrawer
        visible={showViewDrawer}
        todo={viewingTodo}
        allTodos={todos}
        relations={relations}
        onClose={() => {
          setShowViewDrawer(false);
          setViewingTodo(null);
        }}
        onEdit={handleEditFromView}
      />

      <NotesDrawer
        visible={showNotes}
        onClose={() => setShowNotes(false)}
      />

      <CalendarDrawer
        visible={showCalendar}
        todos={todos}
        onClose={() => setShowCalendar(false)}
        onSelectTodo={handleEditTodo}
        viewSize={(settings.calendarViewSize as CalendarViewSize) || 'compact'}
      />

      <CustomTabManager
        visible={showCustomTabManager}
        onClose={() => setShowCustomTabManager(false)}
        customTabs={customTabs}
        onSave={handleSaveCustomTabs}
        existingTags={existingTags}
      />

      {/* 回到顶部按钮 */}
      <FloatButton.BackTop
        target={() => document.querySelector('.content-area') as HTMLElement}
        icon={<VerticalAlignTopOutlined />}
        tooltip="回到顶部"
        visibilityHeight={300}
      />

      {/* 快捷键引导 Modal */}
      <Modal
        title="🎉 欢迎使用 MultiTodo"
        open={showHotkeyGuide}
        onOk={() => setShowHotkeyGuide(false)}
        onCancel={() => setShowHotkeyGuide(false)}
        okText="知道了"
        cancelText="关闭"
        width={500}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Typography.Title level={5}>✨ 快速创建待办</Typography.Title>
            <Typography.Paragraph>
              您可以在任何应用中使用全局快捷键快速创建待办：
            </Typography.Paragraph>
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <Tag color="blue" style={{ fontSize: '16px', padding: '8px 16px' }}>
                {navigator.platform.includes('Mac') ? 'Cmd + Shift + T' : 'Ctrl + Shift + T'}
              </Tag>
            </div>
            <Typography.Paragraph type="secondary">
              使用方法：
            </Typography.Paragraph>
            <ul style={{ color: 'rgba(0, 0, 0, 0.45)' }}>
              <li>在任何应用中选中文字或复制图片</li>
              <li>按下快捷键</li>
              <li>MultiTodo 会自动打开并填充内容</li>
            </ul>
          </div>
          <div>
            <Typography.Title level={5}>💡 提示</Typography.Title>
            <Typography.Paragraph type="secondary">
              • 应用关闭后会最小化到系统托盘，不会退出<br />
              • 您可以在设置中查看更多快捷键信息<br />
              • 单击托盘图标可快速显示窗口
            </Typography.Paragraph>
          </div>
        </Space>
      </Modal>
      </Layout>
  );
};

// 外部组件，提供 ConfigProvider 和 App context
const App: React.FC = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  
  // 加载主题设置
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const appSettings = await window.electronAPI.settings.get();
        if (appSettings.theme) {
          setThemeMode(appSettings.theme as ThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  return (
    <ConfigProvider locale={zhCN} theme={getTheme(themeMode)}>
      <AntApp>
        <AppContent themeMode={themeMode} onThemeChange={setThemeMode} />
      </AntApp>
    </ConfigProvider>
  );
};

export default App;

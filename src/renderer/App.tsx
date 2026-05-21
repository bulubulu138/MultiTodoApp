import { Todo, TodoRelation, CalendarViewSize, CustomTab } from '../shared/types';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Layout, App as AntApp, Tabs, ConfigProvider, FloatButton, Modal, Typography, Space, Tag, notification } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { VerticalAlignTopOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import TodoList from './components/TodoList';
import TodoForm from './components/TodoForm';
import TodoPositionSelector, { PositionSelection } from './components/TodoPositionSelector';
import Toolbar, { SortOption, ViewMode } from './components/Toolbar';
import SettingsModal from './components/SettingsModal';
import TodoViewDrawer from './components/TodoViewDrawer';
import CalendarDrawer from './components/CalendarDrawer';
import ContentFocusView, { ContentFocusViewRef } from './components/ContentFocusView';
import CompactTodoView from './components/CompactTodoView';
import FirstRunDialog from './components/FirstRunDialog';
import { getTheme, ThemeMode, ColorTheme } from './theme/themes';
import { buildParallelGroups, selectGroupRepresentatives, sortWithGroups, getSortComparator } from './utils/sortWithGroups';
import { toStringId, areIdsEqual } from '../shared/utils/typeUtils';
import { optimizedMotionVariants, useConditionalAnimation, shouldReduceMotion, useMotionPerformanceMonitor } from './utils/optimizedMotionVariants';
import { PerformanceMonitor } from './utils/performanceMonitor';
import { useGlobalKeyboardHandler } from './hooks/useGlobalKeyboardHandler';
import { syncParallelGroupOrders, computeAllFinalOrders } from './utils/orderConflictResolver';
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
  colorTheme: ColorTheme;
  onColorThemeChange: (theme: ColorTheme) => void;
}

// 内部组件，可以使用 App.useApp()
const AppContent: React.FC<AppContentProps> = ({ themeMode, onThemeChange, colorTheme, onColorThemeChange }) => {
  const { message } = AntApp.useApp();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showViewDrawer, setShowViewDrawer] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [viewingTodo, setViewingTodo] = useState<Todo | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('pending');
  const [relations, setRelations] = useState<TodoRelation[]>([]);
  const [tabSettings, setTabSettings] = useState<TabSettingsMap>({});
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);
  const [quickCreateContent, setQuickCreateContent] = useState<string | null>(null);
  const [showHotkeyGuide, setShowHotkeyGuide] = useState(false);
  const [searchText, setSearchText] = useState<string>('');
  const [debouncedSearchText, setDebouncedSearchText] = useState<string>('');
  const [showPositionSelector, setShowPositionSelector] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<PositionSelection | null>(null);

  // ✅ 新增：首次运行状态
  const [showFirstRunDialog, setShowFirstRunDialog] = useState(false);
  const [storageLocationConfig, setStorageLocationConfig] = useState<any>(null);
  // 分页状态管理
  const [displayCount, setDisplayCount] = useState<number>(50); // 初始显示50条
  const [hasMoreData, setHasMoreData] = useState<boolean>(true); // 是否还有更多数据

  // 拖拽排序状态管理
  const [dragDropOrder, setDragDropOrder] = useState<{ [tabKey: string]: string[] }>({});

  // 搜索结果缓存 - 提升搜索性能
  const searchCacheRef = useRef<Map<string, Todo[]>>(new Map());
  const searchInputTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 保存状态追踪（用于专注模式的乐观更新）
  const savingTodosRef = useRef<Set<string>>(new Set());
  const pendingSavesRef = useRef<Map<string, Promise<void>>>(new Map());
  
  // ContentFocusView 的 ref，用于切换视图时保存
  const contentFocusRef = useRef<ContentFocusViewRef>(null);

  // 启用全局键盘处理 - 防止中文输入法的空格/退格键滚动
  useGlobalKeyboardHandler();

  // 同步 colorTheme 到 documentElement，供 useThemeColors hook 的 MutationObserver 使用
  useEffect(() => {
    document.documentElement.dataset.colorTheme = colorTheme;
  }, [colorTheme]);

  // 性能监控 - 仅在开发环境启用
  const { startMonitoring } = useMotionPerformanceMonitor();
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const cleanup = startMonitoring();
      return cleanup;
    }
  }, [startMonitoring]);

  // 启动全局性能监控（开发环境）
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // 记录初始加载时间
      PerformanceMonitor.start('initial-load');
      
      // 启动定期监控（每60秒）
      const monitoringTimer = PerformanceMonitor.startMonitoring(60000);
      
      return () => {
        if (monitoringTimer) {
          PerformanceMonitor.stopMonitoring(monitoringTimer);
        }
      };
    }
  }, []);

  // Debug logging - Check App mount and API availability
  useEffect(() => {
    console.log('=== App mounted ===');
    console.log('API available:', typeof window.electronAPI !== 'undefined');
    console.log('API keys:', window.electronAPI ? Object.keys(window.electronAPI) : 'undefined');

    if (typeof window.electronAPI === 'undefined') {
      console.error('electronAPI is not available!');
    }
  }, []);

  // 加载数据
  useEffect(() => {
    loadTodos();
    loadSettings();
    loadRelations();
    checkFirstRun(); // ✅ 新增：检查首次运行

    // 记录初始加载完成时间
    if (process.env.NODE_ENV === 'development') {
      setTimeout(() => {
        PerformanceMonitor.end('initial-load');
      }, 100);
    }
  }, []);

  // 监听快速创建待办事件
  useEffect(() => {
    const handleQuickCreate = (data: { content: string }) => {
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

  // 搜索防抖 - 优化到300ms，平衡性能和响应速度
  useEffect(() => {
    // 清除之前的定时器
    if (searchInputTimerRef.current) {
      clearTimeout(searchInputTimerRef.current);
    }

    // 性能优化：使用250ms防抖，在性能和用户体验间找到最佳平衡
    searchInputTimerRef.current = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 250); // 250ms，既减少计算压力又保证响应性

    return () => {
      if (searchInputTimerRef.current) {
        clearTimeout(searchInputTimerRef.current);
      }
    };
  }, [searchText]);

  // 内存管理优化：缓存清理机制
  useEffect(() => {
    // 清理搜索缓存（当待办数据变化时）
    searchCacheRef.current.clear();
  }, [todos]);

  // 定期清理缓存机制
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      // 清理搜索缓存
      if (searchCacheRef.current.size > 20) {
        // 保留最近的20个缓存项，清理其他的
        const entries = Array.from(searchCacheRef.current.entries());
        searchCacheRef.current.clear();

        // 保留最新的20个
        entries.slice(-20).forEach(([key, value]) => {
          searchCacheRef.current.set(key, value);
        });

        console.log(`[内存管理] 清理搜索缓存，保留20项，当前缓存大小: ${searchCacheRef.current.size}`);
      }
    }, 5 * 60 * 1000); // 每5分钟清理一次

    // 页面卸载时清理
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

  // 监听午夜转换事件
  useEffect(() => {
    const handleMidnightConversion = (data: { convertedCount: number }) => {
      if (data.convertedCount > 0) {
        notification.info({
          message: '待办状态更新',
          description: `已将 ${data.convertedCount} 个"今日已完成"项目转换为"已完成"状态`,
          duration: 5
        });

        // 刷新待办列表
        window.location.reload();
      }
    };

    window.electronAPI.onTodayCompletedMidnightConversion(handleMidnightConversion);

    return () => {
      window.electronAPI.removeTodayCompletedListeners();
    };
  }, [message]);

  // 监听页面可见性变化，页面隐藏时自动保存
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // 页面隐藏时，保存所有未保存的内容（如果在专注模式）
        try {
          await contentFocusRef.current?.saveAll();
        } catch (error) {
          console.error('Error saving on visibility change:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
    PerformanceMonitor.start('todo-list-load');
    let duration = 0;

    try {
      setLoading(true);
      const todoList = await window.electronAPI.todo.getAll();
      // 过滤空值，确保数据完整性
      setTodos(todoList.filter(todo => todo && todo.id));

      // 重置分页状态
      setDisplayCount(50);
      setHasMoreData(todoList.length > 50);

      console.log(`[App] ✅ Successfully loaded ${todoList.length} todos`);
      console.log(`[App] Initial display: 50 todos, has more: ${todoList.length > 50}`);

      // 🔍 自动诊断：如果加载的待办数量异常，自动运行诊断
      if (todoList.length < 20 && window.electronAPI.debug) {
        console.warn('[App] ⚠️ Loaded fewer than 20 todos, running automatic diagnostic...');
        try {
          const diagnosticResult = await window.electronAPI.debug.quickDiagnostic();
          console.log('[App] Diagnostic result:', diagnosticResult);

          if (!diagnosticResult.healthy) {
            const issues = diagnosticResult.issues || [];
            const recommendations = diagnosticResult.recommendations || [];

            console.error('[App] ❌ Found health issues:', issues);

            // 如果发现问题，显示提示给用户
            if (issues.length > 0) {
              const issueMsg = issues.join('; ');
              console.warn('[App] Issues found:', issueMsg);
              // 可以考虑显示用户友好的提示
              // message.warning(`检测到数据问题：${issueMsg}`);
            }

            if (recommendations.length > 0) {
              console.log('[App] Recommendations:', recommendations);
            }
          }
        } catch (diagError) {
          console.error('[App] Failed to run diagnostic:', diagError);
        }
      }
    } catch (error) {
      const errorMsg = `加载待办事项失败: ${error instanceof Error ? error.message : '未知错误'}`;
      message.error(errorMsg);
      console.error('[App] ❌ Error loading todos:', error);
      console.error('[App] Detailed error:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    } finally {
      duration = PerformanceMonitor.end('todo-list-load');
      setLoading(false);

      if (process.env.NODE_ENV === 'development') {
        console.log(`[App] [Performance] Todo list loaded in ${duration.toFixed(2)}ms`);
      }
    }
  };

  // ✅ 新增：检查首次运行
  const checkFirstRun = async () => {
    try {
      if (!window.electronAPI?.storageLocation) {
        console.warn('[App] storageLocation API not available');
        return;
      }

      const result = await window.electronAPI.storageLocation.getConfig();
      if (result.success && result.config?.firstRun) {
        console.log('[App] First run detected');
        setStorageLocationConfig(result.config);
        setShowFirstRunDialog(true);
      }
    } catch (error) {
      console.error('[App] Error checking first run:', error);
    }
  };

  // ✅ 新增：处理首次运行完成
  const handleFirstRunComplete = async (location: any) => {
    try {
      console.log('[App] First run setup completed:', location);

      // 更新存储位置配置
      if (window.electronAPI?.storageLocation) {
        await window.electronAPI.storageLocation.setStorageLocation(
          location.type,
          location.customPath
        );
      }

      setShowFirstRunDialog(false);
      setStorageLocationConfig(null);

      message.success('存储位置设置成功！应用将重新启动以应用更改。');

      // 延迟重启，让用户看到成功消息
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('[App] Error completing first run setup:', error);
      message.error('设置失败，请重试');
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


  // 加载更多数据（分页）
  const loadMore = useCallback(() => {
    const newCount = displayCount + 50;
    setDisplayCount(newCount);
    
    // 检查是否还有更多数据
    if (newCount >= todos.length) {
      setHasMoreData(false);
    }
    
    console.log(`[分页] 加载更多数据，当前显示: ${newCount}/${todos.length}`);
  }, [displayCount, todos.length]);

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

  // 监听 Tab 切换
  useEffect(() => {
    const settings = getCurrentTabSettings();
    // Tab切换逻辑处理
  }, [activeTab, getCurrentTabSettings]);

  const handleCreateTodo = async (
    todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      // 获取当前tab的排序设置
      const currentSettings = getCurrentTabSettings();

      const newTodo = currentSettings.sortOption === 'manual'
        ? await window.electronAPI.todo.createManualAtTop(todoData, activeTab)
        : await window.electronAPI.todo.create(todoData);

      // 乐观更新：直接将新待办添加到列表中（避免重新加载320+待办）
      setTodos(prev => [newTodo, ...prev]);

      // 处理位置选择器中选择的关系
      if (pendingPosition && pendingPosition.mode !== 'root' && pendingPosition.targetTodoId) {
        const relationType = pendingPosition.mode === 'extends' ? 'extends' : 'parallel';

        try {
          await window.electronAPI.relations.create({
            source_id: newTodo.id,
            target_id: pendingPosition.targetTodoId,
            relation_type: relationType
          });
          // 只在创建关系时需要刷新关系列表
          await loadRelations();
          message.success('待办事项创建成功，关联关系已建立');
        } catch (error) {
          console.error('Failed to create relation:', error);
          message.error('待办事项创建成功，但关联关系创建失败');
        }

        // 清除待处理的位置
        setPendingPosition(null);
      } else {
        message.success('待办事项创建成功');
      }

      setShowForm(false);
    } catch (error) {
      // 失败时回滚：重新加载确保数据一致性
      await loadTodos();
      message.error('创建待办事项失败');
      console.error('Error creating todo:', error);
    }
  };

  const handleUpdateTodo = async (id: string, updates: Partial<Todo>) => {
    PerformanceMonitor.start('save');
    let duration = 0;

    try {
      await window.electronAPI.todo.update(String(id), updates);

      // 乐观更新：直接更新本地状态而不是重新加载所有待办
      setTodos(prev => {
        return prev.map(todo => {
          if (todo.id === id) {
            return { ...todo, ...updates, updatedAt: new Date().toISOString() };
          }
          return todo;
        });
      });

      setEditingTodo(null);
      message.success('待办事项更新成功');
    } catch (error) {
      // 失败时回滚：重新加载确保数据一致性
      await loadTodos();
      message.error('更新待办事项失败');
      console.error('Error updating todo:', error);
    } finally {
      duration = PerformanceMonitor.end('save');

      if (process.env.NODE_ENV === 'development' && duration > 100) {
        console.warn(`[Performance] Save operation took ${duration.toFixed(2)}ms (threshold: 100ms)`);
      }
    }
  };

  // 新增：内联编辑专用更新函数
  const handleInlineUpdate = useCallback(async (id: string, updates: Partial<Todo>) => {
    console.log('[App] handleInlineUpdate: Starting update', {
      todoId: id,
      updates,
      currentViewingTodo: viewingTodo?.id
    });

    try {
      // 调用后端API保存数据
      await window.electronAPI.todo.update(String(id), updates);
      console.log('[App] handleInlineUpdate: Backend API call successful');

      // 🔧 修复：确保本地状态正确更新
      setTodos(prev => {
        const updated = prev.map(todo => {
          if (todo.id === id) {
            const updatedTodo = { ...todo, ...updates };
            console.log('[App] handleInlineUpdate: Updating todo in list', {
              todoId: id,
              oldTitle: todo.title,
              newTitle: updatedTodo.title
            });
            return updatedTodo;
          }
          return todo;
        });

        // 🔧 修复：同步更新viewingTodo（如果正在查看这个待办）
        if (viewingTodo?.id === id) {
          const updatedViewingTodo = { ...viewingTodo, ...updates };
          console.log('[App] handleInlineUpdate: Updating viewingTodo', {
            todoId: id,
            oldTitle: viewingTodo.title,
            newTitle: updatedViewingTodo.title
          });
          setViewingTodo(updatedViewingTodo);
        }

        return updated;
      });

      console.log('[App] handleInlineUpdate: All state updates completed');
    } catch (error) {
      console.error('[App] handleInlineUpdate: Update failed', {
        todoId: id,
        updates,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }, [viewingTodo]);

  // 🔧 新增：增量刷新机制 - 从文件系统重新加载单个待办
  const handleRefreshTodo = useCallback(async (todoId: string) => {
    try {
      console.log('[App] handleRefreshTodo: Starting refresh', { todoId });

      // 从文件系统获取最新数据
      const latestTodo = await window.electronAPI.todo.getById(String(todoId));

      if (!latestTodo) {
        console.warn('[App] handleRefreshTodo: Todo not found', { todoId });
        return false;
      }

      console.log('[App] handleRefreshTodo: Retrieved latest data', {
        todoId,
        title: latestTodo.title,
        updatedAt: latestTodo.updatedAt
      });

      // 更新todos中的对应项
      setTodos(prev => {
        return prev.map(todo => {
          if (todo.id === todoId) {
            console.log('[App] handleRefreshTodo: Updating todo in list', {
              todoId,
              oldTitle: todo.title,
              newTitle: latestTodo.title,
              oldUpdatedAt: todo.updatedAt,
              newUpdatedAt: latestTodo.updatedAt
            });
            return latestTodo;
          }
          return todo;
        });
      });

      // 如果当前正在查看这个待办，也更新viewingTodo
      if (viewingTodo?.id === todoId) {
        console.log('[App] handleRefreshTodo: Updating viewingTodo');
        setViewingTodo(latestTodo);
      }

      console.log('[App] handleRefreshTodo: Refresh completed successfully');
      return true;
    } catch (error) {
      console.error('[App] handleRefreshTodo: Refresh failed', {
        todoId,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }, [viewingTodo]);

  // 专注模式专用：乐观更新（不刷新页面，保持滚动位置）
  const handleUpdateTodoInPlace = useCallback(async (id: string, updates: Partial<Todo>) => {
    const idString = id;
    // 1. 标记为正在保存
    savingTodosRef.current.add(idString);

    // 2. 乐观更新本地状态（立即生效，不刷新页面）
    setTodos(prev => prev.map(todo => {
      if (!areIdsEqual(todo.id, id)) return todo;

      // 准备乐观更新的数据
      const optimisticUpdates: Partial<Todo> = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // 如果状态改为 completed，设置 completedAt
      if (updates.status === 'completed' && !updates.completedAt) {
        optimisticUpdates.completedAt = new Date().toISOString();
      }
      // 如果从 completed 改为其他状态，清除 completedAt
      else if (updates.status && updates.status !== 'completed' && todo.status === 'completed') {
        optimisticUpdates.completedAt = undefined;
      }

      return { ...todo, ...optimisticUpdates };
    }));

    // 3. 创建保存 Promise 并追踪
    const savePromise = (async () => {
      try {
        await window.electronAPI.todo.update(String(id), updates);
        // 保存成功，移除追踪
        savingTodosRef.current.delete(idString);
        pendingSavesRef.current.delete(idString);
      } catch (error) {
        // 保存失败，移除追踪并回滚
        console.error('Update error:', error);
        savingTodosRef.current.delete(idString);
        pendingSavesRef.current.delete(idString);

        // 重新加载确保数据一致性
        await loadTodos();
        message.error('保存失败，已回滚更改');
      }
    })();

    pendingSavesRef.current.set(idString, savePromise);
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

  const handleDeleteTodo = async (id: string) => {
    try {
      await window.electronAPI.todo.delete(id);
      setTodos(prev => prev.filter(todo => todo.id !== id));
      message.success('待办事项删除成功');
    } catch (error) {
      message.error('删除待办事项失败');
      console.error('Error deleting todo:', error);
    }
  };

  const handleSettingsUpdate = async (newSettings: Record<string, string>, shouldCloseModal: boolean = true) => {
    try {
      await window.electronAPI.settings.update(newSettings);
      setSettings(prev => ({ ...prev, ...newSettings }));

      // 更新主题
      if (newSettings.theme) {
        onThemeChange(newSettings.theme as ThemeMode);
      }

      // 更新颜色主题
      if (newSettings.colorTheme) {
        onColorThemeChange(newSettings.colorTheme as ColorTheme);
      }

      if (shouldCloseModal) {
        setShowSettings(false);
      }
      if (shouldCloseModal) {
        message.success('设置保存成功');
      }
    } catch (error) {
      message.error('保存设置失败');
      console.error('Error updating settings:', error);
    }
  };

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
    setShowForm(true);
  };

  // 处理位置选择
  const handlePositionSelect = (selection: PositionSelection) => {
    setPendingPosition(selection);
    setShowPositionSelector(false);
    // 打开表单
    setShowForm(true);
  };

  const handleClosePositionSelector = () => {
    setShowPositionSelector(false);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingTodo(null);
    setQuickCreateContent(null); // 清空快速创建内容
  };

  const handleViewTodo = useCallback((todo: Todo) => {
    // 🔧 修复：从最新的todos列表中查找待办，确保数据同步
    const latestTodo = todos.find(t => t.id === todo.id);

    if (latestTodo) {
      console.log('[App] handleViewTodo: Found latest todo from list', {
        todoId: todo.id,
        hasUpdate: JSON.stringify(latestTodo) !== JSON.stringify(todo),
        latestTitle: latestTodo.title,
        latestUpdatedAt: latestTodo.updatedAt
      });
      setViewingTodo(latestTodo);
    } else {
      // 如果找不到（可能被删除），使用传入的todo
      console.warn('[App] handleViewTodo: Todo not found in latest list, using provided todo', {
        todoId: todo.id
      });
      setViewingTodo(todo);
    }

    setShowViewDrawer(true);
  }, [todos]);

  // 新增：详情页关闭处理函数
  const handleCloseViewDrawer = useCallback(async () => {
    console.log('[App] handleCloseViewDrawer: Closing drawer', {
      currentViewingTodo: viewingTodo?.id
    });

    // 🔧 新增：增量刷新机制 - 关闭详情页时重新加载当前待办
    if (viewingTodo) {
      console.log('[App] handleCloseViewDrawer: Triggering incremental refresh');

      // 从文件系统重新加载当前待办，确保显示最新数据
      const refreshSuccess = await handleRefreshTodo(viewingTodo.id);

      if (!refreshSuccess) {
        console.warn('[App] handleCloseViewDrawer: Incremental refresh failed, falling back to data consistency check');

        // 🔧 数据一致性检查：确保viewingTodo中的数据已经同步到todos列表
        const todoInList = todos.find(t => t.id === viewingTodo.id);
        if (todoInList) {
          console.log('[App] handleCloseViewDrawer: Data consistency check', {
            todoId: viewingTodo.id,
            listTitle: todoInList.title,
            viewingTitle: viewingTodo.title,
            matches: todoInList.title === viewingTodo.title
          });

          // 如果不一致，使用todos列表中的最新数据
          if (JSON.stringify(todoInList) !== JSON.stringify(viewingTodo)) {
            console.warn('[App] handleCloseViewDrawer: Data inconsistency detected', {
              todoId: viewingTodo.id,
              listUpdatedAt: todoInList.updatedAt,
              viewingUpdatedAt: viewingTodo.updatedAt
            });
          }
        }
      }
    }

    setShowViewDrawer(false);
    setViewingTodo(null);
  }, [viewingTodo, todos, handleRefreshTodo]);

  const handleEditFromView = (todo: Todo) => {
    setShowViewDrawer(false);
    setViewingTodo(null);
    setEditingTodo(todo);
    setShowForm(true);
  };

  const handleUpdateViewingTodo = useCallback((updatedTodo: Todo) => {
    if (viewingTodo && viewingTodo.id === updatedTodo.id) {
      console.log(`[App] Updating viewingTodo: ${updatedTodo.id}`);
      setViewingTodo(updatedTodo);

      // 同时更新todos列表中的对应项，确保数据一致性
      setTodos(prevTodos =>
        prevTodos.map(t => t.id === updatedTodo.id ? updatedTodo : t)
      );
      console.log(`[App] Updated todo in todos list: ${updatedTodo.id}`);
    }
  }, [viewingTodo]);

  const handleSortChange = async (option: SortOption) => {
    updateCurrentTabSettings({ sortOption: option });
  };

  // 获取当前标签的拖拽排序
  const getCurrentDragOrder = useCallback((): string[] | null => {
    if (getCurrentTabSettings().sortOption !== 'drag') {
      return null;
    }
    return dragDropOrder[activeTab] || null;
  }, [dragDropOrder, activeTab, getCurrentTabSettings]);

  // 辅助函数：更新待办事项的 displayOrders
  const updateTodosWithNewDisplayOrders = (todos: Todo[], newOrder: Todo[], tabKey: string): Todo[] => {
    const newOrderMap = new Map(newOrder.map((todo, index) => [todo.id, index]));
    return todos.map(todo => {
      const newDisplayOrder = newOrderMap.get(todo.id);
      if (newDisplayOrder !== undefined) {
        return {
          ...todo,
          displayOrders: {
            ...(todo.displayOrders || {}),
            [tabKey]: newDisplayOrder
          },
          updatedAt: new Date().toISOString()
        };
      }
      return todo;
    });
  };

  // 拖拽结束处理
  const handleDragEnd = async (newOrder: Todo[]) => {
    // 乐观更新本地状态（立即生效）
    setDragDropOrder((prev) => ({
      ...prev,
      [activeTab]: newOrder.map((todo) => todo.id),
    }));

    // 显示保存中状态
    const hide = message.loading('保存中...', 0);

    try {
      // 构建并列分组映射
      const parallelGroupsMap = buildParallelGroups(newOrder, relations);

      // Phase 2 优化：完整预计算（包括并列分组同步和批量冲突解决）
      const allUpdates = computeAllFinalOrders({
        newOrder,
        activeTab,
        parallelGroupsMap,
        allTodos: todos
      });

      // 单次批量更新（替代原来的Promise.all多调用）
      await window.electronAPI.todo.batchUpdateDisplayOrders(allUpdates);

      hide();
      message.success('排序已保存');

      // 更新本地 todos 状态，包含最新的 displayOrders
      setTodos(prevTodos => {
        return updateTodosWithNewDisplayOrders(prevTodos, newOrder, activeTab);
      });

    } catch (error) {
      hide();
      message.error('保存失败');
      console.error('Failed to update drag order:', error);

      // 回滚到之前的状态
      await loadTodos();
    }
  };

  const handleViewModeChange = async (mode: ViewMode) => {
    // 如果从专注模式切换出去，先保存所有未保存的内容
    if (currentTabSettings.viewMode === 'content-focus' && mode !== 'content-focus') {
      try {
        await contentFocusRef.current?.saveAll();
      } catch (error) {
        console.error('Error saving before view change:', error);
        message.error('保存失败，请稍后重试');
        return;
      }
    }

    // 紧凑模式强制使用手动排序
    if (mode === 'compact') {
      updateCurrentTabSettings({ viewMode: mode, sortOption: 'manual' });
    } else {
      updateCurrentTabSettings({ viewMode: mode });
    }
  };

  const handleUpdateDisplayOrder = async (id: string, tabKey: string, displayOrder: number | null) => {
    try {
      // 读取当前 todo 的 displayOrders
      const todo = todos.find(t => t.id === id);
      if (!todo) {
        throw new Error('Todo not found');
      }

      // 更新指定 tab 的序号
      const newDisplayOrders = { ...(todo.displayOrders || {}) };
      if (displayOrder === null) {
        delete newDisplayOrders[tabKey];
      } else {
        newDisplayOrders[tabKey] = displayOrder;
      }

      await window.electronAPI.todo.update(id, { displayOrders: newDisplayOrders });

      // 乐观更新：直接更新本地状态而不是重新加载所有待办
      setTodos(prev => prev.map(t =>
        t.id === id ? { ...t, displayOrders: newDisplayOrders, updatedAt: new Date().toISOString() } : t
      ));

      message.success('排序已更新');
    } catch (error) {
      // 失败时回滚：重新加载确保数据一致性
      await loadTodos();
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
      // 支持数字ID和UUID字符串ID的混合处理
      const graph = new Map<string, Set<string>>();
      parallelRelations.forEach(r => {
        const sourceId = toStringId(r.source_id);
        const targetId = toStringId(r.target_id);
        if (!graph.has(sourceId)) graph.set(sourceId, new Set());
        if (!graph.has(targetId)) graph.set(targetId, new Set());
        graph.get(sourceId)!.add(targetId);
        graph.get(targetId)!.add(sourceId);
      });

      // DFS找出所有连通分量
      const visited = new Set<string>();
      const groups: Set<string>[] = [];

      const dfs = (nodeId: string, currentGroup: Set<string>) => {
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
          const group = new Set<string>();
          dfs(nodeId, group);
          groups.push(group);
        }
      });

      // 为每组设置相同的displayOrder
      for (const todoIds of groups) {
        const groupTodos = Array.from(todoIds)
          .map(id => todos.find(t => areIdsEqual(t.id, id)))
          .filter((t): t is Todo => t !== undefined);

        if (groupTodos.length === 0) continue;

        // 使用组内最小的displayOrder，如果都没有则使用当前时间戳
        const existingOrders = groupTodos
          .map(t => t.displayOrder)
          .filter((o): o is number => o !== undefined && o !== null);

        const syncOrder = existingOrders.length > 0
          ? Math.min(...existingOrders)
          : Date.now();

        // 批量更新 - 使用UUID字符串
        const updates = groupTodos
          .filter(t => t.displayOrder !== syncOrder)
          .map(t => ({
            uuid: String(t.id),
            displayOrder: syncOrder
          }));

        if (updates.length > 0) {
          await window.electronAPI.todo.batchUpdateDisplayOrder(updates);

          // 乐观更新：只更新涉及到的待办项
          setTodos(prev => prev.map(t => {
            const needsUpdate = updates.some(u => u.uuid === String(t.id));
            if (needsUpdate) {
              return { ...t, displayOrder: syncOrder, updatedAt: new Date().toISOString() };
            }
            return t;
          }));
        }
      }
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
    completed: todos.filter(t => t && t.status === 'completed').length
  }), [todos]);

  // 性能优化：分层缓存计算结果
  // 第一层：基础过滤（按Tab状态过滤）
  const baseFilteredTodos = useMemo(() => {
    const validTodos = todos.filter(todo => todo && todo.id);

    // 处理自定义标签Tab
    if (activeTab.startsWith('tag:')) {
      const targetTag = activeTab.replace('tag:', '').trim().toLowerCase();
      return validTodos.filter(todo => {
        if (!todo.tags) return false;
        const tags = todo.tags.split(',')
          .map(t => t.trim().toLowerCase())
          .filter(Boolean);
        return tags.includes(targetTag);
      });
    } else if (activeTab === 'pending') {
      // 待办tab中包含pending和today_completed状态的待办
      return validTodos.filter(todo => todo.status === 'pending' || todo.status === 'today_completed');
    } else if (activeTab === 'completed') {
      // 已完成tab中不包含today_completed状态的待办（它们只显示在待办tab中）
      return validTodos.filter(todo => todo.status === 'completed');
    } else {
      return activeTab === 'all' ? validTodos : validTodos.filter(todo => todo.status === activeTab);
    }
  }, [todos, activeTab]);

  // 第二层：搜索过滤（带缓存优化）
  const searchedTodos = useMemo(() => {
    // 性能优化：最小搜索长度限制，避免短关键词搜索
    if (!debouncedSearchText.trim() || debouncedSearchText.trim().length < 2) {
      return baseFilteredTodos;
    }

    const searchLower = debouncedSearchText.toLowerCase();
    const currentSettings = getCurrentTabSettings();
    const sortOption = currentSettings.sortOption;
    const cacheKey = `${activeTab}-${sortOption}-${searchLower}`;

    // 检查缓存
    if (searchCacheRef.current.has(cacheKey)) {
      return searchCacheRef.current.get(cacheKey)!;
    }

    // 缓存未命中，执行搜索
    PerformanceMonitor.start('search');

    // 性能优化：改进搜索算法，先搜索标题再搜索内容
    const filtered = baseFilteredTodos.filter(todo => {
      // 标题匹配优先级更高
      const titleMatch = todo.title?.toLowerCase().includes(searchLower);
      if (titleMatch) return true;

      // 内容匹配（仅在标题不匹配时检查）
      const contentMatch = todo.content?.toLowerCase().includes(searchLower);
      return contentMatch;
    });

    const duration = PerformanceMonitor.end('search');
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[搜索] 搜索耗时: ${duration.toFixed(2)}ms, 结果数量: ${filtered.length}`);
    }

    // 性能优化：改进缓存策略，LRU缓存
    if (searchCacheRef.current.size >= 30) { // 减少缓存大小
      // 删除最旧的缓存项（简单的LRU实现）
      const firstKey = searchCacheRef.current.keys().next().value;
      if (firstKey !== undefined) {
        searchCacheRef.current.delete(firstKey);
      }
    }
    searchCacheRef.current.set(cacheKey, [...filtered]);

    return filtered;
  }, [baseFilteredTodos, debouncedSearchText, activeTab, getCurrentTabSettings]);

  // 第三层：构建并列关系分组
  const parallelGroups = useMemo(() => {
    return buildParallelGroups(searchedTodos, relations);
  }, [searchedTodos, relations]);

  // 第四层：最终排序结果
  const filteredTodos = useMemo(() => {
    const currentSettings = getCurrentTabSettings();
    const sortOption = currentSettings.sortOption;

    // 拖拽排序模式
    if (sortOption === 'drag') {
      const dragOrder = getCurrentDragOrder();
      if (!dragOrder || dragOrder.length === 0) {
        // 如果没有拖拽排序，使用 displayOrders 作为默认顺序
        const withOrder = searchedTodos.filter(todo =>
          todo.displayOrders && todo.displayOrders[activeTab] != null
        );
        const withoutOrder = searchedTodos.filter(todo =>
          !todo.displayOrders || todo.displayOrders[activeTab] == null
        );

        const manualComparator = (a: Todo, b: Todo) => {
          const orderA = a.displayOrders?.[activeTab];
          const orderB = b.displayOrders?.[activeTab];
          if (orderA != null && orderB != null) {
            if (orderA !== orderB) return orderA - orderB;
          }
          const numA = typeof a.id === 'number' ? a.id : parseInt(String(a.id || 0), 10);
          const numB = typeof b.id === 'number' ? b.id : parseInt(String(b.id || 0), 10);
          return numA - numB;
        };

        const groupRepresentatives = selectGroupRepresentatives(parallelGroups, searchedTodos, manualComparator);

        const sorted = sortWithGroups(withOrder, parallelGroups, groupRepresentatives, (a, b) => {
          const orderA = a.displayOrders![activeTab]!;
          const orderB = b.displayOrders![activeTab]!;
          if (orderA !== orderB) return orderA - orderB;
          const numA = typeof a.id === 'number' ? a.id : parseInt(String(a.id || 0), 10);
          const numB = typeof b.id === 'number' ? b.id : parseInt(String(b.id || 0), 10);
          return numA - numB;
        });

        const sortedWithoutOrder = sortWithGroups(withoutOrder, parallelGroups, groupRepresentatives, (a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return bTime - aTime;
        });

        return [...sorted, ...sortedWithoutOrder];
      }

      // 按照拖拽排序排列
      const todoMap = new Map(searchedTodos.map((todo) => [todo.id, todo]));
      const sorted: Todo[] = [];

      dragOrder.forEach((id) => {
        const todo = todoMap.get(id);
        if (todo) {
          sorted.push(todo);
          todoMap.delete(id);
        }
      });

      // 添加不在拖拽排序中的任务
      todoMap.forEach((todo) => sorted.push(todo));

      return sorted;
    }

    // 手动排序模式
    if (sortOption === 'manual') {
      // 分为有序号和无序号两组
      const withOrder = searchedTodos.filter(todo =>
        todo.displayOrders && todo.displayOrders[activeTab] != null
      );
      const withoutOrder = searchedTodos.filter(todo =>
        !todo.displayOrders || todo.displayOrders[activeTab] == null
      );

      const manualComparator = (a: Todo, b: Todo) => {
        const orderA = a.displayOrders?.[activeTab];
        const orderB = b.displayOrders?.[activeTab];
        if (orderA != null && orderB != null) {
          if (orderA !== orderB) return orderA - orderB;
        }
        // 安全的 ID 比较：先转换为数字再比较
        const numA = typeof a.id === 'number' ? a.id : parseInt(String(a.id || 0), 10);
        const numB = typeof b.id === 'number' ? b.id : parseInt(String(b.id || 0), 10);
        return numA - numB;
      };

      const groupRepresentatives = selectGroupRepresentatives(parallelGroups, searchedTodos, manualComparator);

      const sorted = sortWithGroups(withOrder, parallelGroups, groupRepresentatives, (a, b) => {
        const orderA = a.displayOrders![activeTab]!;
        const orderB = b.displayOrders![activeTab]!;
        if (orderA !== orderB) return orderA - orderB;
        const numA = typeof a.id === 'number' ? a.id : parseInt(String(a.id || 0), 10);
        const numB = typeof b.id === 'number' ? b.id : parseInt(String(b.id || 0), 10);
        return numA - numB;
      });

      const sortedWithoutOrder = sortWithGroups(withoutOrder, parallelGroups, groupRepresentatives, (a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });

      return [...sorted, ...sortedWithoutOrder];
    }

    // 其他排序模式
    const comparator = getSortComparator(sortOption);
    const groupRepresentatives = selectGroupRepresentatives(parallelGroups, searchedTodos, comparator);
    return sortWithGroups(searchedTodos, parallelGroups, groupRepresentatives, comparator);
  }, [searchedTodos, parallelGroups, activeTab, getCurrentTabSettings, getCurrentDragOrder]);

  // 第五层：应用分页限制
  const paginatedTodos = useMemo(() => {
    // 只显示前 displayCount 条数据
    const paginated = filteredTodos.slice(0, displayCount);
    
    // 更新是否还有更多数据的状态
    const hasMore = displayCount < filteredTodos.length;
    if (hasMore !== hasMoreData) {
      setHasMoreData(hasMore);
    }
    
    console.log(`[分页] 总数据: ${filteredTodos.length}, 显示: ${paginated.length}, 还有更多: ${hasMore}`);
    
    return paginated;
  }, [filteredTodos, displayCount, hasMoreData]);

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
          return tags.includes(targetTag);
        }).length;

        return {
          key: `tag:${tagValue}`,
          label: `🏷️ ${tab.label} (${count})`,
        };
      });

    return [...defaultTabs, ...customTabItems];
  }, [statusCounts, customTabs, todos]);

  // 使用 useMemo 缓存当前 Tab 的设置 - 优化：直接依赖activeTab和tabSettings
  const currentTabSettings = useMemo(() => {
    return tabSettings[activeTab] || {
      sortOption: 'createdAt-desc',
      viewMode: 'card'
    };
  }, [activeTab, tabSettings]);

  // Tab 切换处理（带自动保存）
  const handleTabChange = useCallback(async (newTab: string) => {
    // 如果当前在专注模式，先保存所有未保存的内容
    if (currentTabSettings.viewMode === 'content-focus') {
      try {
        await contentFocusRef.current?.saveAll();
      } catch (error) {
        console.error('Error saving before tab change:', error);
        // 保存失败也允许切换，避免阻塞用户操作
      }
    }
    setActiveTab(newTab);
  }, [currentTabSettings.viewMode]);

  return (
    <Layout
      style={{ height: '100vh' }}
      data-theme={themeMode}
      data-color-theme={colorTheme}
    >
        <Toolbar
          onAddTodo={() => setShowPositionSelector(true)}
        onShowSettings={() => setShowSettings(true)}
        onShowCalendar={() => setShowCalendar(true)}
        sortOption={currentTabSettings.sortOption}
        onSortChange={handleSortChange}
        viewMode={currentTabSettings.viewMode}
        onViewModeChange={handleViewModeChange}
        searchText={searchText}
        onSearchChange={setSearchText}
      />
        
        <Content className="content-area">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={tabItems}
          className="status-tabs"
          size="large"
        />
        <div style={{ marginTop: 16, position: 'relative' }}>
          <AnimatePresence mode="sync">
            <motion.div
              key={`${activeTab}-${currentTabSettings.viewMode}`}
              variants={shouldReduceMotion() ? {} : optimizedMotionVariants.pageTransition}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={currentTabSettings.viewMode === 'content-focus' ? {
                height: 'calc(100vh - 73px - 64px - 32px)',
                overflow: 'hidden'
              } : {}}
            >
              {currentTabSettings.viewMode === 'content-focus' ? (
                <ContentFocusView
                  ref={contentFocusRef}
                  todos={filteredTodos}
                  allTodos={todos}
                  loading={loading}
                  onUpdate={handleUpdateTodoInPlace}
                  onView={handleViewTodo}
                  activeTab={activeTab}
                  relations={relations}
                  onUpdateDisplayOrder={handleUpdateDisplayOrder}
                  colorTheme={colorTheme}
                />
              ) : currentTabSettings.viewMode === 'compact' ? (
                <CompactTodoView
                  todos={filteredTodos}
                  allTodos={todos}
                  onUpdate={handleUpdateTodoInPlace}
                  onView={handleViewTodo}
                  activeTab={activeTab}
                  relations={relations}
                  sortOption={currentTabSettings.sortOption}
                  onDragEnd={handleDragEnd}
                />
              ) : (
                <TodoList
                  todos={paginatedTodos}
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
                  enableVirtualScroll={false}
                  hasMoreData={hasMoreData}
                  onLoadMore={loadMore}
                  totalCount={filteredTodos.length}
                  colorTheme={colorTheme}
                  onDragEnd={handleDragEnd}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Content>

      {showPositionSelector && (
        <TodoPositionSelector
          visible={showPositionSelector}
          todos={todos}
          onClose={handleClosePositionSelector}
          onConfirm={handlePositionSelect}
        />
      )}

      {showForm && (
        <TodoForm
          visible={showForm}
          todo={editingTodo}
          quickCreateContent={quickCreateContent}
          onSubmit={editingTodo ?
            (data) => handleUpdateTodo(
              String(editingTodo.id),
              data
            ) :
            handleCreateTodo
          }
          onCancel={handleCloseForm}
          allTodos={todos}
          relations={relations}
        />
      )}

      <SettingsModal
        visible={showSettings}
        settings={settings}
        todos={todos}
        onSave={handleSettingsUpdate}
        onCancel={() => setShowSettings(false)}
        onReload={loadTodos}
        customTabs={customTabs}
        onSaveCustomTabs={handleSaveCustomTabs}
        existingTags={existingTags}
        colorTheme={colorTheme}
        onColorThemeChange={onColorThemeChange}
      />

      <TodoViewDrawer
        visible={showViewDrawer}
        todo={viewingTodo}
        allTodos={todos}
        relations={relations}
        onClose={handleCloseViewDrawer}
        onEdit={handleEditFromView}
        onRelationsChange={loadRelations}
        onTodoUpdate={handleInlineUpdate}
        onUpdateViewingTodo={handleUpdateViewingTodo}
      />

      <CalendarDrawer
        visible={showCalendar}
        todos={todos}
        onClose={() => setShowCalendar(false)}
        onSelectTodo={handleEditTodo}
        viewSize={(settings.calendarViewSize as CalendarViewSize) || 'compact'}
      />

      {/* 回到顶部按钮 */}
      <FloatButton.BackTop
        target={() => {
          // 根据当前视图模式选择正确的滚动容器
          if (currentTabSettings.viewMode === 'content-focus') {
            // 专注模式：使用ContentFocusView内部的滚动容器
            return document.querySelector('.content-focus-scroll-area') as HTMLElement;
          } else {
            // 普通模式：使用全局的.content-area容器
            return document.querySelector('.content-area') as HTMLElement;
          }
        }}
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

      {/* ✅ 新增：首次运行对话框 */}
      <FirstRunDialog
        visible={showFirstRunDialog}
        onComplete={handleFirstRunComplete}
        onCancel={() => setShowFirstRunDialog(false)}
      />
      </Layout>
  );
};

// 外部组件，提供 ConfigProvider 和 App context
const App: React.FC = () => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [colorTheme, setColorTheme] = useState<ColorTheme>('purple');

  // 加载主题设置
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const appSettings = await window.electronAPI.settings.get();
        if (appSettings.theme) {
          setThemeMode(appSettings.theme as ThemeMode);
        }
        if (appSettings.colorTheme) {
          setColorTheme(appSettings.colorTheme as ColorTheme);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      }
    };
    loadTheme();
  }, []);

  const handleColorThemeChange = (theme: ColorTheme) => {
    setColorTheme(theme);
    // Also persist the color theme to settings
    window.electronAPI.settings.update({ colorTheme: theme }).catch(err => {
      console.error('Error saving color theme:', err);
    });
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={getTheme(themeMode, colorTheme)}
      // 性能优化：减少不必要的动画效果
      virtual={false}
      // 优化波纹效果和动画时长
      wave={{ disabled: false }}
    >
      <AntApp>
        <AppContent
          themeMode={themeMode}
          onThemeChange={setThemeMode}
          colorTheme={colorTheme}
          onColorThemeChange={handleColorThemeChange}
        />
      </AntApp>
    </ConfigProvider>
  );
};

export default App;

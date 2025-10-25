import { Todo, TodoRelation, CalendarViewSize, CustomTab } from '../shared/types';
import React, { useState, useEffect, useMemo } from 'react';
import { Layout, App as AntApp, Tabs, ConfigProvider, FloatButton } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { VerticalAlignTopOutlined } from '@ant-design/icons';
import TodoList from './components/TodoList';
import TodoForm from './components/TodoForm';
import Toolbar, { SortOption } from './components/Toolbar';
import SettingsModal from './components/SettingsModal';
import SearchModal from './components/SearchModal';
import ExportModal from './components/ExportModal';
import TodoViewDrawer from './components/TodoViewDrawer';
import NotesDrawer from './components/NotesDrawer';
import CalendarDrawer from './components/CalendarDrawer';
import CustomTabManager from './components/CustomTabManager';
import { getTheme, ThemeMode } from './theme/themes';
import dayjs from 'dayjs';

const { Content } = Layout;

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
  const [sortOption, setSortOption] = useState<SortOption>('createdAt-desc');
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([]);

  // 加载数据
  useEffect(() => {
    loadTodos();
    loadSettings();
    loadRelations();
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
      
      // 加载排序设置
      if (appSettings.sortOption) {
        setSortOption(appSettings.sortOption as SortOption);
      }
    } catch (error) {
      message.error('加载设置失败');
      console.error('Error loading settings:', error);
    }
  };

  const loadRelations = async () => {
    try {
      const allRelations = await window.electronAPI.relations.getAll();
      setRelations(allRelations);
    } catch (error) {
      console.error('Error loading relations:', error);
      message.error('加载关系失败');
    }
  };

  const handleCreateTodo = async (todoData: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await window.electronAPI.todo.create(todoData);
      // 重新加载所有待办，确保数据一致性（与更新操作保持一致）
      await loadTodos();
      // 同时刷新关联关系
      await loadRelations();
      setShowForm(false);
      message.success('待办事项创建成功');
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
    setSortOption(option);
    // 保存到设置
    try {
      await window.electronAPI.settings.update({ 
        ...settings, 
        sortOption: option 
      });
    } catch (error) {
      console.error('Error saving sort option:', error);
    }
  };

  const handleUpdateDisplayOrder = async (id: number, displayOrder: number | null) => {
    try {
      await window.electronAPI.todo.update(id, { displayOrder });
      await loadTodos();
      message.success('排序已更新');
    } catch (error) {
      message.error('更新排序失败');
      console.error('Error updating display order:', error);
      throw error; // 重新抛出错误，让TodoList组件知道保存失败
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
    const validTodos = todos.filter(todo => todo && todo.id);
    
    // 处理自定义标签Tab
    let filtered: Todo[];
    if (activeTab.startsWith('tag:')) {
      const targetTag = activeTab.replace('tag:', '');
      filtered = validTodos.filter(todo => {
        if (!todo.tags) return false;
        const tags = todo.tags.split(',').map(t => t.trim()).filter(Boolean);
        return tags.includes(targetTag);
      });
    } else {
      filtered = activeTab === 'all' ? validTodos : validTodos.filter(todo => todo.status === activeTab);
    }
    
    // 手动排序模式
    if (sortOption === 'manual') {
      // 分为有序号和无序号两组
      const withOrder = filtered.filter(todo => todo.displayOrder != null);
      const withoutOrder = filtered.filter(todo => todo.displayOrder == null);
      
      // 有序号的按序号升序排序
      withOrder.sort((a, b) => a.displayOrder! - b.displayOrder!);
      
      // 无序号的按创建时间降序排序
      withoutOrder.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
      
      // 合并：有序号的在前，无序号的在后
      return [...withOrder, ...withoutOrder];
    }
    
    // 其他排序模式：分为三组：逾期、活跃（待办和进行中）、已完成
    const now = dayjs();
    const overdueTodos: Todo[] = [];
    const activeTodos: Todo[] = [];
    const completedTodos: Todo[] = [];
    
    filtered.forEach(todo => {
      if (todo.status === 'completed') {
        // 已完成的事项单独分组
        completedTodos.push(todo);
      } else if (todo.deadline && dayjs(todo.deadline).isBefore(now)) {
        // 逾期的事项（未完成且已过期）
        overdueTodos.push(todo);
      } else {
        // 活跃的事项（待办、进行中、暂停等）
        activeTodos.push(todo);
      }
    });
    
    // 逾期待办按逾期时长排序（逾期越久越靠前）
    overdueTodos.sort((a, b) => {
      const aDeadline = dayjs(a.deadline!);
      const bDeadline = dayjs(b.deadline!);
      return aDeadline.diff(bDeadline);  // 升序，越早的越靠前
    });
    
    // 根据排序选项对活跃和已完成待办排序
    const sortTodos = (todosToSort: Todo[]) => {
      const [field, order] = sortOption.split('-') as [string, 'asc' | 'desc'];
      
      return [...todosToSort].sort((a, b) => {
        let aValue: string | undefined;
        let bValue: string | undefined;
        
        if (field === 'createdAt') {
          aValue = a.createdAt;
          bValue = b.createdAt;
        } else if (field === 'startTime') {
          aValue = a.startTime;
          bValue = b.startTime;
        } else if (field === 'deadline') {
          aValue = a.deadline;
          bValue = b.deadline;
        } else if (field === 'updatedAt') {
          aValue = a.updatedAt;
          bValue = b.updatedAt;
        }
        
        // 处理空值：将没有对应字段的项放在最后
        if (!aValue && !bValue) return 0;
        if (!aValue) return 1;
        if (!bValue) return -1;
        
        const aTime = new Date(aValue).getTime();
        const bTime = new Date(bValue).getTime();
        
        return order === 'desc' ? bTime - aTime : aTime - bTime;
      });
    };
    
    const sortedActiveTodos = sortTodos(activeTodos);
    const sortedCompletedTodos = sortTodos(completedTodos);
    
    // 合并：逾期 > 活跃 > 已完成（沉底）
    return [...overdueTodos, ...sortedActiveTodos, ...sortedCompletedTodos];
  }, [todos, activeTab, sortOption]);

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
        // 计算该标签的待办数量
        const count = todos.filter(todo => {
          if (!todo.tags) return false;
          const tags = todo.tags.split(',').map(t => t.trim()).filter(Boolean);
          return tags.includes(tab.tag);
        }).length;

        return {
          key: `tag:${tab.tag}`,
          label: `🏷️ ${tab.label} (${count})`,
        };
      });

    return [...defaultTabs, ...customTabItems];
  }, [statusCounts, customTabs, todos]);

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
        sortOption={sortOption}
        onSortChange={handleSortChange}
      />
        
        <Content className="content-area">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
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
            relations={relations}
            onRelationsChange={loadRelations}
            sortOption={sortOption}
            onUpdateDisplayOrder={handleUpdateDisplayOrder}
          />
        </div>
      </Content>

      {showForm && (
        <TodoForm
          visible={showForm}
          todo={editingTodo}
          onSubmit={editingTodo ? 
            (data) => handleUpdateTodo(editingTodo.id!, data) : 
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

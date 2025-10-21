import { Todo, TodoRelation, CalendarViewSize } from '../shared/types';
import React, { useState, useEffect, useMemo } from 'react';
import { Layout, App as AntApp, Tabs, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import TodoList from './components/TodoList';
import TodoForm from './components/TodoForm';
import Toolbar from './components/Toolbar';
import SettingsModal from './components/SettingsModal';
import SearchModal from './components/SearchModal';
import ExportModal from './components/ExportModal';
import TodoViewDrawer from './components/TodoViewDrawer';
import NotesDrawer from './components/NotesDrawer';
import CalendarDrawer from './components/CalendarDrawer';
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
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [viewingTodo, setViewingTodo] = useState<Todo | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string>('all');
  const [relations, setRelations] = useState<TodoRelation[]>([]);

  // 加载数据
  useEffect(() => {
    loadTodos();
    loadSettings();
    loadRelations();
  }, []);

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

  // 统计各状态的待办数量
  const statusCounts = useMemo(() => ({
    all: todos.filter(t => t && t.id).length,
    pending: todos.filter(t => t && t.status === 'pending').length,
    in_progress: todos.filter(t => t && t.status === 'in_progress').length,
    completed: todos.filter(t => t && t.status === 'completed').length,
    paused: todos.filter(t => t && t.status === 'paused').length
  }), [todos]);

  // 根据当前Tab过滤待办事项，并将逾期的置顶
  const filteredTodos = useMemo(() => {
    const validTodos = todos.filter(todo => todo && todo.id);
    const filtered = activeTab === 'all' ? validTodos : validTodos.filter(todo => todo.status === activeTab);
    
    // 分离逾期和非逾期待办
    const now = dayjs();
    const overdueTodos: Todo[] = [];
    const normalTodos: Todo[] = [];
    
    filtered.forEach(todo => {
      if (todo.deadline && 
          todo.status !== 'completed' && 
          dayjs(todo.deadline).isBefore(now)) {
        overdueTodos.push(todo);
      } else {
        normalTodos.push(todo);
      }
    });
    
    // 逾期待办按逾期时长排序（逾期越久越靠前）
    overdueTodos.sort((a, b) => {
      const aDeadline = dayjs(a.deadline!);
      const bDeadline = dayjs(b.deadline!);
      return aDeadline.diff(bDeadline);  // 升序，越早的越靠前
    });
    
    // 非逾期待办保持原有排序（按更新时间）
    normalTodos.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    // 合并：逾期在前
    return [...overdueTodos, ...normalTodos];
  }, [todos, activeTab]);

  // Tab配置
  const tabItems = [
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

  return (
    <Layout style={{ height: '100vh' }} data-theme={themeMode}>
        <Toolbar
          onAddTodo={() => setShowForm(true)}
        onShowSettings={() => setShowSettings(true)}
        onShowSearch={() => setShowSearch(true)}
        onShowExport={() => setShowExport(true)}
        onShowNotes={() => setShowNotes(true)}
        onShowCalendar={() => setShowCalendar(true)}
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
      />

      <ExportModal
        visible={showExport}
        todos={todos}
        onClose={() => setShowExport(false)}
      />

      <SettingsModal
        visible={showSettings}
        settings={settings}
        onSave={handleSettingsUpdate}
        onCancel={() => setShowSettings(false)}
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

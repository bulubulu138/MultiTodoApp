import { Todo, TodoRelation, CustomTab, Settings } from '../../shared/types';
import { SortOption, ViewMode } from '../components/Toolbar';

// App 状态类型定义
export interface AppState {
  // 数据状态
  todos: Todo[];
  relations: TodoRelation[];
  settings: Record<string, string>;
  customTabs: CustomTab[];

  // UI 状态
  loading: boolean;
  showForm: boolean;
  showSettings: boolean;
  showExport: boolean;
  showViewDrawer: boolean;
  showNotes: boolean;
  showCalendar: boolean;
  showCustomTabManager: boolean;
  showHotkeyGuide: boolean;
  editingTodo: Todo | null;
  viewingTodo: Todo | null;
  quickCreateContent: string | null;

  // 交互状态
  activeTab: string;
  searchText: string;
  debouncedSearchText: string;
  sortOption?: SortOption;
  viewMode?: ViewMode;
}

// 动作类型定义
export type AppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_TODOS'; payload: Todo[] }
  | { type: 'ADD_TODO'; payload: Todo }
  | { type: 'UPDATE_TODO'; payload: { id: number; updates: Partial<Todo> } }
  | { type: 'DELETE_TODO'; payload: number }
  | { type: 'SET_RELATIONS'; payload: TodoRelation[] }
  | { type: 'ADD_RELATION'; payload: TodoRelation }
  | { type: 'DELETE_RELATION'; payload: number }
  | { type: 'SET_SETTINGS'; payload: Record<string, string> }
  | { type: 'UPDATE_SETTING'; payload: { key: string; value: string } }
  | { type: 'SET_CUSTOM_TABS'; payload: CustomTab[] }
  | { type: 'ADD_CUSTOM_TAB'; payload: CustomTab }
  | { type: 'UPDATE_CUSTOM_TAB'; payload: { id: string; updates: Partial<CustomTab> } }
  | { type: 'DELETE_CUSTOM_TAB'; payload: string }
  | { type: 'SET_ACTIVE_TAB'; payload: string }
  | { type: 'SET_SEARCH_TEXT'; payload: string }
  | { type: 'SET_DEBOUNCED_SEARCH_TEXT'; payload: string }
  | { type: 'SET_SORT_OPTION'; payload: SortOption }
  | { type: 'SET_VIEW_MODE'; payload: ViewMode }
  | { type: 'SHOW_FORM'; payload: boolean }
  | { type: 'SHOW_SETTINGS'; payload: boolean }
  | { type: 'SHOW_EXPORT'; payload: boolean }
  | { type: 'SHOW_VIEW_DRAWER'; payload: boolean }
  | { type: 'SHOW_NOTES'; payload: boolean }
  | { type: 'SHOW_CALENDAR'; payload: boolean }
  | { type: 'SHOW_CUSTOM_TAB_MANAGER'; payload: boolean }
  | { type: 'SHOW_HOTKEY_GUIDE'; payload: boolean }
  | { type: 'SET_EDITING_TODO'; payload: Todo | null }
  | { type: 'SET_VIEWING_TODO'; payload: Todo | null }
  | { type: 'SET_QUICK_CREATE_CONTENT'; payload: string | null }
  | { type: 'BULK_UPDATE_TODOS'; payload: Array<{ id: number; updates: Partial<Todo> }> }
  | { type: 'TOGGLE_FORM' }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_EXPORT' }
  | { type: 'TOGGLE_VIEW_DRAWER' }
  | { type: 'TOGGLE_NOTES' }
  | { type: 'TOGGLE_CALENDAR' }
  | { type: 'TOGGLE_CUSTOM_TAB_MANAGER' }
  | { type: 'TOGGLE_HOTKEY_GUIDE' };

// 初始状态
export const initialAppState: AppState = {
  todos: [],
  relations: [],
  settings: {},
  customTabs: [],
  loading: true,
  showForm: false,
  showSettings: false,
  showExport: false,
  showViewDrawer: false,
  showNotes: false,
  showCalendar: false,
  showCustomTabManager: false,
  showHotkeyGuide: false,
  editingTodo: null,
  viewingTodo: null,
  quickCreateContent: null,
  activeTab: 'all',
  searchText: '',
  debouncedSearchText: '',
  sortOption: undefined,
  viewMode: undefined,
};

// Reducer 函数
export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_TODOS':
      return { ...state, todos: action.payload };

    case 'ADD_TODO':
      return { ...state, todos: [...state.todos, action.payload] };

    case 'UPDATE_TODO':
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === action.payload.id ? { ...todo, ...action.payload.updates } : todo
        )
      };

    case 'DELETE_TODO':
      return {
        ...state,
        todos: state.todos.filter(todo => todo.id !== action.payload)
      };

    case 'BULK_UPDATE_TODOS':
      return {
        ...state,
        todos: state.todos.map(todo => {
          const update = action.payload.find(u => u.id === todo.id);
          return update ? { ...todo, ...update.updates } : todo;
        })
      };

    case 'SET_RELATIONS':
      return { ...state, relations: action.payload };

    case 'ADD_RELATION':
      return { ...state, relations: [...state.relations, action.payload] };

    case 'DELETE_RELATION':
      return {
        ...state,
        relations: state.relations.filter(relation => relation.id !== action.payload)
      };

    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };

    case 'UPDATE_SETTING':
      return {
        ...state,
        settings: { ...state.settings, [action.payload.key]: action.payload.value }
      };

    case 'SET_CUSTOM_TABS':
      return { ...state, customTabs: action.payload };

    case 'ADD_CUSTOM_TAB':
      return { ...state, customTabs: [...state.customTabs, action.payload] };

    case 'UPDATE_CUSTOM_TAB':
      return {
        ...state,
        customTabs: state.customTabs.map(tab =>
          tab.id === action.payload.id ? { ...tab, ...action.payload.updates } : tab
        )
      };

    case 'DELETE_CUSTOM_TAB':
      return {
        ...state,
        customTabs: state.customTabs.filter(tab => tab.id !== action.payload)
      };

    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };

    case 'SET_SEARCH_TEXT':
      return { ...state, searchText: action.payload };

    case 'SET_DEBOUNCED_SEARCH_TEXT':
      return { ...state, debouncedSearchText: action.payload };

    case 'SET_SORT_OPTION':
      return { ...state, sortOption: action.payload };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };

    case 'SHOW_FORM':
      return { ...state, showForm: action.payload };

    case 'SHOW_SETTINGS':
      return { ...state, showSettings: action.payload };

    case 'SHOW_EXPORT':
      return { ...state, showExport: action.payload };

    case 'SHOW_VIEW_DRAWER':
      return { ...state, showViewDrawer: action.payload };

    case 'SHOW_NOTES':
      return { ...state, showNotes: action.payload };

    case 'SHOW_CALENDAR':
      return { ...state, showCalendar: action.payload };

    case 'SHOW_CUSTOM_TAB_MANAGER':
      return { ...state, showCustomTabManager: action.payload };

    case 'SHOW_HOTKEY_GUIDE':
      return { ...state, showHotkeyGuide: action.payload };

    case 'SET_EDITING_TODO':
      return { ...state, editingTodo: action.payload };

    case 'SET_VIEWING_TODO':
      return { ...state, viewingTodo: action.payload };

    case 'SET_QUICK_CREATE_CONTENT':
      return { ...state, quickCreateContent: action.payload };

    case 'TOGGLE_FORM':
      return { ...state, showForm: !state.showForm };

    case 'TOGGLE_SETTINGS':
      return { ...state, showSettings: !state.showSettings };

    case 'TOGGLE_EXPORT':
      return { ...state, showExport: !state.showExport };

    case 'TOGGLE_VIEW_DRAWER':
      return { ...state, showViewDrawer: !state.showViewDrawer };

    case 'TOGGLE_NOTES':
      return { ...state, showNotes: !state.showNotes };

    case 'TOGGLE_CALENDAR':
      return { ...state, showCalendar: !state.showCalendar };

    case 'TOGGLE_CUSTOM_TAB_MANAGER':
      return { ...state, showCustomTabManager: !state.showCustomTabManager };

    case 'TOGGLE_HOTKEY_GUIDE':
      return { ...state, showHotkeyGuide: !state.showHotkeyGuide };

    default:
      return state;
  }
};

// Action creators for convenience
export const createAppActions = {
  setLoading: (payload: boolean): AppAction => ({ type: 'SET_LOADING', payload }),
  setTodos: (payload: Todo[]): AppAction => ({ type: 'SET_TODOS', payload }),
  addTodo: (payload: Todo): AppAction => ({ type: 'ADD_TODO', payload }),
  updateTodo: (id: number, updates: Partial<Todo>): AppAction => ({
    type: 'UPDATE_TODO',
    payload: { id, updates }
  }),
  deleteTodo: (payload: number): AppAction => ({ type: 'DELETE_TODO', payload }),
  bulkUpdateTodos: (payload: Array<{ id: number; updates: Partial<Todo> }>): AppAction => ({
    type: 'BULK_UPDATE_TODOS',
    payload
  }),
  setRelations: (payload: TodoRelation[]): AppAction => ({ type: 'SET_RELATIONS', payload }),
  addRelation: (payload: TodoRelation): AppAction => ({ type: 'ADD_RELATION', payload }),
  deleteRelation: (payload: number): AppAction => ({ type: 'DELETE_RELATION', payload }),
  setSettings: (payload: Record<string, string>): AppAction => ({ type: 'SET_SETTINGS', payload }),
  updateSetting: (key: string, value: string): AppAction => ({
    type: 'UPDATE_SETTING',
    payload: { key, value }
  }),
  setCustomTabs: (payload: CustomTab[]): AppAction => ({ type: 'SET_CUSTOM_TABS', payload }),
  addCustomTab: (payload: CustomTab): AppAction => ({ type: 'ADD_CUSTOM_TAB', payload }),
  updateCustomTab: (id: string, updates: Partial<CustomTab>): AppAction => ({
    type: 'UPDATE_CUSTOM_TAB',
    payload: { id, updates }
  }),
  deleteCustomTab: (payload: string): AppAction => ({ type: 'DELETE_CUSTOM_TAB', payload }),
  setActiveTab: (payload: string): AppAction => ({ type: 'SET_ACTIVE_TAB', payload }),
  setSearchText: (payload: string): AppAction => ({ type: 'SET_SEARCH_TEXT', payload }),
  setDebouncedSearchText: (payload: string): AppAction => ({ type: 'SET_DEBOUNCED_SEARCH_TEXT', payload }),
  setSortOption: (payload: SortOption): AppAction => ({ type: 'SET_SORT_OPTION', payload }),
  setViewMode: (payload: ViewMode): AppAction => ({ type: 'SET_VIEW_MODE', payload }),
  showForm: (payload: boolean): AppAction => ({ type: 'SHOW_FORM', payload }),
  showSettings: (payload: boolean): AppAction => ({ type: 'SHOW_SETTINGS', payload }),
  showExport: (payload: boolean): AppAction => ({ type: 'SHOW_EXPORT', payload }),
  showViewDrawer: (payload: boolean): AppAction => ({ type: 'SHOW_VIEW_DRAWER', payload }),
  showNotes: (payload: boolean): AppAction => ({ type: 'SHOW_NOTES', payload }),
  showCalendar: (payload: boolean): AppAction => ({ type: 'SHOW_CALENDAR', payload }),
  showCustomTabManager: (payload: boolean): AppAction => ({ type: 'SHOW_CUSTOM_TAB_MANAGER', payload }),
  showHotkeyGuide: (payload: boolean): AppAction => ({ type: 'SHOW_HOTKEY_GUIDE', payload }),
  setEditingTodo: (payload: Todo | null): AppAction => ({ type: 'SET_EDITING_TODO', payload }),
  setViewingTodo: (payload: Todo | null): AppAction => ({ type: 'SET_VIEWING_TODO', payload }),
  setQuickCreateContent: (payload: string | null): AppAction => ({ type: 'SET_QUICK_CREATE_CONTENT', payload }),
  toggleForm: (): AppAction => ({ type: 'TOGGLE_FORM' }),
  toggleSettings: (): AppAction => ({ type: 'TOGGLE_SETTINGS' }),
  toggleExport: (): AppAction => ({ type: 'TOGGLE_EXPORT' }),
  toggleViewDrawer: (): AppAction => ({ type: 'TOGGLE_VIEW_DRAWER' }),
  toggleNotes: (): AppAction => ({ type: 'TOGGLE_NOTES' }),
  toggleCalendar: (): AppAction => ({ type: 'TOGGLE_CALENDAR' }),
  toggleCustomTabManager: (): AppAction => ({ type: 'TOGGLE_CUSTOM_TAB_MANAGER' }),
  toggleHotkeyGuide: (): AppAction => ({ type: 'TOGGLE_HOTKEY_GUIDE' }),
};
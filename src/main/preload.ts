import { contextBridge, ipcRenderer } from 'electron';
import type { Note } from '../shared/types';

// 定义API接口
export interface ElectronAPI {
  // 待办事项API
  todo: {
    getAll: () => Promise<any[]>;
    create: (todo: any) => Promise<any>;
    createManualAtTop: (todo: any, tabKey: string) => Promise<any>;
    update: (id: number, updates: any) => Promise<any>;
    delete: (id: number) => Promise<boolean>;
    generateHash: (title: string, content: string) => Promise<string>;
    findDuplicate: (contentHash: string, excludeId?: number) => Promise<any | null>;
    batchUpdateDisplayOrder: (updates: {id: number, displayOrder: number}[]) => Promise<void>;
    batchUpdateDisplayOrders: (updates: {id: number, tabKey: string, displayOrder: number}[]) => Promise<void>;
    bulkUpdateTodos: (updates: Array<{id: number; updates: any}>) => Promise<void>;
    bulkDeleteTodos: (ids: number[]) => Promise<void>;
  };
  
  // 关键词和推荐API
  keywords: {
    getRecommendations: (title: string, content: string, excludeId?: number) => Promise<any[]>;
    batchGenerate: () => Promise<{success: boolean; total?: number; processed?: number; failed?: number; error?: string}>;
  };
  
  // AI API
  ai: {
    testConnection: () => Promise<{success: boolean; message: string}>;
    configure: (provider: string, apiKey: string, endpoint?: string) => Promise<{success: boolean; error?: string}>;
    getConfig: () => Promise<{provider: string; endpoint: string; enabled: boolean}>;
    getSupportedProviders: () => Promise<Array<{value: string; label: string; endpoint: string}>>;
  };
  
  // 设置API
  settings: {
    get: (key?: string) => Promise<any>;
    update: (settings: any) => Promise<any>;
    openDataFolder: () => Promise<{success: boolean; error?: string}>;
  };
  
  // 图片API
  image: {
    upload: () => Promise<string | null>;
    delete: (filepath: string) => Promise<boolean>;
    readLocalFile: (filepath: string) => Promise<ArrayBuffer>;
  };
  
  // 文件API
  file: {
    exists: (filepath: string) => Promise<boolean>;
  };
  
  // 关系API
  relations: {
    getAll: () => Promise<any[]>;
    getByTodoId: (todoId: number) => Promise<any[]>;
    getByType: (relationType: string) => Promise<any[]>;
    create: (relation: any) => Promise<number>;
    delete: (id: number) => Promise<void>;
    deleteByTodoId: (todoId: number) => Promise<void>;
    deleteSpecific: (sourceId: number, targetId: number, relationType: string) => Promise<void>;
    exists: (sourceId: number, targetId: number, relationType: string) => Promise<boolean>;
    buildTree: () => Promise<{roots: any[]; relations: any[]}>;
  };
  
  // 心得API
  notes: {
    getAll: () => Promise<Note[]>;
    create: (noteData: Pick<Note, 'title' | 'content'>) => Promise<Note>;
    update: (id: number, updates: Partial<Pick<Note, 'title' | 'content'>>) => Promise<void>;
    delete: (id: number) => Promise<void>;
  };
  
  // 备份API
  backup: {
    list: () => Promise<any[]>;
    create: () => Promise<any>;
    restore: (backupPath: string) => Promise<void>;
  };
  
  // 流程图API
  flowchart: {
    getAssociationsByTodoIds: (todoIds: number[]) => Promise<Record<number, Array<{
      flowchartId: string;
      flowchartName: string;
      nodeId: string;
      nodeLabel: string;
    }>>>;
    save: (flowchartData: any) => Promise<{success: boolean}>;
    load: (flowchartId: string) => Promise<any | null>;
    list: () => Promise<any[]>;
    delete: (flowchartId: string) => Promise<{success: boolean}>;
    savePatches: (flowchartId: string, patches: any[]) => Promise<{success: boolean}>;
  };
  
  // 流程图与待办关联API（流程图级别）
  flowchartTodoAssociation: {
    create: (flowchartId: string, todoId: number) => Promise<{success: boolean}>;
    delete: (flowchartId: string, todoId: number) => Promise<{success: boolean}>;
    queryByFlowchart: (flowchartId: string) => Promise<number[]>;
    queryByTodo: (todoId: number) => Promise<Array<{
      flowchartId: string;
      flowchartName: string;
      flowchartDescription?: string;
      createdAt: number;
    }>>;
    queryByTodos: (todoIds: number[]) => Promise<Record<number, Array<{
      flowchartId: string;
      flowchartName: string;
      flowchartDescription?: string;
      createdAt: number;
    }>>>;
  };

  // 流程图迁移API
  flowchartMigration: {
    getStatus: () => Promise<{
      hasLegacyFlowcharts: boolean;
      flowchartCount: number;
      totalNodes: number;
      totalEdges: number;
      canMigrate: boolean;
    }>;
    getFlowcharts: () => Promise<Array<{
      id: string;
      name: string;
      description: string | null;
      nodes: any[];
      edges: any[];
      created_at: number;
      updated_at: number;
    }>>;
    migrate: (options: {createNewTodos?: boolean; targetTodoId?: number}) => Promise<{
      success: boolean;
      migratedCount: number;
      skippedCount: number;
      errors: string[];
      details: Array<{
        flowchartId: string;
        flowchartName: string;
        success: boolean;
        todoId?: number;
        error?: string;
      }>;
    }>;
    cleanup: () => Promise<{success: boolean; error?: string}>;
    verify: () => Promise<{success: boolean; message: string; remainingFlowcharts: number}>;
  };

  // Shell API
  openExternal: (url: string) => Promise<{success: boolean; error?: string}>;

  // URL标题API
  urlTitles: {
    fetchBatch: (urls: string[]) => Promise<Record<string, string>>;
  };

  // URL授权API
  urlAuth: {
    authorize: (url: string) => Promise<{success: boolean; title?: string; error?: string}>;
    refreshTitle: (url: string) => Promise<{success: boolean; title?: string; error?: string}>;
    getAllAuthorizations: () => Promise<Array<{
      id: number;
      url: string;
      domain: string;
      title: string | null;
      first_authorized_at: string;
      last_refreshed_at: string;
      refresh_count: number;
      status: 'active' | 'expired' | 'failed';
      error_message: string | null;
      created_at: string;
      updated_at: string;
    }>>;
    getAllUrls: () => Promise<{
      success: boolean;
      data?: Array<{
        url: string;
        todoId: number;
        hasAuthorization: boolean;
        authorization: {
          id: number;
          url: string;
          domain: string;
          title: string | null;
          first_authorized_at: string;
          last_refreshed_at: string;
          refresh_count: number;
          status: 'active' | 'expired' | 'failed';
          error_message: string | null;
          created_at: string;
          updated_at: string;
        } | null;
      }>;
      error?: string;
    }>;
    refreshAll: () => Promise<{success: boolean; successCount?: number; failedCount?: number; error?: string}>;
    cleanup: () => Promise<{success: boolean; count?: number; error?: string}>;
    delete: (url: string) => Promise<{success: boolean; error?: string}>;
    getTitles: (urls: string[]) => Promise<Record<string, string>>;
    initialize: () => Promise<{success: boolean; count?: number; error?: string}>;
  };

  // 快速创建待办 API
  onQuickCreateTodo: (callback: (data: { content: string }) => void) => void;
  removeQuickCreateListener: () => void;
}

// 暴露API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  todo: {
    getAll: () => ipcRenderer.invoke('todo:getAll'),
    create: (todo: any) => ipcRenderer.invoke('todo:create', todo),
    createManualAtTop: (todo: any, tabKey: string) => ipcRenderer.invoke('todo:createManualAtTop', todo, tabKey),
    update: (id: number, updates: any) => ipcRenderer.invoke('todo:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('todo:delete', id),
    generateHash: (title: string, content: string) => ipcRenderer.invoke('todo:generateHash', title, content),
    findDuplicate: (contentHash: string, excludeId?: number) => ipcRenderer.invoke('todo:findDuplicate', contentHash, excludeId),
    batchUpdateDisplayOrder: (updates: {id: number, displayOrder: number}[]) => ipcRenderer.invoke('todo:batchUpdateDisplayOrder', updates),
    batchUpdateDisplayOrders: (updates: {id: number, tabKey: string, displayOrder: number}[]) => ipcRenderer.invoke('todo:batchUpdateDisplayOrders', updates),
    bulkUpdateTodos: (updates: Array<{id: number; updates: any}>) => ipcRenderer.invoke('todo:bulkUpdateTodos', updates),
    bulkDeleteTodos: (ids: number[]) => ipcRenderer.invoke('todo:bulkDeleteTodos', ids),
  },
  keywords: {
    getRecommendations: (title: string, content: string, excludeId?: number) => 
      ipcRenderer.invoke('keywords:getRecommendations', title, content, excludeId),
    batchGenerate: () => ipcRenderer.invoke('keywords:batchGenerate'),
  },
  ai: {
    testConnection: () => ipcRenderer.invoke('ai:testConnection'),
    configure: (provider: string, apiKey: string, endpoint?: string) => 
      ipcRenderer.invoke('ai:configure', provider, apiKey, endpoint),
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    getSupportedProviders: () => ipcRenderer.invoke('ai:getSupportedProviders'),
  },
  settings: {
    get: (key?: string) => ipcRenderer.invoke(key === 'dbPath' ? 'settings:getDbPath' : 'settings:get'),
    update: (settings: any) => ipcRenderer.invoke('settings:update', settings),
    openDataFolder: () => ipcRenderer.invoke('settings:openDataFolder'),
  },
  image: {
    upload: () => ipcRenderer.invoke('image:upload'),
    delete: (filepath: string) => ipcRenderer.invoke('image:delete', filepath),
    readLocalFile: (filepath: string) => ipcRenderer.invoke('image:readLocalFile', filepath),
  },
  file: {
    exists: (filepath: string) => ipcRenderer.invoke('file:exists', filepath),
  },
  relations: {
    getAll: () => ipcRenderer.invoke('relations:getAll'),
    getByTodoId: (todoId: number) => ipcRenderer.invoke('relations:getByTodoId', todoId),
    getByType: (relationType: string) => ipcRenderer.invoke('relations:getByType', relationType),
    create: (relation: any) => ipcRenderer.invoke('relations:create', relation),
    delete: (id: number) => ipcRenderer.invoke('relations:delete', id),
    deleteByTodoId: (todoId: number) => ipcRenderer.invoke('relations:deleteByTodoId', todoId),
    deleteSpecific: (sourceId: number, targetId: number, relationType: string) =>
      ipcRenderer.invoke('relations:deleteSpecific', sourceId, targetId, relationType),
    exists: (sourceId: number, targetId: number, relationType: string) =>
      ipcRenderer.invoke('relations:exists', sourceId, targetId, relationType),
    buildTree: () => ipcRenderer.invoke('relations:buildTree'),
  },
  notes: {
    getAll: () => ipcRenderer.invoke('notes:getAll'),
    create: (noteData: any) => ipcRenderer.invoke('notes:create', noteData),
    update: (id: number, updates: any) => ipcRenderer.invoke('notes:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id),
  },
  backup: {
    list: () => ipcRenderer.invoke('backup:list'),
    create: () => ipcRenderer.invoke('backup:create'),
    restore: (backupPath: string) => ipcRenderer.invoke('backup:restore', backupPath),
  },
  flowchart: {
    getAssociationsByTodoIds: (todoIds: number[]) => 
      ipcRenderer.invoke('flowchart:getAssociationsByTodoIds', todoIds),
    save: (flowchartData: any) => 
      ipcRenderer.invoke('flowchart:save', flowchartData),
    load: (flowchartId: string) => 
      ipcRenderer.invoke('flowchart:load', flowchartId),
    list: () => 
      ipcRenderer.invoke('flowchart:list'),
    delete: (flowchartId: string) => 
      ipcRenderer.invoke('flowchart:delete', flowchartId),
    savePatches: (flowchartId: string, patches: any[]) => 
      ipcRenderer.invoke('flowchart:savePatches', flowchartId, patches),
  },
  flowchartTodoAssociation: {
    create: (flowchartId: string, todoId: number) =>
      ipcRenderer.invoke('flowchart-todo-association:create', flowchartId, todoId),
    delete: (flowchartId: string, todoId: number) =>
      ipcRenderer.invoke('flowchart-todo-association:delete', flowchartId, todoId),
    queryByFlowchart: (flowchartId: string) =>
      ipcRenderer.invoke('flowchart-todo-association:query-by-flowchart', flowchartId),
    queryByTodo: (todoId: number) =>
      ipcRenderer.invoke('flowchart-todo-association:query-by-todo', todoId),
    queryByTodos: (todoIds: number[]) =>
      ipcRenderer.invoke('flowchart-todo-association:query-by-todos', todoIds),
  },
  flowchartMigration: {
    getStatus: () => ipcRenderer.invoke('flowchart-migration:getStatus'),
    getFlowcharts: () => ipcRenderer.invoke('flowchart-migration:getFlowcharts'),
    migrate: (options) => ipcRenderer.invoke('flowchart-migration:migrate', options),
    cleanup: () => ipcRenderer.invoke('flowchart-migration:cleanup'),
    verify: () => ipcRenderer.invoke('flowchart-migration:verify'),
  },
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // URL标题API
  urlTitles: {
    fetchBatch: (urls: string[]) => ipcRenderer.invoke('url-titles:fetch-batch', urls),
  },

  // URL授权API
  urlAuth: {
    authorize: (url: string) => ipcRenderer.invoke('url:authorize', url),
    refreshTitle: (url: string) => ipcRenderer.invoke('url:refreshTitle', url),
    getAllAuthorizations: () => ipcRenderer.invoke('url-auth:getAll'),
    getAllUrls: () => ipcRenderer.invoke('url-auth:getAllUrls'),
    refreshAll: () => ipcRenderer.invoke('url-auth:refresh'),
    cleanup: () => ipcRenderer.invoke('url-auth:cleanup'),
    delete: (url: string) => ipcRenderer.invoke('url-auth:delete', url),
    getTitles: (urls: string[]) => ipcRenderer.invoke('url-auth:getTitles', urls),
    initialize: () => ipcRenderer.invoke('url-auth:initialize'),
  },

  // 快速创建待办
  onQuickCreateTodo: (callback: (data: { content: string }) => void) => {
    ipcRenderer.on('quick-create-todo', (_event, data) => callback(data));
  },
  removeQuickCreateListener: () => {
    ipcRenderer.removeAllListeners('quick-create-todo');
  },
} as ElectronAPI);

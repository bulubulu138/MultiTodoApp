import { contextBridge, ipcRenderer } from 'electron';
import type { TodoRelation } from '../shared/types';

/**
 * 批量授权结果
 */
export interface BatchAuthorizationResult {
  domain: string;
  totalUrls: number;
  succeeded: number;
  failed: number;
  skipped: number;
  details: Array<{
    url: string;
    success: boolean;
    title?: string;
    error?: string;
  }>;
}

/**
 * 批量授权进度
 */
export interface BatchAuthorizationProgress {
  domain: string;
  current: number;
  total: number;
  stage: 'extracting' | 'filtering' | 'fetching' | 'saving' | 'completed';
  currentUrl?: string;
  succeeded: number;
  failed: number;
}

// 定义API接口
export interface ElectronAPI {
  // 待办事项API
  todo: {
    getAll: () => Promise<any[]>;
    getById: (uuid: string) => Promise<any | null>;  // 🔧 新增：根据ID获取单个待办
    getMultipleByIds: (uuids: string[]) => Promise<any[]>;  // 🔧 新增：批量获取待办，优先使用缓存
    create: (todo: any) => Promise<any>;
    createManualAtTop: (todo: any, tabKey: string) => Promise<any>;
    update: (uuid: string, updates: any) => Promise<any>;  // 修复：uuid 参数类型为 string
    delete: (uuid: string) => Promise<boolean>;  // 修复：uuid 参数类型为 string
    deleteAndReorder: (uuid: string, tabKey: string) => Promise<void>;  // 删除并重新编号
    generateHash: (title: string, content: string) => Promise<string>;
    findDuplicate: (contentHash: string, excludeUuid?: string) => Promise<any | null>;  // 修复：excludeUuid 参数类型为 string
    batchUpdateDisplayOrder: (updates: {uuid: string, displayOrder: number}[]) => Promise<void>;  // 修复：uuid 参数类型为 string
    batchUpdateDisplayOrders: (updates: {uuid: string, tabKey: string, displayOrder: number}[]) => Promise<void>;  // 修复：uuid 参数类型为 string
    bulkUpdateTodos: (updates: Array<{uuid: string; updates: any}>) => Promise<void>;  // 修复：uuid 参数类型为 string
    bulkDeleteTodos: (uuids: string[]) => Promise<void>;  // 修复：uuids 参数类型为 string
    exportAll: () => Promise<any>;  // 导出所有数据
    importAll: (data: any) => Promise<any>;  // 导入数据
    toggleTodayCompleted: (uuid: string, currentState: string) => Promise<{
      success: boolean;
      error?: string;
    }>;  // 兼容旧接口：切换完成状态
    backflow: {
      checkAndBackflow: () => Promise<{
        success: boolean;
        backflowCount: number;
        lastBackflowDate: string | null;
        error?: string;
      }>;
    };  // 任务回流
  };
  
  // 关键词和推荐API
  keywords: {
    getRecommendations: (title: string, content: string, excludeId?: number) => Promise<any[]>;
    batchGenerate: () => Promise<{success: boolean; total?: number; processed?: number; failed?: number; error?: string}>;
  };
  
  // 设置API
  settings: {
    get: (key?: string) => Promise<any>;
    update: (settings: any) => Promise<any>;
    openDataFolder: () => Promise<{success: boolean; error?: string}>;
  };

  // 存储管理API
  storage: {
    getMode: () => Promise<{mode: 'database' | 'file'; path: string | null}>;
    setMode: (mode: 'database' | 'file', storagePath?: string) => Promise<{success: boolean; error?: string}>;
    getStoragePath: () => Promise<string | null>;
  };
  
  // 图片API
  image: {
    upload: () => Promise<string | null>;
    delete: (filepath: string) => Promise<boolean>;
    readLocalFile: (filepath: string) => Promise<ArrayBuffer>;
    saveBase64: (base64Data: string, originalName: string) => Promise<string | null>;
  };
  
  // 文件API
  file: {
    exists: (filepath: string) => Promise<boolean>;
    openDirectory: () => Promise<string | null>;
    selectDirectory: () => Promise<string | null>;
  };
  
  // 关系API
  relations: {
    getAll: () => Promise<any[]>;
    getByTodoId: (todoId: string) => Promise<any[]>;
    getByType: (relationType: string) => Promise<any[]>;
    create: (relation: any) => Promise<TodoRelation>;
    delete: (id: string) => Promise<void>;
    deleteByTodoId: (todoId: string) => Promise<void>;
    deleteSpecific: (sourceId: string, targetId: string, relationType: string) => Promise<void>;
    exists: (sourceId: string, targetId: string, relationType: string) => Promise<boolean>;
    buildTree: () => Promise<{roots: any[]; relations: any[]}>;
  };

  // 备份API
  backup: {
    list: () => Promise<any[]>;
    create: () => Promise<any>;
    restore: (backupPath: string) => Promise<{success: boolean; error?: string}>;
    getCurrentBackupStatus: () => Promise<{
      lastBackupTime: string;
      nextBackupTime: string;
      backupEnabled: boolean;
    }>;
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
    authorizeSingle: (url: string) => Promise<{
      success: boolean;
      title?: string;
      error?: string;
    }>;
    getBatchTaskStatus: (domain: string) => Promise<{
      success: boolean;
      task?: any;
      error?: string;
    }>;
    refreshTitle: (url: string) => Promise<{
      success: boolean;
      title?: string;
      source?: 'database' | 'network';
      unchanged?: boolean;
      error?: string;
    }>;
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
    // 批量授权事件监听
    onBatchProgress: (callback: (progress: BatchAuthorizationProgress) => void) => void;
    onBatchCompleted: (callback: (result: BatchAuthorizationResult) => void) => void;
    onSingleProgress: (callback: (progress: BatchAuthorizationProgress) => void) => void;
    onBatchInfo: (callback: (info: {
      message: string;
      domain: string;
      totalUrls: number;
      succeeded: number;
      failed: number;
    }) => void) => void;
    removeBatchListeners: () => void;
  };

  // 快速创建待办 API
  onQuickCreateTodo: (callback: (data: { content: string }) => void) => void;
  removeQuickCreateListener: () => void;

  // 存储位置API
  storageLocation: {
    getConfig: () => Promise<{
      success: boolean;
      config?: {
        firstRun: boolean;
        storageLocation: {
          type: string;
          customPath?: string;
          lastUpdated: string;
        };
      };
      error?: string;
    }>;
    setStorageLocation: (type: string, customPath?: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    validatePath: (path: string) => Promise<{
      valid: boolean;
      error?: string;
      warnings?: string[];
    }>;
    getRecommendedPaths: () => Promise<string[]>;
    moveStorage: (newPath: string) => Promise<{
      success: boolean;
      error?: string;
      backupPath?: string;
      newPath?: string;
    }>;
    selectFolder: () => Promise<string | null>;
    openInExplorer: (path: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    // 新增数据库管理 API
    getRecentDatabases: () => Promise<{
      success: boolean;
      databases?: Array<{
        path: string;
        name: string;
        lastUsed: string;
        todoCount: number;
        isValid: boolean;
      }>;
      error?: string;
    }>;
    validateDatabase: (dbPath: string) => Promise<{
      valid: boolean;
      error?: string;
    }>;
    initializeDatabase: (dbPath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    switchDatabase: (dbPath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
  };

  // 混合存储API
  hybridStorage: {
    getConfig: () => Promise<{
      success: boolean;
      config?: {
        currentMode: string;
        databasePath: string;
        filePath: string;
        enableFileSync: boolean;
        conflictResolution: string;
      };
      error?: string;
    }>;
    switchMode: (newMode: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    updatePath: (newPath: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getStats: () => Promise<{
      success: boolean;
      stats?: {
        mode: string;
        databaseCount: number;
        fileCount: number;
        totalCount: number;
        databasePath: string;
        filePath: string;
      };
      error?: string;
    }>;
    scanMarkdownFiles: () => Promise<string[]>;
    importMarkdownFile: (filePath: string) => Promise<any>;
    exportTodoAsMarkdown: (todoId: number) => Promise<string>;
    invalidateCache: () => Promise<void>;
  };

  // 内容迁移API
  migration: {
    needsMigration: () => Promise<boolean>;
    runMigration: () => Promise<any>;
  };

  // 混合存储事件API
  hybridStorageEvents: {
    onConfigChange: (callback: () => void) => () => void;
  };


  // 调试工具API
  debug: {
    checkDataIntegrity: () => Promise<any>;
    repairUuidMapping: () => Promise<any>;
    rebuildIndex: () => Promise<any>;
    quickDiagnostic: () => Promise<{
      healthy: boolean;
      issues: string[];
      recommendations: string[];
    }>;
  };
}

// 暴露API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  todo: {
    getAll: () => ipcRenderer.invoke('todo:getAll'),
    getById: (uuid: string) => ipcRenderer.invoke('todo:getById', uuid),  // 🔧 新增：根据ID获取单个待办
    getMultipleByIds: (uuids: string[]) => ipcRenderer.invoke('todo:getMultipleByIds', uuids),  // 🔧 新增：批量获取待办，优先使用缓存
    create: (todo: any) => ipcRenderer.invoke('todo:create', todo),
    createManualAtTop: (todo: any, tabKey: string) => ipcRenderer.invoke('todo:createManualAtTop', todo, tabKey),
    update: (uuid: string, updates: any) => ipcRenderer.invoke('todo:update', uuid, updates),  // 修复：uuid 参数类型为 string
    delete: (uuid: string) => ipcRenderer.invoke('todo:delete', uuid),  // 修复：uuid 参数类型为 string
    deleteAndReorder: (uuid: string, tabKey: string) => ipcRenderer.invoke('todo:deleteAndReorder', uuid, tabKey),  // 删除并重新编号
    generateHash: (title: string, content: string) => ipcRenderer.invoke('todo:generateHash', title, content),
    findDuplicate: (contentHash: string, excludeUuid?: string) => ipcRenderer.invoke('todo:findDuplicate', contentHash, excludeUuid),  // 修复：excludeUuid 参数类型为 string
    batchUpdateDisplayOrder: (updates: {uuid: string, displayOrder: number}[]) => ipcRenderer.invoke('todo:batchUpdateDisplayOrder', updates),  // 修复：uuid 参数类型为 string
    batchUpdateDisplayOrders: (updates: {uuid: string, tabKey: string, displayOrder: number}[]) => ipcRenderer.invoke('todo:batchUpdateDisplayOrders', updates),  // 修复：uuid 参数类型为 string
    bulkUpdateTodos: (updates: Array<{uuid: string; updates: any}>) => ipcRenderer.invoke('todo:bulkUpdateTodos', updates),  // 修复：uuid 参数类型为 string
    bulkDeleteTodos: (uuids: string[]) => ipcRenderer.invoke('todo:bulkDeleteTodos', uuids),  // 修复：uuids 参数类型为 string
    exportAll: () => ipcRenderer.invoke('todo:exportAll'),  // 导出所有数据
    importAll: (data: any) => ipcRenderer.invoke('todo:importAll', data),  // 导入数据
    toggleTodayCompleted: (uuid: string, currentState: string) =>
      ipcRenderer.invoke('todo:toggleTodayCompleted', uuid, currentState),  // 兼容旧接口：切换完成状态
    backflow: {
      checkAndBackflow: () => ipcRenderer.invoke('todo-backflow:check-and-backflow'),
    },
  },
  keywords: {
    getRecommendations: (title: string, content: string, excludeId?: number) => 
      ipcRenderer.invoke('keywords:getRecommendations', title, content, excludeId),
    batchGenerate: () => ipcRenderer.invoke('keywords:batchGenerate'),
  },
  settings: {
    get: (key?: string) => ipcRenderer.invoke(key === 'dbPath' ? 'settings:getDbPath' : 'settings:get'),
    update: (settings: any) => ipcRenderer.invoke('settings:update', settings),
    openDataFolder: () => ipcRenderer.invoke('settings:openDataFolder'),
  },
  storage: {
    getMode: () => ipcRenderer.invoke('storage:getMode'),
    setMode: (mode: 'database' | 'file', storagePath?: string) =>
      ipcRenderer.invoke('storage:setMode', mode, storagePath),
    getStoragePath: () => ipcRenderer.invoke('storage:getStoragePath'),
  },
  image: {
    upload: () => ipcRenderer.invoke('image:upload'),
    delete: (filepath: string) => ipcRenderer.invoke('image:delete', filepath),
    readLocalFile: (filepath: string) => ipcRenderer.invoke('image:readLocalFile', filepath),
    saveBase64: (base64Data: string, originalName: string) => ipcRenderer.invoke('image:saveBase64', base64Data, originalName),
  },
  file: {
    exists: (filepath: string) => ipcRenderer.invoke('file:exists', filepath),
    openDirectory: () => ipcRenderer.invoke('file:openDirectory'),
    selectDirectory: () => ipcRenderer.invoke('file:selectDirectory'),
  },
  relations: {
    getAll: () => ipcRenderer.invoke('relations:getAll'),
    getByTodoId: (todoId: string) => ipcRenderer.invoke('relations:getByTodoId', todoId),
    getByType: (relationType: string) => ipcRenderer.invoke('relations:getByType', relationType),
    create: (relation: any) => ipcRenderer.invoke('relations:create', relation),
    delete: (id: string) => ipcRenderer.invoke('relations:delete', id),
    deleteByTodoId: (todoId: string) => ipcRenderer.invoke('relations:deleteByTodoId', todoId),
    deleteSpecific: (sourceId: string, targetId: string, relationType: string) =>
      ipcRenderer.invoke('relations:deleteSpecific', sourceId, targetId, relationType),
    exists: (sourceId: string, targetId: string, relationType: string) =>
      ipcRenderer.invoke('relations:exists', sourceId, targetId, relationType),
    buildTree: () => ipcRenderer.invoke('relations:buildTree'),
  },
  backup: {
    list: () => ipcRenderer.invoke('backup:list'),
    create: () => ipcRenderer.invoke('backup:create'),
    restore: (backupPath: string) => ipcRenderer.invoke('backup:restore', backupPath),
    getCurrentBackupStatus: () => ipcRenderer.invoke('backup:getCurrentBackupStatus'),
  },
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  // URL标题API
  urlTitles: {
    fetchBatch: (urls: string[]) => ipcRenderer.invoke('url-titles:fetch-batch', urls),
  },

  // URL授权API
  urlAuth: {
    authorize: (url: string) => ipcRenderer.invoke('url:authorize', url),
    authorizeSingle: (url: string) => ipcRenderer.invoke('url-auth:authorizeSingle', url),
    getBatchTaskStatus: (domain: string) => ipcRenderer.invoke('url-auth:getBatchTaskStatus', domain),
    refreshTitle: (url: string) => ipcRenderer.invoke('url:refreshTitle', url),
    getAllAuthorizations: () => ipcRenderer.invoke('url-auth:getAll'),
    getAllUrls: () => ipcRenderer.invoke('url-auth:getAllUrls'),
    refreshAll: () => ipcRenderer.invoke('url-auth:refresh'),
    cleanup: () => ipcRenderer.invoke('url-auth:cleanup'),
    delete: (url: string) => ipcRenderer.invoke('url-auth:delete', url),
    getTitles: (urls: string[]) => ipcRenderer.invoke('url-auth:getTitles', urls),
    initialize: () => ipcRenderer.invoke('url-auth:initialize'),
    // 批量授权事件监听
    onBatchProgress: (callback: (progress: BatchAuthorizationProgress) => void) => {
      ipcRenderer.on('url-auth:batch-progress', (_event, progress) => {
        callback(progress);
      });
    },
    onBatchCompleted: (callback: (result: BatchAuthorizationResult) => void) => {
      ipcRenderer.on('url-auth:batch-completed', (_event, result) => {
        callback(result);
      });
    },
    onSingleProgress: (callback: (progress: BatchAuthorizationProgress) => void) => {
      ipcRenderer.on('url-auth:single-progress', (_event, progress) => {
        callback(progress);
      });
    },
    onBatchInfo: (callback: (info: any) => void) => {
      ipcRenderer.on('url-auth:batch-info', (_event, info) => {
        callback(info);
      });
    },
    removeBatchListeners: () => {
      ipcRenderer.removeAllListeners('url-auth:batch-progress');
      ipcRenderer.removeAllListeners('url-auth:batch-completed');
      ipcRenderer.removeAllListeners('url-auth:single-progress');
      ipcRenderer.removeAllListeners('url-auth:batch-info');
    },
  },

  // 快速创建待办
  onQuickCreateTodo: (callback: (data: { content: string }) => void) => {
    ipcRenderer.on('quick-create-todo', (_event, data) => callback(data));
  },
  removeQuickCreateListener: () => {
    ipcRenderer.removeAllListeners('quick-create-todo');
  },

  // 存储位置
  storageLocation: {
    getConfig: () => ipcRenderer.invoke('storageLocation:getConfig'),
    setStorageLocation: (type: string, customPath?: string) =>
      ipcRenderer.invoke('storageLocation:setStorageLocation', type, customPath),
    validatePath: (path: string) => ipcRenderer.invoke('storageLocation:validatePath', path),
    getRecommendedPaths: () => ipcRenderer.invoke('storageLocation:getRecommendedPaths'),
    moveStorage: (newPath: string) => ipcRenderer.invoke('storageLocation:moveStorage', newPath),
    selectFolder: () => ipcRenderer.invoke('storageLocation:selectFolder'),
    openInExplorer: (path: string) => ipcRenderer.invoke('storageLocation:openInExplorer', path),
    // 新增数据库管理 API
    getRecentDatabases: () => ipcRenderer.invoke('storageLocation:getRecentDatabases'),
    validateDatabase: (dbPath: string) => ipcRenderer.invoke('storageLocation:validateDatabase', dbPath),
    initializeDatabase: (dbPath: string) => ipcRenderer.invoke('storageLocation:initializeDatabase', dbPath),
    switchDatabase: (dbPath: string) => ipcRenderer.invoke('storageLocation:switchDatabase', dbPath),
  },

  // 混合存储
  hybridStorage: {
    getConfig: () => ipcRenderer.invoke('hybridStorage:getConfig'),
    switchMode: (newMode: string) => ipcRenderer.invoke('hybridStorage:switchMode', newMode),
    updatePath: (newPath: string) => ipcRenderer.invoke('hybridStorage:updatePath', newPath),
    getStats: () => ipcRenderer.invoke('hybridStorage:getStats'),
    scanMarkdownFiles: () => ipcRenderer.invoke('hybridStorage:scanMarkdownFiles'),
    importMarkdownFile: (filePath: string) => ipcRenderer.invoke('hybridStorage:importMarkdownFile', filePath),
    exportTodoAsMarkdown: (todoId: number) => ipcRenderer.invoke('hybridStorage:exportTodoAsMarkdown', todoId),
    invalidateCache: () => ipcRenderer.invoke('hybridStorage:invalidateCache'),
  },

  // 混合存储事件
  hybridStorageEvents: {
    onConfigChange: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on('hybridStorage:config-changed', listener);
      return () => ipcRenderer.removeListener('hybridStorage:config-changed', listener);
    },
  },

  // 内容迁移
  migration: {
    needsMigration: () => ipcRenderer.invoke('migration:needsMigration'),
    runMigration: () => ipcRenderer.invoke('migration:runMigration'),
  },

  // 调试工具
  debug: {
    checkDataIntegrity: () => ipcRenderer.invoke('debug:checkDataIntegrity'),
    repairUuidMapping: () => ipcRenderer.invoke('debug:repairUuidMapping'),
    rebuildIndex: () => ipcRenderer.invoke('debug:rebuildIndex'),
    quickDiagnostic: () => ipcRenderer.invoke('debug:quickDiagnostic'),
  },
} as ElectronAPI);

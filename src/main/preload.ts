import { contextBridge, ipcRenderer } from 'electron';
import type { PromptTemplate, AISuggestionResponse } from '../shared/types';

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
    configure: (provider: string, apiKey: string, endpoint?: string, model?: string) => Promise<{success: boolean; error?: string}>;
    getConfig: () => Promise<{provider: string; endpoint: string; model: string; enabled: boolean}>;
    getSupportedProviders: () => Promise<Array<{value: string; label: string; endpoint: string}>>;
    getAvailableModels: (provider: string) => Promise<Array<{id: string; name: string; description?: string}>>;
    fetchModels: (provider: string, apiKey: string, endpoint?: string) => Promise<{success: boolean; models: Array<{id: string; name: string}>; error?: string}>;
    getAllProviders: () => Promise<{success: boolean; providers: Array<{provider: string; apiKey: string; endpoint: string; model: string; enabled: boolean; updatedAt: string}>; error?: string}>;
    switchProvider: (provider: string) => Promise<{success: boolean; error?: string}>;
    deleteProvider: (provider: string) => Promise<{success: boolean; error?: string}>;
    getConfigPath: () => Promise<{success: boolean; path: string}>;
  };

  // AI 建议API
  aiSuggestion: {
    generate: (todoId: number, templateId?: number) => Promise<AISuggestionResponse>;
    cancel: () => Promise<{success: boolean; error?: string}>;  // ✅ 新增
    save: (todoId: number, suggestion: string) => Promise<{success: boolean; error?: string}>;
    delete: (todoId: number) => Promise<{success: boolean; error?: string}>;
  };

  // Prompt 模板API
  promptTemplates: {
    getAll: () => Promise<PromptTemplate[]>;
    getById: (id: number) => Promise<PromptTemplate | null>;
    create: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PromptTemplate>;
    update: (id: number, updates: Partial<PromptTemplate>) => Promise<void>;
    delete: (id: number) => Promise<void>;
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
    migrate: (targetPath: string, options: any) => Promise<any>;
    validateMigration: (targetPath: string) => Promise<any>;
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
    openDirectory: () => Promise<string | null>;
    selectDirectory: () => Promise<string | null>;
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

  // 流程图待办关联API
  flowchartTodoAssociation: {
    queryByFlowchart: (flowchartId: string) => Promise<number[]>;
    create: (flowchartId: string, todoId: number) => Promise<void>;
    delete: (flowchartId: string, todoId: number) => Promise<void>;
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

  // 混合存储事件API
  hybridStorageEvents: {
    onConfigChange: (callback: () => void) => () => void;
  };

  // 数据同步API
  dataSync: {
    getConfig: () => Promise<{
      success: boolean;
      config?: {
        enabled: boolean;
        interval: number;
        autoSyncOnSwitch: boolean;
        conflictResolution: string;
      };
      error?: string;
    }>;
    updateConfig: (newConfig: any) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getStatus: () => Promise<{
      success: boolean;
      status?: string;
      lastSyncTime?: number;
      error?: string;
    }>;
    manualSync: () => Promise<{
      success: boolean;
      result?: {
        success: boolean;
        startTime: number;
        endTime: number;
        duration: number;
        itemsProcessed: number;
        itemsSuccess: number;
        itemsFailed: number;
        errors: string[];
      };
      error?: string;
    }>;
    getStats: () => Promise<{
      success: boolean;
      stats?: {
        lastSyncTime: number;
        syncStatus: string;
        totalSyncs: number;
        successfulSyncs: number;
        failedSyncs: number;
        averageDuration: number;
      };
      error?: string;
    }>;
    getHistory: () => Promise<{
      success: boolean;
      history?: any[];
      error?: string;
    }>;
    clearHistory: () => Promise<{
      success: boolean;
      error?: string;
    }>;
  };

  // 文件系统监控器API
  filesystemWatcher: {
    getConfig: () => Promise<{
      success: boolean;
      config?: {
        enabled: boolean;
        debounceDelay: number;
        ignorePatterns: RegExp[];
        autoSync: boolean;
        notifyChanges: boolean;
      };
      error?: string;
    }>;
    updateConfig: (newConfig: any) => Promise<{
      success: boolean;
      error?: string;
    }>;
    getStatus: () => Promise<{
      success: boolean;
      status?: string;
      error?: string;
    }>;
    getStats: () => Promise<{
      success: boolean;
      stats?: {
        status: string;
        watchPath: string;
        filesWatched: number;
        changesDetected: number;
        lastChangeTime: number;
        uptime: number;
        errors: number;
      };
      error?: string;
    }>;
    start: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    stop: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    pause: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    resume: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    refresh: () => Promise<{
      success: boolean;
      error?: string;
    }>;
    getWatchedFiles: () => Promise<{
      success: boolean;
      files?: string[];
      error?: string;
    }>;
    resetStats: () => Promise<{
      success: boolean;
      error?: string;
    }>;
  };
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
    configure: (provider: string, apiKey: string, endpoint?: string, model?: string) =>
      ipcRenderer.invoke('ai:configure', provider, apiKey, endpoint, model),
    getConfig: () => ipcRenderer.invoke('ai:getConfig'),
    getSupportedProviders: () => ipcRenderer.invoke('ai:getSupportedProviders'),
    getAvailableModels: (provider: string) => ipcRenderer.invoke('ai:getAvailableModels', provider),
    fetchModels: (provider: string, apiKey: string, endpoint?: string) =>
      ipcRenderer.invoke('ai:fetchModels', provider, apiKey, endpoint),
    getAllProviders: () => ipcRenderer.invoke('ai:getAllProviders'),
    switchProvider: (provider: string) => ipcRenderer.invoke('ai:switchProvider', provider),
    deleteProvider: (provider: string) => ipcRenderer.invoke('ai:deleteProvider', provider),
    getConfigPath: () => ipcRenderer.invoke('ai:getConfigPath'),
  },
  aiSuggestion: {
    generate: (todoId: number, templateId?: number) =>
      ipcRenderer.invoke('ai-suggestion:generate', todoId, templateId),
    cancel: () =>  // ✅ 新增
      ipcRenderer.invoke('ai-suggestion:cancel'),
    save: (todoId: number, suggestion: string) =>
      ipcRenderer.invoke('ai-suggestion:save', todoId, suggestion),
    delete: (todoId: number) =>
      ipcRenderer.invoke('ai-suggestion:delete', todoId),
  },
  promptTemplates: {
    getAll: () => ipcRenderer.invoke('prompt-templates:getAll'),
    getById: (id: number) => ipcRenderer.invoke('prompt-templates:getById', id),
    create: (template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt'>) =>
      ipcRenderer.invoke('prompt-templates:create', template),
    update: (id: number, updates: Partial<PromptTemplate>) =>
      ipcRenderer.invoke('prompt-templates:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('prompt-templates:delete', id),
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
    migrate: (targetPath: string, options: any) =>
      ipcRenderer.invoke('storage:migrate', targetPath, options),
    validateMigration: (targetPath: string) =>
      ipcRenderer.invoke('storage:validateMigration', targetPath),
  },
  image: {
    upload: () => ipcRenderer.invoke('image:upload'),
    delete: (filepath: string) => ipcRenderer.invoke('image:delete', filepath),
    readLocalFile: (filepath: string) => ipcRenderer.invoke('image:readLocalFile', filepath),
  },
  file: {
    exists: (filepath: string) => ipcRenderer.invoke('file:exists', filepath),
    openDirectory: () => ipcRenderer.invoke('file:openDirectory'),
    selectDirectory: () => ipcRenderer.invoke('file:selectDirectory'),
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
    queryByFlowchart: (flowchartId: string) =>
      ipcRenderer.invoke('flowchart-todo-association:queryByFlowchart', flowchartId),
    create: (flowchartId: string, todoId: number) =>
      ipcRenderer.invoke('flowchart-todo-association:create', flowchartId, todoId),
    delete: (flowchartId: string, todoId: number) =>
      ipcRenderer.invoke('flowchart-todo-association:delete', flowchartId, todoId),
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
      ipcRenderer.on('hybridStorage:configChanged', listener);
      return () => ipcRenderer.removeListener('hybridStorage:configChanged', listener);
    }
  },

  // 数据同步
  dataSync: {
    getConfig: () => ipcRenderer.invoke('dataSync:getConfig'),
    updateConfig: (newConfig: any) => ipcRenderer.invoke('dataSync:updateConfig', newConfig),
    getStatus: () => ipcRenderer.invoke('dataSync:getStatus'),
    manualSync: () => ipcRenderer.invoke('dataSync:manualSync'),
    getStats: () => ipcRenderer.invoke('dataSync:getStats'),
    getHistory: () => ipcRenderer.invoke('dataSync:getHistory'),
    clearHistory: () => ipcRenderer.invoke('dataSync:clearHistory'),
  },

  // 文件系统监控器
  filesystemWatcher: {
    getConfig: () => ipcRenderer.invoke('filesystemWatcher:getConfig'),
    updateConfig: (newConfig: any) => ipcRenderer.invoke('filesystemWatcher:updateConfig', newConfig),
    getStatus: () => ipcRenderer.invoke('filesystemWatcher:getStatus'),
    getStats: () => ipcRenderer.invoke('filesystemWatcher:getStats'),
    start: () => ipcRenderer.invoke('filesystemWatcher:start'),
    stop: () => ipcRenderer.invoke('filesystemWatcher:stop'),
    pause: () => ipcRenderer.invoke('filesystemWatcher:pause'),
    resume: () => ipcRenderer.invoke('filesystemWatcher:resume'),
    refresh: () => ipcRenderer.invoke('filesystemWatcher:refresh'),
    getWatchedFiles: () => ipcRenderer.invoke('filesystemWatcher:getWatchedFiles'),
    resetStats: () => ipcRenderer.invoke('filesystemWatcher:resetStats'),
  },
} as ElectronAPI);

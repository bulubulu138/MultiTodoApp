/**
 * Electron API 类型声明
 * 扩展 window 对象，确保 TypeScript 能识别 electronAPI 属性
 * 与 preload.ts 中的定义保持一致
 */

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

interface ElectronAPI {
  // 待办事项API
  todo: {
    getAll: () => Promise<any[]>;
    getById: (uuid: string) => Promise<any | null>;
    getMultipleByIds: (uuids: string[]) => Promise<any[]>;
    create: (todo: any) => Promise<any>;
    createManualAtTop: (todo: any, tabKey: string) => Promise<any>;
    update: (uuid: string, updates: any) => Promise<any>;
    delete: (uuid: string) => Promise<boolean>;
    deleteAndReorder: (uuid: string, tabKey: string) => Promise<void>;  // 删除并重新编号
    generateHash: (title: string, content: string) => Promise<string>;
    findDuplicate: (contentHash: string, excludeUuid?: string) => Promise<any | null>;
    batchUpdateDisplayOrder: (updates: {uuid: string, displayOrder: number}[]) => Promise<void>;
    batchUpdateDisplayOrders: (updates: {uuid: string, tabKey: string, displayOrder: number}[]) => Promise<void>;
    bulkUpdateTodos: (updates: Array<{uuid: string; updates: any}>) => Promise<void>;
    bulkDeleteTodos: (uuids: string[]) => Promise<void>;
    exportAll: () => Promise<any>;
    importAll: (data: any) => Promise<any>;
    toggleTodayCompleted: (uuid: string, currentState: string) => Promise<{
      success: boolean;
      error?: string;
    }>;
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
    create: (relation: any) => Promise<any>;
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

  // 流程图API
  flowchart: {
    getAssociationsByTodoIds: (todoIds: string[]) => Promise<Record<string, Array<{
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
    queryByFlowchart: (flowchartId: string) => Promise<string[]>;
    create: (flowchartId: string, todoId: string) => Promise<void>;
    delete: (flowchartId: string, todoId: string) => Promise<void>;
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

  // 今日完成事件API
  onTodayCompletedMidnightConversion: (callback: (data: { convertedCount: number }) => void) => void;
  removeTodayCompletedListeners: () => void;

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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
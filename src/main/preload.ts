import { contextBridge, ipcRenderer } from 'electron';

// 定义API接口
export interface ElectronAPI {
  // 待办事项API
  todo: {
    getAll: () => Promise<any[]>;
    create: (todo: any) => Promise<any>;
    update: (id: number, updates: any) => Promise<any>;
    delete: (id: number) => Promise<boolean>;
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
  };
  
  // 心得API
  notes: {
    getAll: () => Promise<any[]>;
    create: (noteData: any) => Promise<any>;
    update: (id: number, updates: any) => Promise<any>;
    delete: (id: number) => Promise<void>;
  };
  
  // Shell API
  openExternal: (url: string) => Promise<{success: boolean; error?: string}>;
}

// 暴露API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  todo: {
    getAll: () => ipcRenderer.invoke('todo:getAll'),
    create: (todo: any) => ipcRenderer.invoke('todo:create', todo),
    update: (id: number, updates: any) => ipcRenderer.invoke('todo:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('todo:delete', id),
  },
  settings: {
    get: (key?: string) => ipcRenderer.invoke(key === 'dbPath' ? 'settings:getDbPath' : 'settings:get'),
    update: (settings: any) => ipcRenderer.invoke('settings:update', settings),
    openDataFolder: () => ipcRenderer.invoke('settings:openDataFolder'),
  },
  image: {
    upload: () => ipcRenderer.invoke('image:upload'),
    delete: (filepath: string) => ipcRenderer.invoke('image:delete', filepath),
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
  },
  notes: {
    getAll: () => ipcRenderer.invoke('notes:getAll'),
    create: (noteData: any) => ipcRenderer.invoke('notes:create', noteData),
    update: (id: number, updates: any) => ipcRenderer.invoke('notes:update', id, updates),
    delete: (id: number) => ipcRenderer.invoke('notes:delete', id),
  },
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
} as ElectronAPI);

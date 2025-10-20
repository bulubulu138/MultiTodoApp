// 统一的类型定义文件
// 所有组件都从这里导入类型，避免重复定义

export interface Todo {
  id?: number;
  title: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  priority: 'low' | 'medium' | 'high';
  tags: string;
  imageUrl?: string;
  images?: string; // JSON string of image array
  startTime?: string; // 预计开始时间
  deadline?: string;  // 截止时间
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  [key: string]: string;
}

export interface TodoRelation {
  id?: number;
  source_id: number;
  target_id: number;
  relation_type: 'extends' | 'background' | 'parallel';
  created_at: string;
}

export interface Note {
  id?: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 前端组件专用类型
export interface TodoFormData {
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  tags: string;
  imageUrl?: string;
}

export interface SearchFilters {
  status?: string;
  priority?: string;
  tags?: string;
}

export type CalendarViewSize = 'compact' | 'standard' | 'comfortable';
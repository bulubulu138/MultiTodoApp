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
  displayOrder?: number; // 手动排序序号（向后兼容，保留）
  displayOrders?: { [tabKey: string]: number }; // 多Tab独立排序序号
  contentHash?: string; // 内容哈希值，用于去重检测
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  [key: string]: string;
}

export interface CustomTab {
  id: string;        // 唯一ID
  label: string;     // 显示名称
  tag: string;       // 关联的标签
  color?: string;    // Tab颜色（可选）
  order: number;     // 显示顺序
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
// 统一的类型定义文件
// 所有组件都从这里导入类型，避免重复定义

// Todo ID 类型别名，提高语义化
export type TodoId = string;

export interface Todo {
  id: TodoId;
  title: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'paused' | 'today_completed';
  priority: 'mental' | 'communication' | 'trivial';
  tags: string;
  imageUrl?: string;
  images?: string; // JSON string of image array
  startTime?: string; // 预计开始时间
  deadline?: string;  // 截止时间
  displayOrder?: number; // 手动排序序号（向后兼容，保留）
  displayOrders?: { [tabKey: string]: number }; // 多Tab独立排序序号
  contentHash?: string; // 内容哈希值，用于去重检测
  keywords?: string[]; // 关键词数组
  completedAt?: string; // 完成时间，准确记录待办完成的时间点
  todayCompletedAt?: string; // 今日完成时间，标记何时进入今日已完成状态
  isDeleting?: boolean; // 前端运行态：用于退出动画，不写入数据库
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
  id?: TodoId;
  source_id: TodoId;
  target_id: TodoId;
  relation_type: 'extends' | 'background' | 'parallel';
  created_at: string;
}

// 树形节点类型（用于待办关系树）
export interface TodoTreeNode {
  key: string;
  title: string;  // 待办标题
  todo: Todo;
  children?: TodoTreeNode[];
}

// 树形关系数据
export interface TreeRelationData {
  roots: TodoTreeNode[];
  relations: TodoRelation[];
}

// 前端组件专用类型
export interface TodoFormData {
  title: string;
  content: string;
  priority: 'mental' | 'communication' | 'trivial';
  tags: string;
  imageUrl?: string;
}

export interface SearchFilters {
  status?: string;
  priority?: string;
  tags?: string;
}

export type CalendarViewSize = 'compact' | 'standard' | 'comfortable';

export interface BackupInfo {
  filename: string;
  filepath: string;
  timestamp: number;
  size: number;
  createdAt: string;
}


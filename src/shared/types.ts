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
  keywords?: string[]; // 关键词数组，用于智能推荐
  completedAt?: string; // 完成时间，准确记录待办完成的时间点
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  [key: string]: string;
}

// AI 提供商类型
export type AIProvider = 'disabled' | 'kimi' | 'deepseek' | 'doubao' | 'custom';

// AI 配置接口
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  apiEndpoint?: string; // 自定义端点
  enabled: boolean;
}

// 待办推荐结果
export interface TodoRecommendation {
  todo: Todo;
  similarity: number; // 相似度 0-1
  matchedKeywords: string[]; // 匹配的关键词
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

export interface BackupInfo {
  filename: string;
  filepath: string;
  timestamp: number;
  size: number;
  createdAt: string;
}

// ============================================
// 流程图类型定义 (Flowchart Types)
// ============================================

// 节点和边的类型别名
export type NodeType = 'rectangle' | 'rounded-rectangle' | 'diamond' | 'circle' | 'todo';
export type EdgeType = 'default' | 'smoothstep' | 'step' | 'straight' | 'bezier'; // 新增 bezier 类型
export type EdgeMarkerType = 'arrow' | 'arrowclosed' | 'none'; // 箭头类型
export type ExportFormat = 'json' | 'mermaid' | 'text' | 'png';

// 节点样式
export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed';
  fontSize?: number;
  color?: string; // 文字颜色
}

// 边样式（增强版）
export interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  animated?: boolean; // 新增：动画效果
}

// 待办节点样式配置类型
export interface TodoNodeStyleConfig {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  color: string;
}

// 待办节点状态样式映射
export interface TodoNodeStyleMap {
  completed: TodoNodeStyleConfig;
  in_progress: TodoNodeStyleConfig;
  pending: TodoNodeStyleConfig;
  paused: TodoNodeStyleConfig;
}

// 待办节点主题样式配置
export interface TodoNodeThemeStyles {
  light: TodoNodeStyleMap;
  dark: TodoNodeStyleMap;
}

// 视口配置
export interface ViewportSchema {
  x: number;
  y: number;
  zoom: number;
}

// ============================================
// 1️⃣ 持久化层 (Persistence Layer)
// 纯数据，直接映射数据库，不包含任何运行时状态
// ============================================

export interface FlowchartSchema {
  id: string;
  name: string;
  description?: string;
  viewport: ViewportSchema;
  createdAt: number;
  updatedAt: number;
}

export interface PersistedNodeData {
  label: string;
  todoId?: string;  // 只存 ID，不存实体
  style?: NodeStyle;
  isLocked?: boolean;
}

export interface PersistedNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: PersistedNodeData;
}

export interface PersistedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: EdgeType;
  label?: string;
  style?: EdgeStyle;
  markerEnd?: EdgeMarkerType; // 终点箭头类型
  markerStart?: EdgeMarkerType; // 起点箭头类型
  animated?: boolean; // 新增：动画效果
}

// ============================================
// 2️⃣ 业务领域层 (Domain Layer)
// 包含业务逻辑增强，如关联的 Todo 数据、计算的样式
// ============================================

export interface ResolvedTodo {
  title: string;
  status: Todo['status'];
  priority: Todo['priority'];
}

export interface DomainNodeData {
  label: string;
  todoId?: string;
  // 运行时解析的 Todo 数据（通过 selector/hook 计算）
  resolvedTodo?: ResolvedTodo;
  // 计算后的样式（基于 Todo 状态）
  computedStyle?: NodeStyle;
  // 用户自定义样式（优先级高于计算样式）
  style?: NodeStyle;
  isLocked?: boolean;
}

export interface DomainNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: DomainNodeData;
}

export interface DomainEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: EdgeType;
  label?: string;
  style?: EdgeStyle;
}

export interface FlowchartDomain {
  schema: FlowchartSchema;
  nodes: DomainNode[];
  edges: DomainEdge[];
}

// ============================================
// 3️⃣ UI 运行时层 (Runtime Layer)
// React Flow 使用的格式，包含 UI 状态
// ============================================

export interface RuntimeNodeData extends DomainNodeData {
  // UI 特有的临时状态
  isHovered?: boolean;
  isDragging?: boolean;
  isHighlighted?: boolean;
}

// React Flow Node 格式（简化版，实际使用时会扩展 React Flow 的 Node 类型）
export interface RuntimeNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: RuntimeNodeData;
  selected?: boolean;
  dragging?: boolean;
}

// React Flow Edge 格式（简化版，实际使用时会扩展 React Flow 的 Edge 类型）
export interface RuntimeEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: EdgeType;
  label?: string;
  style?: EdgeStyle;
  selected?: boolean;
}

export interface UIState {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  isDragging: boolean;
  isConnecting: boolean;
  viewport: ViewportSchema;
}

export interface FlowchartRuntime {
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
  uiState: UIState;
}

// ============================================
// 增量更新模型 (Patch Model)
// 用于 Undo/Redo、协作、AI 编辑
// ============================================

// Patch 元数据，用于存储原始数据以支持 Undo 操作
export interface PatchMetadata {
  // For removeNode operations
  originalNode?: PersistedNode;
  originalEdges?: PersistedEdge[];  // Edges connected to the deleted node
  
  // For updateNode operations
  originalNodeState?: PersistedNode;
  
  // For removeEdge operations
  originalEdge?: PersistedEdge;
  
  // For updateEdge operations
  originalEdgeState?: PersistedEdge;
  
  // For viewport/metadata operations
  originalViewport?: ViewportSchema;
  originalMetadata?: Partial<FlowchartSchema>;
}

export type FlowchartPatch =
  | { type: 'addNode'; node: PersistedNode; metadata?: PatchMetadata }
  | { type: 'updateNode'; id: string; changes: Partial<PersistedNode>; metadata?: PatchMetadata }
  | { type: 'removeNode'; id: string; metadata?: PatchMetadata }
  | { type: 'addEdge'; edge: PersistedEdge; metadata?: PatchMetadata }
  | { type: 'updateEdge'; id: string; changes: Partial<PersistedEdge>; metadata?: PatchMetadata }
  | { type: 'removeEdge'; id: string; metadata?: PatchMetadata }
  | { type: 'updateViewport'; viewport: ViewportSchema; metadata?: PatchMetadata }
  | { type: 'updateMetadata'; changes: Partial<FlowchartSchema>; metadata?: PatchMetadata };

export interface PatchHistory {
  patches: FlowchartPatch[];
  currentIndex: number;
}

// ============================================
// 导出相关类型
// ============================================

export interface ExportResult {
  format: ExportFormat;
  content: string;
  filename: string;
}

// ============================================
// 流程图关联类型 (Flowchart Association Types)
// ============================================

export interface FlowchartAssociation {
  flowchartId: string;
  flowchartName: string;
  nodeId: string;
  nodeLabel: string;
}

// 流程图与待办关联（流程图级别）
export interface FlowchartTodoAssociation {
  id?: number;
  flowchartId: string;
  todoId: number;
  createdAt: number;
}

// 关联信息展示模型
export interface FlowchartAssociationDisplay {
  type: 'flowchart' | 'node';
  flowchartId: string;
  flowchartName: string;
  flowchartDescription?: string;
  nodeId?: string;  // 仅节点级别关联有值
  nodeLabel?: string;  // 仅节点级别关联有值
  createdAt?: number;
}

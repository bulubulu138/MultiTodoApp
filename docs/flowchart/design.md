# Design Document - 流程图画布功能

## Overview

本设计文档描述了 MultiTodo 应用中流程图画布功能的技术实现方案。该功能将使用 React Flow 库作为核心绘图引擎，与现有的待办任务系统深度集成，提供直观的可视化任务关系管理能力。

### 技术选型

**核心库**: React Flow (reactflow)
- 与现有技术栈完美契合（React 18 + TypeScript 5）
- 高性能渲染引擎，支持大规模节点
- 丰富的自定义能力（自定义节点、边、控件）
- 完善的 TypeScript 支持
- 活跃的社区和文档

**替代方案对比**:
- AntV X6: 功能强大但学习曲线陡峭，文档主要为中文
- LogicFlow: 专注业务流程，功能相对受限
- React Flow: 平衡了易用性和功能性，最适合本项目

### 设计目标

1. **无缝集成**: 与现有待办系统深度集成，节点可关联实际任务
2. **交互友好**: 提供直观的拖拽、连线、编辑体验
3. **性能优先**: 支持大规模流程图（100+ 节点）流畅运行
4. **数据持久化**: 流程图数据存储在 SQLite 数据库
5. **多格式导出**: 支持 JSON、Mermaid、图片等多种导出格式

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    App.tsx                             │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │           FlowchartDrawer                        │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │      FlowchartCanvas (React Flow)         │  │  │  │
│  │  │  │  - Nodes (TodoNode, ShapeNode)            │  │  │  │
│  │  │  │  - Edges (CustomEdge)                     │  │  │  │
│  │  │  │  - Controls (Toolbar, MiniMap)            │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  │  ┌───────────────────────────────────────────┐  │  │  │
│  │  │  │      FlowchartToolbar                     │  │  │  │
│  │  │  │  - Export, Layout, Template               │  │  │  │
│  │  │  └───────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
│                           │                                  │
│                           │ IPC                              │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                     Main Process                             │
│  ┌────────────────────────▼──────────────────────────────┐  │
│  │              DatabaseManager                          │  │
│  │  - flowcharts table (CRUD operations)                 │  │
│  │  - flowchart_nodes table                              │  │
│  │  - flowchart_edges table                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```


### 架构层次

1. **UI 层** (Renderer Process)
   - FlowchartDrawer: 流程图抽屉容器组件
   - FlowchartCanvas: React Flow 画布核心组件
   - FlowchartToolbar: 工具栏（导出、布局、模板）
   - NodeLibrary: 节点库面板
   - CustomNodes: 自定义节点组件（TodoNode, ShapeNode）
   - CustomEdges: 自定义边组件

2. **业务逻辑层** (Renderer Process)
   - FlowchartManager: 流程图状态管理
   - ExportService: 导出服务（JSON, Mermaid, PNG）
   - LayoutService: 自动布局算法
   - TemplateService: 模板管理

3. **数据层** (Main Process)
   - DatabaseManager: 数据库操作
   - FlowchartRepository: 流程图数据访问

## Components and Interfaces

### 核心组件

#### 1. FlowchartDrawer

流程图抽屉容器，负责整体布局和状态管理。

```typescript
interface FlowchartDrawerProps {
  visible: boolean;
  onClose: () => void;
  initialFlowchartId?: string;
}

interface FlowchartDrawerState {
  currentFlowchart: Flowchart | null;
  flowchartList: Flowchart[];
  isLoading: boolean;
}
```

**职责**:
- 管理流程图列表
- 处理流程图切换
- 协调子组件通信

#### 2. FlowchartCanvas 组件

React Flow 画布核心组件，处理节点和边的渲染与交互。

```typescript
interface FlowchartCanvasProps {
  flowchartId: string;
  onPatchesApplied: (patches: FlowchartPatch[]) => void;
}

interface FlowchartCanvasState {
  // 持久化层数据
  persistedNodes: PersistedNode[];
  persistedEdges: PersistedEdge[];
  
  // 业务领域层数据（通过 selector 计算）
  domainNodes: DomainNode[];
  domainEdges: DomainEdge[];
  
  // UI 运行时层数据（React Flow 使用）
  runtimeNodes: RuntimeNode[];
  runtimeEdges: RuntimeEdge[];
  
  // UI 状态（不持久化）
  uiState: UIState;
}
```

**职责**:
- 管理三层数据模型的转换
- 使用 Patch 模型处理所有修改操作
- 通过 selector 实时解析 Todo 数据
- 管理 Undo/Redo 历史
- 处理用户交互（拖拽、连线、选择）
- 管理画布视口（缩放、平移）

**关键实现**:
```typescript
const FlowchartCanvas: React.FC<FlowchartCanvasProps> = ({ flowchartId, onPatchesApplied }) => {
  // 1. 加载持久化数据
  const [persistedNodes, setPersistedNodes] = useState<PersistedNode[]>([]);
  const [persistedEdges, setPersistedEdges] = useState<PersistedEdge[]>([]);
  
  // 2. 加载所有 Todos（用于解析）
  const todos = useTodos();
  
  // 3. 通过 selector 计算业务领域层数据
  const domainNodes = useDomainNodes(persistedNodes, todos);
  const domainEdges = useMemo(() => persistedEdges, [persistedEdges]);
  
  // 4. 转换为 React Flow 运行时格式
  const [runtimeNodes, setRuntimeNodes, onNodesChange] = useNodesState(
    domainNodes.map(toRuntimeNode)
  );
  const [runtimeEdges, setRuntimeEdges, onEdgesChange] = useEdgesState(
    domainEdges.map(toRuntimeEdge)
  );
  
  // 5. Undo/Redo 管理
  const undoRedoManager = useRef(new UndoRedoManager());
  
  // 6. 处理节点变化 -> 生成 Patch
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const patches: FlowchartPatch[] = [];
    
    changes.forEach(change => {
      if (change.type === 'position' && change.position) {
        patches.push({
          type: 'updateNode',
          id: change.id,
          changes: { position: change.position }
        });
      }
      // ... 处理其他变化类型
    });
    
    if (patches.length > 0) {
      applyPatches(patches);
    }
    
    onNodesChange(changes);
  }, [onNodesChange]);
  
  // 7. 应用 Patches
  const applyPatches = useCallback((patches: FlowchartPatch[]) => {
    // 应用到持久化层
    const result = FlowchartPatchService.applyPatches(
      null,
      persistedNodes,
      persistedEdges,
      patches
    );
    
    setPersistedNodes(result.nodes);
    setPersistedEdges(result.edges);
    
    // 记录到 Undo 历史
    patches.forEach(p => undoRedoManager.current.execute(p));
    
    // 通知父组件保存
    onPatchesApplied(patches);
  }, [persistedNodes, persistedEdges, onPatchesApplied]);
  
  return (
    <ReactFlow
      nodes={runtimeNodes}
      edges={runtimeEdges}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
};
```


#### 3. TodoNode (自定义节点)

关联待办任务的节点组件。

```typescript
interface TodoNodeProps {
  id: string;
  data: DomainNodeData;  // 使用业务领域层数据
  selected: boolean;
}
```

**职责**:
- 显示节点内容
- 显示关联任务信息（从 resolvedTodo 读取，不直接依赖 Todo 实体）
- 根据任务状态显示计算后的样式（从 computedStyle 读取）
- 提供编辑和关联任务的交互

**关键实现**:
```typescript
const TodoNode: React.FC<TodoNodeProps> = ({ id, data, selected }) => {
  // 从 data.resolvedTodo 读取任务信息，而不是直接依赖 Todo 实体
  const { label, resolvedTodo, computedStyle, isLocked } = data;
  
  // 优先使用任务标题，否则使用节点 label
  const displayLabel = resolvedTodo?.title || label;
  
  // 使用计算后的样式
  const style = computedStyle || {
    backgroundColor: '#fff',
    borderColor: '#333',
    borderWidth: 2
  };
  
  return (
    <div
      style={{
        padding: '10px',
        borderRadius: '5px',
        border: `${style.borderWidth}px ${selected ? 'solid' : 'dashed'} ${style.borderColor}`,
        backgroundColor: style.backgroundColor,
        minWidth: '150px',
        position: 'relative'
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {isLocked && (
        <LockIcon style={{ position: 'absolute', top: 5, right: 5 }} />
      )}
      
      <div>
        <strong>{displayLabel}</strong>
        {resolvedTodo && (
          <div style={{ fontSize: '12px', marginTop: '5px' }}>
            <StatusIcon status={resolvedTodo.status} />
            <PriorityBadge priority={resolvedTodo.priority} />
          </div>
        )}
      </div>
      
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};
```

#### 4. FlowchartToolbar

工具栏组件，提供导出、布局、模板等功能。

```typescript
interface FlowchartToolbarProps {
  flowchart: Flowchart;
  onExport: (format: ExportFormat) => void;
  onLayout: (algorithm: LayoutAlgorithm) => void;
  onTemplate: (template: Template) => void;
  onSave: () => void;
}

type ExportFormat = 'json' | 'mermaid' | 'text' | 'png';
type LayoutAlgorithm = 'hierarchical' | 'force-directed';
```

**职责**:
- 提供导出功能入口
- 触发自动布局
- 应用流程图模板
- 保存流程图

#### 5. NodeLibrary

节点库面板，提供可拖拽的节点类型。

```typescript
interface NodeLibraryProps {
  onDragStart: (nodeType: NodeType) => void;
}

type NodeType = 'rectangle' | 'rounded-rectangle' | 'diamond' | 'circle' | 'todo';

interface NodeTemplate {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  defaultStyle: NodeStyle;
}
```

**职责**:
- 展示可用节点类型
- 处理节点拖拽开始事件
- 提供节点预览


## Data Models

### 数据库表结构

#### flowcharts 表

存储流程图元数据。

```sql
CREATE TABLE flowcharts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  viewport TEXT,  -- JSON: {x, y, zoom}
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_flowcharts_updated_at ON flowcharts(updated_at);
```

#### flowchart_nodes 表

存储流程图节点数据。

```sql
CREATE TABLE flowchart_nodes (
  id TEXT PRIMARY KEY,
  flowchart_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'rectangle', 'diamond', 'circle', 'todo'
  position TEXT NOT NULL,  -- JSON: {x, y}
  data TEXT NOT NULL,  -- JSON: {label, todoId, style, isLocked, draggable}
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flowchart_id) REFERENCES flowcharts(id) ON DELETE CASCADE
);

CREATE INDEX idx_flowchart_nodes_flowchart_id ON flowchart_nodes(flowchart_id);
CREATE INDEX idx_flowchart_nodes_updated_at ON flowchart_nodes(updated_at);
```

#### flowchart_edges 表

存储流程图连线数据。

```sql
CREATE TABLE flowchart_edges (
  id TEXT PRIMARY KEY,
  flowchart_id TEXT NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  source_handle TEXT,
  target_handle TEXT,
  type TEXT DEFAULT 'default',  -- 'default', 'smoothstep', 'step', 'straight'
  label TEXT,
  style TEXT,  -- JSON: {stroke, strokeWidth, ...}
  connection_hash TEXT,  -- MD5(source+target+type) 用于快速对比
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (flowchart_id) REFERENCES flowcharts(id) ON DELETE CASCADE
);

CREATE INDEX idx_flowchart_edges_flowchart_id ON flowchart_edges(flowchart_id);
CREATE INDEX idx_flowchart_edges_connection_hash ON flowchart_edges(connection_hash);
CREATE INDEX idx_flowchart_edges_updated_at ON flowchart_edges(updated_at);
```

### TypeScript 类型定义

#### 三层模型架构

为了避免 UI 状态、业务状态和持久化状态混在一起，我们采用三层模型：

```typescript
// ============================================
// 1️⃣ 持久化层 (Persistence Layer)
// 纯数据，直接映射数据库，不包含任何运行时状态
// ============================================

interface FlowchartSchema {
  id: string;
  name: string;
  description?: string;
  viewport: ViewportSchema;
  createdAt: number;
  updatedAt: number;
}

interface ViewportSchema {
  x: number;
  y: number;
  zoom: number;
}

interface PersistedNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: PersistedNodeData;
}

interface PersistedNodeData {
  label: string;
  todoId?: string;  // 只存 ID，不存实体
  style?: NodeStyle;
  isLocked?: boolean;
}

interface PersistedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: EdgeType;
  label?: string;
  style?: EdgeStyle;
}

interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed';
  fontSize?: number;
}

interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
}

// ============================================
// 2️⃣ 业务领域层 (Domain Layer)
// 包含业务逻辑增强，如关联的 Todo 数据、计算的样式
// ============================================

interface FlowchartDomain {
  schema: FlowchartSchema;
  nodes: DomainNode[];
  edges: DomainEdge[];
}

interface DomainNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: DomainNodeData;
}

interface DomainNodeData {
  label: string;
  todoId?: string;
  // 运行时解析的 Todo 数据（通过 selector/hook 计算）
  resolvedTodo?: {
    title: string;
    status: TodoStatus;
    priority: TodoPriority;
  };
  // 计算后的样式（基于 Todo 状态）
  computedStyle?: NodeStyle;
  isLocked?: boolean;
}

interface DomainEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: EdgeType;
  label?: string;
  style?: EdgeStyle;
}

// ============================================
// 3️⃣ UI 运行时层 (Runtime Layer)
// React Flow 使用的格式，包含 UI 状态
// ============================================

interface FlowchartRuntime {
  nodes: RuntimeNode[];
  edges: RuntimeEdge[];
  uiState: UIState;
}

// React Flow Node 格式
interface RuntimeNode extends Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: RuntimeNodeData;
  selected?: boolean;
  dragging?: boolean;
}

interface RuntimeNodeData extends DomainNodeData {
  // UI 特有的临时状态
  isHovered?: boolean;
  isDragging?: boolean;
}

// React Flow Edge 格式
interface RuntimeEdge extends Edge {
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

interface UIState {
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  isDragging: boolean;
  isConnecting: boolean;
  viewport: ViewportSchema;
}

// ============================================
// 增量更新模型 (Patch Model)
// 用于 Undo/Redo、协作、AI 编辑
// ============================================

type FlowchartPatch =
  | { type: 'addNode'; node: PersistedNode }
  | { type: 'updateNode'; id: string; changes: Partial<PersistedNode> }
  | { type: 'removeNode'; id: string }
  | { type: 'addEdge'; edge: PersistedEdge }
  | { type: 'updateEdge'; id: string; changes: Partial<PersistedEdge> }
  | { type: 'removeEdge'; id: string }
  | { type: 'updateViewport'; viewport: ViewportSchema }
  | { type: 'updateMetadata'; changes: Partial<FlowchartSchema> };

interface PatchHistory {
  patches: FlowchartPatch[];
  currentIndex: number;
}

// ============================================
// 类型别名
// ============================================

type NodeType = 'rectangle' | 'rounded-rectangle' | 'diamond' | 'circle' | 'todo';
type EdgeType = 'default' | 'smoothstep' | 'step' | 'straight';
type ExportFormat = 'json' | 'mermaid' | 'text' | 'png';

interface ExportResult {
  format: ExportFormat;
  content: string;
  filename: string;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 节点创建一致性

*For any* node type from the node library, dragging it to the canvas should create a node of that type at the drop position with default properties.

**Validates: Requirements 2.2**

### Property 2: 边创建一致性

*For any* two nodes on the canvas, dragging from one node's handle to another node's handle should create an edge connecting them.

**Validates: Requirements 2.5**

### Property 3: 节点移动保持连接

*For any* node with connected edges, moving the node to a new position should automatically update all connected edge paths to maintain visual connection.

**Validates: Requirements 2.7**

### Property 4: 元素删除完整性

*For any* selected element (node or edge), pressing the Delete key should remove the element from the canvas and from the underlying data model.

**Validates: Requirements 2.8**

### Property 5: 任务关联双向绑定

*For any* node and any todo task, associating the todo with the node should result in the node displaying the todo's title and status, and the association should be persisted in the database.

**Validates: Requirements 3.3, 3.4**

### Property 6: 视口变换一致性

*For any* viewport transformation (pan or zoom), the visual representation of nodes and edges should update correctly while maintaining their relative positions and connections.

**Validates: Requirements 4.1, 4.2**

### Property 7: 多选操作同步性

*For any* set of selected nodes, performing an operation (move, delete, style change) should apply the operation to all selected nodes simultaneously.

**Validates: Requirements 4.3, 4.4, 4.5**

### Property 8: 撤销重做对称性

*For any* reversible operation, performing undo then redo should restore the canvas to the state immediately after the original operation.

**Validates: Requirements 4.6, 4.7**


### Property 9: JSON 导出往返一致性

*For any* flowchart, exporting to JSON format then importing the JSON should produce a flowchart equivalent to the original (nodes, edges, positions, styles preserved).

**Validates: Requirements 5.2**

### Property 10: Mermaid 导出语法正确性

*For any* flowchart, exporting to Mermaid format should produce syntactically valid Mermaid code that can be rendered by Mermaid parsers.

**Validates: Requirements 5.3**

### Property 11: 文本导出可读性

*For any* flowchart, exporting to text format should produce human-readable text that describes all nodes and their connections in a logical order.

**Validates: Requirements 5.4**

### Property 12: 持久化往返一致性

*For any* flowchart, saving to database then loading from database should restore the flowchart with all nodes, edges, viewport state, and metadata preserved.

**Validates: Requirements 6.1, 6.3**

### Property 13: 自动布局保持连接

*For any* flowchart, applying an auto-layout algorithm (hierarchical or force-directed) should rearrange node positions while preserving all edge connections and node data.

**Validates: Requirements 7.2, 7.3**

### Property 14: 节点样式更新一致性

*For any* node and any style property (color, border, font size), updating the style should immediately reflect in the node's visual representation and be persisted to the database.

**Validates: Requirements 9.2, 9.3, 9.4**

### Property 15: 任务状态颜色映射

*For any* node associated with a todo task, the node's background color should automatically match the task's status (pending→blue, in-progress→yellow, completed→green, paused→gray).

**Validates: Requirements 9.5**

### Property 16: 图片导出完整性

*For any* flowchart, exporting to PNG format should produce an image that visually represents all nodes, edges, and their current styles accurately.

**Validates: Requirements 10.2**

### Property 17: URL 编码往返一致性

*For any* flowchart, encoding to URL parameters then decoding should produce a flowchart equivalent to the original (allowing read-only sharing via links).

**Validates: Requirements 10.4, 10.5**

### Property 18: 任务数据实时同步

*For any* node associated with a todo task, when the task is updated outside the flowchart, the node should reflect the latest task data (title, status) upon next render.

**Validates: Requirements 11.2, 11.3**

### Property 19: 循环依赖检测正确性

*For any* set of edges and a proposed new edge, the cycle detection algorithm should correctly identify whether adding the new edge would create a cycle.

**Validates: Requirements 12.3, 12.4**

### Property 20: 锁定节点布局保持

*For any* flowchart with locked nodes, applying auto-layout should preserve the positions of locked nodes while rearranging unlocked nodes.

**Validates: Requirements 12.2, 12.5**

### Property 21: Mermaid 特殊字符转义

*For any* node label containing special characters (quotes, brackets, newlines), the Mermaid export should produce syntactically valid code with properly escaped characters.

**Validates: Requirements 13.1, 13.2, 13.3**


## Error Handling

### 用户输入错误

1. **无效节点位置**
   - 场景: 用户尝试将节点拖拽到画布外
   - 处理: 限制节点位置在画布边界内，提供视觉反馈

2. **循环连接**
   - 场景: 用户尝试创建从节点到自身的边
   - 处理: 阻止创建，显示提示信息

3. **重复连接**
   - 场景: 用户尝试在两个节点间创建多条相同方向的边
   - 处理: 允许创建但提供警告提示

### 数据错误

1. **数据库操作失败**
   - 场景: 保存流程图时数据库写入失败
   - 处理: 显示错误提示，保留内存中的数据，提供重试选项

2. **数据加载失败**
   - 场景: 从数据库加载流程图时数据损坏
   - 处理: 显示错误信息，提供创建新流程图或恢复备份选项

3. **关联任务不存在**
   - 场景: 节点关联的待办任务已被删除
   - 处理: 显示占位信息，提供解除关联或重新关联选项

### 导出错误

1. **导出格式不支持**
   - 场景: 请求不支持的导出格式
   - 处理: 显示支持的格式列表，引导用户选择

2. **导出内容过大**
   - 场景: 流程图过大导致导出超时或内存不足
   - 处理: 分块导出或降低导出质量，提供进度提示

3. **剪贴板访问失败**
   - 场景: 浏览器拒绝剪贴板访问权限
   - 处理: 提供手动复制选项，显示文本框供用户选择复制

### 性能问题

1. **大规模流程图**
   - 场景: 流程图包含 100+ 节点导致渲染缓慢
   - 处理: 启用虚拟化渲染，仅渲染可见区域的节点

2. **频繁自动保存**
   - 场景: 用户快速编辑导致频繁保存请求
   - 处理: 使用防抖机制，合并保存请求（500ms 延迟）

## Testing Strategy

### 单元测试 (Unit Tests)

使用 Jest + React Testing Library 进行组件和工具函数测试。

**测试范围**:
1. **组件渲染测试**
   - FlowchartDrawer 正确渲染
   - FlowchartToolbar 按钮功能
   - NodeLibrary 节点类型展示

2. **工具函数测试**
   - 导出服务 (JSON, Mermaid, Text)
   - 布局算法 (Hierarchical, Force-Directed)
   - 数据转换函数

3. **边界条件测试**
   - 空流程图处理
   - 单节点流程图
   - 大规模流程图 (100+ 节点)

**示例测试**:
```typescript
describe('ExportService', () => {
  it('should export empty flowchart to valid JSON', () => {
    const flowchart = createEmptyFlowchart();
    const result = ExportService.toJSON(flowchart);
    expect(JSON.parse(result)).toEqual({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    });
  });

  it('should export flowchart with nodes to Mermaid', () => {
    const flowchart = createFlowchartWithNodes();
    const result = ExportService.toMermaid(flowchart);
    expect(result).toContain('graph TD');
    expect(result).toMatch(/A\[.*\]/);
  });
});
```


### 属性测试 (Property-Based Tests)

使用 fast-check 库进行属性测试，每个测试运行最少 100 次迭代。

**测试配置**:
```typescript
import fc from 'fast-check';

const testConfig = {
  numRuns: 100,  // 最少 100 次迭代
  verbose: true
};
```

**属性测试用例**:

1. **Property 1: 节点创建一致性**
   ```typescript
   // Feature: flowchart-canvas, Property 1: 节点创建一致性
   it('should create node of correct type at drop position', () => {
     fc.assert(
       fc.property(
         fc.constantFrom('rectangle', 'diamond', 'circle', 'rounded-rectangle'),
         fc.record({ x: fc.integer(0, 1000), y: fc.integer(0, 1000) }),
         (nodeType, position) => {
           const node = createNodeFromDrag(nodeType, position);
           expect(node.type).toBe(nodeType);
           expect(node.position).toEqual(position);
         }
       ),
       testConfig
     );
   });
   ```

2. **Property 2: 边创建一致性**
   ```typescript
   // Feature: flowchart-canvas, Property 2: 边创建一致性
   it('should create edge between any two nodes', () => {
     fc.assert(
       fc.property(
         fc.uuid(),
         fc.uuid(),
         (sourceId, targetId) => {
           fc.pre(sourceId !== targetId); // 避免自环
           const edge = createEdge(sourceId, targetId);
           expect(edge.source).toBe(sourceId);
           expect(edge.target).toBe(targetId);
         }
       ),
       testConfig
     );
   });
   ```

3. **Property 9: JSON 导出往返一致性**
   ```typescript
   // Feature: flowchart-canvas, Property 9: JSON 导出往返一致性
   it('should preserve flowchart through JSON export/import', () => {
     fc.assert(
       fc.property(
         arbitraryFlowchart(),
         (flowchart) => {
           const json = ExportService.toJSON(flowchart);
           const restored = ImportService.fromJSON(json);
           expect(restored).toEqual(flowchart);
         }
       ),
       testConfig
     );
   });
   ```

4. **Property 12: 持久化往返一致性**
   ```typescript
   // Feature: flowchart-canvas, Property 12: 持久化往返一致性
   it('should preserve flowchart through save/load cycle', async () => {
     fc.assert(
       fc.asyncProperty(
         arbitraryFlowchart(),
         async (flowchart) => {
           await DatabaseManager.saveFlowchart(flowchart);
           const loaded = await DatabaseManager.loadFlowchart(flowchart.id);
           expect(loaded).toEqual(flowchart);
         }
       ),
       testConfig
     );
   });
   ```

5. **Property 15: 任务状态颜色映射**
   ```typescript
   // Feature: flowchart-canvas, Property 15: 任务状态颜色映射
   it('should map todo status to node color correctly', () => {
     fc.assert(
       fc.property(
         fc.constantFrom('pending', 'in-progress', 'completed', 'paused'),
         (status) => {
           const todo = createTodoWithStatus(status);
           const node = createNodeWithTodo(todo);
           const expectedColor = getColorForStatus(status);
           expect(node.data.style.backgroundColor).toBe(expectedColor);
         }
       ),
       testConfig
     );
   });
   ```

**生成器 (Arbitraries)**:

```typescript
// 生成随机流程图
const arbitraryFlowchart = () => fc.record({
  id: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  nodes: fc.array(arbitraryNode(), { maxLength: 20 }),
  edges: fc.array(arbitraryEdge(), { maxLength: 30 }),
  viewport: fc.record({
    x: fc.integer(-1000, 1000),
    y: fc.integer(-1000, 1000),
    zoom: fc.double({ min: 0.1, max: 3.0 })
  })
});

// 生成随机节点
const arbitraryNode = () => fc.record({
  id: fc.uuid(),
  type: fc.constantFrom('rectangle', 'diamond', 'circle', 'rounded-rectangle'),
  position: fc.record({
    x: fc.integer(0, 2000),
    y: fc.integer(0, 2000)
  }),
  data: fc.record({
    label: fc.string({ minLength: 1, maxLength: 100 }),
    todoId: fc.option(fc.uuid(), { nil: undefined })
  })
});

// 生成随机边
const arbitraryEdge = () => fc.record({
  id: fc.uuid(),
  source: fc.uuid(),
  target: fc.uuid(),
  type: fc.constantFrom('default', 'smoothstep', 'step', 'straight')
});
```

### 集成测试

测试组件间交互和数据流。

**测试场景**:
1. 创建流程图 → 添加节点 → 连接节点 → 保存 → 加载
2. 关联待办任务 → 更新任务状态 → 验证节点颜色变化
3. 导出 JSON → 导入 JSON → 验证数据完整性
4. 自动布局 → 撤销 → 验证恢复原布局

### 性能测试

**测试指标**:
- 渲染 100 个节点的流程图 < 1000ms
- 自动保存延迟 500ms
- 导出 PNG 图片 < 2000ms
- 自动布局计算 < 1500ms


## Implementation Details

### React Flow 集成

#### 安装依赖

```bash
npm install reactflow
npm install --save-dev @types/react-flow
```

#### 基础配置

```typescript
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node
} from 'reactflow';
import 'reactflow/dist/style.css';

const FlowchartCanvas: React.FC<FlowchartCanvasProps> = ({ flowchart }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(flowchart.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowchart.edges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
};
```

### 自定义节点实现

```typescript
import { Handle, Position, NodeProps } from 'reactflow';

const TodoNode: React.FC<NodeProps<TodoNodeData>> = ({ data, selected }) => {
  const backgroundColor = data.todo 
    ? getColorForStatus(data.todo.status)
    : data.style?.backgroundColor || '#fff';

  return (
    <div
      style={{
        padding: '10px',
        borderRadius: '5px',
        border: `2px ${selected ? 'solid' : 'dashed'} #333`,
        backgroundColor,
        minWidth: '150px'
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div>
        <strong>{data.label}</strong>
        {data.todo && (
          <div style={{ fontSize: '12px', marginTop: '5px' }}>
            <StatusIcon status={data.todo.status} />
            {data.todo.title}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// 注册自定义节点
const nodeTypes = {
  todo: TodoNode,
  rectangle: RectangleNode,
  diamond: DiamondNode,
  circle: CircleNode
};
```

### 导出服务实现

#### JSON 导出

```typescript
class ExportService {
  static toJSON(flowchart: Flowchart): string {
    const data = {
      id: flowchart.id,
      name: flowchart.name,
      nodes: flowchart.nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
      })),
      edges: flowchart.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type,
        label: edge.label
      })),
      viewport: flowchart.viewport
    };
    return JSON.stringify(data, null, 2);
  }

  static fromJSON(json: string): Flowchart {
    const data = JSON.parse(json);
    return {
      id: data.id,
      name: data.name,
      nodes: data.nodes,
      edges: data.edges,
      viewport: data.viewport,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
}
```

#### Mermaid 导出

```typescript
class MermaidExporter {
  static export(flowchart: Flowchart): string {
    let mermaid = 'graph TD\n';
    
    // 添加节点
    flowchart.nodes.forEach(node => {
      const label = node.data.label.replace(/"/g, '\\"');
      const shape = this.getNodeShape(node.type);
      mermaid += `  ${node.id}${shape[0]}"${label}"${shape[1]}\n`;
    });
    
    // 添加边
    flowchart.edges.forEach(edge => {
      const arrow = this.getArrowStyle(edge.type);
      const label = edge.label ? `|${edge.label}|` : '';
      mermaid += `  ${edge.source} ${arrow}${label} ${edge.target}\n`;
    });
    
    return mermaid;
  }

  private static getNodeShape(type: string): [string, string] {
    const shapes = {
      rectangle: ['[', ']'],
      'rounded-rectangle': ['(', ')'],
      diamond: ['{', '}'],
      circle: ['((', '))']
    };
    return shapes[type] || ['[', ']'];
  }

  private static getArrowStyle(type: string): string {
    const arrows = {
      default: '-->',
      smoothstep: '-.->',
      step: '==>',
      straight: '--->'
    };
    return arrows[type] || '-->';
  }
}
```

### 自动布局实现

使用 dagre 库实现层次布局：

```bash
npm install dagre
npm install --save-dev @types/dagre
```

```typescript
import dagre from 'dagre';

class LayoutService {
  static hierarchical(nodes: Node[], edges: Edge[]): Node[] {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB' });

    // 添加节点
    nodes.forEach(node => {
      dagreGraph.setNode(node.id, { width: 150, height: 50 });
    });

    // 添加边
    edges.forEach(edge => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    // 计算布局
    dagre.layout(dagreGraph);

    // 更新节点位置
    return nodes.map(node => {
      const position = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: position.x - 75,
          y: position.y - 25
        }
      };
    });
  }
}
```

### 数据同步策略

#### 问题：待办任务数据一致性

**挑战**: 节点关联的待办任务可能在流程图外被修改（标题、状态等），如何保持同步？

**解决方案**:

1. **严格分离：节点永远不存储 Todo 实体**
   - `PersistedNodeData` 只存储 `todoId`
   - 节点的 `label` 仅用于未关联任务的节点
   - Todo 数据通过 selector/hook 实时解析

2. **使用 Selector 模式解析 Todo**
   ```typescript
   // 使用 useMemo 避免不必要的重渲染
   function useDomainNodes(persistedNodes: PersistedNode[], todos: Todo[]): DomainNode[] {
     return useMemo(() => {
       const todoMap = new Map(todos.map(t => [t.id, t]));
       
       return persistedNodes.map(node => {
         if (node.data.todoId) {
           const todo = todoMap.get(node.data.todoId);
           return {
             ...node,
             data: {
               ...node.data,
               resolvedTodo: todo ? {
                 title: todo.title,
                 status: todo.status,
                 priority: todo.priority
               } : undefined,
               computedStyle: todo ? getStyleForTodoStatus(todo.status) : node.data.style
             }
           };
         }
         return node;
       });
     }, [persistedNodes, todos]);
   }
   
   // 根据 Todo 状态计算样式
   function getStyleForTodoStatus(status: TodoStatus): NodeStyle {
     const colorMap = {
       pending: '#1890ff',
       'in-progress': '#faad14',
       completed: '#52c41a',
       paused: '#8c8c8c'
     };
     return {
       backgroundColor: colorMap[status],
       borderColor: colorMap[status],
       borderWidth: 2
     };
   }
   ```

3. **全局状态同步（可选）**
   ```typescript
   // 在 FlowchartCanvas 中监听任务更新
   useEffect(() => {
     const unsubscribe = window.electron.on('todo:updated', (updatedTodo) => {
       // 不需要手动刷新，selector 会自动重新计算
       // 只需要触发 todos 数组的更新
       setTodos(prev => prev.map(t => t.id === updatedTodo.id ? updatedTodo : t));
     });
     return unsubscribe;
   }, []);
   ```

### 增量更新策略 (Patch Model)

#### 问题：全量删除再插入效率低且无法支持 Undo/Redo

**挑战**: 
- 100+ 节点时性能抖动
- 无法做增量 Undo/Redo
- 无法支持协作编辑和版本历史

**解决方案**:

1. **使用 Patch 模型进行增量更新**
   ```typescript
   class FlowchartPatchService {
     // 应用 Patch 到持久化层
     static applyPatch(
       schema: FlowchartSchema,
       nodes: PersistedNode[],
       edges: PersistedEdge[],
       patch: FlowchartPatch
     ): { nodes: PersistedNode[]; edges: PersistedEdge[] } {
       switch (patch.type) {
         case 'addNode':
           return { nodes: [...nodes, patch.node], edges };
         
         case 'updateNode':
           return {
             nodes: nodes.map(n => 
               n.id === patch.id ? { ...n, ...patch.changes } : n
             ),
             edges
           };
         
         case 'removeNode':
           return {
             nodes: nodes.filter(n => n.id !== patch.id),
             edges: edges.filter(e => e.source !== patch.id && e.target !== patch.id)
           };
         
         case 'addEdge':
           return { nodes, edges: [...edges, patch.edge] };
         
         case 'updateEdge':
           return {
             nodes,
             edges: edges.map(e => 
               e.id === patch.id ? { ...e, ...patch.changes } : e
             )
           };
         
         case 'removeEdge':
           return { nodes, edges: edges.filter(e => e.id !== patch.id) };
         
         default:
           return { nodes, edges };
       }
     }
     
     // 批量应用 Patches
     static applyPatches(
       schema: FlowchartSchema,
       nodes: PersistedNode[],
       edges: PersistedEdge[],
       patches: FlowchartPatch[]
     ): { nodes: PersistedNode[]; edges: PersistedEdge[] } {
       return patches.reduce(
         (acc, patch) => this.applyPatch(schema, acc.nodes, acc.edges, patch),
         { nodes, edges }
       );
     }
   }
   ```

2. **Undo/Redo 实现**
   ```typescript
   class UndoRedoManager {
     private history: PatchHistory = {
       patches: [],
       currentIndex: -1
     };
     
     // 执行操作并记录到历史
     execute(patch: FlowchartPatch): void {
       // 清除当前位置之后的历史
       this.history.patches = this.history.patches.slice(0, this.history.currentIndex + 1);
       
       // 添加新 patch
       this.history.patches.push(patch);
       this.history.currentIndex++;
       
       // 限制历史记录大小
       if (this.history.patches.length > 100) {
         this.history.patches.shift();
         this.history.currentIndex--;
       }
     }
     
     // 撤销
     undo(): FlowchartPatch | null {
       if (this.history.currentIndex < 0) return null;
       
       const patch = this.history.patches[this.history.currentIndex];
       this.history.currentIndex--;
       
       // 返回反向 patch
       return this.invertPatch(patch);
     }
     
     // 重做
     redo(): FlowchartPatch | null {
       if (this.history.currentIndex >= this.history.patches.length - 1) return null;
       
       this.history.currentIndex++;
       return this.history.patches[this.history.currentIndex];
     }
     
     // 生成反向 patch
     private invertPatch(patch: FlowchartPatch): FlowchartPatch {
       switch (patch.type) {
         case 'addNode':
           return { type: 'removeNode', id: patch.node.id };
         case 'removeNode':
           // 需要保存被删除的节点数据
           throw new Error('Cannot invert removeNode without original data');
         case 'updateNode':
           // 需要保存原始数据
           throw new Error('Cannot invert updateNode without original data');
         // ... 其他类型
         default:
           throw new Error(`Unknown patch type`);
       }
     }
   }
   ```

3. **数据库增量保存**
   ```typescript
   class FlowchartRepository {
     // 保存 Patches 而不是全量保存
     static async savePatches(
       flowchartId: string,
       patches: FlowchartPatch[]
     ): Promise<void> {
       const db = await DatabaseManager.getConnection();
       const now = Date.now();
       
       for (const patch of patches) {
         switch (patch.type) {
           case 'addNode':
             db.run(`
               INSERT INTO flowchart_nodes 
               (id, flowchart_id, type, position, data, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)
             `, [
               patch.node.id,
               flowchartId,
               patch.node.type,
               JSON.stringify(patch.node.position),
               JSON.stringify(patch.node.data),
               now,
               now
             ]);
             break;
           
           case 'updateNode':
             db.run(`
               UPDATE flowchart_nodes 
               SET position = COALESCE(?, position),
                   data = COALESCE(?, data),
                   updated_at = ?
               WHERE id = ?
             `, [
               patch.changes.position ? JSON.stringify(patch.changes.position) : null,
               patch.changes.data ? JSON.stringify(patch.changes.data) : null,
               now,
               patch.id
             ]);
             break;
           
           case 'removeNode':
             db.run('DELETE FROM flowchart_nodes WHERE id = ?', [patch.id]);
             db.run('DELETE FROM flowchart_edges WHERE source = ? OR target = ?', [patch.id, patch.id]);
             break;
           
           // ... 处理其他 patch 类型
         }
       }
     }
   }
   ```

### 数据库性能优化

#### 问题：全量删除再插入效率低

**挑战**: 当前设计使用"删除所有节点/边 → 重新插入"的方式保存，导致：
- 索引频繁重建
- 不必要的数据库操作
- 无法追踪变更历史

**解决方案**:

1. **使用 UPSERT 策略**
   ```typescript
   class FlowchartRepository {
     static async save(flowchart: Flowchart): Promise<void> {
       const db = await DatabaseManager.getConnection();
       
       // 使用 INSERT OR REPLACE 而不是 DELETE + INSERT
       const nodeStmt = db.prepare(`
         INSERT OR REPLACE INTO flowchart_nodes 
         (id, flowchart_id, type, position, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 
           COALESCE((SELECT created_at FROM flowchart_nodes WHERE id = ?), ?),
           ?
         )
       `);
       
       flowchart.nodes.forEach(node => {
         const now = Date.now();
         nodeStmt.run([
           node.id,
           flowchart.id,
           node.type,
           JSON.stringify(node.position),
           JSON.stringify(node.data),
           node.id,  // 用于 COALESCE 查询
           now,      // 新记录的 created_at
           now       // updated_at
         ]);
       });
       
       // 删除不再存在的节点
       const existingNodeIds = flowchart.nodes.map(n => n.id);
       db.run(`
         DELETE FROM flowchart_nodes 
         WHERE flowchart_id = ? AND id NOT IN (${existingNodeIds.map(() => '?').join(',')})
       `, [flowchart.id, ...existingNodeIds]);
     }
   }
   ```

2. **边的哈希优化**
   ```typescript
   // 为边添加 connection_hash 用于快速对比
   function getConnectionHash(edge: FlowchartEdge): string {
     return crypto.createHash('md5')
       .update(`${edge.source}-${edge.target}-${edge.type}`)
       .digest('hex');
   }
   
   // 保存时使用哈希快速判断是否需要更新
   const edgeStmt = db.prepare(`
     INSERT OR REPLACE INTO flowchart_edges 
     (id, flowchart_id, source, target, type, label, style, connection_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 
       COALESCE((SELECT created_at FROM flowchart_edges WHERE id = ?), ?),
       ?
     )
   `);
   ```

### 交互细节补充

#### 1. 锁定节点功能

**需求**: 用户手动调整节点位置后，不希望自动布局破坏布局。

**实现**:
```typescript
// 在节点数据中添加 isLocked 标志
interface NodeData {
  isLocked?: boolean;
}

// 自动布局时跳过锁定的节点
class LayoutService {
  static hierarchical(nodes: Node[], edges: Edge[]): Node[] {
    const dagreGraph = new dagre.graphlib.Graph();
    
    // 只对未锁定的节点进行布局
    const unlocked = nodes.filter(n => !n.data.isLocked);
    const locked = nodes.filter(n => n.data.isLocked);
    
    unlocked.forEach(node => {
      dagreGraph.setNode(node.id, { width: 150, height: 50 });
    });
    
    // ... 布局计算
    
    // 合并锁定和未锁定的节点
    return [...layoutedUnlocked, ...locked];
  }
}

// UI: 右键菜单添加"锁定位置"选项
const NodeContextMenu = ({ node, onLock }) => (
  <Menu>
    <Menu.Item onClick={() => onLock(node.id, !node.data.isLocked)}>
      {node.data.isLocked ? '解锁位置' : '锁定位置'}
    </Menu.Item>
  </Menu>
);
```

#### 2. 循环依赖检查

**需求**: 防止创建导致死循环的连线。

**实现**:
```typescript
// 检测是否会形成循环
function wouldCreateCycle(
  edges: Edge[], 
  newEdge: { source: string; target: string }
): boolean {
  // 构建邻接表
  const graph = new Map<string, string[]>();
  [...edges, newEdge].forEach(edge => {
    if (!graph.has(edge.source)) graph.set(edge.source, []);
    graph.get(edge.source)!.push(edge.target);
  });
  
  // DFS 检测环
  const visited = new Set<string>();
  const recStack = new Set<string>();
  
  function hasCycle(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    
    const neighbors = graph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recStack.has(neighbor)) {
        return true;  // 发现环
      }
    }
    
    recStack.delete(node);
    return false;
  }
  
  return hasCycle(newEdge.source);
}

// 在 onConnect 中使用
const onConnect = useCallback((params: Connection) => {
  if (wouldCreateCycle(edges, params)) {
    message.warning('无法创建连接：会导致循环依赖');
    return;
  }
  setEdges((eds) => addEdge(params, eds));
}, [edges]);
```

### 导出功能增强

#### Mermaid 特殊字符转义

**问题**: 节点标签可能包含特殊字符（换行、引号、括号等），导致 Mermaid 语法错误。

**解决方案**:
```typescript
class MermaidExporter {
  static export(flowchart: Flowchart): string {
    let mermaid = 'graph TD\n';
    
    flowchart.nodes.forEach(node => {
      const label = this.escapeLabel(node.data.label);
      const shape = this.getNodeShape(node.type);
      mermaid += `  ${node.id}${shape[0]}"${label}"${shape[1]}\n`;
    });
    
    flowchart.edges.forEach(edge => {
      const arrow = this.getArrowStyle(edge.type);
      const label = edge.label ? `|${this.escapeLabel(edge.label)}|` : '';
      mermaid += `  ${edge.source} ${arrow}${label} ${edge.target}\n`;
    });
    
    return mermaid;
  }

  private static escapeLabel(label: string): string {
    return label
      .replace(/\n/g, '<br/>')           // 换行转为 <br/>
      .replace(/"/g, '#quot;')           // 引号转义
      .replace(/\[/g, '#91;')            // 左方括号
      .replace(/\]/g, '#93;')            // 右方括号
      .replace(/\{/g, '#123;')           // 左花括号
      .replace(/\}/g, '#125;')           // 右花括号
      .replace(/\(/g, '#40;')            // 左圆括号
      .replace(/\)/g, '#41;')            // 右圆括号
      .replace(/</g, '&lt;')             // 小于号
      .replace(/>/g, '&gt;')             // 大于号
      .trim();
  }
}
```

### 数据同步策略

### 数据库操作

```typescript
class FlowchartRepository {
  // 保存流程图（使用 UPSERT 策略）
  static async save(flowchart: Flowchart): Promise<void> {
    const db = await DatabaseManager.getConnection();
    
    // 保存流程图元数据
    db.run(`
      INSERT OR REPLACE INTO flowcharts (id, name, description, viewport, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      flowchart.id,
      flowchart.name,
      flowchart.description,
      JSON.stringify(flowchart.viewport),
      Date.now()
    ]);

    // 使用 UPSERT 保存节点（保留 created_at）
    const nodeStmt = db.prepare(`
      INSERT OR REPLACE INTO flowchart_nodes 
      (id, flowchart_id, type, position, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM flowchart_nodes WHERE id = ?), ?),
        ?
      )
    `);
    
    const now = Date.now();
    flowchart.nodes.forEach(node => {
      nodeStmt.run([
        node.id,
        flowchart.id,
        node.type,
        JSON.stringify(node.position),
        JSON.stringify(node.data),
        node.id,  // 用于 COALESCE 查询
        now,      // 新记录的 created_at
        now       // updated_at
      ]);
    });

    // 删除不再存在的节点
    const existingNodeIds = flowchart.nodes.map(n => n.id);
    if (existingNodeIds.length > 0) {
      db.run(`
        DELETE FROM flowchart_nodes 
        WHERE flowchart_id = ? AND id NOT IN (${existingNodeIds.map(() => '?').join(',')})
      `, [flowchart.id, ...existingNodeIds]);
    } else {
      db.run('DELETE FROM flowchart_nodes WHERE flowchart_id = ?', [flowchart.id]);
    }

    // 使用 UPSERT 保存边（带哈希优化）
    const edgeStmt = db.prepare(`
      INSERT OR REPLACE INTO flowchart_edges 
      (id, flowchart_id, source, target, source_handle, target_handle, type, label, style, connection_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 
        COALESCE((SELECT created_at FROM flowchart_edges WHERE id = ?), ?),
        ?
      )
    `);
    
    flowchart.edges.forEach(edge => {
      const connectionHash = this.getConnectionHash(edge);
      edgeStmt.run([
        edge.id,
        flowchart.id,
        edge.source,
        edge.target,
        edge.sourceHandle,
        edge.targetHandle,
        edge.type,
        edge.label,
        JSON.stringify(edge.style),
        connectionHash,
        edge.id,  // 用于 COALESCE 查询
        now,      // 新记录的 created_at
        now       // updated_at
      ]);
    });

    // 删除不再存在的边
    const existingEdgeIds = flowchart.edges.map(e => e.id);
    if (existingEdgeIds.length > 0) {
      db.run(`
        DELETE FROM flowchart_edges 
        WHERE flowchart_id = ? AND id NOT IN (${existingEdgeIds.map(() => '?').join(',')})
      `, [flowchart.id, ...existingEdgeIds]);
    } else {
      db.run('DELETE FROM flowchart_edges WHERE flowchart_id = ?', [flowchart.id]);
    }
  }

  // 计算连接哈希
  private static getConnectionHash(edge: FlowchartEdge): string {
    const crypto = require('crypto');
    return crypto.createHash('md5')
      .update(`${edge.source}-${edge.target}-${edge.type}`)
      .digest('hex');
  }

  // 加载流程图（实时加载关联的待办任务）
  static async load(id: string): Promise<Flowchart> {
    const db = await DatabaseManager.getConnection();
    
    const flowchart = db.get('SELECT * FROM flowcharts WHERE id = ?', [id]);
    const nodes = db.all('SELECT * FROM flowchart_nodes WHERE flowchart_id = ?', [id]);
    const edges = db.all('SELECT * FROM flowchart_edges WHERE flowchart_id = ?', [id]);

    // 解析节点并实时加载关联的任务
    const parsedNodes = await Promise.all(
      nodes.map(async (n) => {
        const data = JSON.parse(n.data);
        
        // 如果节点关联了任务，实时加载任务数据
        if (data.todoId) {
          const todo = await TodoRepository.findById(data.todoId);
          return {
            id: n.id,
            type: n.type,
            position: JSON.parse(n.position),
            data: {
              ...data,
              todo,  // 运行时注入，不持久化
              label: todo?.title || data.label  // 优先使用任务标题
            }
          };
        }
        
        return {
          id: n.id,
          type: n.type,
          position: JSON.parse(n.position),
          data
        };
      })
    );

    return {
      id: flowchart.id,
      name: flowchart.name,
      description: flowchart.description,
      viewport: JSON.parse(flowchart.viewport),
      nodes: parsedNodes,
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.source_handle,
        targetHandle: e.target_handle,
        type: e.type,
        label: e.label,
        style: JSON.parse(e.style)
      })),
      createdAt: flowchart.created_at,
      updatedAt: flowchart.updated_at
    };
  }
}
```

### 性能优化

1. **防抖保存**: 使用 lodash.debounce 延迟保存
2. **虚拟化渲染**: React Flow 内置支持
3. **Memo 优化**: 使用 React.memo 避免不必要的重渲染
4. **懒加载**: 流程图列表按需加载

```typescript
import { debounce } from 'lodash';

const debouncedSave = debounce((flowchart: Flowchart) => {
  FlowchartRepository.save(flowchart);
}, 500);
```

## 技术依赖

- **reactflow**: ^11.10.0 - 核心流程图库
- **dagre**: ^0.8.5 - 自动布局算法
- **html-to-image**: ^1.11.11 - PNG 导出
- **fast-check**: ^3.15.0 - 属性测试库（开发依赖）

## 参考资料

- [React Flow 官方文档](https://reactflow.dev)
- [Mermaid 语法文档](https://mermaid.js.org)
- [Dagre 布局算法](https://github.com/dagrejs/dagre)
- [Taskade 产品参考](https://www.taskade.com)

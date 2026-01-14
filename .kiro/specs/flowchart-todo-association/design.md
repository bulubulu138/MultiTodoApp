# Design Document: 流程图与待办关联功能

## Overview

本设计文档描述了流程图与待办任务关联功能的技术实现方案。该功能支持两种关联方式：
1. **流程图级别关联**：待办与整个流程图关联，用于表示该待办与整个流程相关
2. **节点级别关联**：待办与流程图中的特定节点关联，用于在节点中显示待办信息（已存在）

系统采用分层架构设计，包括数据持久化层、业务逻辑层和UI展示层，确保数据一致性和良好的用户体验。

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        UI Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ FlowchartCanvas  │  │ TodoViewDrawer   │                │
│  │  + SearchBar     │  │  + Associations  │                │
│  └──────────────────┘  └──────────────────┘                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FlowchartTodoAssociationService                     │  │
│  │  - createAssociation()                               │  │
│  │  - deleteAssociation()                               │  │
│  │  - queryAssociations()                               │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Persistence Layer                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  FlowchartTodoAssociationRepository                  │  │
│  │  - insert()                                          │  │
│  │  - delete()                                          │  │
│  │  - queryByTodoId()                                   │  │
│  │  - queryByFlowchartId()                              │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Database (SQLite)                                   │  │
│  │  - flowchart_todo_associations table                 │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```


### 数据流

1. **创建关联流程**：
   ```
   User clicks todo in search → UI calls service.createAssociation() 
   → Service validates → Repository inserts to DB → UI updates
   ```

2. **查询关联流程**：
   ```
   User opens todo detail → UI calls service.queryAssociations() 
   → Repository queries DB → Service formats data → UI displays
   ```

3. **删除关联流程**：
   ```
   User clicks associated todo → UI calls service.deleteAssociation() 
   → Repository deletes from DB → UI updates
   ```

## Components and Interfaces

### 1. 数据持久化层

#### 1.1 数据库表结构

**新增表：flowchart_todo_associations**

```sql
CREATE TABLE flowchart_todo_associations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flowchart_id TEXT NOT NULL,
  todo_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (flowchart_id) REFERENCES flowcharts(id) ON DELETE CASCADE,
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  UNIQUE(flowchart_id, todo_id)
);

CREATE INDEX idx_flowchart_todo_assoc_flowchart 
  ON flowchart_todo_associations(flowchart_id);
CREATE INDEX idx_flowchart_todo_assoc_todo 
  ON flowchart_todo_associations(todo_id);
```

#### 1.2 FlowchartTodoAssociationRepository

```typescript
export class FlowchartTodoAssociationRepository {
  constructor(private db: Database.Database);

  // 创建关联
  create(flowchartId: string, todoId: number): void;

  // 删除关联
  delete(flowchartId: string, todoId: number): void;

  // 查询流程图的所有关联待办
  queryByFlowchartId(flowchartId: string): number[];

  // 查询待办的所有关联流程图
  queryByTodoId(todoId: number): FlowchartAssociationInfo[];

  // 批量查询多个待办的关联流程图
  queryByTodoIds(todoIds: number[]): Map<number, FlowchartAssociationInfo[]>;

  // 检查关联是否存在
  exists(flowchartId: string, todoId: number): boolean;
}

interface FlowchartAssociationInfo {
  flowchartId: string;
  flowchartName: string;
  flowchartDescription?: string;
  createdAt: number;
}
```


### 2. UI组件层

#### 2.1 FlowchartTodoSearchBar 组件

位于流程图画布顶部的待办搜索栏组件。

```typescript
interface FlowchartTodoSearchBarProps {
  flowchartId: string;
  todos: Todo[];
  associatedTodoIds: number[];
  onAssociate: (todoId: number) => void;
  onDisassociate: (todoId: number) => void;
}

export const FlowchartTodoSearchBar: React.FC<FlowchartTodoSearchBarProps>;
```

**功能特性**：
- 实时搜索待办（防抖300ms）
- 显示搜索结果下拉列表
- 标识已关联的待办
- 支持点击切换关联状态

#### 2.2 TodoViewDrawer 组件增强

在现有的待办详情抽屉中增加关联流程图显示区域。

```typescript
interface TodoViewDrawerProps {
  // ... 现有属性
  onOpenFlowchart?: (flowchartId: string, nodeId?: string) => void;
}
```

**新增功能**：
- 显示流程图级别关联列表
- 显示节点级别关联列表（已存在）
- 支持点击跳转到流程图
- 区分两种关联类型的显示样式


### 3. IPC通信接口

#### 3.1 Main Process API

```typescript
// 在 main.ts 中注册 IPC handlers
ipcMain.handle('flowchart-todo-association:create', 
  async (event, flowchartId: string, todoId: number) => {
    // 创建关联
  });

ipcMain.handle('flowchart-todo-association:delete', 
  async (event, flowchartId: string, todoId: number) => {
    // 删除关联
  });

ipcMain.handle('flowchart-todo-association:query-by-flowchart', 
  async (event, flowchartId: string) => {
    // 查询流程图的关联待办
  });

ipcMain.handle('flowchart-todo-association:query-by-todo', 
  async (event, todoId: number) => {
    // 查询待办的关联流程图
  });

ipcMain.handle('flowchart-todo-association:query-by-todos', 
  async (event, todoIds: number[]) => {
    // 批量查询待办的关联流程图
  });
```

#### 3.2 Renderer Process API

```typescript
// 在 preload.ts 中暴露 API
window.electronAPI.flowchartTodoAssociation = {
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
};
```


## Data Models

### 1. 流程图级别关联模型

```typescript
export interface FlowchartTodoAssociation {
  id?: number;
  flowchartId: string;
  todoId: number;
  createdAt: number;
}
```

### 2. 关联信息展示模型

```typescript
export interface FlowchartAssociationDisplay {
  type: 'flowchart' | 'node';
  flowchartId: string;
  flowchartName: string;
  flowchartDescription?: string;
  nodeId?: string;  // 仅节点级别关联有值
  nodeLabel?: string;  // 仅节点级别关联有值
  createdAt?: number;
}
```

### 3. 搜索结果模型

```typescript
export interface TodoSearchResult {
  todo: Todo;
  isAssociated: boolean;
  matchScore: number;  // 匹配度分数，用于排序
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 搜索功能正确性
*For any* 搜索关键词和待办列表，搜索结果应该只包含标题或内容中包含该关键词的待办
**Validates: Requirements 1.2, 1.3**

### Property 2: 关联创建持久化
*For any* 流程图ID和待办ID，创建关联后从数据库查询应该能够获取到该关联记录
**Validates: Requirements 2.1, 2.4, 6.1**

### Property 3: 已关联状态显示
*For any* 已关联的待办，在搜索结果中应该显示"已关联"标识
**Validates: Requirements 2.3**

### Property 4: 节点关联数据存储
*For any* 节点和待办，创建节点级别关联后，节点数据中应该包含待办ID
**Validates: Requirements 3.1, 6.2**

### Property 5: 节点显示待办信息
*For any* 关联了待办的节点，节点应该显示待办的标题和状态
**Validates: Requirements 3.2**

### Property 6: 节点样式根据待办状态更新
*For any* 关联了待办的节点，节点样式应该根据待办的状态（pending/in_progress/completed/paused）正确更新
**Validates: Requirements 3.3**

### Property 7: 节点取消关联清理
*For any* 节点，取消待办关联后，节点数据中不应该包含待办ID
**Validates: Requirements 3.4**

### Property 8: 待办删除时清理节点引用
*For any* 被删除的待办，所有引用该待办的节点都应该自动清理待办ID引用
**Validates: Requirements 3.5, 6.6**

### Property 9: 取消关联删除记录
*For any* 流程图ID和待办ID，取消关联后从数据库查询不应该获取到该关联记录
**Validates: Requirements 4.1, 4.3, 6.3**

### Property 10: 待办详情显示流程图级别关联
*For any* 有流程图级别关联的待办，详情页应该显示流程图名称和描述
**Validates: Requirements 5.2**

### Property 11: 待办详情显示节点级别关联
*For any* 有节点级别关联的待办，详情页应该显示流程图名称、节点标签
**Validates: Requirements 5.3**

### Property 12: 同时显示两种关联类型
*For any* 同时有流程图级别和节点级别关联的待办，详情页应该分别显示两种类型的关联
**Validates: Requirements 5.4**

### Property 13: 点击流程图级别关联导航
*For any* 流程图级别关联，点击后应该打开对应的流程图
**Validates: Requirements 5.6**

### Property 14: 点击节点级别关联导航并高亮
*For any* 节点级别关联，点击后应该打开对应的流程图并高亮显示对应节点
**Validates: Requirements 5.7**

### Property 15: 流程图删除时级联删除关联
*For any* 被删除的流程图，所有相关的流程图级别关联记录都应该自动删除
**Validates: Requirements 6.4**

### Property 16: 待办删除时级联删除关联
*For any* 被删除的待办，所有相关的流程图级别关联记录都应该自动删除
**Validates: Requirements 6.5**

### Property 17: 查询返回最新数据
*For any* 关联查询操作，应该返回数据库中的最新关联数据
**Validates: Requirements 6.7**

### Property 18: 防抖机制减少请求
*For any* 快速连续的搜索输入，防抖机制应该确保只发送最后一次搜索请求
**Validates: Requirements 7.2**


## Error Handling

### 1. 数据库错误处理

**场景**：数据库操作失败（连接失败、约束冲突等）

**处理策略**：
- 捕获数据库异常
- 记录错误日志
- 向用户显示友好的错误提示
- 不影响其他功能的正常使用

**示例**：
```typescript
try {
  await repository.create(flowchartId, todoId);
  message.success('关联成功');
} catch (error) {
  console.error('创建关联失败:', error);
  message.error('关联失败，请重试');
}
```

### 2. 重复关联处理

**场景**：用户尝试关联已经关联的待办

**处理策略**：
- 数据库层面使用 UNIQUE 约束防止重复
- UI层面检查关联状态，显示"已关联"标识
- 点击已关联的待办时，执行取消关联操作

### 3. 无效引用处理

**场景**：待办或流程图被删除后，关联记录变为无效

**处理策略**：
- 使用外键约束 ON DELETE CASCADE 自动删除关联记录
- 节点级别关联：在节点渲染时检查待办是否存在，显示"(任务已删除)"提示
- 定期清理无效引用（可选）

### 4. 搜索性能问题

**场景**：待办数量过多导致搜索缓慢

**处理策略**：
- 使用防抖机制（300ms）减少搜索请求
- 限制搜索结果数量（最多50条）
- 使用数据库索引优化查询性能
- 前端使用虚拟滚动优化大列表渲染

### 5. 并发操作冲突

**场景**：多个操作同时修改关联关系

**处理策略**：
- 使用数据库事务确保操作原子性
- 乐观锁机制处理并发更新
- UI层面禁用正在处理的操作按钮


## Testing Strategy

### 单元测试和属性测试的互补性

本功能采用双重测试策略：
- **单元测试**：验证具体示例、边缘情况和错误条件
- **属性测试**：验证通用属性在所有输入下的正确性

两者互补，共同确保全面的测试覆盖：
- 单元测试捕获具体的bug和边缘情况
- 属性测试验证系统的通用正确性

### 属性测试配置

**测试框架**：使用 `fast-check` 库进行属性测试（TypeScript/JavaScript生态系统的标准PBT库）

**测试配置**：
- 每个属性测试运行最少 100 次迭代
- 每个测试必须引用设计文档中的属性编号
- 标签格式：`Feature: flowchart-todo-association, Property {number}: {property_text}`

**示例**：
```typescript
import fc from 'fast-check';

// Feature: flowchart-todo-association, Property 2: 关联创建持久化
test('创建关联后应该能从数据库查询到', () => {
  fc.assert(
    fc.property(
      fc.string(), // flowchartId
      fc.integer({ min: 1 }), // todoId
      async (flowchartId, todoId) => {
        // 创建关联
        await repository.create(flowchartId, todoId);
        
        // 查询验证
        const associations = await repository.queryByTodoId(todoId);
        const found = associations.some(a => a.flowchartId === flowchartId);
        
        expect(found).toBe(true);
        
        // 清理
        await repository.delete(flowchartId, todoId);
      }
    ),
    { numRuns: 100 }
  );
});
```

### 单元测试重点

**UI组件测试**：
- 搜索栏组件渲染正确
- 搜索结果显示正确
- 已关联标识显示正确
- 点击操作触发正确的回调

**数据库操作测试**：
- 创建关联成功
- 删除关联成功
- 查询关联返回正确结果
- 重复关联被正确处理
- 级联删除正确执行

**边缘情况测试**：
- 空搜索关键词
- 搜索结果为空
- 待办或流程图不存在
- 数据库连接失败

### 集成测试

**端到端流程测试**：
1. 打开流程图 → 搜索待办 → 创建关联 → 验证关联成功
2. 打开待办详情 → 查看关联列表 → 点击跳转 → 验证流程图打开
3. 删除待办 → 验证关联自动清理
4. 删除流程图 → 验证关联自动清理

**性能测试**：
- 搜索响应时间 < 300ms
- 大量待办（1000+）时的搜索性能
- 批量查询关联的性能


# 修复外键约束失败 - 代码修改总结

## 修改概览

**问题：** 流程图只保存在 localStorage，导致创建关联时外键约束失败  
**解决方案：** 将流程图数据迁移到数据库持久化  
**修改文件数：** 4 个核心文件  
**新增 IPC Handlers：** 5 个

---

## 文件修改详情

### 1. src/main/main.ts

**新增 IPC Handlers：**

```typescript
// 保存流程图到数据库
ipcMain.handle('flowchart:save', async (_, flowchartData: any) => { ... })

// 从数据库加载流程图
ipcMain.handle('flowchart:load', async (_, flowchartId: string) => { ... })

// 列出所有流程图
ipcMain.handle('flowchart:list', async () => { ... })

// 删除流程图
ipcMain.handle('flowchart:delete', async (_, flowchartId: string) => { ... })

// 保存流程图增量更新
ipcMain.handle('flowchart:savePatches', async (_, flowchartId: string, patches: any[]) => { ... })
```

**关键逻辑：**
- `flowchart:save` 会检查流程图是否存在，如果存在则删除后重新创建（确保数据一致性）
- 所有操作都使用 `FlowchartRepository` 进行数据库访问
- 添加了详细的日志记录

---

### 2. src/main/preload.ts

**修改的接口定义：**

```typescript
// 扩展 flowchart API
flowchart: {
  getAssociationsByTodoIds: (todoIds: number[]) => Promise<...>;
  save: (flowchartData: any) => Promise<{success: boolean}>;        // 新增
  load: (flowchartId: string) => Promise<any | null>;               // 新增
  list: () => Promise<any[]>;                                       // 新增
  delete: (flowchartId: string) => Promise<{success: boolean}>;     // 新增
  savePatches: (flowchartId: string, patches: any[]) => Promise<{success: boolean}>; // 新增
};
```

**暴露的 IPC 方法：**

```typescript
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
}
```

---

### 3. src/renderer/components/flowchart/FlowchartDrawer.tsx

**主要修改：**

#### 3.1 加载流程图（useEffect）

**之前：**
```typescript
const rawData = localStorage.getItem(key);
const data = JSON.parse(rawData || '{}');
```

**之后：**
```typescript
const data = await window.electronAPI.flowchart.load(flowchartId);
```

#### 3.2 创建流程图

**之前：**
```typescript
localStorage.setItem(key, JSON.stringify(data));
```

**之后：**
```typescript
await window.electronAPI.flowchart.save({
  schema,
  nodes: templateNodes,
  edges: templateEdges
});
```

#### 3.3 保存逻辑

**函数重命名：**
- `savePatchesToLocalStorage` → `savePatchesToDatabase`

**实现修改：**
```typescript
// 之前
localStorage.setItem(key, JSON.stringify(data));

// 之后
await window.electronAPI.flowchart.save({
  schema: { ...currentFlowchart, updatedAt: Date.now() },
  nodes,
  edges
});
```

#### 3.4 其他修改

- `handleConfirmName`: 使用数据库 API
- `handleNewFlowchart`: 使用数据库 API
- `handleNameChange`: 使用数据库 API
- `handleClose`: 使用数据库 API
- 组件卸载清理：使用数据库 API

---

### 4. src/renderer/components/FlowchartList.tsx

**主要修改：**

#### 4.1 加载流程图列表

**之前：**
```typescript
const keys = Object.keys(localStorage).filter(key => key.startsWith('flowchart_'));
keys.forEach(key => {
  const data = JSON.parse(localStorage.getItem(key) || '{}');
  if (data.schema) {
    flowchartList.push(data.schema);
  }
});
```

**之后：**
```typescript
const flowchartList = await window.electronAPI.flowchart.list();
```

#### 4.2 删除流程图

**之前：**
```typescript
localStorage.removeItem(key);
```

**之后：**
```typescript
await window.electronAPI.flowchart.delete(flowchart.id);
```

#### 4.3 重命名流程图

**之前：**
```typescript
const data = JSON.parse(localStorage.getItem(key) || '{}');
data.schema.name = newName.trim();
localStorage.setItem(key, JSON.stringify(data));
```

**之后：**
```typescript
const flowchartData = await window.electronAPI.flowchart.load(renamingFlowchart.id);
flowchartData.schema.name = newName.trim();
await window.electronAPI.flowchart.save(flowchartData);
```

#### 4.4 导出流程图

**之前：**
```typescript
const data = localStorage.getItem(key);
const blob = new Blob([data], { type: 'application/json' });
```

**之后：**
```typescript
const data = await window.electronAPI.flowchart.load(flowchart.id);
const jsonData = JSON.stringify(data, null, 2);
const blob = new Blob([jsonData], { type: 'application/json' });
```

---

## 数据流对比

### 之前（使用 localStorage）

```
创建流程图
  ↓
保存到 localStorage
  ↓
尝试创建关联
  ↓
❌ 外键约束失败（flowchart_id 不在数据库中）
```

### 之后（使用数据库）

```
创建流程图
  ↓
保存到数据库 (flowcharts 表)
  ↓
创建关联
  ↓
✅ 外键约束检查通过
  ↓
关联记录保存到 flowchart_todo_associations 表
```

---

## API 调用示例

### 保存流程图

```typescript
await window.electronAPI.flowchart.save({
  schema: {
    id: 'flowchart-1736889123456',
    name: '我的流程图',
    description: '描述',
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: 1736889123456,
    updatedAt: 1736889123456
  },
  nodes: [
    {
      id: 'node-1',
      type: 'rectangle',
      position: { x: 100, y: 100 },
      data: { label: '节点1' }
    }
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2'
    }
  ]
});
```

### 加载流程图

```typescript
const flowchart = await window.electronAPI.flowchart.load('flowchart-1736889123456');
// 返回: { schema, nodes, edges }
```

### 列出所有流程图

```typescript
const flowcharts = await window.electronAPI.flowchart.list();
// 返回: FlowchartSchema[]
```

### 删除流程图

```typescript
await window.electronAPI.flowchart.delete('flowchart-1736889123456');
```

---

## 测试验证

### 验证数据库保存

1. 创建一个流程图
2. 检查控制台日志：`[Flowchart] Created flowchart: flowchart-xxxxx`
3. 使用 SQLite 工具查看数据库，确认 `flowcharts` 表中有记录

### 验证外键约束

1. 创建流程图后，尝试关联待办
2. 应该成功，不再出现 "FOREIGN KEY constraint failed" 错误
3. 检查 `flowchart_todo_associations` 表，确认关联记录已创建

### 验证级联删除

1. 创建流程图并关联待办
2. 删除流程图
3. 检查 `flowchart_todo_associations` 表，确认关联记录已被删除

---

## 性能影响

### 优点
- ✅ 数据一致性更好
- ✅ 支持外键约束和级联删除
- ✅ 支持复杂查询
- ✅ 数据持久化更可靠

### 缺点
- ⚠️ 数据库操作比 localStorage 稍慢
- ⚠️ 需要处理异步操作

### 优化措施
- 使用防抖机制（500ms）减少频繁写入
- 批量操作使用事务
- 添加性能监控

---

## 向后兼容性

### localStorage 数据
- 旧的 localStorage 数据不会自动迁移
- 不会自动清理（避免数据丢失）
- 用户需要重新创建流程图

### 未来改进
- 可以添加数据迁移工具
- 可以添加导入功能，从 localStorage 导入到数据库

---

## 相关文档

- [Bug 修复总结](./BUG_FIX_SUMMARY.md)
- [测试指南](./TESTING_GUIDE.md)
- [需求文档](./requirements.md)
- [设计文档](./design.md)
- [任务列表](./tasks.md)

# 流程图保存问题修复

## 问题描述

用户报告：新建多个流程图后，打开时发现所有流程图的内容都是一样的，只能保存一个流程图的内容。

## 问题原因

在 `FlowchartDrawer.tsx` 和 `FlowchartCanvas.tsx` 的数据流中存在状态同步问题：

1. **FlowchartCanvas 使用本地状态**：
   - FlowchartCanvas 组件接收 `persistedNodes` 和 `persistedEdges` 作为初始值
   - 在组件内部使用 `useState` 创建本地状态副本
   - 当用户编辑流程图时，只更新本地状态，不会同步回父组件

2. **FlowchartDrawer 保存时使用旧数据**：
   - FlowchartDrawer 在保存时使用自己的 `nodes` 和 `edges` 状态
   - 这些状态从未被 FlowchartCanvas 的更新同步
   - 导致保存的始终是初始加载时的数据

3. **闭包陷阱**：
   - `savePatchesToLocalStorage` 函数在闭包中捕获了 `currentFlowchart`、`nodes` 和 `edges`
   - 但这些变量没有作为依赖项，导致使用的是旧值

## 修复方案

### 1. 添加数据同步回调

在 `FlowchartCanvas.tsx` 中：

```typescript
interface FlowchartCanvasProps {
  // ... 其他 props
  onNodesEdgesChange?: (nodes: PersistedNode[], edges: PersistedEdge[]) => void;
}
```

在所有更新 `persistedNodes` 和 `persistedEdges` 的地方，添加回调通知父组件：

```typescript
setPersistedNodes(result.nodes);
setPersistedEdges(result.edges);

// 通知父组件数据已更新
if (onNodesEdgesChange) {
  onNodesEdgesChange(result.nodes, result.edges);
}
```

### 2. 在 FlowchartDrawer 中接收更新

在 `FlowchartDrawer.tsx` 中：

```typescript
// 处理 nodes 和 edges 的更新
const handleNodesEdgesChange = useCallback((newNodes: PersistedNode[], newEdges: PersistedEdge[]) => {
  setNodes(newNodes);
  setEdges(newEdges);
}, []);
```

### 3. 修复闭包依赖

将 `savePatchesToLocalStorage` 改为 `useCallback`，并添加正确的依赖项：

```typescript
const savePatchesToLocalStorage = useCallback((flowchartId: string, patches: FlowchartPatch[]) => {
  // ... 保存逻辑
}, [currentFlowchart, nodes, edges, message]);
```

## 修改的文件

1. **MultiTodoApp/src/renderer/components/FlowchartCanvas.tsx**
   - 添加 `onNodesEdgesChange` prop
   - 在 `handleApplyPatches`、`handleUndo`、`handleRedo` 中调用回调

2. **MultiTodoApp/src/renderer/components/flowchart/FlowchartDrawer.tsx**
   - 添加 `handleNodesEdgesChange` 回调函数
   - 将 `savePatchesToLocalStorage` 改为 `useCallback` 并添加依赖
   - 调整函数定义顺序避免引用错误
   - 在 FlowchartCanvas 中传递 `onNodesEdgesChange` prop

## 测试验证

修复后应该验证以下场景：

1. **创建多个流程图**：
   - 创建流程图 A，添加一些节点
   - 创建流程图 B，添加不同的节点
   - 创建流程图 C，添加其他节点
   - 关闭并重新打开每个流程图，验证内容正确

2. **编辑和保存**：
   - 打开流程图 A，添加新节点
   - 切换到流程图 B，验证内容不同
   - 返回流程图 A，验证新节点已保存

3. **撤销/重做**：
   - 在流程图中进行编辑
   - 使用撤销功能
   - 保存并重新打开，验证撤销后的状态被正确保存

## 技术要点

### 数据流向

```
用户操作
  ↓
FlowchartCanvas (本地状态更新)
  ↓
onNodesEdgesChange 回调
  ↓
FlowchartDrawer (同步状态)
  ↓
savePatchesToLocalStorage (使用最新状态)
  ↓
localStorage
```

### React Hooks 依赖管理

使用 `useCallback` 时必须正确声明依赖项，否则会出现闭包陷阱：

```typescript
// ❌ 错误：缺少依赖项
const save = useCallback(() => {
  localStorage.setItem(key, JSON.stringify({ nodes, edges }));
}, []); // nodes 和 edges 会是旧值

// ✅ 正确：包含所有依赖项
const save = useCallback(() => {
  localStorage.setItem(key, JSON.stringify({ nodes, edges }));
}, [nodes, edges]); // 每次 nodes 或 edges 变化时重新创建函数
```

## 相关问题

这个问题的根本原因是 React 中常见的"状态提升"和"单向数据流"问题：

- 子组件不应该持有父组件需要的状态副本
- 如果子组件需要修改数据，应该通过回调通知父组件
- 父组件是数据的唯一真实来源（Single Source of Truth）

## 后续优化建议

1. **考虑使用 Context 或状态管理库**：
   - 对于复杂的数据流，可以考虑使用 React Context 或 Zustand/Redux
   - 避免 props drilling 和回调地狱

2. **数据持久化改进**：
   - 当前使用 localStorage，可以考虑迁移到数据库
   - 实现更可靠的保存机制（如自动保存、版本控制）

3. **性能优化**：
   - 使用 `useMemo` 缓存计算结果
   - 避免不必要的重新渲染

## 修复日期

2026-01-01

## 修复人员

Kiro AI Assistant

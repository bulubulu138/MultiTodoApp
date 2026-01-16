# 流程图关联数据刷新问题修复

## 问题描述

当用户在待办详情中点击"关联的流程图"跳转到流程图后，再次打开待办详情时，关联的流程图数据消失了。

## 问题原因

1. **组件生命周期问题**：
   - 点击流程图关联时，`TodoViewDrawer` 组件会关闭并卸载
   - 跳转到流程图后，组件状态被清空
   - 再次打开待办详情时，组件重新挂载，但关联数据没有重新加载

2. **依赖追踪问题**：
   - `useFlowchartAssociations` hook 使用 `JSON.stringify(todoIds)` 作为依赖
   - 如果 `todoIds` 值相同，useEffect 不会重新执行
   - 导致关联数据不会自动刷新

## 修复方案

### 1. 流程图级别关联刷新

在 `TodoViewDrawer.tsx` 中，将 `visible` 属性添加到 useEffect 依赖中：

```typescript
useEffect(() => {
  const loadFlowchartLevelAssociations = async () => {
    if (!todo?.id || !visible) {
      setFlowchartLevelAssociations([]);
      return;
    }
    // ... 加载逻辑
  };
  loadFlowchartLevelAssociations();
}, [todo?.id, visible]); // 添加 visible 依赖
```

### 2. 节点级别关联刷新

添加一个新的 useEffect，当抽屉打开时强制刷新节点级别关联：

```typescript
const { associationsByTodo, loading: nodeLevelLoading, refresh: refreshNodeAssociations } = useFlowchartAssociations(todoIds);

// 当抽屉打开时，强制刷新节点级别关联
useEffect(() => {
  if (visible && todo?.id) {
    refreshNodeAssociations();
  }
}, [visible, todo?.id, refreshNodeAssociations]);
```

## 修复效果

- ✅ 每次打开待办详情时，都会重新加载流程图关联数据
- ✅ 确保数据始终是最新的
- ✅ 不影响其他功能的正常使用

## 测试步骤

1. 创建一个待办事项
2. 将待办关联到一个流程图
3. 打开待办详情，查看关联的流程图
4. 点击关联的流程图，跳转到流程图页面
5. 返回待办列表，再次打开同一个待办的详情
6. 验证：关联的流程图应该正常显示

## 相关文件

- `src/renderer/components/TodoViewDrawer.tsx` - 待办详情抽屉组件
- `src/renderer/hooks/useFlowchartAssociations.ts` - 流程图关联数据 hook

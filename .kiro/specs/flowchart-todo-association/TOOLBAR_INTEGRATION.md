# 流程图工具栏集成待办关联功能

## 修改说明

将待办关联功能从独立的浮动搜索框移至流程图顶部工具栏，提供更简洁的用户界面。

## 修改文件

### 1. FlowchartToolbar.tsx
**位置**：`src/renderer/components/flowchart/FlowchartToolbar.tsx`

**主要改动**：
- 添加 `flowchartId` 和 `todos` props
- 添加待办关联状态管理（`associatedTodoIds`）
- 添加加载已关联待办的逻辑
- 添加多选下拉框（Select）用于关联/取消关联待办
- 支持搜索过滤待办（按标题和内容）
- 显示已完成待办的标记

**新增功能**：
```typescript
// 待办关联选择器
<Select
  mode="multiple"
  placeholder="关联待办事项"
  style={{ minWidth: 200, maxWidth: 400 }}
  value={associatedTodoIds}
  onChange={...}
  filterOption={...}
>
  {todos.map(todo => (
    <Option key={todo.id} value={todo.id!}>
      <Space>
        <span>{todo.title}</span>
        {todo.status === 'completed' && (
          <span style={{ color: '#52c41a', fontSize: 12 }}>✓</span>
        )}
      </Space>
    </Option>
  ))}
</Select>
```

### 2. FlowchartDrawer.tsx
**位置**：`src/renderer/components/flowchart/FlowchartDrawer.tsx`

**主要改动**：
- 传递 `flowchartId` 和 `todos` props 给 FlowchartToolbar

## 功能特性

1. **多选支持**：可以同时关联多个待办事项
2. **搜索过滤**：支持按标题和内容搜索待办
3. **状态显示**：已完成的待办显示 ✓ 标记
4. **实时同步**：关联/取消关联立即生效
5. **加载状态**：显示加载中状态
6. **标签折叠**：最多显示 2 个标签，其余折叠

## 用户体验改进

### 之前
- 独立的浮动搜索框在画布上方
- 需要额外的屏幕空间
- 可能遮挡流程图内容

### 现在
- 集成在顶部工具栏
- 与其他工具按钮统一布局
- 不占用画布空间
- 更符合用户操作习惯

## 技术细节

### API 调用
```typescript
// 加载已关联的待办
window.electronAPI.flowchartTodoAssociation.queryByFlowchart(flowchartId)

// 创建关联
window.electronAPI.flowchartTodoAssociation.create(flowchartId, todoId)

// 删除关联
window.electronAPI.flowchartTodoAssociation.delete(flowchartId, todoId)
```

### 状态管理
- `associatedTodoIds`: 已关联的待办 ID 数组
- `loadingAssociations`: 加载状态
- 使用 `useEffect` 在流程图 ID 变化时自动加载关联

### 搜索过滤
```typescript
filterOption={(input, option) => {
  const todo = todos.find(t => t.id === option?.value);
  if (!todo) return false;
  const searchText = input.toLowerCase();
  return (
    todo.title.toLowerCase().includes(searchText) ||
    (todo.content?.toLowerCase().includes(searchText) || false)
  );
}}
```

## 测试建议

1. 打开流程图，验证待办选择器显示
2. 搜索待办，验证过滤功能
3. 选择多个待办，验证关联成功
4. 取消选择，验证取消关联成功
5. 刷新页面，验证关联持久化
6. 测试已完成待办的标记显示

## 后续优化建议

1. 添加待办数量统计显示
2. 支持按状态过滤待办
3. 添加快捷键支持
4. 优化大量待办时的性能
5. 添加批量操作功能

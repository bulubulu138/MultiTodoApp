# 流程图关联外键约束失败 - Bug 修复总结

## 问题描述

用户在尝试关联待办到流程图时遇到以下错误：
```
Error: Error invoking remote method 'flowchart-todo-association:create': SqliteError: FOREIGN KEY constraint failed
```

无论是节点级别的关联还是流程图级别的关联都失败。

## 根本原因

流程图数据只保存在 **localStorage** 中，而没有保存到数据库的 `flowcharts` 表。当尝试创建关联时，`flowchart_todo_associations` 表的外键约束检查失败，因为引用的 `flowchart_id` 在 `flowcharts` 表中不存在。

### 数据库表结构

```sql
CREATE TABLE IF NOT EXISTS flowchart_todo_associations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  flowchart_id TEXT NOT NULL,
  todo_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (flowchart_id) REFERENCES flowcharts(id) ON DELETE CASCADE,  -- 这里的外键约束失败
  FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
  UNIQUE(flowchart_id, todo_id)
)
```

## 修复方案

将流程图数据从 localStorage 迁移到数据库持久化。

### 修改的文件

1. **src/main/main.ts**
   - 添加 `flowchart:save` IPC handler - 保存流程图到数据库
   - 添加 `flowchart:load` IPC handler - 从数据库加载流程图
   - 添加 `flowchart:list` IPC handler - 列出所有流程图
   - 添加 `flowchart:delete` IPC handler - 删除流程图
   - 添加 `flowchart:savePatches` IPC handler - 保存流程图增量更新

2. **src/main/preload.ts**
   - 在 `ElectronAPI.flowchart` 接口中添加新的方法定义
   - 暴露新的 IPC 方法到渲染进程

3. **src/renderer/components/flowchart/FlowchartDrawer.tsx**
   - 修改流程图加载逻辑：从 `localStorage.getItem()` 改为 `window.electronAPI.flowchart.load()`
   - 修改流程图保存逻辑：从 `localStorage.setItem()` 改为 `window.electronAPI.flowchart.save()`
   - 修改所有创建流程图的地方，确保立即保存到数据库
   - 更新 `savePatchesToLocalStorage` 为 `savePatchesToDatabase`

4. **src/renderer/components/FlowchartList.tsx**
   - 修改加载流程图列表：从 `localStorage` 改为 `window.electronAPI.flowchart.list()`
   - 修改删除流程图：从 `localStorage.removeItem()` 改为 `window.electronAPI.flowchart.delete()`
   - 修改重命名流程图：使用数据库 API 更新
   - 修改导出流程图：从数据库加载数据

## 修复后的工作流程

### 创建流程图
1. 用户创建新流程图（通过模板或空白画布）
2. 流程图数据立即保存到数据库的 `flowcharts` 表
3. 节点和边保存到 `flowchart_nodes` 和 `flowchart_edges` 表

### 关联待办到流程图
1. 用户在流程图中搜索待办
2. 点击待办创建关联
3. 系统在 `flowchart_todo_associations` 表中创建记录
4. 外键约束检查通过（因为 `flowchart_id` 现在存在于 `flowcharts` 表中）

### 数据一致性
- 删除流程图时，级联删除所有关联记录（`ON DELETE CASCADE`）
- 删除待办时，级联删除所有关联记录
- 所有数据都在数据库中，保证了数据一致性

## 测试步骤

1. **创建流程图**
   - 打开应用，点击"流程图"按钮
   - 创建一个新的流程图
   - 验证流程图已保存到数据库

2. **关联待办到流程图（流程图级别）**
   - 在流程图画布顶部的搜索栏中搜索待办
   - 点击某个待办创建关联
   - 验证关联成功，没有外键约束错误

3. **关联待办到节点（节点级别）**
   - 在流程图中创建一个节点
   - 在节点编辑面板中选择一个待办
   - 验证关联成功

4. **查看待办详情中的关联**
   - 打开已关联的待办详情页
   - 验证"关联的流程图"区域显示正确的流程图列表
   - 点击流程图名称，验证能正确跳转

5. **删除流程图**
   - 删除一个有关联的流程图
   - 验证关联记录被级联删除

## 注意事项

### 数据迁移
- 现有的 localStorage 中的流程图数据不会自动迁移
- 用户需要重新创建流程图，或者可以添加一个迁移脚本

### 性能考虑
- 数据库操作比 localStorage 稍慢，但提供了更好的数据一致性
- 使用了防抖机制（500ms）来减少频繁的数据库写入

### 向后兼容性
- 旧的 localStorage 数据不会被自动清理
- 可以考虑添加一个清理工具或迁移向导

## 相关文件

- `.kiro/specs/flowchart-todo-association/requirements.md` - 需求文档
- `.kiro/specs/flowchart-todo-association/design.md` - 设计文档
- `.kiro/specs/flowchart-todo-association/tasks.md` - 任务列表
- `src/main/database/FlowchartRepository.ts` - 流程图数据访问层
- `src/main/database/FlowchartTodoAssociationRepository.ts` - 关联数据访问层
- `src/main/database/DatabaseManager.ts` - 数据库管理器

## 修复状态

✅ 已完成 - 2025-01-14

所有修改已完成，流程图现在正确地保存到数据库，外键约束问题已解决。

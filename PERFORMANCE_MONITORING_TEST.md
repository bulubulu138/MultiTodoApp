# 性能监控系统测试指南

## 快速测试步骤

### 1. 启动开发环境

```bash
npm run dev
```

### 2. 验证初始加载监控

打开应用后，在浏览器控制台（F12）查看：

```
🔍 Performance monitoring started
[Performance] initial-load: XXX.XXms
```

### 3. 验证待办列表渲染监控

加载待办列表后，查看控制台：

```
[Performance] todo-list-load: XX.XXms
[Performance] Todo list loaded in XX.XXms
[Performance] todo-list-render: XXX.XXms
[Performance] Todo list rendered X items in XXX.XXms
[Performance] Memory: XXX.XXMB
[Performance] DOM Nodes: XXXX
```

### 4. 验证搜索性能监控

在搜索框输入关键词，查看控制台：

```
[Performance] search: XX.XXms
[搜索] 搜索耗时: XX.XXms, 结果数量: X
```

### 5. 验证保存操作监控

编辑并保存一个待办项，查看控制台：

```
[Performance] save: XX.XXms
```

### 6. 验证性能警告

如果操作超过阈值，会看到警告：

```
[Performance Warning] 待办列表渲染时间超过阈值: XXX.XXms (阈值: 500ms)
[Performance Warning] Label: todo-list-render
[Performance Warning] Average: XXX.XXms
```

### 7. 验证定期监控

等待 10 秒，查看定期监控输出：

```
[Performance] Memory: XXX.XXMB
[Performance] DOM Nodes: XXXX

💡 Performance Suggestions
  - 建议信息（如果有）
```

### 8. 验证性能报告

关闭应用或等待一段时间后，查看完整报告：

```
📊 Performance Report
⏱️  Rendering Performance:
  - Initial Load: XXX.XXms (target: <1000ms)
  - Todo List Render: XXX.XXms (target: <500ms)

⚡ Response Time:
  - Search: XX.XXms (target: <300ms)
  - Save: XX.XXms (target: <100ms)

💾 Resource Usage:
  - Memory: XXX.XXMB (target: <200MB)
  - DOM Nodes: XXXX (target: <500)

🔍 Performance monitoring stopped
```

## 测试场景

### 场景 1: 正常性能（无警告）

1. 创建 10-20 个待办项
2. 执行搜索操作
3. 保存待办项
4. 预期：所有操作都在阈值内，无警告

### 场景 2: 触发渲染性能警告

1. 创建 150+ 个待办项
2. 切换 Tab 或刷新页面
3. 预期：看到 DOM 节点数量警告

### 场景 3: 触发内存警告

1. 长时间运行应用
2. 频繁切换 Tab 和搜索
3. 预期：如果内存超过 200MB，会看到内存警告

### 场景 4: 流程图性能监控

1. 打开流程图编辑器
2. 创建包含 50+ 节点的流程图
3. 保存流程图
4. 预期：看到流程图渲染时间和保存时间

## 预期结果

### ✅ 成功标准

1. **初始加载监控**: 能看到初始加载时间记录
2. **渲染监控**: 能看到待办列表和流程图渲染时间
3. **操作监控**: 能看到搜索和保存操作时间
4. **资源监控**: 能看到内存和 DOM 节点数量
5. **性能警告**: 超过阈值时能看到警告信息
6. **定期监控**: 每 10 秒能看到监控输出
7. **性能报告**: 关闭应用时能看到完整报告
8. **性能建议**: 能看到针对性的优化建议

### ❌ 失败情况

1. 控制台没有任何性能监控输出
2. 性能警告没有触发（即使超过阈值）
3. 内存或 DOM 节点监控没有数据
4. 定期监控没有运行
5. 性能报告格式错误或缺失数据

## 调试技巧

### 1. 检查开发环境

确保 `NODE_ENV` 设置为 `development`：

```javascript
console.log(process.env.NODE_ENV); // 应该输出 "development"
```

### 2. 手动触发监控

在浏览器控制台手动测试：

```javascript
// 导入性能监控（如果可以访问）
const { PerformanceMonitor } = require('./utils/performanceMonitor');

// 测试基本功能
PerformanceMonitor.start('test');
setTimeout(() => {
  const duration = PerformanceMonitor.end('test');
  console.log('Test duration:', duration);
}, 100);

// 测试内存监控
PerformanceMonitor.recordMemoryUsage();

// 测试 DOM 节点监控
PerformanceMonitor.recordDOMNodeCount();

// 获取性能报告
PerformanceMonitor.printReport();

// 获取性能建议
const suggestions = PerformanceMonitor.getPerformanceSuggestions();
console.log('Suggestions:', suggestions);
```

### 3. 检查控制台过滤器

确保控制台没有过滤掉 `[Performance]` 消息：
- 清除所有过滤器
- 确保显示所有日志级别（Info, Warning, Error）

### 4. 检查浏览器兼容性

性能监控使用了以下 API，确保浏览器支持：
- `performance.mark()`
- `performance.measure()`
- `performance.memory` (Chrome/Edge)
- `requestAnimationFrame()`

## 常见问题

### Q1: 看不到任何性能监控输出

**A**: 检查是否在开发环境运行：
```bash
# 确保使用 dev 命令
npm run dev

# 而不是
npm start
```

### Q2: 内存监控显示 0MB

**A**: `performance.memory` 仅在 Chrome/Edge 浏览器中可用，Firefox 不支持。

### Q3: 性能警告没有触发

**A**: 检查操作是否真的超过阈值：
- 初始加载 > 1000ms
- 待办列表渲染 > 500ms
- 流程图渲染 > 300ms
- 搜索 > 300ms
- 保存 > 100ms
- 内存 > 200MB
- DOM 节点 > 500

### Q4: 定期监控没有运行

**A**: 确保应用保持运行至少 10 秒，并且在开发环境。

## 性能基准参考

### 良好性能（无警告）

- 初始加载: < 800ms
- 待办列表渲染 (50 项): < 200ms
- 流程图渲染 (20 节点): < 150ms
- 搜索: < 100ms
- 保存: < 50ms
- 内存: < 150MB
- DOM 节点: < 300

### 可接受性能（接近阈值）

- 初始加载: 800-1000ms
- 待办列表渲染 (100 项): 300-500ms
- 流程图渲染 (50 节点): 200-300ms
- 搜索: 200-300ms
- 保存: 80-100ms
- 内存: 150-200MB
- DOM 节点: 400-500

### 需要优化（超过阈值）

- 初始加载: > 1000ms
- 待办列表渲染 (150+ 项): > 500ms
- 流程图渲染 (100+ 节点): > 300ms
- 搜索: > 300ms
- 保存: > 100ms
- 内存: > 200MB
- DOM 节点: > 500

## 总结

通过以上测试步骤，可以全面验证性能监控系统的功能。如果所有测试都通过，说明性能监控系统已经成功实施并正常工作。

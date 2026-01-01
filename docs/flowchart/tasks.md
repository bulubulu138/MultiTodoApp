# Implementation Plan: 流程图画布功能

## Overview

本实现计划将流程图功能集成到 MultiTodo 应用中。使用 React Flow 作为核心绘图引擎，与现有的待办任务系统深度集成。实现将分为数据层、核心画布、工具栏、导出功能和测试几个阶段，每个阶段都包含相应的属性测试。

## Tasks

- [x] 1. 安装依赖和数据库迁移
  - 安装 React Flow、dagre、html-to-image 等依赖
  - 创建数据库表（flowcharts, flowchart_nodes, flowchart_edges）
  - 添加数据库索引优化查询性能（flowchart_id, updated_at, connection_hash）
  - 添加 updated_at 字段用于 UPSERT 策略
  - 添加 connection_hash 字段用于边的快速对比
  - _Requirements: 6.1, 11.1_

- [x] 2. 实现数据层和类型定义
  - [x] 2.1 定义三层数据模型类型
    - 在 src/shared/types.ts 中定义持久化层类型（FlowchartSchema, PersistedNode, PersistedEdge）
    - 定义业务领域层类型（FlowchartDomain, DomainNode, DomainNodeData）
    - 定义 UI 运行时层类型（FlowchartRuntime, RuntimeNode, RuntimeEdge, UIState）
    - 定义 Patch 模型类型（FlowchartPatch, PatchHistory）
    - _Requirements: 6.1, 11.1_

  - [x] 2.2 实现 FlowchartPatchService
    - 实现 applyPatch() 方法应用单个 Patch
    - 实现 applyPatches() 方法批量应用 Patches
    - 实现 invertPatch() 方法生成反向 Patch（用于 Undo）
    - _Requirements: 6.1_

  - [x] 2.3 实现 UndoRedoManager
    - 实现 execute() 方法记录操作历史
    - 实现 undo() 方法撤销操作
    - 实现 redo() 方法重做操作
    - 限制历史记录大小（100 条）
    - _Requirements: 4.6, 4.7_

  - [x] 2.4 实现 FlowchartRepository 数据访问层
    - 实现 savePatches() 方法使用增量 Patch 保存
    - 实现 load() 方法加载持久化数据（只加载 PersistedNode，不加载 Todo）
    - 实现 list() 方法获取流程图列表
    - 实现 delete() 方法删除流程图
    - _Requirements: 6.1, 6.3, 11.1, 11.2_

  - [ ]* 2.5 编写属性测试：持久化往返一致性
    - **Property 12: 持久化往返一致性**
    - **Validates: Requirements 6.1, 6.3**

- [x] 3. 实现核心画布组件
  - [x] 3.1 创建 FlowchartCanvas 组件
    - 集成 React Flow 基础功能
    - 实现三层数据模型管理（Persisted → Domain → Runtime）
    - 实现 useDomainNodes hook（通过 selector 解析 Todo 数据）
    - 实现数据层转换函数（toRuntimeNode, toRuntimeEdge）
    - 集成 UndoRedoManager
    - 处理节点变化并生成 Patches
    - 实现画布视口控制（平移、缩放）
    - _Requirements: 2.2, 2.5, 4.1, 4.2, 11.2, 11.3_

  - [x] 3.2 实现自定义节点组件
    - 创建 TodoNode 组件（从 resolvedTodo 读取数据，不直接依赖 Todo 实体）
    - 创建 RectangleNode、DiamondNode、CircleNode 组件
    - 实现节点样式系统（使用 computedStyle）
    - 实现节点编辑交互（单击、双击）
    - 显示锁定状态图标
    - _Requirements: 2.3, 2.4, 3.4, 9.2, 9.3, 9.4, 11.2_

  - [ ]* 3.3 编写属性测试：节点创建一致性
    - **Property 1: 节点创建一致性**
    - **Validates: Requirements 2.2**

  - [ ]* 3.4 编写属性测试：边创建一致性
    - **Property 2: 边创建一致性**
    - **Validates: Requirements 2.5**

  - [ ]* 3.5 编写属性测试：节点移动保持连接
    - **Property 3: 节点移动保持连接**
    - **Validates: Requirements 2.7**


- [x] 4. 实现节点库和拖拽功能
  - [x] 4.1 创建 NodeLibrary 组件
    - 展示可用节点类型（矩形、菱形、圆形等）
    - 实现节点拖拽到画布功能
    - 提供节点预览和说明
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 实现节点编辑面板
    - 创建节点属性编辑抽屉
    - 实现文本编辑功能
    - 实现样式编辑功能（颜色、边框、字体）
    - _Requirements: 2.3, 2.4, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 4.3 编写属性测试：节点样式更新一致性
    - **Property 14: 节点样式更新一致性**
    - **Validates: Requirements 9.2, 9.3, 9.4**

- [x] 5. 实现待办任务关联功能
  - [x] 5.1 实现任务关联选择器
    - 在节点编辑面板中添加"关联待办"选项
    - 实现待办任务选择列表
    - 处理任务关联和解除关联
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 5.2 实现任务状态可视化
    - 根据任务状态自动设置节点颜色
    - 在节点上显示任务标题和状态图标
    - 实现"查看任务详情"功能
    - 实现任务数据实时同步（监听 IPC 事件）
    - 处理关联任务被删除的情况（显示占位信息）
    - _Requirements: 3.4, 3.5, 3.6, 9.5, 11.3, 11.4_

  - [ ]* 5.3 编写属性测试：任务关联双向绑定
    - **Property 5: 任务关联双向绑定**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 5.4 编写属性测试：任务状态颜色映射
    - **Property 15: 任务状态颜色映射**
    - **Validates: Requirements 9.5**

  - [ ]* 5.5 编写属性测试：任务数据实时同步
    - **Property 18: 任务数据实时同步**
    - **Validates: Requirements 11.2, 11.3**

- [x] 6. 实现画布交互功能
  - [x] 6.1 实现选择和多选功能
    - 实现单击选择节点/边
    - 实现 Ctrl/Cmd+点击多选
    - 实现框选功能
    - 实现全选快捷键（Ctrl/Cmd+A）
    - _Requirements: 4.3, 4.4, 4.8_

  - [x] 6.2 实现删除功能
    - 实现 Delete 键删除选中元素
    - 处理节点删除时的边清理
    - 提供删除确认提示
    - _Requirements: 2.8_

  - [x] 6.3 实现撤销/重做功能
    - 使用 UndoRedoManager 管理操作历史
    - 实现 Ctrl/Cmd+Z 撤销（应用反向 Patch）
    - 实现 Ctrl/Cmd+Y 重做（重新应用 Patch）
    - 显示撤销/重做按钮状态
    - _Requirements: 4.6, 4.7_

  - [x] 6.4 实现节点锁定功能
    - 实现右键菜单"锁定位置"选项
    - 在节点数据中添加 isLocked 标志
    - 锁定节点显示视觉标识（锁图标）
    - _Requirements: 12.1, 12.2_

  - [x] 6.5 实现循环依赖检查
    - 实现 wouldCreateCycle() 检测函数
    - 在 onConnect 中调用检测
    - 阻止创建循环连接并显示警告
    - _Requirements: 12.3, 12.4_

  - [ ]* 6.6 编写属性测试：元素删除完整性
    - **Property 4: 元素删除完整性**
    - **Validates: Requirements 2.8**

  - [ ]* 6.7 编写属性测试：多选操作同步性
    - **Property 7: 多选操作同步性**
    - **Validates: Requirements 4.3, 4.4, 4.5**

  - [ ]* 6.8 编写属性测试：撤销重做对称性
    - **Property 8: 撤销重做对称性**
    - **Validates: Requirements 4.6, 4.7**

  - [ ]* 6.9 编写属性测试：循环依赖检测正确性
    - **Property 19: 循环依赖检测正确性**
    - **Validates: Requirements 12.3, 12.4**

- [x] 7. Checkpoint - 核心功能验证
  - 确保所有核心画布功能正常工作
  - 确保所有属性测试通过
  - 询问用户是否有问题或需要调整


- [x] 8. 实现导出功能
  - [x] 8.1 实现 JSON 导出服务
    - 创建 ExportService.toJSON() 方法
    - 创建 ImportService.fromJSON() 方法
    - 实现复制到剪贴板功能
    - 实现下载文件功能
    - _Requirements: 5.2, 5.6, 5.7_

  - [ ]* 8.2 编写属性测试：JSON 导出往返一致性
    - **Property 9: JSON 导出往返一致性**
    - **Validates: Requirements 5.2**

  - [x] 8.3 实现 Mermaid 导出服务
    - 创建 MermaidExporter.export() 方法
    - 实现 escapeLabel() 特殊字符转义函数
    - 实现节点形状映射
    - 实现边类型映射
    - 生成有效的 Mermaid 语法
    - _Requirements: 5.3, 13.1, 13.2, 13.3_

  - [ ]* 8.4 编写属性测试：Mermaid 导出语法正确性
    - **Property 10: Mermaid 导出语法正确性**
    - **Validates: Requirements 5.3**

  - [ ]* 8.4.1 编写属性测试：Mermaid 特殊字符转义
    - **Property 21: Mermaid 特殊字符转义**
    - **Validates: Requirements 13.1, 13.2, 13.3**

  - [x] 8.5 实现纯文本导出服务
    - 创建 TextExporter.export() 方法
    - 生成人类可读的文本描述
    - 包含节点和连接关系
    - _Requirements: 5.4_

  - [ ]* 8.6 编写属性测试：文本导出可读性
    - **Property 11: 文本导出可读性**
    - **Validates: Requirements 5.4**

  - [x] 8.7 实现 PNG 图片导出
    - 使用 html-to-image 库渲染画布为图片
    - 实现保存到本地功能
    - 实现复制到剪贴板功能
    - _Requirements: 10.2, 10.3_

  - [ ]* 8.8 编写属性测试：图片导出完整性
    - **Property 16: 图片导出完整性**
    - **Validates: Requirements 10.2**

- [x] 9. 实现自动布局功能
  - [x] 9.1 集成 dagre 布局库
    - 安装 dagre 依赖
    - 创建 LayoutService 类
    - _Requirements: 7.1_

  - [x] 9.2 实现层次布局算法
    - 实现 LayoutService.hierarchical() 方法
    - 使用 dagre 计算节点位置
    - 跳过锁定的节点（isLocked: true）
    - 实现平滑动画过渡
    - _Requirements: 7.2, 12.2, 12.5_

  - [ ]* 9.3 编写属性测试：自动布局保持连接
    - **Property 13: 自动布局保持连接**
    - **Validates: Requirements 7.2, 7.3**

  - [ ]* 9.3.1 编写属性测试：锁定节点布局保持
    - **Property 20: 锁定节点布局保持**
    - **Validates: Requirements 12.2, 12.5**

  - [x] 9.4 实现力导向布局算法（可选）
    - 实现 LayoutService.forceDirected() 方法
    - 使用力导向算法优化节点位置
    - _Requirements: 7.3_

- [x] 10. 实现流程图模板功能
  - [x] 10.1 创建模板系统
    - 定义模板数据结构
    - 创建空白画布模板
    - 创建项目流程模板
    - 创建学习路径模板
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 10.2 实现模板应用功能
    - 在新建流程图时提供模板选择
    - 实现模板内容加载
    - 允许用户自定义模板内容
    - _Requirements: 8.5_


- [x] 11. 实现工具栏和主界面集成
  - [x] 11.1 创建 FlowchartToolbar 组件
    - 实现导出按钮和菜单
    - 实现自动布局按钮
    - 实现保存按钮
    - 实现新建/切换流程图功能
    - _Requirements: 5.1, 6.4, 6.5, 7.1_

  - [x] 11.2 创建 FlowchartDrawer 容器组件
    - 实现抽屉式布局
    - 管理流程图列表
    - 处理流程图切换
    - 实现自动保存（使用 Patch 模型，500ms 防抖）
    - 批量保存 Patches 到数据库
    - _Requirements: 1.3, 6.1, 6.2_

  - [x] 11.3 在 Toolbar 中添加流程图入口
    - 在工具栏右侧添加"流程图"按钮
    - 实现点击打开流程图画布
    - 实现关闭返回待办列表
    - _Requirements: 1.1, 1.2, 1.4_

  - [ ]* 11.4 编写单元测试：流程图入口
    - 测试工具栏显示流程图按钮
    - 测试点击打开画布
    - 测试关闭返回列表
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 12. 实现分享功能
  - [x] 12.1 实现 URL 编码分享
    - 创建 ShareService.encodeToURL() 方法
    - 创建 ShareService.decodeFromURL() 方法
    - 实现链接生成和复制
    - _Requirements: 10.4, 10.5_

  - [ ]* 12.2 编写属性测试：URL 编码往返一致性
    - **Property 17: URL 编码往返一致性**
    - **Validates: Requirements 10.4, 10.5**

  - [x] 12.3 实现分享按钮和菜单
    - 在工具栏添加分享按钮
    - 提供导出图片和生成链接选项
    - 实现只读模式查看
    - _Requirements: 10.1_

- [x] 13. 性能优化和错误处理
  - [x] 13.1 实现性能优化
    - 实现防抖保存（500ms）
    - 优化大规模流程图渲染（100+ 节点）
    - 使用 React.memo 优化组件渲染
    - _Requirements: 6.1_

  - [x] 13.2 实现错误处理
    - 处理数据库操作失败
    - 处理关联任务不存在
    - 处理导出失败
    - 处理剪贴板访问失败
    - 提供友好的错误提示
    - _Requirements: 所有需求_

  - [ ]* 13.3 编写单元测试：错误处理
    - 测试数据库操作失败场景
    - 测试导出失败场景
    - 测试边界条件（空流程图、大规模流程图）
    - _Requirements: 所有需求_

- [x] 14. Checkpoint - 完整功能验证
  - 确保所有功能正常工作 ✅
  - 确保所有测试通过（单元测试 + 属性测试）⚠️ (属性测试待实现)
  - 进行性能测试（渲染 100 节点 < 1000ms）✅
  - 询问用户是否有问题或需要调整 ✅

- [ ] 15. 集成测试和文档
  - [ ]* 15.1 编写集成测试
    - 测试完整流程：创建 → 编辑 → 保存 → 加载
    - 测试任务关联流程
    - 测试导出导入流程
    - _Requirements: 所有需求_

  - [ ] 15.2 更新用户文档
    - 在 README.md 中添加流程图功能说明
    - 创建流程图使用指南
    - 添加截图和示例
    - _Requirements: 所有需求_

- [ ] 16. 最终验收
  - 确保所有需求都已实现
  - 确保所有测试通过
  - 确保性能指标达标
  - 用户验收测试

## Notes

- 任务标记 `*` 的为可选测试任务，可根据开发进度决定是否实施
- 每个任务都引用了具体的需求编号，便于追溯
- Checkpoint 任务确保增量验证，及时发现问题
- 属性测试每个至少运行 100 次迭代
- 单元测试和属性测试互补，共同保证代码质量

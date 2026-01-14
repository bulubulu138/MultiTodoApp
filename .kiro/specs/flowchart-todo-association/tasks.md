# Implementation Plan: 流程图与待办关联功能

## Overview

本实现计划将流程图与待办关联功能分解为可执行的编码任务。实现将按照以下顺序进行：
1. 数据持久化层（数据库表和Repository）
2. IPC通信层（主进程和渲染进程API）
3. UI组件层（搜索栏和详情页增强）
4. 测试和集成

## Tasks

- [x] 1. 创建数据库表和Repository
  - [x] 1.1 在DatabaseManager中添加flowchart_todo_associations表
    - 创建表结构和索引
    - 添加表迁移逻辑
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

  - [x] 1.2 创建FlowchartTodoAssociationRepository类
    - 实现create方法（创建关联）
    - 实现delete方法（删除关联）
    - 实现queryByFlowchartId方法（查询流程图的关联）
    - 实现queryByTodoId方法（查询待办的关联）
    - 实现queryByTodoIds方法（批量查询）
    - 实现exists方法（检查关联是否存在）
    - _Requirements: 2.1, 2.4, 4.1, 4.3, 5.2, 6.1, 6.3, 6.7_

  - [ ]* 1.3 编写Repository的属性测试
    - **Property 2: 关联创建持久化**
    - **Validates: Requirements 2.1, 2.4, 6.1**

  - [ ]* 1.4 编写Repository的属性测试
    - **Property 9: 取消关联删除记录**
    - **Validates: Requirements 4.1, 4.3, 6.3**

  - [ ]* 1.5 编写Repository的属性测试
    - **Property 17: 查询返回最新数据**
    - **Validates: Requirements 6.7**

  - [ ]* 1.6 编写Repository的单元测试
    - 测试重复关联处理
    - 测试数据库错误处理
    - 测试边缘情况（不存在的ID等）
    - _Requirements: 2.1, 4.1_

- [x] 2. 实现IPC通信接口
  - [x] 2.1 在main.ts中注册IPC handlers
    - 注册flowchart-todo-association:create handler
    - 注册flowchart-todo-association:delete handler
    - 注册flowchart-todo-association:query-by-flowchart handler
    - 注册flowchart-todo-association:query-by-todo handler
    - 注册flowchart-todo-association:query-by-todos handler
    - _Requirements: 2.1, 4.1, 5.2, 5.3_

  - [x] 2.2 在preload.ts中暴露API
    - 添加flowchartTodoAssociation命名空间
    - 暴露create、delete、queryByFlowchart、queryByTodo、queryByTodos方法
    - _Requirements: 2.1, 4.1, 5.2, 5.3_

  - [x] 2.3 更新types.ts添加类型定义
    - 添加FlowchartTodoAssociation接口
    - 添加FlowchartAssociationDisplay接口
    - 添加TodoSearchResult接口
    - _Requirements: 2.1, 5.2, 5.3_

  - [ ]* 2.4 编写IPC通信的集成测试
    - 测试创建关联的端到端流程
    - 测试查询关联的端到端流程
    - 测试删除关联的端到端流程
    - _Requirements: 2.1, 4.1, 5.2_

- [x] 3. Checkpoint - 确保数据层和通信层测试通过
  - 确保所有测试通过，如有问题请询问用户


- [x] 4. 创建FlowchartTodoSearchBar组件
  - [x] 4.1 创建组件基础结构
    - 创建FlowchartTodoSearchBar.tsx文件
    - 实现搜索输入框UI
    - 实现搜索结果下拉列表UI
    - _Requirements: 1.1, 1.3_

  - [x] 4.2 实现搜索功能
    - 实现防抖搜索逻辑（300ms）
    - 实现搜索结果过滤和排序
    - 限制搜索结果最多50条
    - _Requirements: 1.2, 1.3, 7.2, 7.3_

  - [x] 4.3 实现关联状态显示
    - 查询当前流程图的关联待办列表
    - 在搜索结果中标识已关联的待办
    - _Requirements: 2.3_

  - [x] 4.4 实现关联/取消关联操作
    - 实现点击待办创建关联
    - 实现点击已关联待办取消关联
    - 显示操作成功/失败提示
    - _Requirements: 2.1, 2.2, 4.1, 4.2_

  - [ ]* 4.5 编写搜索功能的属性测试
    - **Property 1: 搜索功能正确性**
    - **Validates: Requirements 1.2, 1.3**

  - [ ]* 4.6 编写关联状态显示的属性测试
    - **Property 3: 已关联状态显示**
    - **Validates: Requirements 2.3**

  - [ ]* 4.7 编写防抖机制的属性测试
    - **Property 18: 防抖机制减少请求**
    - **Validates: Requirements 7.2**

  - [ ]* 4.8 编写组件的单元测试
    - 测试组件渲染
    - 测试空搜索结果显示
    - 测试清空搜索关键词
    - 测试错误处理
    - _Requirements: 1.1, 1.4, 1.5, 2.5, 4.4_

- [x] 5. 集成FlowchartTodoSearchBar到FlowchartCanvas
  - [x] 5.1 在FlowchartCanvas中添加搜索栏
    - 导入FlowchartTodoSearchBar组件
    - 在画布顶部渲染搜索栏
    - 传递必要的props（flowchartId, todos等）
    - _Requirements: 1.1_

  - [x] 5.2 实现关联状态管理
    - 添加state管理当前流程图的关联待办列表
    - 实现关联/取消关联的回调函数
    - 更新关联状态后刷新列表
    - _Requirements: 2.1, 4.1_

  - [ ]* 5.3 编写集成测试
    - 测试搜索栏在画布中正确显示
    - 测试关联操作更新状态
    - _Requirements: 1.1, 2.1_

- [x] 6. Checkpoint - 确保搜索栏功能完整
  - 确保所有测试通过，如有问题请询问用户


- [x] 7. 增强TodoViewDrawer组件
  - [x] 7.1 添加关联查询逻辑
    - 在组件中查询流程图级别关联
    - 合并流程图级别和节点级别关联数据
    - 按类型分组显示关联列表
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 7.2 实现关联列表UI
    - 创建流程图级别关联卡片组件
    - 创建节点级别关联卡片组件
    - 实现空状态显示
    - 区分两种关联类型的样式
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [x] 7.3 实现点击跳转功能
    - 实现点击流程图级别关联打开流程图
    - 实现点击节点级别关联打开流程图并高亮节点
    - 添加onOpenFlowchart回调prop
    - _Requirements: 5.6, 5.7_

  - [ ]* 7.4 编写关联显示的属性测试
    - **Property 10: 待办详情显示流程图级别关联**
    - **Validates: Requirements 5.2**

  - [ ]* 7.5 编写关联显示的属性测试
    - **Property 11: 待办详情显示节点级别关联**
    - **Validates: Requirements 5.3**

  - [ ]* 7.6 编写关联显示的属性测试
    - **Property 12: 同时显示两种关联类型**
    - **Validates: Requirements 5.4**

  - [ ]* 7.7 编写导航功能的属性测试
    - **Property 13: 点击流程图级别关联导航**
    - **Validates: Requirements 5.6**

  - [ ]* 7.8 编写导航功能的属性测试
    - **Property 14: 点击节点级别关联导航并高亮**
    - **Validates: Requirements 5.7**

  - [ ]* 7.9 编写组件的单元测试
    - 测试空状态显示
    - 测试加载失败显示
    - 测试关联列表渲染
    - _Requirements: 5.1, 5.5, 5.8_

- [x] 8. 实现级联删除逻辑
  - [x] 8.1 在DatabaseManager中添加级联删除
    - 确保flowchart_todo_associations表的外键约束正确
    - 测试删除流程图时自动删除关联
    - 测试删除待办时自动删除关联
    - _Requirements: 6.4, 6.5_

  - [ ]* 8.2 编写级联删除的属性测试
    - **Property 15: 流程图删除时级联删除关联**
    - **Validates: Requirements 6.4**

  - [ ]* 8.3 编写级联删除的属性测试
    - **Property 16: 待办删除时级联删除关联**
    - **Validates: Requirements 6.5**

- [x] 9. 完善节点级别关联功能（已存在，需要验证）
  - [x] 9.1 验证节点关联待办的数据存储
    - 检查节点data中todoId的存储逻辑
    - 确保节点编辑面板可以选择待办
    - _Requirements: 3.1, 6.2_

  - [x] 9.2 验证节点显示待办信息
    - 检查节点组件是否显示待办标题和状态
    - 验证节点样式根据待办状态更新
    - _Requirements: 3.2, 3.3_

  - [x] 9.3 验证节点取消关联功能
    - 检查节点编辑面板可以取消待办关联
    - 验证取消后节点数据中todoId被移除
    - _Requirements: 3.4_

  - [x] 9.4 验证待办删除时清理节点引用
    - 检查FlowchartRepository.cleanupInvalidTodoReferences方法
    - 验证待办删除时自动调用清理方法
    - _Requirements: 3.5, 6.6_

  - [ ]* 9.5 编写节点关联的属性测试
    - **Property 4: 节点关联数据存储**
    - **Validates: Requirements 3.1, 6.2**

  - [ ]* 9.6 编写节点显示的属性测试
    - **Property 5: 节点显示待办信息**
    - **Validates: Requirements 3.2**

  - [ ]* 9.7 编写节点样式的属性测试
    - **Property 6: 节点样式根据待办状态更新**
    - **Validates: Requirements 3.3**

  - [ ]* 9.8 编写节点取消关联的属性测试
    - **Property 7: 节点取消关联清理**
    - **Validates: Requirements 3.4**

  - [ ]* 9.9 编写待办删除清理的属性测试
    - **Property 8: 待办删除时清理节点引用**
    - **Validates: Requirements 3.5, 6.6**

- [x] 10. 集成和端到端测试
  - [x] 10.1 实现完整的用户流程
    - 打开流程图 → 搜索待办 → 创建关联 → 验证成功
    - 打开待办详情 → 查看关联 → 点击跳转 → 验证打开
    - 删除待办 → 验证关联自动清理
    - 删除流程图 → 验证关联自动清理
    - _Requirements: 2.1, 4.1, 5.6, 5.7, 6.4, 6.5_

  - [ ]* 10.2 编写端到端集成测试
    - 测试完整的创建关联流程
    - 测试完整的查看关联流程
    - 测试完整的删除关联流程
    - 测试级联删除流程
    - _Requirements: 2.1, 4.1, 5.6, 5.7, 6.4, 6.5_

- [x] 11. 性能优化和错误处理
  - [x] 11.1 优化搜索性能
    - 验证防抖机制工作正常
    - 验证搜索结果限制在50条
    - 测试大量待办（1000+）时的性能
    - _Requirements: 7.2, 7.3_

  - [x] 11.2 完善错误处理
    - 添加数据库错误的友好提示
    - 添加网络错误的重试机制
    - 添加操作失败的回滚逻辑
    - _Requirements: 2.5, 4.4, 5.8_

  - [ ]* 11.3 编写性能测试
    - 测试搜索响应时间
    - 测试批量查询性能
    - _Requirements: 7.1, 7.2_

- [x] 12. Final Checkpoint - 确保所有功能完整且测试通过
  - 确保所有测试通过，如有问题请询问用户

## Notes

- 任务标记 `*` 的为可选测试任务，可以跳过以加快MVP开发
- 每个任务都引用了具体的需求编号，确保可追溯性
- Checkpoint任务确保增量验证，及时发现问题
- 属性测试使用 fast-check 库，每个测试运行100次迭代
- 单元测试验证具体示例和边缘情况
- 集成测试验证端到端流程的正确性

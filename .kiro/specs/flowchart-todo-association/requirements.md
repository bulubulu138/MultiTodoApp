# Requirements Document

## Introduction

本需求文档定义了流程图与待办任务关联功能的需求。该功能允许用户在流程图中搜索并关联待办任务，并在待办详情页中查看关联的流程图列表。

## Glossary

- **Flowchart**: 流程图，用户创建的可视化流程图文档
- **Todo**: 待办任务，用户创建的任务项
- **Flowchart_Level_Association**: 流程图级别关联，指待办与整个流程图之间的关联关系
- **Node_Level_Association**: 节点级别关联，指待办与流程图中某个特定节点之间的关联关系（已存在）
- **Search_Bar**: 搜索栏，位于流程图画布顶部的待办搜索输入框
- **Todo_Detail_Drawer**: 待办详情抽屉，显示待办任务详细信息的侧边栏
- **Association_List**: 关联列表，在待办详情页底部显示的关联流程图列表

## Requirements

### Requirement 1: 流程图中搜索待办

**User Story:** 作为用户，我想在流程图画布中搜索待办任务，以便快速找到需要关联的待办。

#### Acceptance Criteria

1. WHEN 用户打开流程图画布 THEN THE System SHALL 在画布顶部显示待办搜索栏
2. WHEN 用户在搜索栏中输入关键词 THEN THE System SHALL 实时搜索匹配的待办任务
3. WHEN 搜索关键词匹配待办标题或内容 THEN THE System SHALL 在下拉列表中显示匹配的待办
4. WHEN 搜索结果为空 THEN THE System SHALL 显示"无匹配结果"提示
5. WHEN 用户清空搜索关键词 THEN THE System SHALL 清空搜索结果列表

### Requirement 2: 关联待办到流程图（流程图级别）

**User Story:** 作为用户，我想将搜索到的待办关联到当前流程图（流程图级别），以便建立流程图与待办之间的整体联系。

#### Acceptance Criteria

1. WHEN 用户在搜索结果中点击某个待办 THEN THE System SHALL 将该待办关联到当前流程图（流程图级别）
2. WHEN 待办成功关联 THEN THE System SHALL 显示成功提示消息
3. WHEN 待办已经关联到当前流程图 THEN THE System SHALL 显示"已关联"标识
4. WHEN 用户关联待办后 THEN THE System SHALL 将关联关系持久化到数据库
5. WHEN 关联操作失败 THEN THE System SHALL 显示错误提示消息

### Requirement 3: 关联待办到节点（节点级别）

**User Story:** 作为用户，我想将待办关联到流程图中的特定节点，以便在节点中显示待办信息。

#### Acceptance Criteria

1. WHEN 用户在节点编辑面板中选择待办 THEN THE System SHALL 将该待办关联到当前节点
2. WHEN 节点关联待办后 THEN THE System SHALL 在节点中显示待办标题和状态
3. WHEN 节点已关联待办 THEN THE System SHALL 根据待办状态更新节点样式
4. WHEN 用户取消节点的待办关联 THEN THE System SHALL 移除节点中的待办引用
5. WHEN 节点关联的待办被删除 THEN THE System SHALL 自动清理节点中的无效引用

### Requirement 4: 取消流程图级别关联

**User Story:** 作为用户，我想取消流程图与待办的关联，以便管理不再需要的关联关系。

#### Acceptance Criteria

1. WHEN 用户在搜索结果中点击已关联的待办 THEN THE System SHALL 取消该待办与流程图的关联
2. WHEN 取消关联成功 THEN THE System SHALL 显示成功提示消息
3. WHEN 取消关联后 THEN THE System SHALL 从数据库中删除关联记录
4. WHEN 取消关联操作失败 THEN THE System SHALL 显示错误提示消息

### Requirement 5: 在待办详情页显示关联的流程图

**User Story:** 作为用户，我想在待办详情页查看关联的流程图列表，以便了解该待办在哪些流程图中被引用。

#### Acceptance Criteria

1. WHEN 用户打开待办详情页 THEN THE System SHALL 在底部显示"关联的流程图"区域
2. WHEN 待办有流程图级别关联 THEN THE System SHALL 显示流程图名称和描述
3. WHEN 待办有节点级别关联 THEN THE System SHALL 显示流程图名称、节点标签和节点位置
4. WHEN 待办同时有两种级别的关联 THEN THE System SHALL 分别显示两种关联类型
5. WHEN 待办没有任何关联 THEN THE System SHALL 显示"暂无关联的流程图"提示
6. WHEN 用户点击流程图级别关联 THEN THE System SHALL 打开该流程图
7. WHEN 用户点击节点级别关联 THEN THE System SHALL 打开该流程图并高亮显示对应节点
8. WHEN 流程图列表加载失败 THEN THE System SHALL 显示错误提示消息

### Requirement 6: 数据持久化

**User Story:** 作为系统，我需要持久化流程图与待办的关联关系，以便用户下次打开时能看到之前的关联。

#### Acceptance Criteria

1. WHEN 用户创建流程图级别关联 THEN THE System SHALL 在数据库中创建关联记录
2. WHEN 用户创建节点级别关联 THEN THE System SHALL 在节点数据中存储待办ID
3. WHEN 用户取消流程图级别关联 THEN THE System SHALL 从数据库中删除关联记录
4. WHEN 流程图被删除 THEN THE System SHALL 自动删除相关的所有流程图级别关联记录
5. WHEN 待办被删除 THEN THE System SHALL 自动删除相关的所有流程图级别关联记录
6. WHEN 待办被删除 THEN THE System SHALL 自动清理节点中的无效待办引用
7. WHEN 查询关联关系 THEN THE System SHALL 从数据库中读取最新的关联数据

### Requirement 7: 搜索性能优化

**User Story:** 作为用户，我希望搜索响应快速，以便流畅地使用搜索功能。

#### Acceptance Criteria

1. WHEN 用户输入搜索关键词 THEN THE System SHALL 在300毫秒内返回搜索结果
2. WHEN 用户快速连续输入 THEN THE System SHALL 使用防抖机制减少搜索请求
3. WHEN 待办数量超过1000条 THEN THE System SHALL 限制搜索结果最多显示50条
4. WHEN 搜索结果较多 THEN THE System SHALL 支持滚动加载更多结果

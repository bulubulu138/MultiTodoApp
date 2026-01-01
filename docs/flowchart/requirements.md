# Requirements Document - 流程图画布功能

## Introduction

本文档定义了 MultiTodo 应用中流程图画布功能的需求。该功能允许用户通过可视化的流程图方式组织和展示待办任务之间的关系，并支持将流程图导出为多种格式（JSON、代码、文本等）。

## Glossary

- **FlowchartCanvas**: 流程图画布，用户绘制流程图的主界面
- **FlowchartNode**: 流程图节点，代表一个任务或概念
- **FlowchartEdge**: 流程图连线，表示节点之间的关系
- **TodoTask**: 待办任务，可以关联到流程图节点
- **ExportFormat**: 导出格式，包括 JSON、Mermaid、纯文本等
- **Toolbar**: 工具栏，位于待办列表顶部的操作区域
- **Canvas**: 画布，流程图的绘制区域
- **NodeLibrary**: 节点库，提供可用的节点类型

## Requirements

### Requirement 1: 流程图入口

**User Story:** 作为用户，我想在待办应用的工具栏中看到流程图入口，以便快速进入流程图编辑模式。

#### Acceptance Criteria

1. WHEN 用户查看工具栏 THEN THE System SHALL 在工具栏右侧显示"流程图"按钮
2. WHEN 用户点击"流程图"按钮 THEN THE System SHALL 打开流程图画布界面
3. WHEN 流程图画布打开 THEN THE System SHALL 以抽屉或全屏模式展示画布
4. WHEN 用户关闭流程图画布 THEN THE System SHALL 返回到待办列表视图

### Requirement 2: 基础绘图功能

**User Story:** 作为用户，我想使用基本的流程图绘制功能，以便创建和编辑流程图。

#### Acceptance Criteria

1. WHEN 用户进入画布 THEN THE System SHALL 提供节点库面板，包含基础节点类型（矩形、圆角矩形、菱形、圆形）
2. WHEN 用户从节点库拖拽节点到画布 THEN THE System SHALL 在画布上创建该节点
3. WHEN 用户点击节点 THEN THE System SHALL 显示节点编辑状态，允许输入文本
4. WHEN 用户双击节点 THEN THE System SHALL 打开节点详细编辑面板
5. WHEN 用户从一个节点拖拽到另一个节点 THEN THE System SHALL 创建连接线
6. WHEN 用户点击连接线 THEN THE System SHALL 显示连接线编辑选项（删除、添加标签）
7. WHEN 用户拖拽节点 THEN THE System SHALL 移动节点位置，连接线自动跟随
8. WHEN 用户选中节点或连接线按 Delete 键 THEN THE System SHALL 删除选中元素

### Requirement 3: 节点与待办任务关联

**User Story:** 作为用户，我想将流程图节点与现有待办任务关联，以便在流程图中展示实际任务。

#### Acceptance Criteria

1. WHEN 用户双击节点打开编辑面板 THEN THE System SHALL 提供"关联待办"选项
2. WHEN 用户点击"关联待办" THEN THE System SHALL 显示待办任务选择列表
3. WHEN 用户选择一个待办任务 THEN THE System SHALL 将节点与该任务关联
4. WHEN 节点关联了待办任务 THEN THE System SHALL 在节点上显示任务标题和状态图标
5. WHEN 用户点击已关联任务的节点 THEN THE System SHALL 提供"查看任务详情"选项
6. WHEN 用户点击"查看任务详情" THEN THE System SHALL 打开任务详情抽屉

### Requirement 4: 画布交互体验

**User Story:** 作为用户，我想要流畅友好的画布交互体验，以便高效地编辑流程图。

#### Acceptance Criteria

1. WHEN 用户在画布空白区域拖拽 THEN THE System SHALL 平移画布视图
2. WHEN 用户使用鼠标滚轮 THEN THE System SHALL 缩放画布（放大/缩小）
3. WHEN 用户按住 Ctrl/Cmd 键点击多个节点 THEN THE System SHALL 支持多选
4. WHEN 用户框选区域 THEN THE System SHALL 选中区域内的所有节点
5. WHEN 用户拖拽多个选中节点 THEN THE System SHALL 同时移动所有选中节点
6. WHEN 用户按 Ctrl/Cmd+Z THEN THE System SHALL 撤销上一步操作
7. WHEN 用户按 Ctrl/Cmd+Y THEN THE System SHALL 重做操作
8. WHEN 用户按 Ctrl/Cmd+A THEN THE System SHALL 选中所有节点

### Requirement 5: 流程图导出功能

**User Story:** 作为用户，我想将流程图导出为多种格式，以便在其他场景中使用流程图数据。

#### Acceptance Criteria

1. WHEN 用户点击"导出"按钮 THEN THE System SHALL 显示导出格式选择菜单
2. WHEN 用户选择 JSON 格式 THEN THE System SHALL 将流程图导出为 JSON 树结构
3. WHEN 用户选择 Mermaid 格式 THEN THE System SHALL 将流程图转换为 Mermaid 代码
4. WHEN 用户选择纯文本格式 THEN THE System SHALL 将流程图转换为文本描述
5. WHEN 导出完成 THEN THE System SHALL 提供"复制到剪贴板"和"下载文件"两个选项
6. WHEN 用户点击"复制到剪贴板" THEN THE System SHALL 将导出内容复制到系统剪贴板
7. WHEN 用户点击"下载文件" THEN THE System SHALL 下载导出文件到本地

### Requirement 6: 流程图持久化存储

**User Story:** 作为用户，我想保存我的流程图，以便下次打开应用时继续编辑。

#### Acceptance Criteria

1. WHEN 用户编辑流程图 THEN THE System SHALL 自动保存流程图数据到数据库
2. WHEN 用户关闭流程图画布 THEN THE System SHALL 保存当前流程图状态
3. WHEN 用户重新打开流程图画布 THEN THE System SHALL 加载上次保存的流程图
4. WHEN 用户创建新流程图 THEN THE System SHALL 提供"新建流程图"选项
5. WHEN 用户有多个流程图 THEN THE System SHALL 提供流程图列表供选择

### Requirement 7: 自动布局功能

**User Story:** 作为用户，我想使用自动布局功能，以便快速整理混乱的流程图。

#### Acceptance Criteria

1. WHEN 用户点击"自动布局"按钮 THEN THE System SHALL 提供布局算法选项（层次布局、力导向布局）
2. WHEN 用户选择层次布局 THEN THE System SHALL 按照节点层级关系自动排列节点
3. WHEN 用户选择力导向布局 THEN THE System SHALL 使用力导向算法优化节点位置
4. WHEN 自动布局完成 THEN THE System SHALL 平滑动画过渡到新布局
5. WHEN 用户对自动布局不满意 THEN THE System SHALL 支持撤销操作恢复原布局

### Requirement 8: 流程图模板

**User Story:** 作为用户，我想使用预设的流程图模板，以便快速创建常见类型的流程图。

#### Acceptance Criteria

1. WHEN 用户点击"新建流程图" THEN THE System SHALL 提供模板选择选项
2. WHEN 用户选择"空白画布" THEN THE System SHALL 创建空白流程图
3. WHEN 用户选择"项目流程模板" THEN THE System SHALL 创建包含项目阶段节点的流程图
4. WHEN 用户选择"学习路径模板" THEN THE System SHALL 创建包含学习阶段节点的流程图
5. WHERE 用户选择模板 THEN THE System SHALL 允许用户自定义模板内容

### Requirement 9: 节点样式自定义

**User Story:** 作为用户，我想自定义节点的样式，以便让流程图更美观和易读。

#### Acceptance Criteria

1. WHEN 用户选中节点 THEN THE System SHALL 显示样式编辑面板
2. WHEN 用户在样式面板中选择颜色 THEN THE System SHALL 更改节点背景色
3. WHEN 用户在样式面板中选择边框样式 THEN THE System SHALL 更改节点边框（实线、虚线、粗细）
4. WHEN 用户在样式面板中选择字体大小 THEN THE System SHALL 更改节点文字大小
5. WHERE 节点关联了待办任务 THEN THE System SHALL 根据任务状态自动设置节点颜色（待办-蓝色、进行中-黄色、已完成-绿色）

### Requirement 10: 协作与分享

**User Story:** 作为用户，我想分享我的流程图，以便与他人协作或展示。

#### Acceptance Criteria

1. WHEN 用户点击"分享"按钮 THEN THE System SHALL 提供分享选项（导出图片、生成链接）
2. WHEN 用户选择"导出图片" THEN THE System SHALL 将流程图渲染为 PNG 图片
3. WHEN 图片导出完成 THEN THE System SHALL 提供保存到本地或复制到剪贴板选项
4. WHEN 用户选择"生成链接" THEN THE System SHALL 将流程图数据编码为 URL 参数
5. WHEN 用户复制链接 THEN THE System SHALL 允许其他用户通过链接查看流程图（只读模式）

### Requirement 11: 数据一致性和同步

**User Story:** 作为用户，我想确保流程图中的任务信息始终是最新的，以便准确反映任务状态。

#### Acceptance Criteria

1. WHEN 节点关联了待办任务 THEN THE System SHALL 不在数据库中冗余存储任务标题和状态
2. WHEN 加载流程图 THEN THE System SHALL 通过 todoId 使用 selector 模式实时解析最新的任务数据
3. WHEN 任务在流程图外被修改 THEN THE System SHALL 在流程图中自动反映最新的任务信息
4. WHEN 关联的任务被删除 THEN THE System SHALL 显示占位信息并提供解除关联选项
5. WHERE 节点未关联任务 THEN THE System SHALL 使用节点自身的 label 字段
6. WHEN 节点数据模型 THEN THE System SHALL 严格分离持久化层、业务领域层和 UI 运行时层

### Requirement 14: 增量更新和历史管理

**User Story:** 作为用户，我想使用撤销/重做功能，并且系统应该高效地保存我的修改。

#### Acceptance Criteria

1. WHEN 用户修改流程图 THEN THE System SHALL 使用 Patch 模型记录增量变更
2. WHEN 保存流程图 THEN THE System SHALL 只保存变化的部分，而不是全量删除再插入
3. WHEN 用户执行操作 THEN THE System SHALL 将 Patch 记录到历史栈
4. WHEN 用户撤销操作 THEN THE System SHALL 应用反向 Patch 恢复状态
5. WHEN 用户重做操作 THEN THE System SHALL 重新应用 Patch
6. WHEN 历史记录超过限制 THEN THE System SHALL 自动清理最旧的记录

### Requirement 12: 高级交互功能

**User Story:** 作为用户，我想使用高级交互功能，以便更精确地控制流程图布局和连接。

#### Acceptance Criteria

1. WHEN 用户右键点击节点 THEN THE System SHALL 提供"锁定位置"选项
2. WHEN 节点被锁定 THEN THE System SHALL 在自动布局时跳过该节点
3. WHEN 用户尝试创建连接 THEN THE System SHALL 检测是否会形成循环依赖
4. WHEN 连接会导致循环依赖 THEN THE System SHALL 阻止创建并显示警告提示
5. WHEN 用户解锁节点 THEN THE System SHALL 允许自动布局调整该节点位置

### Requirement 13: 导出格式健壮性

**User Story:** 作为用户，我想确保导出的内容格式正确，即使节点标签包含特殊字符。

#### Acceptance Criteria

1. WHEN 节点标签包含换行符 THEN THE System SHALL 在 Mermaid 导出中转换为 `<br/>`
2. WHEN 节点标签包含引号或括号 THEN THE System SHALL 正确转义特殊字符
3. WHEN 导出 Mermaid 代码 THEN THE System SHALL 生成语法正确的代码
4. WHEN 导出 JSON 格式 THEN THE System SHALL 正确处理所有 Unicode 字符
5. WHEN 导出纯文本 THEN THE System SHALL 保持文本可读性

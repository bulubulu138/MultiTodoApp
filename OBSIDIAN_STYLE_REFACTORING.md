# Obsidian 风格文件存储重构设计

## 需求概述

将当前"每个代办一个文件夹"的存储方式改为"Obsidian风格的单文件存储"，每个代办直接作为一个 `{待办名称}.md` 文件，附件与 md 文档同级放置。

## 用户选择

1. **文件名特殊字符处理**：自动替换为下划线或移除
2. **附件引用方式**：使用标准的Markdown图片语法 `
![附件名](./附件名.扩展名)
`，需要在应用中正常显示
3. **同名处理**：在文件名后添加序号后缀（如：代办名称_1.md, 代办名称_2.md）
4. **迁移策略**：提供"重新迁移"功能，清空现有目录，按照新的格式重新导出所有代办

## 当前架构分析

### 当前文件结构
```
todos/
├── todo-{uuid}/
│   ├── todo.md           # 待办内容
│   ├── .meta.json        # 元数据
│   └── assets/           # 附件目录
│       ├── image-1.png
│       └── image-2.png
└── .multitodo-metadata/
    ├── relations.json    # 关系数据
    ├── settings.json     # 设置
    └── index.json        # 搜索索引
```

### 核心组件
- `FileStorageManager`: 负责文件系统的 CRUD 操作
- `MigrationService`: 负责从 SQLite 到 Markdown 文件的迁移
- `MarkdownParser`: 负责在 Todo 对象和 Markdown 文件之间转换

## 新架构设计

### 目标文件结构
```
todos/
├── {待办名称}.md          # 待办内容和元数据
├── {待办名称}_1.png       # 附件（与 md 文件同级）
├── {待办名称}_2.png       # 附件
├── {待办名称2}.md         # 另一个待办
├── {待办名称2}_1.png      # 附件
└── .multitodo-metadata/
    ├── uuid-to-file.json  # UUID 到文件名的映射
    ├── relations.json     # 关系数据
    ├── settings.json      # 设置
    └── index.json         # 搜索索引
```

### 关键设计决策

#### 1. 文件名生成策略
```typescript
function generateFileName(title: string, uuid: string, existingFiles: string[]): string {
  // 1. 移除或替换特殊字符
  let safeTitle = title.replace(/[\/\\:*?"<>|]/g, '_');
  
  // 2. 检查重名
  let fileName = `${safeTitle}.md`;
  let counter = 1;
  
  while (existingFiles.includes(fileName)) {
    fileName = `${safeTitle}_${counter}.md`;
    counter++;
  }
  
  return fileName;
}
```

#### 2. UUID 映射机制
由于文件名不再包含 UUID，需要维护 UUID 到文件名的映射：
```json
{
  "uuid-to-file": {
    "550e8400-e29b-41d4-a716-446655440000": "待办名称.md",
    "550e8400-e29b-41d4-a716-446655440001": "待办名称2.md"
  }
}
```

#### 3. 附件处理策略
- 附件文件名：`{待办名称}_{序号}.{扩展名}`
- 附件引用：`
![附件名](./待办名称_{序号}.png)
`
- 附件放置：与 md 文件同级目录

#### 4. Markdown 文件格式
```markdown
---
title: 待办标题
status: pending
priority: medium
tags: tag1,tag2
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-01T00:00:00.000Z
id: 550e8400-e29b-41d4-a716-446655440000
deadline: 2024-01-02T00:00:00.000Z
completed_at: null
display_order: 1
display_orders: {"tab1": 1, "tab2": 2}
content_hash: abc123
keywords: ["关键词1", "关键词2"]
ai_suggestion: AI建议
ai_suggestion_generated_at: 2024-01-01T00:00:00.000Z
start_time: 2024-01-01T09:00:00.000Z
attachments:
  - ./待办名称_1.png
  - ./待办名称_2.png
---

## Content

待办的详细内容...

## Attachments

![附件1](./待办名称_1.png)


![附件2](./待办名称_2.png)

## Relations

- [🔗 前置任务](./待办名称2.md)
- [📚 背景任务](./待办名称3.md)
```

## 实现计划

### 阶段 1: 核心重构
1. 修改 `FileStorageManager` 支持新的文件结构
2. 修改 `MarkdownParser` 支持新的文件格式
3. 实现 UUID 到文件名的映射机制

### 阶段 2: 迁移功能
1. 修改 `MigrationService` 支持新的文件组织方式
2. 实现文件名冲突检测和解决
3. 实现附件的路径转换

### 阶段 3: 显示功能
1. 确保应用能够正确读取和显示新的文件格式
2. 确保图片能够正常显示（支持相对路径）
3. 测试所有功能在新架构下的工作状态

### 阶段 4: UI 更新
1. 更新迁移向导的说明文档
2. 添加"重新迁移"功能的确认对话框

## 技术挑战和解决方案

### 挑战 1: 文件名冲突
**解决方案**: 使用序号后缀，维护一个全局计数器

### 挑战 2: UUID 映射维护
**解决方案**: 创建专门的映射管理器，持久化到 `.multitodo-metadata/uuid-to-file.json`

### 挑战 3: 附件路径相对性
**解决方案**: 所有附件使用相对路径 `./{filename}`，确保在应用和外部编辑器中都能正确显示

### 挑战 4: 文件名特殊字符
**解决方案**: 建立特殊字符映射表，统一替换为安全字符

## 向后兼容性

- 保留旧的迁移逻辑作为 fallback
- 提供转换工具，将旧的文件夹格式转换为新的单文件格式
- 在迁移前自动备份现有数据

## 测试计划

1. 单元测试：文件名生成、特殊字符处理、UUID 映射
2. 集成测试：完整的迁移流程
3. UI 测试：图片显示、待办显示、关系显示
4. 性能测试：大量待办的迁移和读取性能

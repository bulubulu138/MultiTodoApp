# MultiTodo - 智能多功能待办应用

![Build Status](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 📝 产品简介

MultiTodo 是一款专为高效人士打造的**智能待办事项管理应用**，集任务管理、知识整理、工作汇报于一体。通过创新的任务关联系统、AI智能辅助和富文本编辑能力，帮助您轻松管理复杂项目、建立知识体系、生成工作报告。

### 🎯 产品定位

- **个人效率工具** - 适合需要管理多个项目和任务的专业人士
- **知识管理系统** - 通过任务关联建立知识网络，沉淀工作经验
- **工作汇报助手** - 自动生成日报、周报、月报，轻松应对汇报需求
- **隐私优先** - 100%本地存储，无需联网，数据完全由您掌控

### 👥 适用人群

- 📊 **项目经理** - 管理多个项目任务，跟踪进度和依赖关系
- 💻 **程序员** - 记录技术任务、Bug修复、学习笔记
- 📚 **学生** - 管理课程作业、考试计划、学习进度
- ✍️ **内容创作者** - 组织创作灵感、素材收集、发布计划
- 🏢 **职场人士** - 日常工作任务管理、工作总结汇报

## ✨ 核心特性

### 🎨 任务管理系统

- **多维度管理**
  - 4种状态：待办 / 进行中 / 已完成 / 暂停
  - 3级优先级：高 / 中 / 低
  - 自定义标签分类，支持多标签
  - 时间管理：开始时间 + 截止时间
  - 逾期提醒：自动显示逾期时长

- **灵活排序**
  - 手动拖拽排序，自定义显示顺序
  - 多Tab独立排序（每个Tab可有不同的排序方式）
  - 8种自动排序：创建时间、更新时间、开始时间、截止时间（升序/降序）
  - 并列任务自动分组显示

- **自定义Tab**
  - 为重要标签创建专属Tab
  - 快速筛选特定类型任务
  - Tab顺序自定义调整

### 🔗 任务关联系统（独创功能）

建立任务之间的关系，构建知识网络：

- **依赖关系（Extends）** - A扩展自B，B是A的基础
  - 示例：「React进阶」扩展自「React基础」
  
- **背景关系（Background）** - A是B的背景，B需要A的上下文
  - 示例：「需求文档」是「功能开发」的背景
  
- **并列关系（Parallel）** - A和B可以并行处理
  - 示例：「前端开发」和「后端开发」可以并行
  - 并列任务自动分组显示，统一管理

- **关联可视化**
  - 查看任务的所有关联关系
  - 快速跳转到关联任务
  - 关联上下文展开查看

### 📝 富文本编辑

- **强大的编辑能力**
  - 基于Quill编辑器，支持丰富格式
  - 粗体、斜体、下划线、删除线
  - 有序列表、无序列表
  - 标题、引用、代码块
  - 图片插入和管理

- **图片处理**
  - 支持粘贴、拖拽上传图片
  - 自动转换为base64存储
  - 图片大小限制和压缩
  - 纯文本降级模式（性能优化）

- **智能功能**
  - 内容哈希去重检测
  - AI关键词提取（可选）
  - 一键复制内容到剪贴板

### 📅 日历与报告

- **日历视图**
  - 可视化查看任务时间分布
  - 按月份浏览任务
  - 三种视图大小：紧凑 / 标准 / 舒适
  - 快速跳转到指定日期

- **自动生成报告**
  - **日报** - 每日任务完成情况
  - **周报** - 本周工作总结，自动统计完成率
  - **月报** - 月度工作回顾，数据可视化
  - 支持编辑和保存报告内容
  - 周五/月初自动提醒填写报告

### 🤖 AI智能辅助（可选）

- **支持多个AI提供商**
  - Kimi（月之暗面）
  - DeepSeek（深度求索）
  - 豆包（字节跳动）
  - 自定义API端点

- **智能功能**
  - 关键词自动提取（基于中文分词）
  - 任务智能推荐（基于关键词匹配）
  - 内容去重检测
  - 可完全禁用AI功能

### 🎯 双视图模式

- **卡片视图** - 传统列表模式，信息全面
  - 显示所有任务信息
  - 快速操作按钮
  - 状态和优先级标签
  
- **内容专注视图** - 沉浸式编辑模式
  - 专注于任务内容
  - 实时自动保存
  - 防抖机制避免频繁保存
  - 适合长文本编辑

### 🔍 搜索与过滤

- **全文搜索**
  - 搜索标题和内容
  - 实时搜索结果
  - 高亮显示匹配内容

- **多维度过滤**
  - 按状态过滤
  - 按优先级过滤
  - 按标签过滤
  - 组合过滤条件

### 💾 数据管理

- **本地存储**
  - SQLite数据库，轻量高效
  - 完全本地化，无需联网
  - 数据完全由您掌控

- **数据导出**
  - 导出为JSON格式
  - 导出为纯文本
  - 批量导出任务数据

- **工作心得**
  - 独立的笔记系统
  - 记录工作经验和想法
  - 富文本编辑支持

### ⚡ 全局快捷键

- **快速创建** - `Ctrl/Cmd + Shift + T`
  - 在任何应用中快速创建待办
  - 自动获取剪贴板内容（文字/图片）
  - 应用自动打开并填充内容

- **系统托盘**
  - 最小化到托盘，不占用任务栏
  - 单击托盘图标快速显示
  - 右键菜单快速操作

### 🎨 主题与外观

- **浅色主题** - 适合日间使用，清新明亮
- **纯黑主题** - 适合夜间使用，护眼省电（AMOLED屏幕友好）
- **自定义配置** - 日历视图大小、字体大小等

## 🌟 应用场景

### 场景1：项目管理

**问题**：管理多个项目，任务繁多，依赖关系复杂

**解决方案**：
1. 为每个项目创建自定义Tab（如：「项目A」「项目B」）
2. 使用依赖关系标记任务先后顺序
3. 使用并列关系标记可并行任务
4. 手动排序调整任务优先级
5. 日历视图查看项目时间线
6. 自动生成周报汇报项目进度

**示例**：
```
项目A Tab:
├─ [并列] 前端开发 ⟷ 后端开发
├─ [依赖] API文档 → 接口开发 → 联调测试
└─ [背景] 需求文档（为所有开发任务提供背景）
```

### 场景2：学习计划管理

**问题**：学习内容多，知识点有先后关系，难以系统化

**解决方案**：
1. 创建「学习」Tab，集中管理学习任务
2. 使用依赖关系建立知识体系
3. 富文本记录学习笔记和代码
4. 使用标签分类（如：#前端 #算法 #数据库）
5. 月报回顾学习成果

**示例**：
```
学习路径：
HTML基础 → CSS基础 → JavaScript基础 → React入门 → React进阶
                                          ↓
                                      项目实战
```

### 场景3：内容创作

**问题**：灵感碎片化，素材分散，创作流程难以管理

**解决方案**：
1. 快捷键快速记录灵感（随时随地）
2. 使用标签分类素材（#选题 #素材 #草稿）
3. 图片粘贴功能保存视觉素材
4. 使用背景关系关联相关素材
5. 专注视图进行长文写作
6. 工作心得记录创作经验

### 场景4：日常工作管理

**问题**：工作任务多而杂，需要定期汇报，手动整理费时

**解决方案**：
1. 按优先级管理每日任务
2. 使用状态跟踪任务进度
3. 截止时间提醒重要任务
4. 自动生成日报/周报/月报
5. 一键复制报告内容到汇报文档
6. 工作心得记录经验教训

### 场景5：个人知识管理

**问题**：知识碎片化，难以建立体系，查找不便

**解决方案**：
1. 每个知识点作为一个待办
2. 使用任务关联建立知识网络
3. 富文本记录详细内容
4. 标签系统分类管理
5. 全文搜索快速查找
6. 导出为文档长期保存

## 🚀 快速开始

### 下载安装

从 [GitHub Releases](https://github.com/bulubulu138/MultiTodoApp/releases) 下载最新版本：

#### Windows
下载 `MultiTodo-1.0.0-x64-setup.exe` 并运行安装程序。

#### macOS
- **Intel Mac**: 下载 `MultiTodo-1.0.0-x64.dmg`
- **Apple Silicon (M1/M2/M3)**: 下载 `MultiTodo-1.0.0-arm64.dmg`

打开 DMG 文件，将应用拖到 Applications 文件夹。

> 💡 **提示**: macOS 首次运行可能需要在"系统偏好设置 > 安全性与隐私"中允许应用运行。

### 首次使用指南

1. **创建第一个待办**
   - 点击「新建待办」按钮
   - 填写标题和内容
   - 设置优先级和标签
   - 可选：设置开始时间和截止时间

2. **尝试全局快捷键**
   - 在任何应用中按 `Ctrl/Cmd + Shift + T`
   - 选中文字或复制图片后使用快捷键
   - MultiTodo 会自动打开并填充内容

3. **建立任务关联**
   - 点击任务卡片上的「关联」按钮
   - 选择关联类型和目标任务
   - 查看关联上下文

4. **自定义工作区**
   - 点击「管理Tab」创建自定义Tab
   - 在「设置」中调整主题和外观
   - 配置AI功能（可选）

### 快捷键速查表

| 功能 | Windows | macOS |
|------|---------|-------|
| 全局快速创建 | `Ctrl + Shift + T` | `Cmd + Shift + T` |
| 新建待办 | 点击工具栏按钮 | 点击工具栏按钮 |
| 搜索 | 点击搜索按钮 | 点击搜索按钮 |
| 切换主题 | 设置中切换 | 设置中切换 |

## 🛠️ 技术栈

- **框架**: Electron 27 - 跨平台桌面应用
- **前端**: React 18 + TypeScript 5 - 现代化UI开发
- **UI 库**: Ant Design 5 - 企业级组件库
- **富文本编辑器**: Quill 2.0 / react-quill-new - 强大的编辑能力
- **数据库**: SQLite3 (better-sqlite3) - 轻量级本地数据库
- **构建工具**: Webpack 5 + electron-builder - 打包和发布
- **状态管理**: React Hooks - 简洁的状态管理
- **中文分词**: segment - AI关键词提取
- **样式**: CSS + CSS Variables - 主题切换支持

## 📂 项目结构

```
MultiTodoApp/
├── .github/
│   └── workflows/         # GitHub Actions 自动构建配置
├── assets/                # 资源文件
│   ├── icon*.png         # 应用图标（多尺寸）
│   ├── icon.ico          # Windows 图标
│   ├── entitlements.mac.plist  # macOS 权限配置
│   └── installer.nsh     # Windows 安装程序配置
├── src/
│   ├── main/             # Electron 主进程
│   │   ├── main.ts       # 应用入口、窗口管理、托盘、快捷键
│   │   ├── preload.ts    # 预加载脚本、IPC 桥接
│   │   ├── database/     # SQLite 数据库管理
│   │   │   └── DatabaseManager.ts  # 数据库操作封装
│   │   ├── services/     # 业务服务
│   │   │   ├── AIService.ts         # AI集成服务
│   │   │   ├── KeywordExtractor.ts  # 关键词提取
│   │   │   └── KeywordProcessor.ts  # 关键词处理
│   │   └── utils/        # 工具函数
│   │       ├── ImageManager.ts      # 图片管理
│   │       └── hashUtils.ts         # 哈希计算
│   ├── renderer/         # React 渲染进程
│   │   ├── App.tsx       # 主应用组件
│   │   ├── components/   # UI 组件（20个）
│   │   │   ├── TodoList.tsx         # 任务列表（卡片视图）
│   │   │   ├── TodoForm.tsx         # 任务编辑表单
│   │   │   ├── TodoViewDrawer.tsx   # 任务详情抽屉
│   │   │   ├── ContentFocusView.tsx # 内容专注视图
│   │   │   ├── RichTextEditor.tsx   # 富文本编辑器
│   │   │   ├── PlainTextFallback.tsx # 纯文本降级
│   │   │   ├── RelationsModal.tsx   # 关联管理
│   │   │   ├── RelationContext.tsx  # 关联上下文
│   │   │   ├── CalendarDrawer.tsx   # 日历视图
│   │   │   ├── DailyReport.tsx      # 日报
│   │   │   ├── WeeklyReport.tsx     # 周报
│   │   │   ├── MonthlyReport.tsx    # 月报
│   │   │   ├── ReportModal.tsx      # 报告模态框
│   │   │   ├── SearchModal.tsx      # 搜索
│   │   │   ├── ExportModal.tsx      # 导出
│   │   │   ├── SettingsModal.tsx    # 设置
│   │   │   ├── NotesDrawer.tsx      # 工作心得
│   │   │   ├── CustomTabManager.tsx # 自定义Tab管理
│   │   │   ├── TagManagement.tsx    # 标签管理
│   │   │   └── Toolbar.tsx          # 工具栏
│   │   ├── hooks/        # 自定义 Hooks
│   │   │   └── useThemeColors.ts    # 主题颜色
│   │   ├── styles/       # 全局样式
│   │   │   └── global.css
│   │   ├── theme/        # 主题配置
│   │   │   └── themes.ts            # 主题定义
│   │   └── utils/        # 工具函数
│   │       ├── copyTodo.ts          # 复制功能
│   │       ├── reportGenerator.ts   # 报告生成
│   │       └── sortWithGroups.ts    # 分组排序
│   └── shared/           # 共享类型定义
│       └── types.ts      # TypeScript 类型
├── build_final.bat       # Windows 构建脚本
├── build_mac.sh          # macOS 构建脚本
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
└── webpack.renderer.config.js  # Webpack 配置
```

## 🔧 开发

### 前置要求
- Node.js 16+ 
- npm 或 yarn

### 安装依赖
```bash
cd MultiTodoApp
npm install
```

### 开发模式
```bash
npm run dev
```
这将启动开发服务器和 Electron 应用，支持热重载。

### 构建应用
```bash
npm run build
```
编译 TypeScript 和打包前端资源。

### 打包发布

#### Windows
```bash
npm run dist:win
```
输出: `release\MultiTodo-1.0.0-x64-setup.exe`

#### macOS
```bash
npm run dist:mac
```
输出: 
- `release/MultiTodo-1.0.0-x64.dmg` (Intel)
- `release/MultiTodo-1.0.0-arm64.dmg` (Apple Silicon)

### 使用 GitHub Actions 自动构建（推荐）

详见: [快速开始 - GitHub自动构建.md](快速开始%20-%20GitHub自动构建.md)

## 📦 构建说明

### 平台支持

| 平台 | 状态 | 构建脚本 | 说明 |
|------|------|----------|------|
| **Windows 10/11** | ✅ 完全支持 | `build_final.bat` | x64 架构 |
| **macOS (Intel)** | ✅ 完全支持 | `build_mac.sh` | x64 架构 |
| **macOS (Apple Silicon)** | ✅ 完全支持 | `build_mac.sh` | arm64 架构 |

### 构建方式

1. **本地构建** - 使用 `build_final.bat` (Windows) 或 `build_mac.sh` (macOS)
2. **GitHub Actions** - 推送代码后自动构建，支持跨平台编译

## 🔒 隐私和数据安全

### 数据安全承诺

- ✅ **100%本地存储** - 所有数据存储在本地 SQLite 数据库
- ✅ **零网络请求** - 不会上传任何用户数据到服务器（AI功能除外，且可完全禁用）
- ✅ **数据自主权** - 用户完全控制自己的数据
- ✅ **无追踪统计** - 不收集任何使用统计或分析数据
- ✅ **开源透明** - 代码完全开源，欢迎审查

### 数据位置

- **Windows**: `%APPDATA%\MultiTodo\`
  - 数据库: `%APPDATA%\MultiTodo\database.db`
  - 图片: `%APPDATA%\MultiTodo\images\`
  
- **macOS**: `~/Library/Application Support/MultiTodo/`
  - 数据库: `~/Library/Application Support/MultiTodo/database.db`
  - 图片: `~/Library/Application Support/MultiTodo/images/`

### AI功能说明

- AI功能完全可选，默认禁用
- 启用后仅用于关键词提取和智能推荐
- 需要用户主动配置API密钥
- 可随时在设置中禁用

### 数据备份建议

建议定期备份数据库文件，以防数据丢失：
1. 在设置中点击「打开数据文件夹」
2. 复制 `database.db` 文件到安全位置
3. 建议使用云盘自动同步备份文件夹

## 📝 更新日志

### v1.0.0 (2025-01-24)

**核心功能**:
- ✅ 完整的任务管理系统（状态、优先级、标签、时间）
- ✅ 富文本编辑器支持（Quill + 图片管理）
- ✅ 任务关联系统（依赖/背景/并列关系）
- ✅ 双视图模式（卡片视图 + 内容专注视图）
- ✅ 日历视图和报告功能（日报/周报/月报）
- ✅ 自定义Tab和标签管理
- ✅ 全局快捷键快速创建
- ✅ 系统托盘集成
- ✅ 多主题支持（浅色/纯黑）
- ✅ AI智能辅助（可选）
- ✅ 搜索和导出功能
- ✅ 工作心得笔记系统

**平台支持**:
- ✅ Windows 10/11 (x64)
- ✅ macOS Intel (x64)
- ✅ macOS Apple Silicon (arm64)

**构建与部署**:
- ✅ GitHub Actions 自动构建
- ✅ 跨平台编译支持

**性能优化**:
- ✅ React 组件优化（useMemo、useCallback）
- ✅ 图片懒加载和缓存
- ✅ 数据库查询优化
- ✅ 防抖和节流机制

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 报告问题

如果您发现 Bug 或有功能建议，请在 [Issues](https://github.com/bulubulu138/MultiTodoApp/issues) 中提交。

提交 Issue 时请包含：
- 操作系统和版本
- 应用版本
- 问题复现步骤
- 预期行为和实际行为
- 截图（如适用）

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

```
MIT License

Copyright (c) 2025 MultiTodo Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 👥 作者

**MultiTodo Team**

- GitHub: [@bulubulu138](https://github.com/bulubulu138)

## 🙏 致谢

感谢以下优秀的开源项目：

- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
- [React](https://react.dev/) - 用户界面库
- [Ant Design](https://ant.design/) - 企业级 UI 设计语言
- [Quill](https://quilljs.com/) - 富文本编辑器
- [SQLite](https://www.sqlite.org/) - 轻量级数据库
- [TypeScript](https://www.typescriptlang.org/) - JavaScript 的超集
- [Webpack](https://webpack.js.org/) - 模块打包工具
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - 高性能 SQLite 绑定
- [segment](https://github.com/leizongmin/node-segment) - 中文分词库

## 📚 相关文档

- [快速开始 - GitHub自动构建.md](快速开始%20-%20GitHub自动构建.md) - 自动构建指南
- [RELATIONS_USER_GUIDE.md](RELATIONS_USER_GUIDE.md) - 任务关联功能详解
- [RICH_TEXT_EDITOR_GUIDE.md](RICH_TEXT_EDITOR_GUIDE.md) - 富文本编辑器使用
- [全局快捷键功能说明.md](全局快捷键功能说明.md) - 快捷键完整说明
- [性能优化说明.md](性能优化说明.md) - 性能优化详解
- [日志报告功能说明.md](日志报告功能说明.md) - 报告功能说明

## 💡 常见问题

### Q: 数据会丢失吗？
A: 所有数据存储在本地SQLite数据库中，只要不删除数据库文件就不会丢失。建议定期备份。

### Q: 可以在多台电脑上同步吗？
A: 目前不支持云同步。您可以手动复制数据库文件到其他电脑，或使用云盘同步数据文件夹。

### Q: AI功能是必须的吗？
A: 不是。AI功能完全可选，默认禁用。不启用AI也能正常使用所有核心功能。

### Q: 支持移动端吗？
A: 目前仅支持桌面端（Windows/macOS）。移动端支持在规划中。

### Q: 如何导入其他待办应用的数据？
A: 目前需要手动迁移。您可以将其他应用的数据导出为文本，然后在MultiTodo中创建任务。

### Q: 可以自定义快捷键吗？
A: 目前全局快捷键固定为 Ctrl/Cmd+Shift+T。自定义快捷键功能在规划中。

## 🌟 Star History

如果这个项目对您有帮助，请给它一个 ⭐️ Star！

---

**享受高效的任务管理体验！** ✨

**MultiTodo - 让待办管理更简单、更智能、更高效** 🚀

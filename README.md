# MultiTodo - 多功能待办应用

![Build Status](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![License](https://img.shields.io/badge/license-MIT-orange)

## 📝 简介

MultiTodo 是一个功能强大的桌面待办事项管理应用，支持 Windows 和 macOS 平台。采用现代化的技术栈，提供流畅的用户体验和丰富的功能。

### ✨ 主要特性

- 📋 **任务管理** - 创建、编辑、完成待办事项，支持优先级和状态管理
- 📝 **富文本编辑** - 支持格式化文本、图片插入和笔记功能
- 📅 **日历视图** - 可视化管理任务时间，支持日/周/月报告
- 🔗 **任务关联** - 建立任务之间的依赖、背景和并列关系
- 🔍 **智能搜索** - 快速搜索任务标题和内容
- 🏷️ **标签管理** - 自定义标签分类和自定义 Tab
- 🎨 **多主题支持** - 浅色/纯黑主题，支持自定义外观
- ⚡ **全局快捷键** - Ctrl/Cmd+Shift+T 快速创建待办
- 💾 **本地存储** - 数据完全保存在本地，隐私安全
- 📊 **数据导出** - 支持导出任务数据和生成报告

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

### 从源码构建

#### 前置要求
- Node.js 16+ 
- npm 或 yarn

#### Windows 构建
```powershell
cd MultiTodoApp
npm install
.\build_final.bat
```

输出: `release\MultiTodo-1.0.0-x64-setup.exe`

#### macOS 构建
```bash
cd MultiTodoApp
npm install
chmod +x build_mac.sh
./build_mac.sh
```

输出: 
- `release/MultiTodo-1.0.0-x64.dmg` (Intel)
- `release/MultiTodo-1.0.0-arm64.dmg` (Apple Silicon)

#### 使用 GitHub Actions 自动构建（推荐）
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

详细构建指南请参考: [快速开始 - GitHub自动构建.md](快速开始%20-%20GitHub自动构建.md)

## 🛠️ 技术栈

- **框架**: Electron 27
- **前端**: React 18 + TypeScript 5
- **UI 库**: Ant Design 5
- **富文本编辑器**: Quill / react-quill-new
- **数据库**: SQLite3 (better-sqlite3)
- **构建工具**: Webpack 5 + electron-builder
- **状态管理**: React Hooks
- **样式**: CSS Modules + CSS Variables

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
│   │   ├── main.ts       # 应用入口、窗口管理、托盘
│   │   ├── preload.ts    # 预加载脚本、IPC 桥接
│   │   ├── database/     # SQLite 数据库管理
│   │   └── utils/        # 工具函数（图片、哈希）
│   ├── renderer/         # React 渲染进程
│   │   ├── App.tsx       # 主应用组件
│   │   ├── components/   # UI 组件（19个）
│   │   ├── hooks/        # 自定义 Hooks
│   │   ├── styles/       # 全局样式
│   │   ├── theme/        # 主题配置
│   │   └── utils/        # 工具函数
│   └── shared/           # 共享类型定义
├── build_final.bat       # Windows 构建脚本
├── build_mac.sh          # macOS 构建脚本
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
└── webpack.renderer.config.js  # Webpack 配置
```

## 🔧 开发

### 安装依赖
```bash
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
```bash
# Windows
npm run dist:win

# macOS
npm run dist:mac
```

### 代码检查
```bash
npm run lint
```

## 📖 功能指南

### 核心功能

#### 1. 任务管理
- **创建待办**: 支持标题、内容、优先级、状态、标签
- **富文本内容**: 支持格式化文本、图片、链接
- **手动排序**: 自定义待办显示顺序
- **状态管理**: 待办/进行中/已完成/暂停
- **优先级**: 高/中/低三个级别

#### 2. 任务关联
- **依赖关系**: A 扩展自 B（B 是 A 的基础）
- **背景关系**: A 是 B 的背景（B 依赖 A 的上下文）
- **并列关系**: A 和 B 可以并行处理

详见: [RELATIONS_USER_GUIDE.md](RELATIONS_USER_GUIDE.md)

#### 3. 富文本编辑
- **格式化**: 粗体、斜体、下划线、删除线
- **列表**: 有序列表、无序列表
- **插入**: 图片、链接
- **纯文本模式**: 性能优化的备选方案

详见: [RICH_TEXT_EDITOR_GUIDE.md](RICH_TEXT_EDITOR_GUIDE.md)

#### 4. 日历与报告
- **日历视图**: 可视化查看待办时间分布
- **日报**: 每日待办统计
- **周报**: 每周工作总结
- **月报**: 每月完成情况

详见: [日志报告功能说明.md](日志报告功能说明.md)

#### 5. 全局快捷键
- **快速创建**: `Ctrl/Cmd + Shift + T` 在任何应用中快速创建待办
- **剪贴板集成**: 自动填充剪贴板内容（文字/图片）
- **系统托盘**: 最小化到托盘，快速访问

详见: [全局快捷键功能说明.md](全局快捷键功能说明.md)

#### 6. 自定义标签
- **标签管理**: 创建、编辑、删除标签
- **自定义 Tab**: 为重要标签创建专属 Tab
- **标签统计**: 查看每个标签的待办数量

#### 7. 主题与外观
- **浅色主题**: 适合日间使用
- **纯黑主题**: 适合夜间使用，AMOLED 省电
- **自定义配置**: 日历视图大小等

#### 8. 数据管理
- **本地存储**: SQLite 数据库，完全本地化
- **数据导出**: 导出待办数据
- **搜索功能**: 快速搜索标题和内容
- **工作心得**: 记录工作笔记和想法

### 性能优化

应用经过多项性能优化，确保流畅体验：
- ✅ 精简的 CSS 过渡动画
- ✅ React 组件优化（rowKey、useMemo）
- ✅ 图片懒加载和缓存
- ✅ 数据库查询优化

详见: [性能优化说明.md](性能优化说明.md)

## 🔒 隐私和数据

### 数据安全

- ✅ **完全本地化** - 所有数据存储在本地 SQLite 数据库
- ✅ **无网络请求** - 不会上传任何用户数据到服务器
- ✅ **数据自主** - 用户完全控制自己的数据
- ✅ **无追踪** - 不收集任何使用统计或分析数据

### 数据位置

- **Windows**: `%APPDATA%\MultiTodo\`
  - 数据库: `%APPDATA%\MultiTodo\database.db`
- **macOS**: `~/Library/Application Support/MultiTodo/`
  - 数据库: `~/Library/Application Support/MultiTodo/database.db`

### 数据备份

建议定期备份数据库文件，以防数据丢失。

## 📝 更新日志

### v1.0.0 (2025-01-24)

**核心功能**:
- ✅ 完整的任务管理系统
- ✅ 富文本编辑器支持
- ✅ 日历视图和报告功能
- ✅ 任务关联系统（依赖/背景/并列）
- ✅ 标签管理和自定义 Tab
- ✅ 全局快捷键快速创建
- ✅ 系统托盘集成
- ✅ 多主题支持（浅色/纯黑）

**平台支持**:
- ✅ Windows 10/11 (x64)
- ✅ macOS Intel (x64)
- ✅ macOS Apple Silicon (arm64)

**构建与部署**:
- ✅ GitHub Actions 自动构建
- ✅ 跨平台编译支持

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

## 📚 相关文档

- [快速开始 - GitHub自动构建.md](快速开始%20-%20GitHub自动构建.md) - 自动构建指南
- [RELATIONS_USER_GUIDE.md](RELATIONS_USER_GUIDE.md) - 任务关联功能详解
- [RICH_TEXT_EDITOR_GUIDE.md](RICH_TEXT_EDITOR_GUIDE.md) - 富文本编辑器使用
- [全局快捷键功能说明.md](全局快捷键功能说明.md) - 快捷键完整说明
- [性能优化说明.md](性能优化说明.md) - 性能优化详解
- [日志报告功能说明.md](日志报告功能说明.md) - 报告功能说明

## 🌟 Star History

如果这个项目对您有帮助，请给它一个 ⭐️ Star！

---

**享受高效的任务管理体验！** ✨

**MultiTodo - 让待办管理更简单、更高效** 🚀

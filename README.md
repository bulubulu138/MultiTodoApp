# MultiTodo - 多功能待办应用

![Build Status](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Version](https://img.shields.io/badge/version-1.0.0-green)

## 📝 简介

MultiTodo 是一个功能强大的桌面待办事项管理应用，支持 Windows 和 macOS 平台。

### ✨ 主要特性

- 📋 任务管理 - 创建、编辑、完成待办事项
- 📝 富文本编辑 - 支持格式化文本和笔记
- 📅 日历视图 - 可视化管理任务时间
- 🔗 任务关联 - 建立任务之间的关系
- 🔍 智能搜索 - 快速找到需要的内容
- 🎨 多主题支持 - 自定义界面外观
- 💾 本地存储 - 数据完全保存在本地

## 🚀 快速开始

### 下载安装

#### Windows
下载 `MultiTodo-1.0.0-x64-setup.exe` 并运行安装程序。

#### macOS
- Intel Mac: 下载 `MultiTodo-1.0.0-x64.dmg`
- Apple Silicon (M1/M2/M3): 下载 `MultiTodo-1.0.0-arm64.dmg`

打开 DMG 文件，将应用拖到 Applications 文件夹。

### 从源码构建

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
- `release/MultiTodo-1.0.0-x64.dmg`
- `release/MultiTodo-1.0.0-arm64.dmg`

#### 使用 GitHub Actions 自动构建（推荐）
详见: [快速开始 - GitHub自动构建.md](快速开始%20-%20GitHub自动构建.md)

## 📦 构建说明

### 平台支持

| 平台 | 状态 | 构建脚本 | 说明 |
|------|------|----------|------|
| **Windows 10/11** | ✅ 完全支持 | `build_final.bat` | x64 架构 |
| **macOS (Intel)** | ✅ 完全支持 | `build_mac.sh` | x64 架构 |
| **macOS (Apple Silicon)** | ✅ 完全支持 | `build_mac.sh` | arm64 架构 |

### 构建文档

- 📄 [BUILD_SUMMARY.md](BUILD_SUMMARY.md) - 构建总结和配置说明
- 📄 [BUILD_MACOS_GUIDE.md](BUILD_MACOS_GUIDE.md) - macOS 详细构建指南
- 📄 [GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md) - GitHub Actions 设置
- 📄 [快速开始 - GitHub自动构建.md](快速开始%20-%20GitHub自动构建.md) - 最简单的构建方法

## 🛠️ 技术栈

- **框架**: Electron 27
- **前端**: React 18 + TypeScript
- **UI 库**: Ant Design 5
- **编辑器**: Quill / react-quill-new
- **数据库**: SQLite3 (better-sqlite3)
- **构建工具**: Webpack 5 + electron-builder

## 📂 项目结构

```
MultiTodoApp/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── main.ts        # 应用入口
│   │   ├── preload.ts     # 预加载脚本
│   │   └── database/      # 数据库管理
│   ├── renderer/          # React 渲染进程
│   │   ├── App.tsx        # 主应用组件
│   │   ├── components/    # UI 组件
│   │   └── hooks/         # 自定义 Hooks
│   └── shared/            # 共享类型定义
├── assets/                # 资源文件（图标、脚本）
├── .github/workflows/     # GitHub Actions 配置
├── build_final.bat        # Windows 构建脚本
├── build_mac.sh           # macOS 构建脚本
└── package.json           # 项目配置
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

### 构建应用
```bash
npm run build
```

### 打包发布
```bash
# Windows
npm run dist:win

# macOS
npm run dist:mac
```

## 📖 用户指南

应用包含以下功能模块：

- **任务管理** - 创建、编辑、删除、完成任务
- **富文本笔记** - 每个任务可以添加详细的格式化笔记
- **日历视图** - 在日历中查看和管理任务
- **任务关联** - 建立任务之间的依赖和关联关系
- **搜索功能** - 快速搜索任务标题和内容
- **主题切换** - 多种主题可选
- **数据导出** - 导出任务数据

详细使用说明：
- 📄 [RELATIONS_USER_GUIDE.md](RELATIONS_USER_GUIDE.md) - 任务关联功能
- 📄 [RICH_TEXT_EDITOR_GUIDE.md](RICH_TEXT_EDITOR_GUIDE.md) - 富文本编辑器

## 🔒 隐私和数据

- ✅ **完全本地化** - 所有数据存储在本地
- ✅ **无网络请求** - 不会上传任何用户数据
- ✅ **数据自主** - 用户完全控制自己的数据

数据位置：
- Windows: `%APPDATA%\MultiTodo`
- macOS: `~/Library/Application Support/MultiTodo`

## 📝 更新日志

### v1.0.0 (2025-01-XX)
- ✅ 初始版本发布
- ✅ Windows 和 macOS 支持
- ✅ 完整的任务管理功能
- ✅ 富文本编辑器
- ✅ 日历和关联功能
- ✅ GitHub Actions 自动构建

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

Copyright (c) 2025 MultiTodo Team

## 👥 作者

MultiTodo Team

## 🙏 致谢

感谢以下开源项目：
- Electron
- React
- Ant Design
- Quill
- SQLite

---

**享受高效的任务管理体验！** ✨

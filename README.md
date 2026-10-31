# MultiTodo - 智能多功能待办应用

<div align="center">

![MultiTodo Logo](assets/icon_256x256.png)

**让你的每一个任务都有意义**

[![Build Status](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)](https://github.com/bulubulu138/MultiTodoApp/actions)
[![Version](https://img.shields.io/badge/version-1.1.0-green)](https://github.com/bulubulu138/MultiTodoApp/releases)
[![License](https://img.shields.io/badge/license-MIT-orange)](https://github.com/bulubulu138/MultiTodoApp/blob/main/LICENSE)
[![Performance](https://img.shields.io/badge/performance-optimized-brightgreen)](https://github.com/bulubulu138/MultiTodoApp#性能指标)

[📥 立即下载](#-立即下载) • [✨ 核心功能](#-为什么选择-multitodo) • [📖 使用文档](#-快速开始) • [🛠️ 开发指南](#-开发指南)

</div>

---

## 🎯 产品故事

你是否曾经：
- 📝 在多个待办工具间反复切换，找不到最适合自己的？
- 🔍 想快速找到某个任务，却要翻半天历史记录？
- 🤔 完成了很多待办，却不知道哪些真正有价值？
- 🔗 任务之间有依赖关系，但工具不支持关联管理？

**MultiTodo 就是为解决这些痛点而生。**

我们相信，一个好的待办工具不应该只是"记录"任务，而应该帮助你**理解任务、组织任务、完成任务**。

---

## ✨ 为什么选择 MultiTodo？

### 🚀 极致性能
```
搜索 1000+ 任务    < 200ms
生成周报          < 500ms
启动速度          < 2s
```

不管你有多少任务，MultiTodo 都能保持流畅体验。

### 🧠 智能推荐
基于中文分词和 TF-IDF 算法，自动为你推荐相关任务：
- 开始写文档时，自动显示之前的相关笔记
- 修复 Bug 时，自动关联相关的技术调研
- 完成任务时，智能推荐下一步该做什么

### 🎨 双视图模式

**卡片视图** - 全局把控
```
┌────────────────────────────────────┐
│  🎯 高优先级    📅 截止日期        │
│  ────────────────────────────────  │
│  ✅ 已完成      🔄 进行中          │
│  ────────────────────────────────  │
│  标签、状态、优先级一目了然        │
└────────────────────────────────────┘
```

**内容专注视图** - 沉浸写作
```
┌────────────────────────────────────┐
│                                    │
│     你的想法......                 │
│                                    │
│                                    │
│     （无干扰的纯净空间）           │
│                                    │
│                                    │
└────────────────────────────────────┘
```

### 🔗 独创任务关系系统

```
        依赖关系 (Depends On)
         ↓
    [任务A] ────→ [任务B]
         ↑
      背景关系 (Background)

    [任务C] ⇄ [任务D]
       并列关系 (Parallel)
```

- **依赖**：完成 A 才能开始 B
- **背景**：B 是为了支持 A 而做的准备工作
- **并列**：两个任务可以同时进行

### 📊 智能报表系统

**不只是统计数字，更是洞察价值**

- 📈 **任务质量评分**：根据完成情况、时间投入自动评估
- 🎯 **效率分析**：哪些时间段最高效？哪些任务拖得最久？
- 💡 **智能建议**：基于历史数据，给出下周工作建议

### 🎨 强大的富文本编辑

- ✍️ 所见即所得的编辑体验
- 📷 支持图片拖拽和粘贴
- 🎨 支持 Markdown 语法
- 📎 支持附件管理

### 🤖 可选 AI 助手

**100% 可禁用，隐私优先**

支持多个 AI 提供商：
- [Kimi](https://kimi.moonshot.cn/)
- [DeepSeek](https://www.deepseek.com/)
- [字节豆包](https://www.doubao.com/)
- 自定义 API 端点

---

## 📥 立即下载

### Windows 用户

<a href="https://github.com/bulubulu138/MultiTodoApp/releases/latest/download/MultiTodo-1.1.0-x64-setup.exe">
  <img src="https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Download for Windows">
</a>

**推荐系统**：Windows 10/11 (64-bit)

> 💡 **首次安装提示**：Windows 可能会显示 SmartScreen 警告，点击"更多信息" → "仍要运行"即可。

### macOS 用户

#### Intel 芯片 Mac (x64)
<a href="https://github.com/bulubulu138/MultiTodoApp/releases/latest/download/MultiTodo-1.1.0-x64.dmg">
  <img src="https://img.shields.io/badge/macOS_Intel-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS Intel">
</a>

#### Apple Silicon Mac (M1/M2/M3/M4)
<a href="https://github.com/bulubulu138/MultiTodoApp/releases/latest/download/MultiTodo-1.1.0-arm64.dmg">
  <img src="https://img.shields.io/badge/macOS_ARM-000000?style=for-the-badge&logo=apple&logoColor=white" alt="Download for macOS ARM">
</a>

> 💡 **如何选择？** 点击左上角  → "关于本机" → 查看"芯片"信息
> - Intel 芯片：显示 Intel Core i5/i7/i9 等
> - Apple Silicon：显示 M1/M2/M3/M4 等

> ⚠️ **首次运行提示**：macOS 可能会阻止运行，请前往"系统偏好设置" → "安全性与隐私" → 点击"仍要打开"。

---

## 🚀 快速开始

### 1️⃣ 安装应用

下载对应平台的安装包，按照提示完成安装。

### 2️⃣ 创建第一个任务

使用全局快捷键 `Ctrl/Cmd + Shift + T` 快速创建任务，或点击界面上的"新建任务"按钮。

### 3️⃣ 探索功能

- **搜索**：`Ctrl/Cmd + F` 全局搜索
- **切换视图**：在卡片视图和内容专注视图间切换
- **添加关系**：右键任务 → "管理关系"
- **查看报表**：点击"报表"标签查看统计数据

### 4️⃣ 配置 AI（可选）

进入"设置" → "AI 配置"，选择喜欢的 AI 提供商并输入 API Key。

---

## 💡 使用场景

### 📚 学生 - 管理课程和作业
```
└─ 📖 数据结构课程
   ├─ 🔵 第三章作业 [进行中]
   │  └─ 背景：第三章笔记整理 [已完成]
   └─ 🔴 期末项目 [待开始]
      └─ 依赖：第三章作业 [进行中]
```

### 💼 开发者 - 管理项目和 Bug
```
└─ 🚀 新功能开发
   ├─ 📝 需求文档 [已完成]
   ├─ 🎨 UI 设计 [已完成]
   ├─ 💻 前端开发 [进行中]
   │  └─ 依赖：UI 设计
   └─ 🧪 单元测试 [待开始]
      └─ 依赖：前端开发
```

### ✍️ 内容创作者 - 管理创作流程
```
└─ 📹 新视频制作
   ├─ 💡 选题调研 [已完成]
   ├─ 📝 脚本撰写 [进行中]
   ├─ 🎬 拍摄 [待开始] ⇄ 🎨 缩略图设计 [待开始]
   └─ ✂️ 剪辑 [待开始]
      └─ 依赖：拍摄 + 缩略图设计
```

---

## 📊 性能指标

| 操作 | 数据规模 | 响应时间 | 说明 |
|------|---------|---------|------|
| 搜索任务 | 1000+ 条 | < 200ms | 使用索引 + LRU 缓存 |
| 生成周报 | 100+ 条/周 | < 500ms | 增量计算 + 智能评分 |
| 切换视图 | 任意 | < 50ms | React 虚拟化列表 |
| 启动应用 | - | < 2s | 延迟加载 + 预加载优化 |

---

## 🛠️ 技术架构

<details>
<summary>点击展开技术栈详情</summary>

### 前端
- **框架**：React 18 + TypeScript
- **UI 组件**：Ant Design 5
- **富文本编辑器**：Quill 2.0
- **状态管理**：React Hooks + Context API
- **虚拟化渲染**：react-window

### 后端
- **运行时**：Electron 27
- **数据库**：SQLite (better-sqlite3)
- **中文分词**：segment
- **搜索算法**：TF-IDF + LRU 缓存

### 构建工具
- **打包工具**：Webpack 5
- **构建工具**：electron-builder
- **CI/CD**：GitHub Actions

### 架构特点
- ✅ **本地优先**：100% 本地存储,无需联网
- ✅ **性能优化**：虚拟化渲染 + 数据库索引
- ✅ **安全可靠**：内容哈希防重 + 数据备份
- ✅ **跨平台**：Windows + macOS 原生体验

</details>

---

## 🛠️ 开发指南

### 环境要求
- Node.js >= 20.x
- Python 3.11 (macOS 图标生成需要)

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev           # 启动开发服务器（主进程 + 渲染进程）
npm run dev:main      # 仅编译主进程
npm run dev:renderer  # 仅启动渲染进程开发服务器
```

### 构建
```bash
npm run build         # 构建应用
npm run dist          # 打包成安装包
npm run dist:win      # 仅打包 Windows 版本
npm run dist:mac      # 仅打包 macOS 版本
```

### 发布新版本
```bash
npm run release           # 自动递增补丁版本（1.1.0 → 1.1.1）
npm run release 1.2.0     # 发布指定版本号
```

发布脚本会自动：
1. 更新 package.json 版本号
2. 创建 git tag
3. 推送到 GitHub
4. 触发 GitHub Actions 自动构建和发布

---

## 📝 更新日志

查看 [CHANGELOG.md](./CHANGELOG.md) 了解详细更新内容。

### v1.1.0 亮点 (2026-10-31)
- 🚀 搜索性能提升 3 倍（< 200ms）
- 🚀 周报生成速度提升至 < 500ms
- ✨ 新增任务质量评分系统
- ✨ 优化任务关系管理
- 🐛 修复大数据集性能问题

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范
- 使用 TypeScript 编写代码
- 遵循 ESLint 规则
- 添加必要的注释
- 保持代码简洁清晰

---

## 📄 许可证

本项目采用 [MIT License](./LICENSE) 开源协议。

---

## ⭐ Star History

如果这个项目对你有帮助，请给一个 ⭐️ Star！

每一个 Star 都是对我最大的鼓励！

---

## 📮 联系我们

- 🐛 [报告 Bug](https://github.com/bulubulu138/MultiTodoApp/issues/new?labels=bug)
- ✨ [功能建议](https://github.com/bulubulu138/MultiTodoApp/issues/new?labels=enhancement)
- 💬 [讨论交流](https://github.com/bulubulu138/MultiTodoApp/discussions)

---

<div align="center">

**MultiTodo - 让待办管理更简单、更智能、更高效** ✨

Made with ❤️ by [bulubulu138](https://github.com/bulubulu138)

</div>

# 🚀 快速开始 - GitHub 自动构建

## ✅ 准备工作已完成

我已经为你设置好了所有必要的文件：

### 创建的文件列表：
- ✅ `.github/workflows/build.yml` - GitHub Actions 工作流
- ✅ `.github/workflows/README.md` - 工作流说明文档
- ✅ `.gitignore` - Git 忽略文件配置
- ✅ `setup_github.bat` - 自动设置脚本（推荐使用）
- ✅ `GITHUB_ACTIONS_SETUP.md` - 详细设置指南
- ✅ 所有其他构建文件和文档

## 🎯 两种使用方法

### 方法 1: 使用自动设置脚本（推荐，最简单）⭐

直接运行设置脚本：

```powershell
.\setup_github.bat
```

脚本会自动：
1. ✅ 初始化 Git 仓库
2. ✅ 添加并提交所有文件
3. ✅ 提示你输入 GitHub 仓库地址
4. ✅ 推送代码到 GitHub
5. ✅ 自动触发构建

**只需要 3 个步骤：**
1. 在 GitHub 创建新仓库 (https://github.com/new)
2. 运行 `.\setup_github.bat`
3. 输入仓库地址，回车

就这么简单！🎉

---

### 方法 2: 手动设置（如果你熟悉 Git）

#### 步骤 1: 在 GitHub 创建新仓库

1. 访问 https://github.com/new
2. 填写：
   - **Repository name**: `multi-todo-app`（或其他名称）
   - **Description**: `Multi-functional Todo Tool`
   - **Public** ✓（推荐，免费无限构建）
3. ⚠️ **不要**勾选任何初始化选项
4. 点击 **"Create repository"**

#### 步骤 2: 推送代码

在 PowerShell 中运行：

```powershell
# 进入项目目录
cd D:\todolist\MultiTodoApp

# 初始化 Git（如果还没有）
git init

# 设置默认分支
git branch -M main

# 添加所有文件
git add .

# 创建提交
git commit -m "Initial commit with GitHub Actions"

# 连接到你的 GitHub 仓库（替换成你的地址）
git remote add origin https://github.com/你的用户名/multi-todo-app.git

# 推送代码
git push -u origin main
```

---

## 📊 推送后会发生什么

### 1. 自动触发构建（立即）

推送代码后，GitHub Actions 会自动开始构建：

```
你的代码推送
    ↓
GitHub Actions 自动检测
    ↓
同时开始两个构建任务：
├── Windows 构建 (5-10 分钟)
│   └── 生成: MultiTodo-1.0.0-x64-setup.exe
│
└── macOS 构建 (10-15 分钟)
    ├── 生成: MultiTodo-1.0.0-x64.dmg (Intel)
    └── 生成: MultiTodo-1.0.0-arm64.dmg (Apple Silicon)
```

### 2. 查看构建进度

1. 访问你的 GitHub 仓库
2. 点击顶部的 **"Actions"** 标签
3. 你会看到一个正在运行的工作流：**"Build MultiTodo Apps"**
4. 点击进入查看实时日志

### 3. 下载构建文件（约 15 分钟后）

构建完成后：

1. 滚动到 Actions 页面底部
2. 找到 **"Artifacts"** 部分
3. 下载：
   - 📦 **windows-installer** - 包含 Windows 安装程序
   - 📦 **macos-installers** - 包含 2 个 macOS 安装包

## 🎉 发布正式版本

当你准备发布时：

```powershell
# 1. 更新版本号（编辑 package.json）
# "version": "1.0.1"

# 2. 提交并创建标签
git add package.json
git commit -m "Release v1.0.1"
git tag v1.0.1

# 3. 推送
git push origin main
git push origin v1.0.1
```

推送标签后，GitHub 会：
- ✅ 自动构建 Windows 和 macOS 版本
- ✅ 创建一个 Draft Release
- ✅ 上传所有安装包到 Release

然后你只需：
1. 访问 **"Releases"** 页面
2. 编辑 Draft Release
3. 点击 **"Publish release"**

用户就可以下载了！

## 📱 手动触发构建

不想推送代码也能构建：

1. 访问你的仓库
2. 点击 **"Actions"**
3. 选择 **"Build MultiTodo Apps"**
4. 点击 **"Run workflow"** 按钮
5. 选择分支，点击运行

## ❓ 常见问题

### Q: 推送时要求登录 GitHub？
**A:** 首次推送需要认证：
- 会自动弹出浏览器登录
- 或使用 Personal Access Token
- 登录一次后会记住

### Q: 构建失败了怎么办？
**A:** 
1. 查看 Actions 页面的错误日志
2. 最常见的原因：网络问题（自动重试即可）
3. 可以点击 "Re-run jobs" 重新运行

### Q: 多久能完成构建？
**A:** 约 15 分钟（Windows 和 macOS 并行构建）

### Q: 构建需要付费吗？
**A:** 
- 公开仓库：完全免费 ✓
- 私有仓库：每月 2000 分钟免费额度

### Q: 我能看到 macOS 构建过程吗？
**A:** 可以！Actions 页面有详细的实时日志，包括：
- 图标创建过程
- 编译输出
- 打包进度
- 文件列表

## 📚 更多文档

- 📄 `GITHUB_ACTIONS_SETUP.md` - 完整设置指南
- 📄 `.github/workflows/README.md` - 工作流详细说明
- 📄 `BUILD_SUMMARY.md` - 构建总结
- 📄 `BUILD_MACOS_GUIDE.md` - macOS 本地构建指南

## 🎯 现在就开始吧！

### 推荐流程（5 分钟搞定）：

```powershell
# 1. 访问 GitHub 创建仓库
start https://github.com/new

# 2. 运行设置脚本
.\setup_github.bat

# 3. 输入你的仓库地址

# 4. 完成！访问 Actions 页面查看构建
```

---

**就是这么简单！** 🚀

Windows 和 macOS 版本将自动为你构建好！


# GitHub Actions 设置指南

## 🎯 目标

使用 GitHub Actions 自动构建 Windows 和 macOS 版本的 MultiTodo 应用。

## ✅ 已完成的准备工作

我已经为你创建了以下文件：
- ✅ `.github/workflows/build.yml` - GitHub Actions 工作流配置
- ✅ `.github/workflows/README.md` - 工作流详细说明
- ✅ 所有构建脚本和配置文件

## 📋 你需要做的步骤

### 步骤 1: 创建 GitHub 仓库

如果还没有 GitHub 仓库：

1. 访问 https://github.com/new
2. 填写信息：
   - Repository name: `multi-todo-app` (或其他名称)
   - Description: `Multi-functional Todo Tool - Powerful Task Management Application`
   - 选择 **Public** (免费无限制构建时间) 或 **Private**
3. 点击 **"Create repository"**

### 步骤 2: 初始化 Git 并推送代码

在 Windows PowerShell 中运行：

```powershell
# 进入项目目录
cd D:\todolist\MultiTodoApp

# 初始化 Git 仓库（如果还没有）
git init

# 添加所有文件
git add .

# 创建第一次提交
git commit -m "Initial commit with GitHub Actions workflow"

# 连接到 GitHub 仓库（替换成你的仓库地址）
git remote add origin https://github.com/你的用户名/multi-todo-app.git

# 推送到 GitHub
git push -u origin main
```

如果遇到分支名称问题（`master` vs `main`）：
```powershell
# 查看当前分支
git branch

# 如果是 master，重命名为 main
git branch -M main

# 再推送
git push -u origin main
```

### 步骤 3: 等待自动构建

推送后：

1. **访问你的 GitHub 仓库**
   ```
   https://github.com/你的用户名/multi-todo-app
   ```

2. **点击 "Actions" 标签**
   - 你会看到一个正在运行的工作流
   - 名称: "Build MultiTodo Apps"

3. **点击工作流查看详情**
   - 可以看到实时构建日志
   - Windows 和 macOS 会并行构建

4. **等待构建完成**（约 15 分钟）
   - ✅ 绿色勾号 = 成功
   - ❌ 红色叉号 = 失败（查看日志）

### 步骤 4: 下载构建文件

构建成功后：

1. **滚动到页面底部**
   找到 **"Artifacts"** 部分

2. **下载文件**：
   - 📦 `windows-installer` - Windows 安装程序
     - 包含: `MultiTodo-1.0.0-x64-setup.exe`
   
   - 📦 `macos-installers` - macOS 安装包
     - 包含: `MultiTodo-1.0.0-x64.dmg` (Intel Mac)
     - 包含: `MultiTodo-1.0.0-arm64.dmg` (Apple Silicon)

3. **解压并使用**
   - Artifacts 下载的是 ZIP 文件
   - 解压后即可使用

## 🎉 发布正式版本

当你准备发布正式版本时：

### 1. 更新版本号

编辑 `package.json`：
```json
{
  "version": "1.0.1"
}
```

### 2. 提交并创建标签

```powershell
# 提交版本更新
git add package.json
git commit -m "Release version 1.0.1"

# 创建标签
git tag v1.0.1

# 推送代码和标签
git push origin main
git push origin v1.0.1
```

### 3. 等待构建完成

推送标签后，GitHub Actions 会：
1. ✅ 构建 Windows 和 macOS 版本
2. ✅ 自动创建一个 Draft Release
3. ✅ 上传所有安装文件到 Release

### 4. 发布 Release

1. 访问 **"Releases"** 页面
2. 找到新创建的 Draft Release
3. 编辑 Release 说明（更新内容、新功能等）
4. 点击 **"Publish release"**

用户现在可以从 Releases 页面下载安装包了！

## 📊 工作流说明

### 自动触发条件

工作流会在以下情况自动运行：

| 操作 | 触发条件 | 结果 |
|------|----------|------|
| `git push` | 推送到 `main`/`master` | 构建 + 上传 Artifacts |
| `git push --tags` | 推送标签 `v*` | 构建 + 创建 Release |
| Pull Request | PR 到 `main`/`master` | 构建测试 |
| 手动触发 | 在 Actions 页面点击 | 构建 + 上传 Artifacts |

### 构建内容

```
GitHub Actions
├── Windows Build (并行)
│   ├── 安装依赖
│   ├── 编译 TypeScript
│   ├── 打包 NSIS 安装程序
│   └── 上传 .exe 文件
│
└── macOS Build (并行)
    ├── 安装依赖
    ├── 创建 icon.icns
    ├── 编译 TypeScript
    ├── 打包 DMG (x64 + arm64)
    └── 上传 .dmg 文件
```

## 🔧 手动触发构建

不需要推送代码也能触发构建：

1. 访问你的仓库
2. 点击 **"Actions"** 标签
3. 在左侧选择 **"Build MultiTodo Apps"**
4. 点击右上角的 **"Run workflow"** 按钮
5. 选择分支（通常是 `main`）
6. 点击绿色的 **"Run workflow"** 按钮

## ❓ 常见问题

### Q1: 推送后没有触发构建？
**检查：**
- 确认推送到了 `main` 或 `master` 分支
- 确认 `.github/workflows/build.yml` 文件已存在
- 访问 Actions 页面查看是否有错误

### Q2: 构建失败怎么办？
**步骤：**
1. 点击失败的工作流
2. 查看红色的步骤
3. 展开查看错误信息
4. 常见问题：
   - 依赖安装失败 → 检查网络或 `package.json`
   - 编译错误 → 确保本地构建成功
   - 打包失败 → 检查 electron-builder 配置

### Q3: 如何查看构建日志？
1. 访问 Actions 页面
2. 点击任意工作流运行
3. 点击左侧的任务名称（如 `build-windows`）
4. 展开各个步骤查看详细日志

### Q4: Artifacts 保存多久？
默认 30 天，之后会自动删除。Release 中的文件永久保存。

### Q5: 构建时间和费用？
- **公开仓库**: 完全免费，无限制
- **私有仓库**: 每月 2000 分钟免费额度
- **构建时间**: 约 15 分钟/次

### Q6: 能否只构建一个平台？
可以，但不推荐。如果只需要某个平台的文件，忽略另一个即可。

## 🎨 添加构建状态徽章

在项目的 `README.md` 中添加：

```markdown
# MultiTodo

![Build Status](https://github.com/你的用户名/multi-todo-app/actions/workflows/build.yml/badge.svg)

一个强大的多功能待办应用
```

这样可以在 README 中显示构建状态（通过/失败）。

## 📚 相关文档

- 📄 `.github/workflows/README.md` - 工作流详细说明
- 📄 `BUILD_MACOS_GUIDE.md` - macOS 本地构建指南
- 📄 `BUILD_SUMMARY.md` - 项目构建总结
- 📄 `如何在Windows上准备macOS构建.md` - Windows 用户指南

## 🎯 下一步

1. ✅ 按照步骤推送代码到 GitHub
2. ✅ 等待首次构建完成
3. ✅ 下载并测试构建的安装包
4. ✅ （可选）发布正式版本

## 💡 提示

- 第一次构建可能需要 15-20 分钟
- 之后的构建会更快（有缓存）
- 可以随时推送代码触发新的构建
- Artifacts 可以无限次下载（在过期前）

---

**准备好了吗？开始推送代码到 GitHub 吧！** 🚀


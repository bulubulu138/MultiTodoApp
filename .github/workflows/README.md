# GitHub Actions 工作流说明

## 📋 概述

这个工作流会自动构建 Windows 和 macOS 版本的 MultiTodo 应用。

## 🚀 触发条件

工作流会在以下情况自动运行：

1. **推送到主分支** (`main` 或 `master`)
   ```bash
   git push origin main
   ```

2. **创建标签** (如 `v1.0.0`)
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   创建标签会额外创建一个 GitHub Release

3. **Pull Request** 到主分支

4. **手动触发**
   - 访问 GitHub 仓库
   - 点击 "Actions" 标签
   - 选择 "Build MultiTodo Apps" 工作流
   - 点击 "Run workflow" 按钮

## 🏗️ 构建任务

### Windows 构建 (`build-windows`)
- **运行环境**: Windows Server (最新版)
- **Node.js**: v18
- **输出文件**:
  - `MultiTodo-1.0.0-x64-setup.exe` - Windows 安装程序
  - 相关的 blockmap 文件

### macOS 构建 (`build-macos`)
- **运行环境**: macOS (最新版)
- **Node.js**: v18
- **Python**: 3.11 (用于图标生成)
- **输出文件**:
  - `MultiTodo-1.0.0-x64.dmg` - Intel Mac 安装包
  - `MultiTodo-1.0.0-arm64.dmg` - Apple Silicon 安装包
  - 相关的 blockmap 文件

### Release 创建 (`create-release`)
- **触发条件**: 仅在推送标签时 (如 `v1.0.0`)
- **功能**: 自动创建 GitHub Release 并上传所有安装包
- **状态**: Draft (草稿)，需要手动发布

## 📦 下载构建文件

### 方法 1: 从 Actions 页面下载

1. 访问你的 GitHub 仓库
2. 点击顶部的 **"Actions"** 标签
3. 选择一个成功的工作流运行
4. 滚动到页面底部的 **"Artifacts"** 部分
5. 下载需要的文件：
   - `windows-installer` - Windows 安装程序
   - `macos-installers` - macOS 安装包

### 方法 2: 从 Releases 下载 (仅标签构建)

1. 访问你的 GitHub 仓库
2. 点击右侧的 **"Releases"** 
3. 找到对应版本的 Release
4. 在 **"Assets"** 部分下载文件

## 🔄 工作流程

```
推送代码/创建标签
    ↓
GitHub Actions 自动触发
    ↓
┌─────────────────┬─────────────────┐
│  Windows 构建    │   macOS 构建     │
│  (并行运行)      │   (并行运行)     │
└─────────────────┴─────────────────┘
    ↓
上传构建产物 (Artifacts)
    ↓
[如果是标签] 创建 GitHub Release
```

## ⏱️ 构建时间

预计构建时间：
- **Windows**: 5-10 分钟
- **macOS**: 10-15 分钟
- **总计**: 约 15 分钟（并行执行）

## 📝 使用步骤

### 首次设置

1. **将代码推送到 GitHub**
   ```bash
   cd MultiTodoApp
   git init
   git add .
   git commit -m "Initial commit with GitHub Actions"
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git push -u origin main
   ```

2. **查看构建状态**
   - 推送后会自动触发构建
   - 访问 Actions 页面查看进度

3. **下载构建文件**
   - 构建完成后从 Artifacts 下载

### 发布新版本

1. **更新版本号**
   编辑 `package.json`：
   ```json
   {
     "version": "1.0.1"
   }
   ```

2. **提交并创建标签**
   ```bash
   git add package.json
   git commit -m "Bump version to 1.0.1"
   git tag v1.0.1
   git push origin main
   git push origin v1.0.1
   ```

3. **等待构建完成**
   - 自动创建 Draft Release
   - 访问 Releases 页面

4. **发布 Release**
   - 编辑 Release 说明
   - 点击 "Publish release"

## 🔧 自定义配置

### 修改 Node.js 版本
编辑 `.github/workflows/build.yml`：
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'  # 改为你需要的版本
```

### 修改保留天数
```yaml
- name: Upload Windows installer
  uses: actions/upload-artifact@v4
  with:
    retention-days: 90  # 改为你需要的天数 (最多 90 天)
```

### 添加通知
可以添加 Slack、Discord 或邮件通知步骤。

## ❓ 常见问题

### Q: 构建失败怎么办？
A: 
1. 查看 Actions 页面的错误日志
2. 常见原因：
   - 依赖安装失败 → 检查 `package.json`
   - 图标文件缺失 → 工作流会自动创建
   - 构建超时 → 可能需要优化构建配置

### Q: 如何只构建 Windows？
A: 推送代码时，macOS 任务也会运行，但你可以忽略它。或者修改工作流文件移除 macOS 任务。

### Q: 能否在本地测试工作流？
A: 可以使用 [act](https://github.com/nektos/act) 工具在本地运行 GitHub Actions。

### Q: Artifacts 保存多久？
A: 默认 30 天，可以在工作流中修改 `retention-days`。

### Q: 构建需要付费吗？
A: 
- 公开仓库：完全免费
- 私有仓库：每月有免费额度（2000 分钟）

## 📊 构建状态徽章

在你的 `README.md` 中添加构建状态徽章：

```markdown
![Build Status](https://github.com/你的用户名/你的仓库名/actions/workflows/build.yml/badge.svg)
```

## 🔐 安全说明

- `GITHUB_TOKEN` 是自动提供的，无需手动配置
- 如果需要代码签名，需要添加相应的 Secrets：
  - Windows: `WINDOWS_CERTIFICATE`
  - macOS: `MACOS_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD`

## 📚 更多信息

- [GitHub Actions 文档](https://docs.github.com/actions)
- [electron-builder CI 配置](https://www.electron.build/configuration/configuration.html#configuration)
- [Actions/upload-artifact](https://github.com/actions/upload-artifact)


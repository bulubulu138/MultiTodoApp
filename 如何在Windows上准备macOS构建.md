# 如何在 Windows 上准备 macOS 构建

## 📌 重要说明

**你目前在 Windows 系统上，`./build_mac.sh` 脚本无法在 Windows 上直接运行。**

原因：
- ❌ `./build_mac.sh` 是 Unix/Linux Shell 脚本（Bash）
- ❌ Windows PowerShell/CMD 不支持这种脚本格式
- ❌ 即使能运行，脚本中的 macOS 专用命令（如 `iconutil`）也不存在
- ❌ electron-builder 在 Windows 上无法可靠地创建 macOS .dmg 文件

## ✅ 你需要做什么

### 方案 1：使用 Mac 电脑（推荐）

这是**唯一可靠**的方式来创建 macOS 安装包。

#### 步骤：

1. **将项目复制到 Mac**
   - 使用 U盘、网络共享、或云存储
   - 或者使用 Git 推送到仓库，然后在 Mac 上克隆

2. **在 Mac 上打开终端**
   - 按 `Command + 空格`，输入 "Terminal"
   - 或在 Finder 中：应用程序 > 实用工具 > 终端

3. **运行构建命令**
   ```bash
   # 进入项目目录
   cd /Users/你的用户名/Downloads/MultiTodoApp
   
   # 添加执行权限（首次运行需要）
   chmod +x build_mac.sh
   
   # 执行构建
   ./build_mac.sh
   ```

4. **等待构建完成**
   - 第一次运行会自动创建 icon.icns
   - 构建过程需要几分钟
   - 完成后会在 `release/` 目录生成：
     - `MultiTodo-1.0.0-x64.dmg` (Intel Mac)
     - `MultiTodo-1.0.0-arm64.dmg` (Apple Silicon)

### 方案 2：使用 GitHub Actions（自动化）

如果你的项目在 GitHub 上，可以设置自动构建：

#### 步骤：

1. **创建工作流文件**

在项目根目录创建 `.github/workflows/build.yml`：

```yaml
name: Build Apps

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  # Windows 构建
  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
        working-directory: MultiTodoApp
      
      - name: Build Windows
        run: .\build_final.bat
        working-directory: MultiTodoApp
      
      - name: Upload Windows installer
        uses: actions/upload-artifact@v3
        with:
          name: windows-installer
          path: MultiTodoApp/release/*.exe

  # macOS 构建
  build-macos:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
        working-directory: MultiTodoApp
      
      - name: Make script executable
        run: chmod +x build_mac.sh
        working-directory: MultiTodoApp
      
      - name: Build macOS
        run: ./build_mac.sh
        working-directory: MultiTodoApp
      
      - name: Upload macOS installers
        uses: actions/upload-artifact@v3
        with:
          name: macos-installers
          path: MultiTodoApp/release/*.dmg
```

2. **推送到 GitHub**
   ```bash
   git add .
   git commit -m "Add GitHub Actions workflow"
   git push
   ```

3. **在 GitHub 上查看构建结果**
   - 访问你的仓库
   - 点击 "Actions" 标签
   - 下载构建好的安装包

### 方案 3：租用 macOS 云服务器

如果没有 Mac 电脑，可以临时租用：
- MacStadium
- AWS EC2 Mac instances
- MacinCloud

## 📋 当前状态总结

### ✅ 已完成（在 Windows 上）
- Windows 构建脚本：`build_final.bat` ✅ 可以运行
- Windows 安装包：`MultiTodo-1.0.0-x64-setup.exe` ✅ 已生成
- macOS 构建脚本：`build_mac.sh` ✅ 已创建（需要在 Mac 上运行）
- macOS 图标工具：`create_icns.py` ✅ 已创建（需要在 Mac 上运行）
- 所有文档：✅ 已创建

### ⏳ 需要在 Mac 上完成
- 运行 `./build_mac.sh`
- 生成 macOS 安装包（.dmg 文件）
- 测试 macOS 应用

## 🎯 推荐做法

### 如果你有 Mac 电脑：
👉 **使用方案 1**（最简单、最可靠）

### 如果你没有 Mac 电脑：
👉 **使用方案 2**（GitHub Actions，免费且自动化）

### 如果只想快速测试：
👉 找一位有 Mac 的朋友帮忙运行脚本

## 🔍 验证脚本是否正确

虽然你不能在 Windows 上运行脚本，但可以查看它：

```powershell
# 用记事本打开（Windows）
notepad build_mac.sh

# 或用 VSCode 打开
code build_mac.sh
```

脚本内容是正确的，只要在 Mac 上运行就能工作。

## ❓ 常见问题

### Q: 为什么不能在 Windows 上构建 macOS 应用？
A: 因为：
- macOS 的 .dmg 格式需要 macOS 文件系统支持
- 代码签名需要 macOS 的工具链
- electron-builder 的跨平台构建对 macOS 支持有限

### Q: 我必须要有 Mac 吗？
A: 不一定，可以使用：
- GitHub Actions（推荐，免费）
- 云端 Mac 服务器（需要付费）
- 借用朋友的 Mac

### Q: 能不能只发布 Windows 版本？
A: 可以！你的 Windows 版本已经完美工作了。macOS 版本是可选的。

## 📞 需要帮助？

如果你：
- ✅ 有 Mac 电脑 → 按方案 1 操作即可
- ✅ 项目在 GitHub 上 → 我可以帮你设置 GitHub Actions
- ✅ 只需要 Windows 版本 → 已经完成了！

---

**总结：** 在 Windows 上无法运行 `./build_mac.sh`。你需要：
1. 使用 Mac 电脑，或
2. 使用 GitHub Actions 自动构建，或
3. 只发布 Windows 版本（当前已完成）


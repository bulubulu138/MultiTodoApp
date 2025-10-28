# MultiTodo 构建指南

本文档详细说明如何在不同平台上构建 MultiTodo 应用程序。

## 📋 前置要求

### 通用要求

- **Node.js**: >= 16.x (推荐 18.x LTS)
- **npm**: >= 7.x
- **Git**: 最新版本

### Windows 特定要求

- **Visual Studio Build Tools 2019 或更高版本**
  - 下载地址: https://visualstudio.microsoft.com/zh-hans/downloads/
  - 安装时选择 "使用 C++ 的桌面开发" 工作负载
  - 或使用命令: `npm install --global windows-build-tools`

- **Python**: 2.7 或 3.x (node-gyp 需要)

### macOS 特定要求

- **Xcode Command Line Tools**
  ```bash
  xcode-select --install
  ```

- **签名证书** (可选，用于代码签名)
  - Apple Developer账号
  - Mac Developer证书

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/yourusername/MultiTodo.git
cd MultiTodo/MultiTodoApp
```

### 2. 安装依赖

```bash
npm install
```

这会自动：
- 安装所有依赖
- 运行 `electron-builder install-app-deps`
- 编译原生模块 (better-sqlite3, nodejieba)

### 3. 验证环境

```bash
# 检查构建环境
npm run prebuild

# 验证原生模块
npm run verify
```

### 4. 开发模式运行

```bash
npm run dev
```

这会启动：
- Webpack dev server (端口 3000)
- Electron 主进程
- 热重载支持

### 5. 构建应用

```bash
# 构建代码（不打包）
npm run build

# 打包为安装程序
npm run dist

# 仅打包 Windows
npm run dist:win

# 仅打包 macOS
npm run dist:mac
```

## 🔧 构建流程详解

### 原生模块编译

MultiTodo 使用两个原生模块：

1. **better-sqlite3** - 数据库引擎
2. **nodejieba** - 中文分词

这些模块需要针对 Electron 的运行时编译：

```bash
npm run rebuild
```

#### 手动重建（如果自动失败）

```bash
# Windows
npx electron-rebuild -f -w better-sqlite3 -w nodejieba

# macOS/Linux
npm run rebuild
```

### 打包配置

打包配置在 `package.json` 的 `build` 部分：

```json
{
  "build": {
    "asarUnpack": [
      "node_modules/better-sqlite3/**/*",
      "node_modules/nodejieba/**/*"
    ]
  }
}
```

- `asarUnpack`: 排除原生模块不打包到 asar，确保正常加载

### 构建产物

```
MultiTodoApp/
└── release/
    ├── MultiTodo-1.0.0-x64-setup.exe       # Windows安装包
    ├── MultiTodo-1.0.0-x64.dmg             # macOS Intel安装包
    ├── MultiTodo-1.0.0-arm64.dmg           # macOS Apple Silicon安装包
    └── win-unpacked/                        # Windows未打包版本（开发用）
```

## 🐛 常见问题

### Windows 问题

#### 1. node-gyp 编译失败

**错误**: `error MSB8036: 找不到 Windows SDK 版本`

**解决**:
```bash
# 安装 windows-build-tools
npm install --global windows-build-tools

# 或手动安装 Visual Studio Build Tools
# https://visualstudio.microsoft.com/zh-hans/downloads/
```

#### 2. 原生模块加载失败

**错误**: `找不到指定的模块`

**解决**:
```bash
# 清理并重新安装
rm -rf node_modules
npm install
npm run rebuild
```

### macOS 问题

#### 1. Xcode Command Line Tools 缺失

**错误**: `xcrun: error: invalid active developer path`

**解决**:
```bash
xcode-select --install
```

#### 2. 权限问题

**错误**: `EACCES: permission denied`

**解决**:
```bash
sudo chown -R $(whoami) /usr/local/{lib,bin,include,share}
```

#### 3. 代码签名失败

**解决**:
- 确保有有效的 Mac Developer 证书
- 配置环境变量:
  ```bash
  export APPLE_ID="your-apple-id@email.com"
  export APPLE_ID_PASSWORD="app-specific-password"
  export CSC_LINK="/path/to/certificate.p12"
  export CSC_KEY_PASSWORD="certificate-password"
  ```

### 通用问题

#### 1. 内存不足

**错误**: `JavaScript heap out of memory`

**解决**:
```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

#### 2. 依赖版本冲突

**解决**:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### 3. 原生模块版本不匹配

**解决**:
```bash
# 查看 Electron 版本
npm ls electron

# 重新编译所有原生模块
npm run rebuild
```

## 🔍 调试技巧

### 1. 查看详细日志

```bash
# 启用详细日志
DEBUG=electron-builder npm run dist

# 查看 electron-rebuild 日志
npm run rebuild -- --verbose
```

### 2. 测试打包后的应用

```bash
# 打包但不创建安装程序
npm run pack

# 运行打包后的应用
# Windows
./release/win-unpacked/MultiTodo.exe

# macOS
open ./release/mac/MultiTodo.app
```

### 3. 验证原生模块

```bash
# 运行验证脚本
npm run verify

# 手动测试
node -e "console.log(require('better-sqlite3'))"
node -e "console.log(require('nodejieba'))"
```

## 📦 CI/CD 构建

### GitHub Actions

项目配置了 GitHub Actions 自动构建：

- **触发**: 推送到 main/dev 分支或创建 tag
- **平台**: Windows x64, macOS x64, macOS ARM64
- **产物**: 自动上传到 Artifacts
- **发布**: tag 时自动创建 GitHub Release

查看 `.github/workflows/build.yml` 了解详情。

### 本地模拟 CI 构建

```bash
# 完整构建流程
npm run prebuild    # 检查环境
npm run build       # 构建代码
npm run verify      # 验证模块
npm run dist        # 打包应用
```

## 🎯 性能优化

### 减小安装包大小

1. **排除不必要的文件**
   ```json
   "files": [
     "!node_modules/**/test/**/*",
     "!node_modules/**/*.md"
   ]
   ```

2. **使用 asar 打包** (已配置)

3. **启用压缩**
   ```json
   "compression": "maximum"
   ```

### 加快构建速度

1. **使用缓存**
   - GitHub Actions 已配置 npm 缓存

2. **并行构建**
   - 使用 GitHub Actions matrix strategy

3. **增量构建**
   ```bash
   # 仅重新打包，不重新构建代码
   electron-builder --dir
   ```

## 📚 相关资源

- [Electron Builder 文档](https://www.electron.build/)
- [electron-rebuild 文档](https://github.com/electron/electron-rebuild)
- [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3)
- [nodejieba 文档](https://github.com/yanyiwu/nodejieba)

## 💬 获取帮助

遇到问题？

1. 检查[常见问题](#-常见问题)部分
2. 运行 `npm run verify` 诊断问题
3. 查看 [GitHub Issues](https://github.com/yourusername/MultiTodo/issues)
4. 提交新的 Issue

---

**最后更新**: 2025-10-28  
**版本**: v1.0.0


# MultiTodo 构建与发布快速指南

## 🎯 快速开始

### 第一次构建

```bash
cd MultiTodoApp

# 1. 安装依赖（自动编译原生模块）
npm install

# 2. 验证环境和原生模块
npm run verify

# 3. 开始开发
npm run dev
```

### 打包发布

```bash
# 本地打包
npm run dist

# 发布到 GitHub（自动构建所有平台）
git tag v1.0.0
git push origin main --tags
```

## 📋 核心命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发模式（热重载） |
| `npm run prebuild` | 检查构建环境 |
| `npm run verify` | 验证原生模块 |
| `npm run rebuild` | 重新编译原生模块 |
| `npm run build` | 构建应用 |
| `npm run dist` | 打包安装程序 |
| `npm run dist:win` | 仅打包 Windows |
| `npm run dist:mac` | 仅打包 macOS |

## 🔧 前置要求

### Windows
- Node.js 16+
- Visual Studio Build Tools 2019+

### macOS  
- Node.js 16+
- Xcode Command Line Tools

## 📁 构建产物

```
MultiTodoApp/release/
├── MultiTodo-1.0.0-x64-setup.exe          # Windows 安装包
├── MultiTodo-1.0.0-x64.dmg                # macOS Intel 安装包
└── MultiTodo-1.0.0-arm64.dmg              # macOS Apple Silicon 安装包
```

## 🐛 常见问题

### 原生模块加载失败？
```bash
npm run rebuild
npm run verify
```

### 构建失败？
```bash
npm run prebuild  # 查看详细错误
```

### CI 构建失败？
检查 GitHub Actions 日志中的原生模块编译部分

## 📚 详细文档

- [BUILD.md](./BUILD.md) - 完整构建指南
- [RELEASE.md](./RELEASE.md) - 发布流程
- [跨平台打包配置完成说明.md](./跨平台打包配置完成说明.md) - 配置详情

## 🚀 自动构建

推送 tag 到 GitHub 自动触发：
- Windows x64 构建
- macOS Intel 构建  
- macOS Apple Silicon 构建
- 自动创建 Release

## ✅ 验证清单

运行以下命令确保一切正常：

```bash
✓ npm run prebuild    # 环境检查通过
✓ npm run verify      # 原生模块验证通过
✓ npm run build       # 构建成功
✓ npm run dist        # 打包成功
```

---

**需要帮助？** 查看 [BUILD.md](./BUILD.md) 获取详细说明


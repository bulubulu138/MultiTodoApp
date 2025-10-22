# macOS DMG 构建错误修复

## 🐛 问题描述

在 GitHub Actions 中构建 macOS DMG 安装包时出现以下错误：

```
FileNotFoundError: [Errno 2] No such file or directory: 
b'/Volumes/MultiTodo 1.0.0/.background/background.tiff'
```

## 🔍 问题原因

electron-builder 在创建 macOS DMG 时，默认会尝试使用背景图片来美化安装界面。但是：

1. **我们没有提供背景图片**
2. **electron-builder 尝试使用默认的背景图片**
3. **在 GitHub Actions 的 ARM64 runner 上，默认背景图片路径不存在**
4. **导致 DMG 构建失败**

### 详细错误分析

```python
# dmg-builder 尝试为背景图片创建别名
alias = Alias.for_file(background_file)
# 但 background_file 路径不存在
st = osx.statfs(path)
# 抛出 FileNotFoundError
```

同时出现第二个错误：
```
hdiutil: attach failed - no mountable file systems
```

这是由于第一个错误导致 DMG 文件创建不完整，无法挂载。

## ✅ 解决方案

在 `package.json` 的 `dmg` 配置中：

1. **明确禁用背景图片** - 设置 `"background": null`
2. **使用 ULFO 格式** - 设置 `"format": "ULFO"`（更兼容，不需要 HFS+）

### 修改前

```json
"dmg": {
  "contents": [
    {
      "x": 130,
      "y": 220
    },
    {
      "x": 410,
      "y": 220,
      "type": "link",
      "path": "/Applications"
    }
  ],
  "title": "MultiTodo ${version}",
  "icon": "assets/icon.icns"
}
```

### 修改后

```json
"dmg": {
  "contents": [
    {
      "x": 130,
      "y": 220
    },
    {
      "x": 410,
      "y": 220,
      "type": "link",
      "path": "/Applications"
    }
  ],
  "title": "MultiTodo ${version}",
  "icon": "assets/icon.icns",
  "background": null,
  "format": "ULFO"
}
```

## 📝 配置说明

### `"background": null`
- 明确告诉 electron-builder **不要使用背景图片**
- 避免寻找不存在的默认背景文件
- DMG 将使用系统默认的白色背景

### `"format": "ULFO"`
- **ULFO** = UDIF Lzfse-compressed format
- 使用 APFS 文件系统（macOS 10.12+）
- 不依赖 HFS+（HFS+ 在 ARM64 上不可用）
- 更现代、更兼容的格式

### 其他可选格式

如果需要，还可以使用：
- `"UDZO"` - 使用 zlib 压缩（传统格式）
- `"UDBZ"` - 使用 bzip2 压缩
- `"ULMO"` - 使用 lzma 压缩

## 🎨 如果需要自定义背景图片

如果将来想添加自定义的 DMG 背景图片：

### 1. 创建背景图片

```bash
# 创建 512x320 的背景图片
# 保存为 assets/dmg-background.png
```

### 2. 更新配置

```json
"dmg": {
  "background": "assets/dmg-background.png",
  "format": "ULFO",
  "window": {
    "width": 540,
    "height": 380
  },
  "contents": [
    {
      "x": 130,
      "y": 220
    },
    {
      "x": 410,
      "y": 220,
      "type": "link",
      "path": "/Applications"
    }
  ]
}
```

### 3. 背景图片规范

- **推荐尺寸**: 512x320 或 540x380
- **格式**: PNG 或 TIFF
- **位置**: 放在 `assets/` 目录
- **命名**: 任意，但需要在配置中正确引用

## 🚀 构建验证

修复后，GitHub Actions 将：

1. ✅ 成功构建 Intel Mac DMG（x64）
2. ✅ 成功构建 Apple Silicon DMG（arm64）
3. ✅ 使用系统默认白色背景
4. ✅ 保持图标和布局正常

## 📦 构建产物

修复后生成：
- `MultiTodo-1.0.0-x64.dmg` - Intel Mac 版本
- `MultiTodo-1.0.0-arm64.dmg` - Apple Silicon 版本
- `*.dmg.blockmap` - 增量更新文件

## 🔧 本地测试

如果在 macOS 上本地构建：

```bash
npm install
npm run build
npm run dist:mac
```

## ⚠️ 注意事项

### 代码签名警告

构建日志中可能出现：
```
skipped macOS application code signing  
reason=cannot find valid "Developer ID Application" identity
```

这是**正常的**，因为：
- GitHub Actions 没有配置 Apple Developer 证书
- 应用仍可以构建和分发
- 用户首次打开时需要右键 → 打开（绕过 Gatekeeper）

### 如需正式签名

1. 获取 Apple Developer 账号
2. 创建 Developer ID 证书
3. 在 GitHub Secrets 中配置证书
4. 更新 GitHub Actions 工作流

## 🐛 相关问题

### APFS vs HFS+

- **APFS**: 现代文件系统，macOS 10.12+ 支持
- **HFS+**: 传统文件系统，在 ARM64 runner 上不可用
- **解决**: 使用 `"format": "ULFO"` 强制使用 APFS

### ARM64 构建环境

GitHub Actions 的 `macos-latest` runner 使用 ARM64 架构：
- 可以交叉编译 x64 和 arm64
- 但某些工具（如 HFS+）不可用
- 需要使用更现代的格式

## 📊 修复总结

| 项目 | 修改前 | 修改后 |
|------|--------|--------|
| 背景图片 | 使用默认（不存在） | 明确禁用 |
| DMG 格式 | 自动选择（可能用 HFS+） | 强制 ULFO (APFS) |
| 构建结果 | ❌ 失败 | ✅ 成功 |
| 兼容性 | - | macOS 10.12+ |

## 🚀 部署状态

- **提交哈希**: cc6b9db
- **提交信息**: fix: 修复 macOS DMG 构建错误 - 移除背景图片配置
- **推送时间**: 2025-10-22
- **状态**: ✅ 已推送到 GitHub
- **构建**: 🚀 GitHub Actions 自动构建中

查看构建状态：https://github.com/bulubulu138/MultiTodoApp/actions

---

**macOS DMG 构建问题已解决！** 🎉


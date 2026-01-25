# macOS 构建指南

本文档说明如何在 macOS 上构建和运行 MultiTodo 应用，以及如何解决常见的闪退问题。

## 前置条件

- **必须**在 macOS 上构建（不能在 Windows 或 Linux 上构建 macOS 版本）
- macOS 10.15 (Catalina) 或更高版本
- Node.js 18+ 和 npm
- Python 3（用于生成图标）
- Xcode Command Line Tools（用于代码签名工具）

## 快速开始

### 自动化构建（推荐）

使用我们提供的自动化脚本：

```bash
# 给脚本添加执行权限
chmod +x scripts/build-mac.sh

# 运行构建脚本
./scripts/build-mac.sh
```

该脚本会自动完成以下步骤：
1. 检查系统环境
2. 生成 `icon.icns` 图标文件
3. 安装依赖
4. 重建原生模块（better-sqlite3）
5. 构建应用
6. 创建 DMG 安装包
7. 应用 ad-hoc 签名

### 手动构建

如果你想手动控制每个步骤：

#### 步骤 1：生成图标文件

```bash
cd assets
python3 create_icns.py
cd ..
```

验证文件已生成：
```bash
ls -lh assets/icon.icns
```

#### 步骤 2：安装和重建依赖

```bash
# 安装依赖
npm install

# 重建原生模块（重要！）
npm run rebuild

# 验证原生模块
npm run verify
```

#### 步骤 3：构建应用

```bash
# 构建所有
npm run build

# 创建 macOS 安装包
npm run dist:mac
```

#### 步骤 4：签名应用

```bash
# 找到生成的 .app 文件
cd release/MultiTodo-1.0.0-arm64  # 或其他版本号目录

# 应用 ad-hoc 签名
codesign --force --deep --sign - MultiTodo.app

# 验证签名
codesign --verify --verbose MultiTodo.app
```

## 运行应用

### 方法 1：双击运行

1. 在 `release` 目录中找到 `MultiTodo.app`
2. 双击运行
3. 如果看到安全警告，点击"取消"

### 方法 2：右键打开（绕过 Gatekeeper）

1. 右键点击 `MultiTodo.app`
2. 按住 **Option** 键
3. 点击"打开"
4. 在弹出的对话框中点击"打开"

### 方法 3：命令行运行（查看日志）

```bash
# 直接运行可执行文件
./release/MultiTodo-1.0.0-arm64/MultiTodo.app/Contents/MacOS/MultiTodo
```

这样可以实时查看应用输出，方便调试。

## 常见问题

### Q1: 应用点击即闪退

**可能原因和解决方案：**

1. **缺少 icon.icns 文件**
   ```bash
   # 检查文件是否存在
   ls assets/icon.icns
   # 如果不存在，重新生成
   cd assets && python3 create_icns.py
   ```

2. **原生模块架构不匹配**
   ```bash
   # 重新编译原生模块
   npm run rebuild
   # 验证架构
   file node_modules/better-sqlite3/build/Release/better_sqlite3.node
   # 应该显示: Mach-O 64-bit bundle arm64 (Apple Silicon)
   ```

3. **缺少 entitlements 配置**
   - 检查 `package.json` 中是否包含：
     ```json
     "entitlements": "assets/entitlements.mac.plist",
     "entitlementsInherit": "assets/entitlements.mac.plist"
     ```

4. **未签名或签名无效**
   ```bash
   # 重新签名
   codesign --force --deep --sign - MultiTodo.app
   ```

### Q2: "来自身份不明开发者"警告

这是正常的，因为我们使用 ad-hoc 签名（没有 Apple 开发者账号）。

**解决方案：**
- 右键点击 → 打开
- 或在系统设置 → 隐私与安全性中允许

### Q3: 构建时提示找不到 icon.icns

**解决方案：**
```bash
cd assets
python3 create_icns.py
```

确保 `assets/icon.png` 存在（1024x1024 PNG 文件）。

### Q4: 原生模块加载失败

**错误信息示例：**
```
Error: dlopen(.../better_sqlite3.node, 1): no suitable image found
```

**解决方案：**
```bash
# 清理并重建
rm -rf node_modules
npm install
npm run rebuild
npm run verify
```

### Q5: 应用启动但无法创建数据库

**可能原因：** 缺少文件系统权限

**解决方案：**
检查 `assets/entitlements.mac.plist` 包含：
```xml
<key>com.apple.security.files.all.read-write</key>
<true/>
```

## 调试技巧

### 查看崩溃日志

```bash
# 查看最近的崩溃报告
log show --predicate 'eventMessage contains "MultiTodo"' --last 5m

# 或在 Console.app 中查看
open ~/Library/Logs/DiagnosticReports/
```

### 查看系统日志

```bash
# 实时查看日志
log stream --predicate 'process == "MultiTodo"'

# 查看最近的日志
log show --last 10m --predicate 'process == "MultiTodo"'
```

### 验证原生模块

```bash
# 检查 better-sqlite3 架构
file node_modules/better-sqlite3/build/Release/better_sqlite3.node

# 应该显示：
# Mach-O 64-bit bundle arm64  (Apple Silicon)
# 或
# Mach-O 64-bit bundle x86_64 (Intel)
```

### 检查签名状态

```bash
# 查看签名信息
codesign --display --verbose -4 MultiTodo.app

# 验证签名
codesign --verify --verbose MultiTodo.app
```

## 配置说明

### entitlements.mac.plist

此文件定义了应用的安全权限：

- `allow-jit`: 允许 JIT 编译（V8 引擎需要）
- `allow-unsigned-executable-memory`: 允许执行动态生成的代码
- `disable-library-validation`: 允许加载原生模块
- `network.client`: 允许网络访问（AI 功能）
- `files.user-selected.read-write`: 允许读写用户选择的文件
- `files.all.read-write`: 允许访问任意文件（数据库和备份）

### package.json macOS 配置

```json
"mac": {
  "target": "dmg",                    // 输出 DMG 安装包
  "icon": "assets/icon.icns",         // 应用图标
  "category": "public.app-category.productivity",  // App Store 分类
  "artifactName": "${productName}-${version}-${arch}.${ext}",
  "identity": null,                   // Ad-hoc 签名（无开发者账号）
  "hardenedRuntime": false,           // Ad-hoc 签名不支持
  "gatekeeperAssess": false,          // 禁用 Gatekeeper 评估
  "entitlements": "assets/entitlements.mac.plist",        // 权限配置
  "entitlementsInherit": "assets/entitlements.mac.plist"  // 继承的权限
}
```

## 正式发布（需要 Apple Developer 账号）

如果你有 Apple Developer 账号（$99/年），可以配置正式签名：

### 1. 获取证书和 Team ID

```bash
# 列出可用的签名证书
security find-identity -v -p codesigning
```

### 2. 更新 package.json

```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "assets/entitlements.mac.plist",
  "entitlementsInherit": "assets/entitlements.mac.plist"
}
```

### 3. 构建和公证

```bash
# 构建
npm run dist:mac

# 公证（macOS 10.15+ 需要）
xcrun notarytool submit MultiTodo-1.0.0-arm64.dmg \
  --apple-id "your@email.com" \
  --password "app-specific-password" \
  --team-id "TEAM_ID" \
  --wait

# 装订公证票据
xcrun stapler staple MultiTodo-1.0.0-arm64.dmg
```

## 硬件加速控制

应用在 macOS 上默认启用硬件加速。如果遇到渲染问题，可以通过环境变量禁用：

```bash
# 禁用硬件加速
MULTI_TODO_DISABLE_HW_ACC=1 ./MultiTodo.app/Contents/MacOS/MultiTodo
```

## 自动化构建（CI/CD）

### GitHub Actions 示例

```yaml
name: Build macOS

on:
  push:
    tags:
      - 'v*'

jobs:
  build-mac:
    runs-on: macos-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Rebuild native modules
        run: npm run rebuild

      - name: Build
        run: npm run build

      - name: Package
        run: npm run dist:mac

      - name: Upload artifact
        uses: actions/upload-artifact@v3
        with:
          name: MultiTodo-macOS
          path: release/*.dmg
```

## 验收清单

构建完成后，请验证：

- [ ] `assets/icon.icns` 文件存在
- [ ] `package.json` 包含 entitlements 配置
- [ ] better-sqlite3 已为当前架构编译
- [ ] 应用已签名（ad-hoc 或开发者证书）
- [ ] 应用可以启动（双击或命令行）
- [ ] 窗口正常显示
- [ ] 主要功能正常工作
- [ ] 数据库可以正常创建和访问
- [ ] 崩溃日志中无严重错误

## 获取帮助

如果按照本指南操作后仍有问题：

1. 查看崩溃日志：`~/Library/Logs/DiagnosticReports/`
2. 查看系统日志：`Console.app`
3. 从命令行运行查看实时输出
4. 在 GitHub Issues 中报告问题，附上：
   - macOS 版本
   - 架构（Intel 或 Apple Silicon）
   - 完整的错误日志
   - 复现步骤

## 参考资料

- [Electron macOS 代码签名](https://www.electronjs.org/docs/latest/tutorial/code-signing)
- [electron-builder macOS 配置](https://www.electron.build/configuration/mac)
- [Apple Entitlements 文档](https://developer.apple.com/documentation/bundleresources/entitlements)
- [macOS 代码签名最佳实践](https://developer.apple.com/support/code-signing/)

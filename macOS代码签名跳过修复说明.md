# macOS 代码签名跳过修复说明

## 修复日期
2025-10-29

## 问题描述

### GitHub Actions 错误日志

在 macOS 打包步骤中出现以下错误：

```
Run npm run dist:mac -- --x64
  npm run dist:mac -- --x64
  shell: /bin/bash -e {0}
  env:
    GH_TOKEN: ***
    APPLE_ID: 
    APPLE_ID_PASSWORD: 
    CSC_LINK: 
    CSC_KEY_PASSWORD: 

> multi-todo-app@1.0.0 dist:mac
> electron-builder --mac --x64

  • electron-builder  version=24.13.3 os=24.6.0
  • artifacts will be published if draft release exists  reason=CI detected
  • loaded configuration  file=package.json ("build" field)
  • rebuilding native dependencies  dependencies=better-sqlite3@11.10.0 platform=darwin arch=x64
  • install prebuilt binary  name=better-sqlite3 version=11.10.0 platform=darwin arch=x64 napi=
  • packaging       platform=darwin arch=x64 electron=27.0.0 appOutDir=release/mac
  • downloading     url=https://npmmirror.com/mirrors/electron/27.0.0/electron-v27.0.0-darwin-x64.zip size=98 MB parts=6
  • downloaded      url=https://npmmirror.com/mirrors/electron/27.0.0/electron-v27.0.0-darwin-x64.zip duration=5.299s
  • default Electron icon is used  reason=application icon is not set
  • empty password will be used for code signing  reason=CSC_KEY_PASSWORD is not defined
  ⨯ /Users/runner/work/MultiTodoApp/MultiTodoApp not a file
Error: Process completed with exit code 1.
```

### 关键错误信息

1. **环境变量为空**：
   ```
   APPLE_ID: 
   APPLE_ID_PASSWORD: 
   CSC_LINK: 
   CSC_KEY_PASSWORD: 
   ```

2. **警告信息**：
   ```
   • empty password will be used for code signing  reason=CSC_KEY_PASSWORD is not defined
   ```

3. **致命错误**：
   ```
   ⨯ /Users/runner/work/MultiTodoApp/MultiTodoApp not a file
   ```

## 根本原因

### 1. GitHub Secrets 未配置

在 `.github/workflows/build.yml` 中引用了以下 secrets，但未在 GitHub 仓库中设置：

```yaml
env:
  GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  APPLE_ID: ${{ secrets.APPLE_ID }}
  APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
  CSC_LINK: ${{ secrets.MAC_CERT_P12_BASE64 }}
  CSC_KEY_PASSWORD: ${{ secrets.MAC_CERT_PASSWORD }}
```

**缺失的 Secrets**：
- `APPLE_ID` - Apple ID 账号
- `APPLE_ID_PASSWORD` - 应用专用密码
- `MAC_CERT_P12_BASE64` - 代码签名证书（P12 格式，Base64 编码）
- `MAC_CERT_PASSWORD` - 证书密码

### 2. electron-builder 行为

当 `CSC_LINK` 为空时，electron-builder 仍然尝试进行代码签名，导致：
- 将项目路径 `/Users/runner/work/MultiTodoApp/MultiTodoApp` 误当作证书文件
- 报错 "not a file"
- 打包失败

### 3. macOS 代码签名要求

完整的 macOS 代码签名和公证流程需要：

1. **Apple Developer 账号**：
   - 费用：99 美元/年
   - 用于生成代码签名证书

2. **代码签名证书**：
   - 类型：Developer ID Application
   - 格式：P12 文件（包含私钥）
   - 用途：签名应用程序

3. **公证（Notarization）**：
   - 上传应用到 Apple 进行安全扫描
   - 需要 Apple ID 和应用专用密码
   - 通过后用户下载时不会看到警告

## 解决方案

### 方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| **A. 跳过代码签名** | 免费、简单、无需证书 | 用户首次打开需手动允许 | 开发测试、开源项目 |
| **B. 配置代码签名** | 用户体验好、无警告 | 需付费账号、配置复杂 | 商业发布 |

### 选择方案 A：跳过代码签名

**原因**：
1. 当前处于开发和测试阶段
2. 没有 Apple Developer 账号
3. 不需要发布到 App Store
4. GitHub Actions 可以正常打包 DMG

## 修复实施

### 修改内容

**文件**: `package.json`

在 `build.mac` 配置中添加 `"identity": null`：

**修改前**:
```json
"mac": {
  "target": [
    {
      "target": "dmg",
      "arch": ["x64", "arm64"]
    }
  ],
  "icon": "assets/icon.icns",
  "category": "public.app-category.productivity",
  "artifactName": "${productName}-${version}-${arch}.${ext}",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "assets/entitlements.mac.plist",
  "entitlementsInherit": "assets/entitlements.mac.plist",
  "extendInfo": {
    "NSCameraUsageDescription": "This app does not use the camera.",
    "NSMicrophoneUsageDescription": "This app does not use the microphone."
  }
}
```

**修改后**:
```json
"mac": {
  "target": [
    {
      "target": "dmg",
      "arch": ["x64", "arm64"]
    }
  ],
  "icon": "assets/icon.icns",
  "category": "public.app-category.productivity",
  "artifactName": "${productName}-${version}-${arch}.${ext}",
  "identity": null,  // ✅ 新增：跳过代码签名
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "assets/entitlements.mac.plist",
  "entitlementsInherit": "assets/entitlements.mac.plist",
  "extendInfo": {
    "NSCameraUsageDescription": "This app does not use the camera.",
    "NSMicrophoneUsageDescription": "This app does not use the microphone."
  }
}
```

### 配置说明

**`"identity": null`**：
- 告诉 electron-builder 跳过代码签名
- 即使 `CSC_LINK` 等环境变量为空也不会报错
- 生成的 DMG 未签名，但可以正常安装和使用

**保留的配置**：
- `hardenedRuntime`: 虽然未签名，但保留配置以便后续启用
- `gatekeeperAssess`: false - 不进行 Gatekeeper 评估
- `entitlements`: 权限配置文件（备用）

## 预期效果

### GitHub Actions 构建

**修复前**：
```
⨯ /Users/runner/work/MultiTodoApp/MultiTodoApp not a file
Error: Process completed with exit code 1.
```

**修复后**：
```
✓ Building macOS DMG
✓ Package created successfully
✓ Upload artifacts to GitHub
```

### 用户体验

**下载和安装**：
1. 下载 `MultiTodo-1.0.0-x64.dmg` 或 `MultiTodo-1.0.0-arm64.dmg`
2. 双击打开 DMG
3. 拖拽应用到 Applications 文件夹

**首次运行**：

由于应用未签名，macOS Gatekeeper 会显示警告：

```
"MultiTodo.app" cannot be opened because it is from an unidentified developer.
```

**解决方法**（两种方式）：

**方式 1：右键打开**
1. 在 Finder 中找到应用
2. 按住 Control 键点击应用图标
3. 选择"打开"
4. 点击"打开"按钮确认

**方式 2：系统设置**
1. 尝试打开应用（会被阻止）
2. 打开"系统设置" → "隐私与安全性"
3. 找到"仍要打开"按钮
4. 点击"打开"确认

之后就可以正常使用，不会再有警告。

## 未来升级路径

### 如需配置代码签名

**步骤**：

1. **申请 Apple Developer 账号**
   - 访问：https://developer.apple.com
   - 费用：99 美元/年

2. **生成代码签名证书**
   ```bash
   # 在 macOS 上使用 Keychain Access
   # 1. 打开 Keychain Access
   # 2. 菜单：证书助理 → 从证书颁发机构请求证书
   # 3. 输入邮箱和名称
   # 4. 保存到磁盘
   # 5. 在 Apple Developer 网站上传 CSR
   # 6. 下载证书并安装到 Keychain
   ```

3. **导出证书为 P12**
   ```bash
   # 在 Keychain Access 中
   # 1. 找到 "Developer ID Application" 证书
   # 2. 右键 → 导出
   # 3. 格式选择 .p12
   # 4. 设置密码
   ```

4. **转换为 Base64**
   ```bash
   base64 -i certificate.p12 -o certificate.txt
   ```

5. **在 GitHub 设置 Secrets**
   - `MAC_CERT_P12_BASE64`: certificate.txt 的内容
   - `MAC_CERT_PASSWORD`: P12 文件的密码
   - `APPLE_ID`: Apple ID 邮箱
   - `APPLE_ID_PASSWORD`: 应用专用密码（在 appleid.apple.com 生成）

6. **修改 package.json**
   ```json
   "mac": {
     // 移除或注释掉 "identity": null
     // "identity": null,
     ...
   }
   ```

7. **推送代码**
   - GitHub Actions 会自动使用证书进行签名和公证

## 技术总结

### electron-builder 代码签名行为

| 配置 | CSC_LINK 状态 | 行为 |
|------|--------------|------|
| 无 `identity` | 空 | ❌ 尝试签名，报错 |
| 无 `identity` | 有效证书 | ✅ 自动签名 |
| `identity: null` | 空 | ✅ 跳过签名 |
| `identity: null` | 有效证书 | ✅ 跳过签名 |
| `identity: "..."` | 空 | ❌ 查找指定证书，失败 |
| `identity: "..."` | 有效证书 | ✅ 使用指定证书签名 |

### macOS 安全机制

**Gatekeeper**：
- macOS 10.8+ 引入的安全功能
- 检查应用是否来自可信开发者
- 未签名应用需要用户手动允许

**公证（Notarization）**：
- macOS 10.14+ 强制要求
- Apple 扫描应用是否包含恶意代码
- 通过后用户下载时无警告

**权限模型**：
- 即使未签名，应用仍可请求权限
- 用户需要在系统设置中授予权限

## 验证方法

### 1. 检查 GitHub Actions

访问：https://github.com/bulubulu138/MultiTodoApp/actions

**预期结果**：
- ✅ macOS x64 构建成功
- ✅ macOS ARM64 构建成功
- ✅ 生成 DMG 文件
- ✅ 上传 Artifacts

### 2. 下载测试（如有 macOS 环境）

1. 下载构建产物中的 DMG
2. 双击打开
3. 拖拽到 Applications
4. 右键打开应用
5. 确认应用正常运行

### 3. 检查构建日志

**关键日志**：
```
✓ packaging       platform=darwin arch=x64
✓ building        target=macOS DMG
✓ building block map  blockMapFile=release/MultiTodo-1.0.0-x64.dmg.blockmap
```

**无错误日志**：
- 不应再有 "not a file" 错误
- 不应有代码签名相关错误

## 相关文件

- `package.json` - electron-builder 配置（本次修复）
- `.github/workflows/build.yml` - GitHub Actions 工作流
- `assets/entitlements.mac.plist` - macOS 权限配置

## 参考资料

1. [electron-builder - Code Signing](https://www.electron.build/code-signing)
2. [Apple - Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
3. [electron-builder - macOS Configuration](https://www.electron.build/configuration/mac)
4. [Apple - Gatekeeper](https://support.apple.com/en-us/HT202491)

## 注意事项

1. **未签名的影响**：
   - ✅ 应用功能完全正常
   - ✅ 可以正常安装和运行
   - ⚠️ 首次打开需要用户手动允许
   - ⚠️ 无法通过 App Store 分发

2. **用户指引**：
   - 建议在 README 中说明首次打开的步骤
   - 提供截图帮助用户理解

3. **后续计划**：
   - 当项目正式发布时，考虑配置代码签名
   - 商业项目建议尽早配置以提升用户体验


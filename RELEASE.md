# MultiTodo 发布流程

本文档说明如何发布 MultiTodo 的新版本。

## 📝 发布检查清单

### 发布前准备

- [ ] 所有功能已完成并测试
- [ ] 所有单元测试通过
- [ ] 代码已合并到 `main` 分支
- [ ] 更新 `CHANGELOG.md`
- [ ] 更新版本号
- [ ] 本地构建测试成功
- [ ] 原生模块验证通过

### 发布步骤

- [ ] 创建版本标签
- [ ] 触发 CI/CD 构建
- [ ] 验证构建产物
- [ ] 创建 GitHub Release
- [ ] 发布公告

### 发布后

- [ ] 验证安装包可下载
- [ ] 测试安装和运行
- [ ] 收集用户反馈
- [ ] 监控崩溃报告

## 🔢 版本号管理

MultiTodo 使用[语义化版本](https://semver.org/lang/zh-CN/)：`MAJOR.MINOR.PATCH`

- **MAJOR**: 不兼容的 API 修改
- **MINOR**: 向下兼容的功能性新增
- **PATCH**: 向下兼容的问题修正

### 版本号示例

- `1.0.0` - 首次正式发布
- `1.0.1` - Bug修复
- `1.1.0` - 新功能添加
- `2.0.0` - 重大更新，可能不兼容

## 🚀 发布步骤详解

### 1. 更新版本号

#### 自动更新（推荐）

```bash
# Patch 版本 (1.0.0 -> 1.0.1)
npm version patch

# Minor 版本 (1.0.0 -> 1.1.0)
npm version minor

# Major 版本 (1.0.0 -> 2.0.0)
npm version major
```

这会自动：
- 更新 `package.json` 中的版本号
- 创建 git commit
- 创建 git tag

#### 手动更新

编辑 `package.json`:
```json
{
  "version": "1.0.1"
}
```

### 2. 更新 CHANGELOG

编辑 `CHANGELOG.md`，添加新版本的更新内容：

```markdown
## [1.0.1] - 2025-10-28

### Added
- 新增关键词智能推荐功能
- 新增 AI 助手配置

### Changed
- 优化分词算法性能
- 改进 UI 交互体验

### Fixed
- 修复数据库迁移问题
- 修复原生模块加载失败

### Security
- 更新依赖包版本
```

### 3. 提交更改

```bash
git add package.json CHANGELOG.md
git commit -m "chore: release v1.0.1"
```

### 4. 创建标签

```bash
# 创建带注释的标签
git tag -a v1.0.1 -m "Release version 1.0.1"

# 查看标签
git tag -l
```

### 5. 推送到 GitHub

```bash
# 推送代码
git push origin main

# 推送标签
git push origin v1.0.1

# 或同时推送
git push origin main --tags
```

### 6. GitHub Actions 自动构建

推送标签后，GitHub Actions 会自动：

1. 在 Windows 和 macOS 上构建应用
2. 编译原生模块
3. 打包安装程序
4. 创建 GitHub Release
5. 上传安装包到 Release

### 7. 验证构建结果

访问 GitHub Actions 页面查看构建状态：
```
https://github.com/yourusername/MultiTodo/actions
```

检查：
- ✅ 所有构建任务成功
- ✅ Artifacts 已上传
- ✅ Release 已创建

### 8. 完善 Release 说明

访问 Releases 页面，编辑自动创建的 Release：

1. 添加详细的更新说明
2. 添加安装说明
3. 添加已知问题
4. 标记为正式版本（取消 Pre-release）

### 9. 发布公告

- 在项目 README 中更新版本号
- 在社区/论坛发布更新公告
- 通过邮件列表通知用户

## 🔐 密钥配置

### GitHub Secrets

在 GitHub 仓库设置中配置以下密钥（Settings → Secrets and variables → Actions）：

#### macOS 代码签名（可选）

- `APPLE_ID`: Apple ID 邮箱
- `APPLE_ID_PASSWORD`: App-specific password
- `MAC_CERT_P12_BASE64`: 证书 P12 文件的 Base64 编码
- `MAC_CERT_PASSWORD`: 证书密码

#### 生成 App-specific password

1. 访问 https://appleid.apple.com/
2. 登录 Apple ID
3. 安全 → App-specific passwords
4. 生成新密码

#### 导出并编码证书

```bash
# 导出证书为 P12 文件
# 在 Keychain Access 中导出，设置密码

# 转换为 Base64
base64 -i certificate.p12 -o certificate.p12.base64

# 将内容设置为 MAC_CERT_P12_BASE64
cat certificate.p12.base64
```

## 📋 发布类型

### 正式发布 (Stable Release)

用于生产环境的稳定版本：

```bash
npm version 1.0.0
git push origin main --tags
```

### 测试版 (Beta Release)

用于测试的预发布版本：

```bash
npm version 1.0.0-beta.1
git push origin dev --tags
```

### 候选版本 (Release Candidate)

发布前的最终测试版本：

```bash
npm version 1.0.0-rc.1
git push origin main --tags
```

## 🧪 发布前测试

### 1. 本地构建测试

```bash
# 完整构建流程
npm run prebuild
npm run build
npm run verify
npm run dist
```

### 2. 安装测试

- Windows: 运行 `.exe` 安装程序
- macOS: 挂载 `.dmg` 并拖拽安装

### 3. 功能测试

- [ ] 应用正常启动
- [ ] 数据库正常工作
- [ ] 原生模块加载成功
- [ ] 关键词提取功能正常
- [ ] 所有核心功能可用
- [ ] 没有明显的性能问题

### 4. 兼容性测试

- [ ] Windows 10/11
- [ ] macOS 12+ (Intel)
- [ ] macOS 12+ (Apple Silicon)

## 📊 发布统计

### 跟踪指标

- 下载次数
- 安装成功率
- 崩溃报告
- 用户反馈
- GitHub Stars/Forks

### 工具推荐

- [GitHub Insights](https://github.com/yourusername/MultiTodo/pulse) - 项目活跃度
- [Sentry](https://sentry.io/) - 错误追踪
- [Google Analytics](https://analytics.google.com/) - 使用统计

## 🔄 热修复流程

发现严重Bug需要紧急修复：

### 1. 创建热修复分支

```bash
git checkout -b hotfix/1.0.1 v1.0.0
```

### 2. 修复问题并测试

```bash
# 修复代码
# 运行测试
npm test
```

### 3. 更新版本号

```bash
npm version patch
```

### 4. 合并到主分支

```bash
git checkout main
git merge hotfix/1.0.1
git push origin main --tags
```

### 5. 删除热修复分支

```bash
git branch -d hotfix/1.0.1
```

## 📝 发布注意事项

### DO ✅

- 详细记录每个版本的更新内容
- 保持语义化版本号规范
- 在发布前充分测试
- 及时响应用户反馈
- 保持定期发布节奏

### DON'T ❌

- 不要在工作日晚上或周五发布
- 不要跳过测试阶段
- 不要忽略构建警告
- 不要忘记更新文档
- 不要过于频繁发布

## 🗓️ 发布计划

建议的发布周期：

- **补丁版本**: 按需发布（Bug修复）
- **小版本**: 每月一次（新功能）
- **大版本**: 每季度或半年（重大更新）

## 📞 联系方式

发布相关问题请联系：

- 项目维护者: [GitHub Issues](https://github.com/yourusername/MultiTodo/issues)
- 邮箱: support@example.com

---

**模板版本**: v1.0  
**最后更新**: 2025-10-28


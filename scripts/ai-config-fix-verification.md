# AI配置持久化修复 - 验证指南

## 修复内容总结

### 1. 已实施的修改

#### 修改1：添加详细日志 - main.ts (ai:configure处理器)
**文件：** `src/main/main.ts`
**位置：** line 755-770

**修改内容：**
- 添加了配置请求的日志输出
- 添加了保存到数据库前的日志
- 添加了保存成功的确认日志
- 添加了保存失败的错误日志

**日志示例：**
```
[ai:configure] 接收到配置请求: { provider: 'kimi', apiKey: '***', endpoint: '', model: 'moonshot-v1-8k' }
[ai:configure] 准备保存到数据库: { ai_provider: 'kimi', ai_api_key: '***', ai_enabled: 'true', ... }
[ai:configure] 数据库保存成功
```

#### 修改2：宽松化启动时的加载条件 - main.ts (AI服务初始化)
**文件：** `src/main/main.ts`
**位置：** line 1457-1490

**修改前：**
```typescript
if (settings.ai_enabled === 'true' && settings.ai_provider !== 'disabled') {
```

**修改后：**
```typescript
// 宽松的加载条件：只要有provider和apiKey就加载，不依赖ai_enabled字段
if (settings.ai_provider && settings.ai_provider !== 'disabled' && settings.ai_api_key && settings.ai_api_key.length > 0) {
```

**改进点：**
- 不再依赖`ai_enabled`字段
- 只要provider和apiKey有效就加载配置
- 添加了详细的初始化日志
- 添加了try-catch错误处理

**日志示例：**
```
[AI Init] 从数据库读取的配置: { ai_provider: 'kimi', ai_api_key: '***', ai_enabled: 'true', ... }
[AI Init] 配置有效，开始初始化AI服务
[AI Init] AI服务配置成功
```

**或当配置无效时：**
```
[AI Init] 从数据库读取的配置: { ai_provider: 'disabled', ai_api_key: '(empty)', ai_enabled: 'false', ... }
[AI Init] 配置无效或为空，跳过AI服务初始化: { hasProvider: false, providerIsDisabled: true, hasApiKey: false, apiKeyLength: 0 }
```

#### 修改3：删除重复保存 - SettingsModal.tsx
**文件：** `src/renderer/components/SettingsModal.tsx`
**位置：** line 183-210

**修改前：**
```typescript
if (result.success) {
  message.success('AI配置已保存');
  // 同时更新settings - 这是重复的！
  await window.electronAPI.settings.update({...});
  setConnectionTestResult(null);
}
```

**修改后：**
```typescript
if (result.success) {
  message.success('AI配置已保存');
  setConnectionTestResult(null);
}
```

**改进点：**
- 删除了重复的`settings.update`调用
- 添加了详细的保存日志
- 添加了错误处理

### 2. 问题根源分析

通过代码分析发现，最可能的问题是：

**双重保存导致配置覆盖：**
1. 第一次保存（`ai:configure`）：正确保存了API Key
2. 第二次保存（`settings.update`）：可能覆盖了正确的配置
3. 结果：数据库中保存的是空值或不完整值

**加载条件过于严格：**
- 依赖`ai_enabled === 'true'`的严格判断
- 如果该字段不是'true'，配置就不会被加载

### 3. 修复原理

**方案1：删除重复保存**
- 只在`ai:configure`处理器中保存一次
- 确保配置保存的原子性和一致性

**方案2：宽松化加载条件**
- 不依赖`ai_enabled`字段
- 只要provider和apiKey有效就加载配置
- 提高配置加载的成功率

**方案3：添加详细日志**
- 便于追踪配置保存和加载流程
- 快速定位问题

## 测试步骤

### 步骤1：启动应用并查看日志
1. 运行应用：`npm run dev`
2. 打开开发者工具（Ctrl+Shift+I）
3. 切换到Console标签页

### 步骤2：首次配置AI服务
1. 点击设置 → AI助手标签
2. 选择AI提供商（如Kimi）
3. 输入API Key
4. 点击"获取模型"按钮
5. 选择模型
6. 点击"保存配置"按钮

**预期日志：**
```
[SettingsModal] 保存AI配置: { ai_provider: 'kimi', ai_api_key: '***', ai_api_endpoint: '', ai_model: 'moonshot-v1-8k' }
[ai:configure] 接收到配置请求: { provider: 'kimi', apiKey: '***', endpoint: '', model: 'moonshot-v1-8k' }
[ai:configure] 准备保存到数据库: { ai_provider: 'kimi', ai_api_key: '***', ai_enabled: 'true', ... }
[ai:configure] 数据库保存成功
```

### 步骤3：验证配置已保存
1. 查看应用是否显示"AI配置已保存"提示
2. 点击"测试连接"按钮
3. 应该显示"连接成功！"

### 步骤4：重启应用
1. 完全关闭应用（包括系统托盘）
2. 重新启动应用：`npm run dev`

**预期日志：**
```
[AI Init] 从数据库读取的配置: { ai_provider: 'kimi', ai_api_key: '***', ai_enabled: 'true', ... }
[AI Init] 配置有效，开始初始化AI服务
[AI Init] AI服务配置成功
[AI service initialization completed]
```

### 步骤5：验证配置已加载
1. 打开设置 → AI助手标签
2. 查看是否显示之前配置的：
   - AI提供商
   - API Key（显示为已输入状态）
   - 模型
3. 点击"测试连接"按钮
4. 应该显示"连接成功！"

## 预期结果

✅ **修复后：**
1. 首次配置AI服务后，API Key被正确保存到数据库
2. 重启应用后，配置自动加载，无需重新输入
3. 控制台日志清晰显示配置保存和加载过程

❌ **修复前：**
1. 首次配置后，配置可能被覆盖为空值
2. 重启应用后，需要重新输入API Key
3. 缺乏日志，难以诊断问题

## 常见问题排查

### 问题1：日志显示"[AI Init] 配置无效或为空"

**可能原因：**
- 数据库中没有保存配置
- 配置字段缺失或为空

**排查步骤：**
1. 检查保存时的日志，确认配置被正确保存
2. 查看日志中显示的具体原因：
   - `hasProvider: false` → provider字段缺失
   - `providerIsDisabled: true` → provider是'disabled'
   - `hasApiKey: false` → apiKey字段缺失
   - `apiKeyLength: 0` → apiKey是空字符串

### 问题2：保存时日志显示"[ai:configure] 准备保存到数据库: { ai_api_key: '(empty)' }"

**可能原因：**
- 表单中的API Key字段为空
- 表单验证问题

**解决方法：**
1. 确保在输入框中输入了API Key
2. 点击"获取模型"按钮验证API Key有效

### 问题3：测试连接失败

**可能原因：**
- API Key无效或已过期
- 网络连接问题
- API服务端点配置错误

**解决方法：**
1. 检查API Key是否正确
2. 检查网络连接
3. 尝试使用默认API端点

## 回滚方案

如果修复后出现问题，可以回滚到修复前的版本：

### 回滚1：恢复重复保存（如果需要）
```typescript
// SettingsModal.tsx
if (result.success) {
  message.success('AI配置已保存');
  // 如果需要恢复重复保存，取消下面的注释
  await window.electronAPI.settings.update({...});
  setConnectionTestResult(null);
}
```

### 回滚2：恢复严格条件判断
```typescript
// main.ts
if (settings.ai_enabled === 'true' && settings.ai_provider !== 'disabled') {
```

## 技术细节

### 数据库表结构
```sql
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### AI配置字段
- `ai_provider`: AI提供商（'kimi', 'deepseek', 'doubao', 'openai', 'glm', 'claude', 'qwen', 'custom', 'disabled'）
- `ai_api_key`: API密钥
- `ai_api_endpoint`: 自定义API端点（可选）
- `ai_model`: AI模型
- `ai_enabled`: 是否启用（'true'/'false'，现已废弃，保留用于向后兼容）

### 配置保存流程
```
用户点击"保存配置"
    ↓
SettingsModal.handleAIConfigSave()
    ↓
window.electronAPI.ai.configure()
    ↓
IPC: ai:configure (main.ts)
    ↓
1. aiService.configure() - 配置内存
2. dbManager.updateSettings() - 保存到数据库
```

### 配置加载流程
```
应用启动
    ↓
main.ts 初始化
    ↓
dbManager.getSettings() - 从数据库读取配置
    ↓
检查条件：provider && provider !== 'disabled' && apiKey && apiKey.length > 0
    ↓ (如果条件满足)
aiService.configure() - 配置AI服务
```

## 总结

本次修复通过以下三个关键改进解决了API Key无法持久化的问题：

1. ✅ **删除重复保存** - 避免配置被覆盖
2. ✅ **宽松化加载条件** - 提高配置加载成功率
3. ✅ **添加详细日志** - 便于问题诊断和追踪

修复后，用户只需要在首次使用时配置一次AI服务，之后重启应用时配置会自动加载，无需重复输入。

---

**修复日期：** 2026-04-11
**修改文件：**
- `src/main/main.ts`
- `src/renderer/components/SettingsModal.tsx`

**测试状态：** 待用户验证

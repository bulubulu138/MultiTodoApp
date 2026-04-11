# AI配置持久化问题诊断报告

## 问题描述
用户报告：每次打开应用都需要重新输入AI模型的API Key，配置无法持久化。

## 代码分析结果

### 1. 配置保存流程（SettingsModal.tsx line 183-210）

```typescript
const handleAIConfigSave = async () => {
  try {
    const values = await aiForm.validateFields();
    const result = await window.electronAPI.ai.configure(
      values.ai_provider,
      values.ai_api_key || '',
      values.ai_api_endpoint || '',
      values.ai_model || ''
    );

    if (result.success) {
      message.success('AI配置已保存');
      // ⚠️ 问题点1：双重保存
      await window.electronAPI.settings.update({
        ai_provider: values.ai_provider,
        ai_api_key: values.ai_api_key || '',
        ai_api_endpoint: values.ai_api_endpoint || '',
        ai_model: values.ai_model || '',
        ai_enabled: values.ai_provider !== 'disabled' && values.ai_api_key ? 'true' : 'false'
      });
      setConnectionTestResult(null);
    } else {
      message.error('保存失败: ' + result.error);
    }
  } catch (error) {
    console.error('Failed to save AI config:', error);
  }
};
```

**发现的问题：**
- **双重保存**：调用`ai:configure`时已经保存一次，然后又调用`settings:update`保存第二次
- **可能导致配置不一致**：如果第二次保存的值与第一次不同，会造成混乱

### 2. Main进程中的保存逻辑（main.ts line 755-770）

```typescript
ipcMain.handle('ai:configure', async (_, provider: string, apiKey: string, endpoint?: string, model?: string) => {
  try {
    aiService.configure(provider as any, apiKey, endpoint, model);
    // 保存到数据库
    await this.dbManager.updateSettings({
      ai_provider: provider,
      ai_api_key: apiKey,
      ai_api_endpoint: endpoint || '',
      ai_model: model || '',
      ai_enabled: provider !== 'disabled' && apiKey ? 'true' : 'false'
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});
```

**分析：**
- 这里的保存逻辑是正确的
- **关键判断**：`ai_enabled = provider !== 'disabled' && apiKey ? 'true' : 'false'`
  - 如果provider是'disabled'，ai_enabled = 'false'
  - 如果provider不是'disabled'但apiKey为空，ai_enabled = 'false'
  - 只有provider不是'disabled'且apiKey有值时，ai_enabled = 'true'

### 3. 启动时的加载逻辑（main.ts line 1457-1468）

```typescript
// 初始化 AI 服务
console.log('Initializing AI service...');
const settings = await this.dbManager.getSettings();
if (settings.ai_enabled === 'true' && settings.ai_provider !== 'disabled') {
  aiService.configure(
    settings.ai_provider as any,
    settings.ai_api_key || '',
    settings.ai_api_endpoint || undefined,
    settings.ai_model || undefined
  );
}
console.log('AI service initialized successfully');
```

**发现的问题：**
- **条件判断过于严格**：`settings.ai_enabled === 'true' && settings.ai_provider !== 'disabled'`
  - 要求`ai_enabled`必须严格等于字符串'true'
  - 如果因为某种原因`ai_enabled`字段缺失或为其他值，配置不会被加载

## 可能的根本原因

### 原因1：双重保存导致配置覆盖（可能性：⭐⭐⭐⭐）

**场景复现：**
1. 用户在SettingsModal中输入API Key
2. 点击"保存配置"
3. 第一次保存（`ai:configure`）：保存了正确的配置，`ai_enabled='true'`
4. 第二次保存（`settings:update`）：如果此时表单中的某些字段被清空，可能导致`ai_api_key`被覆盖为空字符串
5. 数据库中最终保存的配置是：`ai_api_key=''`, `ai_enabled='false'`
6. 下次启动时，因为`ai_enabled='false'`，配置不会加载

**验证方法：**
- 在main.ts的`ai:configure`处理器中添加日志，记录保存到数据库的值
- 在SettingsModal的`handleAIConfigSave`中添加日志，记录第二次保存的值
- 对比两次保存的值是否一致

### 原因2：条件判断过于严格（可能性：⭐⭐⭐）

**场景复现：**
1. 保存时配置正确，`ai_enabled='true'`
2. 但由于某种原因（如数据库迁移、手动修改等），`ai_enabled`字段变为其他值
3. 启动时条件判断失败，配置不加载

**改进建议：**
```typescript
// 改进前
if (settings.ai_enabled === 'true' && settings.ai_provider !== 'disabled') {

// 改进后：宽松的判断条件
if (settings.ai_provider && settings.ai_provider !== 'disabled' && settings.ai_api_key) {
```

### 原因3：API Key为空字符串（可能性：⭐⭐）

**场景复现：**
1. 用户输入API Key后点击"保存配置"
2. 但此时`values.ai_api_key`实际上是空字符串（可能是表单验证问题）
3. 保存时`ai_enabled='false'`
4. 下次启动不加载配置

## 诊断建议

### 立即执行的诊断步骤：

**步骤1：添加详细日志**
在以下位置添加console.log：

```typescript
// main.ts - ai:configure处理器
ipcMain.handle('ai:configure', async (_, provider: string, apiKey: string, endpoint?: string, model?: string) => {
  try {
    console.log('[ai:configure] 接收到配置请求:', { provider, apiKey: apiKey ? '***' : '(empty)', endpoint, model });
    aiService.configure(provider as any, apiKey, endpoint, model);

    const settingsToSave = {
      ai_provider: provider,
      ai_api_key: apiKey,
      ai_api_endpoint: endpoint || '',
      ai_model: model || '',
      ai_enabled: provider !== 'disabled' && apiKey ? 'true' : 'false'
    };
    console.log('[ai:configure] 准备保存到数据库:', { ...settingsToSave, ai_api_key: settingsToSave.ai_api_key ? '***' : '(empty)' });

    await this.dbManager.updateSettings(settingsToSave);
    console.log('[ai:configure] 数据库保存成功');

    return { success: true };
  } catch (error) {
    console.error('[ai:configure] 保存失败:', error);
    return { success: false, error: (error as Error).message };
  }
});

// main.ts - 启动时加载
const settings = await this.dbManager.getSettings();
console.log('[AI Init] 从数据库读取的settings:', {
  ai_provider: settings.ai_provider,
  ai_api_key: settings.ai_api_key ? '***' : '(empty)',
  ai_enabled: settings.ai_enabled,
  ai_api_endpoint: settings.ai_api_endpoint,
  ai_model: settings.ai_model
});

if (settings.ai_enabled === 'true' && settings.ai_provider !== 'disabled') {
  console.log('[AI Init] 条件满足，开始配置AI服务');
  aiService.configure(
    settings.ai_provider as any,
    settings.ai_api_key || '',
    settings.ai_api_endpoint || undefined,
    settings.ai_model || undefined
  );
} else {
  console.log('[AI Init] 条件不满足，跳过AI服务配置:', {
    reason: !settings.ai_enabled ? 'ai_enabled为false' : settings.ai_provider === 'disabled' ? 'provider为disabled' : '未知原因'
  });
}
```

**步骤2：删除SettingsModal中的重复保存**
```typescript
// SettingsModal.tsx - handleAIConfigSave
const handleAIConfigSave = async () => {
  try {
    const values = await aiForm.validateFields();
    console.log('[SettingsModal] 表单值:', { ...values, ai_api_key: values.ai_api_key ? '***' : '(empty)' });

    const result = await window.electronAPI.ai.configure(
      values.ai_provider,
      values.ai_api_key || '',
      values.ai_api_endpoint || '',
      values.ai_model || ''
    );

    if (result.success) {
      message.success('AI配置已保存');
      // ⚠️ 删除这段重复的保存代码
      // await window.electronAPI.settings.update({...});
      setConnectionTestResult(null);
    } else {
      message.error('保存失败: ' + result.error);
    }
  } catch (error) {
    console.error('Failed to save AI config:', error);
  }
};
```

**步骤3：宽松化启动时的加载条件**
```typescript
// main.ts - 启动时
const settings = await this.dbManager.getSettings();
// 改为更宽松的条件：只要有provider和apiKey就加载
if (settings.ai_provider && settings.ai_provider !== 'disabled' && settings.ai_api_key && settings.ai_api_key.length > 0) {
  aiService.configure(
    settings.ai_provider as any,
    settings.ai_api_key,
    settings.ai_api_endpoint || undefined,
    settings.ai_model || undefined
  );
}
```

### 诊断后的预期结果：

添加日志后，重新运行应用并配置AI，观察控制台输出：

**如果日志显示：**
1. `[ai:configure] 准备保存到数据库: { ai_api_key: '(empty)' }`
   - **原因确认**：API Key确实是空字符串
   - **问题来源**：表单验证或表单值获取有问题

2. `[AI Init] 条件不满足，跳过AI服务配置: { reason: 'ai_enabled为false' }`
   - **原因确认**：数据库中`ai_enabled='false'`
   - **问题来源**：双重保存导致配置被覆盖

3. 日志显示保存成功，但启动时不加载
   - **原因确认**：条件判断问题或其他未知原因

## 总结

基于代码静态分析，**最可能的原因是双重保存导致配置被覆盖**：

1. `ai:configure`保存了一次正确的配置
2. SettingsModal中的`settings.update`又保存了一次，可能覆盖了正确的值

**立即修复方案：**
1. 删除SettingsModal中的重复保存代码
2. 宽松化启动时的加载条件
3. 添加详细的日志以便追踪问题


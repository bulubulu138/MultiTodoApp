# 配置切换功能测试验证计划

## 修复内容总结

### 问题
用户切换存储位置后，配置更新存在竞态条件：
- 两次调用 `saveConfig()`（第一次更新 storageLocation，第二次更新 currentDatabasePath）
- 可能导致配置不一致，重启后使用旧路径

### 修复方案
1. **在 AppConfig 中添加 `updateDatabasePath(dbPath)` 方法**
   - 同时更新 `storageLocation` 和 `currentDatabasePath`
   - 只调用一次 `saveConfig()`，确保原子性

2. **修改 DatabaseManager.switchDatabase()**
   - 使用新的 `updateDatabasePath(dbPath)` 方法
   - 减少配置文件 I/O 操作
   - 添加更详细的日志

3. **添加配置验证逻辑**
   - 在 `DatabaseManager.initialize()` 中添加一致性检查
   - 检测并修复配置不一致问题

## 测试场景

### 场景1：首次运行时设置存储位置
**前置条件：** 应用首次启动（isFirstRun = true）

**操作步骤：**
1. 启动应用
2. 在首次运行对话框中选择自定义存储位置
3. 点击完成

**预期结果：**
- 配置文件中 `storageLocation.customPath` = 用户选择的路径
- 配置文件中 `currentDatabasePath` = 用户选择的路径
- 应用重启后，数据从新位置加载
- 日志显示 "Configuration consistency check passed"

**验证日志：**
```
[AppConfig] 🔄 Updating database path atomically: <路径>
[AppConfig] ✅ Database path updated atomically: { storageLocation: {...}, currentDatabasePath: <路径> }
[DatabaseManager] ✅ Configuration consistency check passed
```

---

### 场景2：从设置页面切换数据库（历史记录）
**前置条件：** 应用已启动，有多个历史数据库记录

**操作步骤：**
1. 打开设置页面
2. 在"最近使用的数据库"列表中选择一个数据库
3. 点击"切换"按钮
4. 确认切换

**预期结果：**
- 显示"数据库切换成功，正在重新加载..."
- 2秒后应用自动重新加载
- 重新加载后，数据来自新选择的数据库
- 配置文件更新正确

**验证日志：**
```
[DatabaseManager] 🔄 Switching to database: <新路径>
[DatabaseManager] 💾 Updating configuration atomically...
[AppConfig] 🔄 Updating database path atomically: <新路径>
[AppConfig] ✅ Database path updated atomically
[DatabaseManager] ✅ Configuration updated successfully
[DatabaseManager] ✅ Database switched successfully: <新路径> (X todos)
```

---

### 场景3：添加新数据库并切换
**前置条件：** 应用已启动

**操作步骤：**
1. 打开设置页面
2. 点击"添加新数据库"按钮
3. 选择一个新文件夹（非数据库）
4. 在确认对话框中点击"确定"初始化新数据库
5. 系统自动切换到新数据库

**预期结果：**
- 新文件夹被初始化为数据库
- 应用切换到新数据库
- 数据库出现在历史记录列表顶部
- 配置文件正确更新

**验证日志：**
```
[AppConfig] ✅ Database initialized: <新路径>
[DatabaseManager] 🔄 Switching to database: <新路径>
[AppConfig] 🔄 Updating database path atomically: <新路径>
[AppConfig] ✅ Database path updated atomically
```

---

### 场景4：切换后应用重启验证
**前置条件：** 已完成一次数据库切换

**操作步骤：**
1. 完全关闭应用
2. 重新启动应用
3. 观察加载的数据源

**预期结果：**
- 应用从上次切换的数据库加载数据
- 日志显示配置一致性检查通过
- 没有配置不一致的警告

**验证日志：**
```
[DatabaseManager] 🚀 Initializing database manager...
[DatabaseManager] 📂 Current database path: <上次切换的路径>
[DatabaseManager] ✅ Configuration consistency check passed
[DatabaseManager] 🔄 Switching to database: <上次切换的路径>
```

---

### 场景5：配置不一致自动修复
**前置条件：** 手动创建配置不一致的情况（仅用于测试）

**操作步骤：**
1. 手动修改 `app-config.json`，使 `storageLocation.customPath` 与 `currentDatabasePath` 不一致
2. 启动应用
3. 观察日志

**预期结果：**
- 日志显示检测到配置不一致
- 自动修复配置
- 应用正常运行

**验证日志：**
```
[DatabaseManager] ⚠️ Configuration inconsistency detected: { storageLocation.customPath: 'X', currentDatabasePath: 'Y' }
[DatabaseManager] 🔧 Attempting to fix configuration inconsistency...
[AppConfig] 🔄 Updating database path atomically: Y
[AppConfig] ✅ Database path updated atomically
[DatabaseManager] ✅ Configuration fixed
```

---

### 场景6：并发切换压力测试
**前置条件：** 应用已启动

**操作步骤：**
1. 快速连续点击多个不同的数据库切换按钮
2. 观察应用行为

**预期结果：**
- 只有最后一次切换生效
- 配置文件保持一致
- 没有崩溃或异常

---

## 关键验证点

### 1. 配置文件内容检查
检查 `app-config.json` 文件内容：
```json
{
  "version": 2,
  "firstRun": false,
  "storageLocation": {
    "type": "custom",
    "customPath": "D:\\multitodo\\新建文件夹",
    "lastUpdated": "2026-05-17T..."
  },
  "recentDatabases": [...],
  "currentDatabasePath": "D:\\multitodo\\新建文件夹"
}
```

**验证点：**
- `storageLocation.customPath` 与 `currentDatabasePath` 应该一致
- 只有一个 `lastUpdated` 时间戳
- 文件内容完整，没有截断

### 2. 日志验证
**关键日志序列：**
1. `[AppConfig] 🔄 Updating database path atomically` - 显示原子更新开始
2. `[AppConfig] ✅ Database path updated atomically` - 显示原子更新完成
3. **不应该**出现两次单独的 `setStorageLocation` 或 `setCurrentDatabasePath` 日志

### 3. 文件 I/O 监控
**修复前：**
- 切换一次数据库，配置文件被写入两次

**修复后：**
- 切换一次数据库，配置文件只被写入一次

### 4. 时间顺序验证
- 更新配置应该在创建新的 FileStorageManager 之后
- 避免在初始化过程中修改配置

---

## 回归测试

### 首次运行流程
- ✅ 确保首次运行对话框正常显示
- ✅ 确保默认路径正确设置
- ✅ 确保后续启动时不再显示首次运行对话框

### 数据加载
- ✅ 切换数据库后，数据正确加载
- ✅ 待办事项显示正确的数据源
- ✅ 历史记录正确更新

### 错误处理
- ✅ 切换到不存在的路径时，显示错误提示
- ✅ 切换失败时，不修改配置
- ✅ 应用状态保持一致

---

## 性能验证

### 配置更新性能
**修复前：**
- 两次文件 I/O 操作
- 可能存在竞态条件

**修复后：**
- 一次文件 I/O 操作
- 原子性保证
- 更快的配置更新速度

### 应用启动性能
- 配置验证逻辑应该在 10ms 内完成
- 不应该影响应用启动速度

---

## 长期稳定性验证

### 多次切换测试
- 连续切换 10 次不同的数据库
- 验证配置文件始终一致
- 验证没有内存泄漏

### 长时间运行测试
- 应用运行 24 小时
- 多次切换数据库
- 验证配置文件没有损坏

---

## 自动化测试建议

### 单元测试
1. 测试 `AppConfig.updateDatabasePath()` 方法
2. 测试 `DatabaseManager.switchDatabase()` 方法
3. 测试配置一致性检查逻辑

### 集成测试
1. 模拟完整的切换流程
2. 验证配置文件的最终状态
3. 验证应用重启后的行为

### E2E 测试
1. 自动化 UI 操作
2. 验证用户交互流程
3. 验证数据一致性

---

## 测试执行记录

**执行日期：** 2026-05-17
**执行人：** [待填写]
**测试结果：** [待填写]

**通过的测试场景：**
- [ ] 场景1：首次运行时设置存储位置
- [ ] 场景2：从设置页面切换数据库
- [ ] 场景3：添加新数据库并切换
- [ ] 场景4：切换后应用重启验证
- [ ] 场景5：配置不一致自动修复
- [ ] 场景6：并发切换压力测试

**发现的问题：** [待填写]
**修复建议：** [待填写]
**最终结论：** [待填写]

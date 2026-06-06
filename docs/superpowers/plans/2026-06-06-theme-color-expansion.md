# 主题颜色扩展实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Ant Design 颜色主题从 5 种扩展到 12 种，保持现有架构和用户体验

**Architecture:** 扩展 `themes.ts` 中的 `ColorTheme` 类型和 `COLOR_SCHEMES` 对象，添加 7 个新颜色配置（cyan、magenta、yellow、indigo、pink、teal、amber）。更新 `SettingsModal.tsx` 中的颜色选择器 UI，采用两行布局展示 12 个颜色选项。所有改动基于现有的 HSL 色彩系统和 Ant Design Design Token 架构。

**Tech Stack:** React 18, TypeScript, Ant Design 5.12, HSL 色彩空间

---

## 文件结构

**修改文件：**
- `src/renderer/theme/themes.ts` - 扩展颜色类型定义和配置对象
- `src/renderer/components/SettingsModal.tsx` - 扩展颜色选择器 UI

**不需要创建新文件**：完全基于现有文件的扩展

---

### Task 1: 扩展颜色类型定义

**Files:**
- Modify: `src/renderer/theme/themes.ts:5`

**目标：** 扩展 `ColorTheme` 类型，添加 7 个新颜色选项

- [ ] **Step 1: 打开 themes.ts 文件并定位类型定义**

文件路径: `src/renderer/theme/themes.ts`
找到第 5 行的 `ColorTheme` 类型定义

- [ ] **Step 2: 修改 ColorTheme 类型定义**

将第 5 行从：
```typescript
export type ColorTheme = 'purple' | 'blue' | 'green' | 'orange' | 'red';
```

修改为：
```typescript
export type ColorTheme = 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'cyan' | 'magenta' | 'yellow' | 'indigo' | 'pink' | 'teal' | 'amber';
```

- [ ] **Step 3: 验证 TypeScript 编译**

运行: `npm run build:main`
预期: 编译成功，无类型错误

- [ ] **Step 4: Commit 类型定义更改**

```bash
git add src/renderer/theme/themes.ts
git commit -m "feat: extend ColorTheme type with 7 new colors"
```

---

### Task 2: 添加 Cyan 颜色配置

**Files:**
- Modify: `src/renderer/theme/themes.ts:18-49`

**目标：** 在 `COLOR_SCHEMES` 对象中添加 cyan 颜色配置

- [ ] **Step 1: 定位 COLOR_SCHEMES 对象**

在 `themes.ts` 文件中找到第 18 行的 `COLOR_SCHEMES` 对象定义

- [ ] **Step 2: 在 red 配置之后添加 cyan 配置**

在第 49 行（`red` 配置的闭合大括号）之后添加：

```typescript
  cyan: {
    hue: 180,
    primary: 'hsl(180, 80%, 50%)',
    primaryDark: 'hsl(180, 80%, 40%)',
    primaryLight: 'hsl(180, 80%, 92%)',
  },
```

- [ ] **Step 3: 验证 TypeScript 编译**

运行: `npm run build:main`
预期: 编译成功，cyan 颜色配置被正确识别

- [ ] **Step 4: Commit cyan 颜色配置**

```bash
git add src/renderer/theme/themes.ts
git commit -m "feat: add cyan color scheme"
```

---

### Task 3: 添加 Magenta 颜色配置

**Files:**
- Modify: `src/renderer/theme/themes.ts:18-49`

**目标：** 在 `COLOR_SCHEMES` 对象中添加 magenta 颜色配置

- [ ] **Step 1: 在 cyan 配置之后添加 magenta 配置**

在 cyan 配置的闭合大括号之后添加：

```typescript
  magenta: {
    hue: 320,
    primary: 'hsl(320, 80%, 60%)',
    primaryDark: 'hsl(320, 80%, 45%)',
    primaryLight: 'hsl(320, 80%, 92%)',
  },
```

- [ ] **Step 2: 验证 TypeScript 编译**

运行: `npm run build:main`
预期: 编译成功

- [ ] **Step 3: Commit magenta 颜色配置**

```bash
git add src/renderer/theme/themes.ts
git commit -m "feat: add magenta color scheme"
```

---

### Task 4: 添加 Yellow 颜色配置

**Files:**
- Modify: `src/renderer/theme/themes.ts:18-49`

**目标：** 在 `COLOR_SCHEMES` 对象中添加 yellow 颜色配置

- [ ] **Step 1: 在 magenta 配置之后添加 yellow 配置**

在 magenta 配置的闭合大括号之后添加：

```typescript
  yellow: {
    hue: 48,
    primary: 'hsl(48, 90%, 58%)',
    primaryDark: 'hsl(48, 90%, 45%)',
    primaryLight: 'hsl(48, 90%, 92%)',
  },
```

注意：yellow 使用 90% 饱和度（而非 80%），以达到更好的视觉效果

- [ ] **Step 2: 验证 TypeScript 编译**

运行: `npm run build:main`
预期: 编译成功

- [ ] **Step 3: Commit yellow 颜色配置**

```bash
git add src/renderer/theme/themes.ts
git commit -m "feat: add yellow color scheme"
```

---

### Task 5: 添加 Indigo 颜色配置

**Files:**
- Modify: `src/renderer/theme/themes.ts:18-49`

**目标：** 在 `COLOR_SCHEMES` 对象中添加 indigo 颜色配置

- [ ] **Step 1: 在 yellow 配置之后添加 indigo 配置**

在 yellow 配置的闭合大括号之后添加：

```typescript
  indigo: {
    hue: 240,
    primary: 'hsl(240, 80%, 60%)',
    primaryDark: 'hsl(240, 80%, 45%)',
    primaryLight: 'hsl(240, 80%, 92%)',
  },
```

- [ ] **Step 2: 验证 TypeScript 编译**

运行: `npm run build:main`
预期: 编译成功

- [ ] **Step 3: Commit indigo 颜色配置**

```bash
git add src/renderer/theme/themes.ts
git commit -m "feat: add indigo color scheme"
```

---

### Task 6: 添加 Pink 颜色配置

**Files:**
- Modify: `src/renderer/theme/themes.ts:18-49`

**目标：** 在 `COLOR_SCHEMES` 对象中添加 pink 颜色配置

- [ ] **Step 1: 在 indigo 配置之后添加 pink 配置**

在 indigo 配置的闭合大括号之后添加：

```typescript
  pink: {
    hue: 340,
    primary: 'hsl(340, 80%, 65%)',
    primaryDark: 'hsl(340, 80%, 50%)',
    primaryLight: 'hsl(340, 80%, 92%)',
  },
```

注意：pink 使用 65% 亮度（而非标准的 60%），以获得更柔和的视觉效果

- [ ] **Step 2: 验证 TypeScript 编译**

运行: `npm run build:main`
预期: 编译成功

- [ ] **Step 3: Commit pink 颜色配置**

```bash
git add src/renderer/theme/themes.ts
git commit -m "feat: add pink color scheme"
```

---

### Task 7: 添加 Teal 颜色配置

**Files:**
- Modify: `src/renderer/theme/themes.ts:18-49`

**目标：** 在 `COLOR_SCHEMES` 对象中添加 teal 颜色配置

- [ ] **Step 1: 在 pink 配置之后添加 teal 配置**

在 pink 配置的闭合大括号之后添加：

```typescript
  teal: {
    hue: 170,
    primary: 'hsl(170, 80%, 45%)',
    primaryDark: 'hsl(170, 80%, 35%)',
    primaryLight: 'hsl(170, 80%, 92%)',
  },
```

注意：teal 使用 45% 和 35% 亮度（而非标准的 60%/45%），以保持青绿色的自然感

- [ ] **Step 2: 验证 TypeScript 编译**

运行: `npm run build:main`
预期: 编译成功

- [ ] **Step 3: Commit teal 颜色配置**

```bash
git add src/renderer/theme/themes.ts
git commit -m "feat: add teal color scheme"
```

---

### Task 8: 添加 Amber 颜色配置

**Files:**
- Modify: `src/renderer/theme/themes.ts:18-49`

**目标：** 在 `COLOR_SCHEMES` 对象中添加 amber 颜色配置

- [ ] **Step 1: 在 teal 配置之后添加 amber 配置**

在 teal 配置的闭合大括号之后添加：

```typescript
  amber: {
    hue: 42,
    primary: 'hsl(42, 90%, 55%)',
    primaryDark: 'hsl(42, 90%, 42%)',
    primaryLight: 'hsl(42, 90%, 92%)',
  },
```

注意：amber 使用 90% 饱和度和 55%/42% 亮度，以呈现温暖的琥珀色调

- [ ] **Step 2: 验证 TypeScript 编译**

运行: `npm run build:main`
预期: 编译成功

- [ ] **Step 3: Commit amber 颜色配置**

```bash
git add src/renderer/theme/themes.ts
git commit -m "feat: add amber color scheme"
```

---

### Task 9: 更新颜色选择器 UI

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx:21-28`

**目标：** 扩展 `ColorThemeSelector` 组件的 colors 数组，添加 7 个新颜色选项

- [ ] **Step 1: 定位 ColorThemeSelector 组件**

在 `SettingsModal.tsx` 文件中找到第 21 行的 `ColorThemeSelector` 组件和 `colors` 数组定义

- [ ] **Step 2: 扩展 colors 数组**

将 colors 数组从：
```typescript
  const colors: Array<{ key: ColorTheme; color: string; label: string }> = [
    { key: 'purple', color: '#8B5CF6', label: '紫色' },
    { key: 'blue', color: '#3B82F6', label: '蓝色' },
    { key: 'green', color: '#10B981', label: '绿色' },
    { key: 'orange', color: '#F59E0B', label: '橙色' },
    { key: 'red', color: '#EF4444', label: '红色' },
  ];
```

修改为：
```typescript
  const colors: Array<{ key: ColorTheme; color: string; label: string }> = [
    { key: 'purple', color: '#8B5CF6', label: '紫色' },
    { key: 'blue', color: '#3B82F6', label: '蓝色' },
    { key: 'green', color: '#10B981', label: '绿色' },
    { key: 'orange', color: '#F59E0B', label: '橙色' },
    { key: 'red', color: '#EF4444', label: '红色' },
    { key: 'cyan', color: '#14B8A6', label: '青色' },
    { key: 'magenta', color: '#D946EF', label: '品红' },
    { key: 'yellow', color: '#EAB308', label: '金黄' },
    { key: 'indigo', color: '#6366F1', label: '靛蓝' },
    { key: 'pink', color: '#EC4899', label: '粉色' },
    { key: 'teal', color: '#0D9488', label: '青绿' },
    { key: 'amber', color: '#F59E0B', label: '琥珀' },
  ];
```

- [ ] **Step 3: 验证 TypeScript 编译**

运行: `npm run build:renderer`
预期: 编译成功，无类型错误

- [ ] **Step 4: Commit 颜色选择器更新**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat: extend color selector with 7 new color options"
```

---

### Task 10: 调整颜色选择器布局

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx:30-55`

**目标：** 调整 Space 组件布局，支持两行显示 12 个颜色

- [ ] **Step 1: 定位颜色选择器的 Space 组件**

在 `ColorThemeSelector` 组件中找到第 30 行的 `<Space>` 组件

- [ ] **Step 2: 添加 wrap 属性**

将 Space 组件从：
```typescript
    <Space size={12}>
```

修改为：
```typescript
    <Space size={12} wrap>
```

这样可以让颜色选项自动换行，形成两行布局（每行 6 个）

- [ ] **Step 3: 验证 TypeScript 编译**

运行: `npm run build:renderer`
预期: 编译成功

- [ ] **Step 4: Commit 布局调整**

```bash
git add src/renderer/components/SettingsModal.tsx
git commit -m "feat: add wrap layout to color selector for better display"
```

---

### Task 11: 本地开发验证

**Files:**
- N/A (验证步骤)

**目标：** 在开发模式下验证所有新颜色主题的功能和视觉效果

- [ ] **Step 1: 启动开发服务器**

运行: `npm run dev`
预期: 应用成功启动，无编译错误

- [ ] **Step 2: 打开设置页面验证颜色选择器**

1. 在应用中打开设置页面
2. 找到"主题设置"部分
3. 验证颜色选择器显示 12 个颜色选项（两行布局）
4. 验证每个颜色的 Tooltip 标签正确显示

预期: 所有 12 个颜色选项正确显示，布局美观

- [ ] **Step 3: 测试每个新颜色主题（浅色模式）**

依次点击每个新颜色（cyan、magenta、yellow、indigo、pink、teal、amber）：
1. 验证主题立即切换
2. 验证主按钮、卡片、输入框等组件颜色协调
3. 验证文字可读性良好

预期: 所有新颜色在浅色模式下表现良好

- [ ] **Step 4: 测试每个新颜色主题（深色模式）**

切换到深色模式，重复 Step 3 的测试

预期: 所有新颜色在深色模式下表现良好，对比度充足

- [ ] **Step 5: 测试主题持久化**

1. 选择一个新颜色主题（如 cyan）
2. 关闭并重新打开应用
3. 验证主题设置保持为 cyan

预期: 主题设置正确持久化

- [ ] **Step 6: 测试在主要页面的表现**

在以下页面测试新颜色主题：
1. 待办列表页面（TodoList）
2. 内容专注视图（ContentFocusView）
3. 流程图编辑器（FlowchartDrawer）
4. 日历视图（CalendarDrawer）

预期: 所有页面在新颜色主题下视觉协调

---

### Task 12: 视觉微调（如需要）

**Files:**
- Modify: `src/renderer/theme/themes.ts:18-49` (如需微调颜色参数)

**目标：** 根据验证结果微调颜色配置

- [ ] **Step 1: 识别需要微调的颜色**

在 Task 11 的验证过程中，记录任何可读性或视觉协调性问题

- [ ] **Step 2: 微调颜色的 HSL 参数**

如果某个颜色需要调整，修改其 `COLOR_SCHEMES` 配置：
- 调整 hue（色相）：改变颜色倾向
- 调整 saturation（饱和度）：改变颜色鲜艳度
- 调整 lightness（亮度）：改变颜色明暗

示例（假设 yellow 太亮需要调暗）：
```typescript
  yellow: {
    hue: 48,
    primary: 'hsl(48, 90%, 55%)',      // 从 58% 降到 55%
    primaryDark: 'hsl(48, 90%, 42%)',  // 从 45% 降到 42%
    primaryLight: 'hsl(48, 90%, 92%)',
  },
```

- [ ] **Step 3: 重新验证调整后的颜色**

运行: `npm run dev`
在应用中测试调整后的颜色，确认问题已解决

- [ ] **Step 4: Commit 微调（如有改动）**

```bash
git add src/renderer/theme/themes.ts
git commit -m "fix: adjust color parameters for better readability"
```

注意：如果 Task 11 验证时所有颜色表现良好，此任务可以跳过

---

### Task 13: 构建验证

**Files:**
- N/A (验证步骤)

**目标：** 验证生产构建正常，无编译错误

- [ ] **Step 1: 构建主进程**

运行: `npm run build:main`
预期: 构建成功，无 TypeScript 错误

- [ ] **Step 2: 构建渲染进程**

运行: `npm run build:renderer`
预期: 构建成功，无 webpack 错误

- [ ] **Step 3: 完整构建**

运行: `npm run build`
预期: 主进程和渲染进程都构建成功

- [ ] **Step 4: 打包验证（可选）**

运行: `npm run pack`
预期: 成功创建未打包的分发版本

---

### Task 14: 最终提交和文档更新

**Files:**
- Create: `CHANGELOG.md` (如果项目有变更日志)
- Modify: `README.md` (如果需要更新功能说明)

**目标：** 完成最终的代码提交和文档更新

- [ ] **Step 1: 检查所有改动已提交**

运行: `git status`
预期: 工作目录干净，所有改动已提交

- [ ] **Step 2: 创建功能完成的标记提交（可选）**

```bash
git commit --allow-empty -m "feat: complete theme color expansion - 12 colors now available"
```

- [ ] **Step 3: 更新 CHANGELOG（如果项目有）**

在 `CHANGELOG.md` 中添加：
```markdown
## [Unreleased]

### Added
- 扩展主题颜色选项，从 5 种增加到 12 种
- 新增颜色：青色(cyan)、品红(magenta)、金黄(yellow)、靛蓝(indigo)、粉色(pink)、青绿(teal)、琥珀(amber)
- 颜色选择器采用两行布局，更好地展示所有颜色选项
```

- [ ] **Step 4: 更新 README（如果需要）**

如果 README 中提到主题功能，更新颜色数量：
```markdown
- 支持 12 种颜色主题（紫色、蓝色、绿色、橙色、红色、青色、品红、金黄、靛蓝、粉色、青绿、琥珀）
```

- [ ] **Step 5: Commit 文档更新**

```bash
git add CHANGELOG.md README.md
git commit -m "docs: update changelog and readme for theme color expansion"
```

---

## 验证清单

完成所有任务后，使用此清单进行最终验证：

**功能验证：**
- [ ] 设置页面显示 12 个颜色选项
- [ ] 点击任意颜色，主题立即切换
- [ ] 浅色/深色模式切换时，所有颜色主题正常工作
- [ ] Button、Card、Modal、Input、Tag 等组件在新颜色下视觉协调
- [ ] 主题设置持久化（刷新页面后保持）
- [ ] 从旧主题切换到新主题的过渡平滑

**视觉验证：**
- [ ] 12 种颜色在待办卡片上表现良好
- [ ] 12 种颜色在紧凑模式下表现良好
- [ ] 12 种颜色在内容专注视图表现良好
- [ ] 12 种颜色在流程图编辑器表现良好
- [ ] 优先级标签在各颜色主题下可读性良好
- [ ] 状态标签在各颜色主题下可读性良好
- [ ] 深色模式下所有颜色对比度充足

**构建验证：**
- [ ] `npm run build:main` 成功
- [ ] `npm run build:renderer` 成功
- [ ] `npm run build` 成功
- [ ] 无 TypeScript 类型错误
- [ ] 无 webpack 构建错误

---

## 预计时间

- Task 1-8（类型和颜色配置）：45 分钟
- Task 9-10（UI 更新）：30 分钟
- Task 11（开发验证）：45 分钟
- Task 12（视觉微调）：30 分钟（可选）
- Task 13-14（构建验证和文档）：30 分钟

**总计：约 3 小时**

---

## 故障排除

**问题 1：TypeScript 报错 "Type 'cyan' is not assignable to type ColorTheme"**
- 原因：ColorTheme 类型定义未更新或未保存
- 解决：检查 Task 1 是否正确完成，重新编译

**问题 2：颜色选择器布局在小屏幕上显示不佳**
- 原因：wrap 属性未生效或需要调整 maxWidth
- 解决：在 Space 组件外层添加容器，设置 `style={{ maxWidth: '400px' }}`

**问题 3：某个新颜色在深色模式下对比度不足**
- 原因：HSL 亮度值需要调整
- 解决：在 Task 12 中微调该颜色的 lightness 参数，增加 5-10%

**问题 4：主题切换后部分组件颜色未更新**
- 原因：某些组件使用了硬编码颜色而非 Design Token
- 解决：检查相关组件，将硬编码颜色替换为 Ant Design Token 变量

---

## 成功标准

1. ✅ 用户可以在设置页面看到 12 种颜色选项
2. ✅ 所有颜色主题在浅色/深色模式下都能正常工作
3. ✅ 主题切换平滑无卡顿
4. ✅ 所有 Ant Design 组件在新颜色主题下视觉协调
5. ✅ 代码结构清晰，零破坏性改动
6. ✅ 构建成功，无编译错误

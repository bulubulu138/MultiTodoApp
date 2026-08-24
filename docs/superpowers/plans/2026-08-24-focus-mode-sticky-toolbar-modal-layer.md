# 专注模式固定工具栏与设置弹窗层级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让专注模式中每个待办的工具栏在其正文滚动时固定在内容区顶部，并确保设置弹窗覆盖这些工具栏。

**Architecture:** 保留现有 `.content-focus-scroll-area` 作为唯一滚动容器，使用 CSS sticky 的待办边界行为完成工具栏接替，不添加滚动事件监听。为 `SettingsModal` 设置显式高于内容 sticky 层的 `zIndex`，让弹窗层级不依赖 Ant Design 默认值。

**Tech Stack:** React, TypeScript, Ant Design, CSS, Jest。

---

### Task 1: 建立失败的布局回归测试

**Files:**
- Modify: `src/renderer/components/__tests__/ContentFocusView.toolbar.test.ts`
- Create: `src/renderer/components/__tests__/SettingsModal.layer.test.ts`

- [ ] **Step 1: 扩展专注模式测试，验证真实布局约束**

在现有 CSS 读取测试中增加断言：`.content-focus-scroll-area` 具有垂直滚动、相对定位和 `--content-focus-sticky-top: 0px`；`.content-focus-item-header` 具有 `position: sticky`、`top: 0`（或解析为 0 的变量）、内容层 `z-index` 和不透明背景。测试必须排除注释文本后再匹配实际规则，防止只靠注释通过。

- [ ] **Step 2: 为设置弹窗写失败测试**

读取 `SettingsModal.tsx` 的 `Modal` 属性，断言组件声明了显式 `zIndex`，且值高于 `global.css` 中 `.content-focus-item-header` 的 `--z-sticky` 数值。测试还应断言没有通过设置工具栏更高层级来解决遮挡。

- [ ] **Step 3: 运行定向测试确认测试因实现缺失而失败**

Run: `npm test -- --runInBand src/renderer/components/__tests__/ContentFocusView.toolbar.test.ts src/renderer/components/__tests__/SettingsModal.layer.test.ts`

Expected: 新增的 scroll-area 或 Modal `zIndex` 断言失败；失败原因应指向缺少目标属性，而不是测试环境错误。

### Task 2: 修正专注模式 sticky 工具栏

**Files:**
- Modify: `src/renderer/styles/global.css:1640-1655,2101-2110`

- [ ] **Step 1: 调整实际生效的滚动容器规则**

在 `.content-focus-scroll-area` 中保留 `overflow-y: auto`、`overflow-x: hidden`、`position: relative` 和 `--content-focus-sticky-top: 0px`，并确保没有祖先规则把专注模式容器设为另一个滚动上下文。

- [ ] **Step 2: 调整工具栏 sticky 规则**

让 `.content-focus-item-header` 使用 `position: sticky`、`top: var(--content-focus-sticky-top, 0px)`、内容层级的 `z-index`、主题不透明背景、底部边框和足够覆盖间距的 padding。不要改变按钮结构或引入固定高度，以保持移动端换行后工具栏完整可见。

- [ ] **Step 3: 运行布局回归测试**

Run: `npm test -- --runInBand src/renderer/components/__tests__/ContentFocusView.toolbar.test.ts`

Expected: PASS。

### Task 3: 修正设置弹窗层级

**Files:**
- Modify: `src/renderer/components/SettingsModal.tsx:445-465`
- Test: `src/renderer/components/__tests__/SettingsModal.layer.test.ts`

- [ ] **Step 1: 给设置 Modal 设置显式层级**

在现有 `<Modal>` 上增加 `zIndex={var(--z-modal)}` 无法直接作为 React 数字属性使用，因此使用项目的数值 token 对应值（`1050`）或抽取共享的数值常量；最终值必须高于工具栏的 `1020`，且只作用于设置 Modal，不修改全局 sticky 层级。

- [ ] **Step 2: 运行设置层级测试**

Run: `npm test -- --runInBand src/renderer/components/__tests__/SettingsModal.layer.test.ts`

Expected: PASS，且测试确认设置 Modal 的声明层级高于内容工具栏层级。

### Task 4: 全量验证

**Files:**
- Test: `src/renderer/components/__tests__/ContentFocusView.toolbar.test.ts`
- Test: `src/renderer/components/__tests__/SettingsModal.layer.test.ts`

- [ ] **Step 1: 运行专注模式相关测试**

Run: `npm test -- --runInBand src/renderer/components/__tests__/ContentFocusView*.test.*`

Expected: PASS。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: main 和 renderer 均构建成功，无 TypeScript 或 webpack 错误。

- [ ] **Step 3: 检查最终变更范围**

Run: `git diff -- docs/superpowers/specs/2026-08-24-focus-mode-sticky-toolbar-modal-layer-design.md docs/superpowers/plans/2026-08-24-focus-mode-sticky-toolbar-modal-layer.md src/renderer/components/__tests__/ContentFocusView.toolbar.test.ts src/renderer/components/__tests__/SettingsModal.layer.test.ts src/renderer/styles/global.css src/renderer/components/SettingsModal.tsx`

Expected: 变更只覆盖本规格要求的测试、样式和设置 Modal 层级；不包含无关格式化或业务逻辑改动。

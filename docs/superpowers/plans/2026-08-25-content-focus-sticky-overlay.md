# 专注模式工具栏与浮层层级修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让专注模式待办工具栏在当前待办滚动区域内持续吸顶，并确保新增待办弹窗与详情抽屉覆盖工具栏。

**Architecture:** 保持待办级 `position: sticky`，明确专注模式滚动容器的吸顶层级和背景覆盖，避免额外层叠上下文限制 sticky。为新增 Modal 和详情 Drawer 使用统一的高浮层层级并挂载到 `document.body`。

**Tech Stack:** React, TypeScript, Ant Design, CSS, Jest.

---

### Task 1: 添加回归测试

**Files:**
- Modify: `src/renderer/components/__tests__/ContentFocusView.toolbar.test.ts`
- Create: `src/renderer/components/__tests__/ContentFocusView.overlay-layer.test.ts`

- [ ] 写测试断言专注模式滚动容器和工具栏具有吸顶所需的结构。
- [ ] 写测试断言 `TodoForm` Modal 与 `TodoViewDrawer` Drawer 声明 body 挂载和高于 sticky 工具栏的 `zIndex`。
- [ ] 运行相关测试并确认新增断言在当前实现上失败。

### Task 2: 修复专注模式吸顶样式

**Files:**
- Modify: `src/renderer/styles/global.css`

- [ ] 让滚动容器建立明确的 sticky 参考边界、背景和层级变量。
- [ ] 确保工具栏占满吸顶覆盖区域，不被正文内容透过或被后续待办遮挡。
- [ ] 保持响应式布局与现有编辑器滚动行为不变。

### Task 3: 修复新增与详情浮层层级

**Files:**
- Modify: `src/renderer/components/TodoForm.tsx`
- Modify: `src/renderer/components/TodoViewDrawer.tsx`

- [ ] 为 Modal 与 Drawer 设置统一的浮层层级，高于专注模式工具栏。
- [ ] 设置 `getContainer={() => document.body}`，避免父级层叠上下文限制浮层。
- [ ] 保留调用方的其它 props 和关闭、销毁行为。

### Task 4: 验证

**Files:**
- No additional files.

- [ ] 运行专注模式相关测试。
- [ ] 运行 renderer 构建，确认 TypeScript 和 webpack 编译通过。
- [ ] 检查最终 diff，仅包含规格、计划、回归测试和本次 UI 修复。

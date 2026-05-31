# 中文输入法冲突问题修复总结

## 问题描述

### 第一阶段问题（已修复）
**Bug症状**：在紧凑模式下输入中文内容时，过了大概2-3秒，光标自动回到最后，输入的中文变成了拼音。

**根本原因**：`useCompactTodoEdit` hook 的防抖保存机制在1秒后自动触发保存，但没有检查中文输入法的组合状态（IME Composition）。

### 第二阶段问题（本次修复）
**Bug症状**：输入过程不会被打断了，但输入完成后，已经确认的中文会在1-2秒后突然变回拼音。

**根本原因**：`useCompactTodoEdit` hook 中存在竞态条件：
1. 用户输入中文并确认，`editedTitle` 更新为 "中文"
2. 防抖定时器触发保存，调用 `saveTitle()`
3. 保存成功后立即执行 `setIsEditing(false)`
4. 触发 `useEffect`，因为 `!isEditing` 为 true
5. **问题点**：此时 `initialTitle` prop 可能还是旧值（拼音），useEffect 执行 `setEditedTitle(initialTitle)`，导致中文被拼音覆盖

**为什么会有这个竞态**：
- `useCompactTodoEdit` 缺少 `lastSavedTitleRef` 来追踪最后保存的值
- useEffect 无法区分"外部真正的更新"和"自己刚保存的值"
- 依赖 `initialTitle` prop 的更新时机，但 prop 更新可能滞后

## 修复方案

### 第一阶段修复：添加输入法状态追踪

复用 `ContentFocusView.tsx` 中已验证的输入法处理模式，在 `useCompactTodoEdit` hook 中添加输入法状态追踪。

**修改内容**：
- 添加 `isComposingRef` 用于追踪输入法状态
- 在 `handleChange` 的防抖保存逻辑中检查输入法状态
- 在 `handleBlur` 中延迟保存，等待输入法确认
- 新增 `handleCompositionStart` 和 `handleCompositionEnd` 事件处理器

### 第二阶段修复：添加 lastSavedTitleRef 避免竞态条件

参考 `ContentFocusView.tsx` 中已验证的正确实现模式（第145-154行），修复 `useCompactTodoEdit` hook。

**核心改进**：
1. **添加 `lastSavedTitleRef`**：追踪最后成功保存的标题值
2. **修改 useEffect 同步逻辑**：只在外部真正更新且不在编辑时才同步
3. **修改 saveTitle 函数**：保存成功后立即更新 `lastSavedTitleRef.current`
4. **修改比较逻辑**：使用 `lastSavedTitleRef.current` 而不是 `initialTitle` 进行比较

### 修改文件

#### 1. `src/renderer/hooks/useCompactTodoEdit.ts`

**第一阶段修改**：
```typescript
// 第23行：添加输入法状态追踪
const isComposingRef = useRef(false);

// 第78-84行：防抖保存前检查输入法状态
saveTimeoutRef.current = setTimeout(() => {
  if (isComposingRef.current) {
    return; // 如果正在使用输入法，跳过保存
  }
  saveTitle();
}, 1000);

// 第87-102行：失去焦点时延迟保存
const handleBlur = useCallback(() => {
  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

  if (isComposingRef.current) {
    setTimeout(() => {
      if (!isComposingRef.current) {
        saveTitle();
      }
    }, 100);
  } else {
    saveTitle();
  }
}, [saveTitle]);

// 第118-124行：输入法事件处理器
const handleCompositionStart = useCallback(() => {
  isComposingRef.current = true;
}, []);

const handleCompositionEnd = useCallback(() => {
  isComposingRef.current = false;
}, []);
```

**第二阶段修改**：
```typescript
// 第24行：添加 lastSavedTitleRef
const lastSavedTitleRef = useRef(initialTitle);

// 第26-34行：修改 useEffect 同步逻辑
useEffect(() => {
  const isCurrentlyEditing = editedTitle !== lastSavedTitleRef.current;
  
  if (initialTitle !== lastSavedTitleRef.current && !isSaving && !isCurrentlyEditing) {
    setEditedTitle(initialTitle);
    lastSavedTitleRef.current = initialTitle;
  }
}, [initialTitle, isSaving, editedTitle]);

// 第47-68行：修改 saveTitle 函数
const saveTitle = useCallback(async () => {
  if (!todoId) return;

  const trimmedTitle = validateTitle(editedTitle);
  if (trimmedTitle === lastSavedTitleRef.current) { // 改用 ref 比较
    setIsEditing(false);
    return;
  }

  setIsSaving(true);
  try {
    await onUpdate(todoId, { title: trimmedTitle });
    lastSavedTitleRef.current = trimmedTitle; // 保存成功后立即更新 ref
    setEditedTitle(trimmedTitle); // 确保状态一致
    setIsEditing(false);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
    setEditedTitle(lastSavedTitleRef.current); // 恢复到最后保存的值
  } finally {
    setIsSaving(false);
  }
}, [todoId, editedTitle, onUpdate, validateTitle]);

// 第104-111行：修改 Escape 逻辑
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (e.key === 'Escape') {
    setEditedTitle(lastSavedTitleRef.current); // 改用 ref
    setIsEditing(false);
  } else if (e.key === 'Enter') {
    saveTitle();
  }
}, [saveTitle]);
```

#### 2. `src/renderer/components/CompactTodoItem.tsx`

**修改内容**：
- 从 hook 中解构新的事件处理器
- 在 input 元素上绑定 `onCompositionStart` 和 `onCompositionEnd` 事件

**关键代码**：
```typescript
// 第52-66行：解构新的事件处理器
const {
  isEditing,
  editedTitle,
  isSaving,
  handleChange,
  handleBlur,
  handleKeyDown,
  handleClick,
  handleCompositionStart, // 新增
  handleCompositionEnd,   // 新增
} = useCompactTodoEdit({...});

// 第266-279行：绑定输入法事件
<input
  ref={inputRef}
  type="text"
  value={editedTitle}
  onChange={handleChange}
  onBlur={handleBlur}
  onKeyDown={handleKeyDown}
  onClick={handleClick}
  onCompositionStart={handleCompositionStart} // 新增
  onCompositionEnd={handleCompositionEnd}     // 新增
  style={titleInputStyle}
  disabled={isSaving}
  placeholder="输入待办标题..."
/>
```

## 技术细节

### Composition Events API
使用标准的 Web API 来追踪输入法状态：
- `compositionstart`：输入法开始组合时触发
- `compositionend`：输入法完成组合时触发

### 防御性编程
在所有可能触发保存的路径都检查输入法状态：
1. **防抖保存**（1秒后）：检查 `isComposingRef.current`，如果为 true 则跳过
2. **失去焦点保存**：如果正在组合，延迟100ms后再次检查
3. **Enter键保存**：直接调用 `saveTitle()`（用户主动确认）

### 兼容性保证
- 不改变 hook 的现有接口结构，只是新增两个可选的事件处理器
- 如果调用方不绑定 composition 事件，hook 仍然能正常工作（只是没有输入法保护）
- 英文输入场景不触发 composition 事件，防抖保存正常工作

## 测试建议

### 手动测试场景
1. **中文输入测试**：
   - 在紧凑模式下点击待办标题
   - 使用中文输入法（搜狗、微软拼音等）输入中文
   - 观察是否还会出现"光标回到最后，中文变拼音"的问题
   - 预期：输入流畅，不会被打断

2. **英文输入测试**：
   - 在紧凑模式下输入英文标题
   - 等待1秒后观察是否自动保存
   - 预期：防抖保存正常工作

3. **快速切换测试**：
   - 快速在多个待办之间切换编辑
   - 观察状态是否正确重置
   - 预期：无异常，状态正确

4. **快捷键测试**：
   - 在输入法组合过程中按 Escape
   - 在输入法组合过程中按 Enter
   - 预期：Escape 取消编辑，Enter 保存（如果不在组合状态）

5. **失去焦点测试**：
   - 在输入法组合过程中点击其他区域
   - 预期：延迟保存，等待输入法确认

### 边界条件
- 用户输入中文时，1秒内不应触发保存
- 用户输入中文后确认（compositionEnd），应该正常保存
- 用户输入英文时，1秒后应该正常保存
- 用户在输入法组合过程中失去焦点，应该延迟保存

## 参考实现

本次修复参考了项目中已有的最佳实践：
- `src/renderer/components/ContentFocusView.tsx` (第73行、第704-705行、第205-207行)
- `src/renderer/components/InlineEditPanel.tsx` (第238-244行)

这些组件已经实现了完整的输入法处理逻辑，本次修复将相同的模式应用到紧凑视图中。

## 影响范围

- **直接影响**：紧凑模式下的标题编辑
- **不受影响**：其他编辑组件（ContentFocusView、InlineEditPanel、TodoForm）都有独立的实现
- **向下兼容**：不改变现有接口，完全向下兼容

## 长期扩展性

- ✅ 支持所有输入法（中文、日文、韩文等）
- ✅ 可以轻松提取为独立 hook（如 `useIMEComposition`）复用
- ✅ 支持更复杂的保存策略扩展

## 修复时间

2026-05-30

## 修复人员

Claude Code (Sonnet 4.6)

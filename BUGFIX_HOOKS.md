# React Hooks 错误修复

## 🐛 问题描述

在点击查看待办详情页时出现以下错误：

```
Warning: React has detected a change in the order of Hooks called by TodoViewDrawer. 
This will lead to bugs and errors if not fixed.

Previous render            Next render
------------------------------------------------------
1. useState                   useState
2. useEffect                  useEffect
3. undefined                  useMemo
```

## 🔍 问题原因

在 `TodoViewDrawer.tsx` 中，`useMemo` Hook 在条件返回语句 `if (!todo) return null;` **之后**调用，违反了 React Hooks 的规则：

### ❌ 错误的代码结构

```tsx
const TodoViewDrawer: React.FC<TodoViewDrawerProps> = ({ ... }) => {
  const colors = useThemeColors();
  
  if (!todo) return null;  // ⚠️ 提前返回
  
  // ... 其他函数 ...
  
  const renderContentWithImagePreview = useMemo(() => {  // ❌ Hook 在条件语句之后
    // ...
  }, [todo.content, colors.contentBg]);
  
  // ...
};
```

### React Hooks 规则

根据 [React Hooks 规则](https://reactjs.org/link/rules-of-hooks)：

1. **只在最顶层使用 Hook**
   - 不要在循环、条件或嵌套函数中调用 Hook
   - 确保 Hook 在每次渲染时都以相同的顺序被调用

2. **只在 React 函数中调用 Hook**
   - 在 React 函数组件中调用
   - 在自定义 Hook 中调用

## ✅ 解决方案

将所有 Hooks（包括 `useMemo` 和 `useCallback`）移到条件返回语句**之前**：

### ✅ 正确的代码结构

```tsx
const TodoViewDrawer: React.FC<TodoViewDrawerProps> = ({ ... }) => {
  // 1. 所有 Hooks 必须在最顶层
  const colors = useThemeColors();
  
  // 2. 使用 useCallback 包装事件处理函数
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      e.preventDefault();
      const href = target.getAttribute('href');
      if (href) {
        window.electronAPI.openExternal(href);
      }
    }
  }, []);

  // 3. useMemo 在所有 Hooks 之后，条件返回之前
  const renderContentWithImagePreview = useMemo(() => {
    if (!todo || !todo.content) return null;  // ✅ 在 useMemo 内部做条件判断
    // ...
  }, [todo?.content, colors.contentBg, handleContentClick]);
  
  // 4. 条件返回在所有 Hooks 之后
  if (!todo) return null;
  
  // 5. 其他普通函数和渲染逻辑
  // ...
};
```

## 🔧 具体修改

### 1. 添加 `useCallback` 导入

```tsx
import React, { useMemo, useCallback } from 'react';
```

### 2. 将 `handleContentClick` 改为 `useCallback`

避免每次渲染时创建新函数，导致 `useMemo` 失效：

```tsx
const handleContentClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
  const target = e.target as HTMLElement;
  if (target.tagName === 'A') {
    e.preventDefault();
    const href = target.getAttribute('href');
    if (href) {
      window.electronAPI.openExternal(href);
    }
  }
}, []);
```

### 3. 将 `useMemo` 移到条件返回之前

```tsx
const renderContentWithImagePreview = useMemo(() => {
  if (!todo || !todo.content) return null;  // 安全检查
  // ... 其他逻辑
}, [todo?.content, colors.contentBg, handleContentClick]);

// 所有 Hooks 之后才能条件返回
if (!todo) return null;
```

### 4. 使用可选链操作符

在依赖数组中使用 `todo?.content` 而不是 `todo.content`，避免在 `todo` 为 `null` 时出错：

```tsx
}, [todo?.content, colors.contentBg, handleContentClick]);
```

## 📊 影响范围

- **修改文件**: `src/renderer/components/TodoViewDrawer.tsx`
- **影响功能**: 
  - ✅ 查看待办详情页
  - ✅ 图片点击放大预览
  - ✅ 外部链接在浏览器打开

## ✅ 验证结果

修复后：
- ✅ 无 React Hooks 警告
- ✅ 详情页正常显示
- ✅ 图片预览功能正常
- ✅ 外部链接正常打开
- ✅ 0 个 Linting 错误

## 📚 学习要点

### Hooks 调用顺序的重要性

React 依赖 Hooks 的调用顺序来正确关联每个 Hook 的状态：

```tsx
// 第一次渲染
useState()    // Hook 1
useEffect()   // Hook 2
useMemo()     // Hook 3

// 第二次渲染 - 必须保持相同顺序
useState()    // Hook 1
useEffect()   // Hook 2
useMemo()     // Hook 3  ✅
```

如果顺序改变：

```tsx
// 第一次渲染（todo 为 null）
useState()    // Hook 1
useEffect()   // Hook 2
return null   // 提前返回，没有调用 useMemo

// 第二次渲染（todo 有值）
useState()    // Hook 1
useEffect()   // Hook 2
useMemo()     // Hook 3  ❌ 顺序不一致！
```

### 最佳实践

1. **所有 Hooks 在组件顶部调用**
2. **永远不要在条件语句之后调用 Hooks**
3. **使用 `useCallback` 包装事件处理函数**
4. **使用可选链（`?.`）处理可能为空的依赖**
5. **在 Hook 内部做条件判断，而不是在外部**

## 🚀 部署状态

- **提交哈希**: db90ee5
- **提交信息**: fix: 修复 TodoViewDrawer React Hooks 顺序错误
- **推送时间**: 2025-10-22
- **状态**: ✅ 已推送到 GitHub
- **构建**: 🚀 GitHub Actions 自动构建中

查看构建状态：https://github.com/bulubulu138/MultiTodoApp/actions

---

**问题已解决！** 🎉


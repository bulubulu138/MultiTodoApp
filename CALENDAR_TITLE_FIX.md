# 日历待办列表标题颜色修复

## 完成时间
2025-10-19

## 问题描述

在light模式下，日历视图左侧的待办列表大标题（"逾期的待办"、"开始的待办"、"截止的待办"）显示为白色文字，导致在白色背景下不可见。

## 根本原因

在 `CalendarDrawer.tsx` 中，三个待办列表标题的文字颜色被硬编码为 `#ffffff`（白色）：
- 第223行：逾期的待办标题
- 第276行：开始的待办标题
- 第328行：截止的待办标题

这导致：
- **Dark模式**：白色文字 + 深色背景 = ✅ 正常显示
- **Light模式**：白色文字 + 白色背景 = ❌ 不可见

## 解决方案

### 1. 扩展 useThemeColors Hook

在 `useThemeColors.ts` 中添加 `textColor` 属性：

```typescript
export interface ThemeColors {
  // ... 其他颜色
  textColor: string;  // 新增
}

return {
  // ... 其他颜色
  textColor: isDark ? '#ffffff' : '#000000',  // 根据主题自动调整
};
```

### 2. 更新 CalendarDrawer 组件

将硬编码的白色文字替换为动态颜色：

**修改前：**
```tsx
<Text strong style={{ fontSize: 14, color: '#ffffff' }}>
```

**修改后：**
```tsx
<Text strong style={{ fontSize: 14, color: colors.textColor }}>
```

应用到三个标题：
- 逾期的待办标题（第223行）
- 开始的待办标题（第276行）
- 截止的待办标题（第328行）

## 修改文件

1. `MultiTodoApp/src/renderer/hooks/useThemeColors.ts`
   - 添加 `textColor` 到 `ThemeColors` 接口
   - 添加 `textColor` 到返回值

2. `MultiTodoApp/src/renderer/components/CalendarDrawer.tsx`
   - 修改三处标题颜色，使用 `colors.textColor`

## 测试结果

✅ TypeScript编译通过
✅ Webpack构建成功
✅ 无linter错误
✅ 应用正常启动

## 效果

- **Light模式**：黑色文字 + 白色背景 = ✅ 清晰可见
- **Dark模式**：白色文字 + 深色背景 = ✅ 清晰可见

标题文字现在会根据主题自动调整颜色，确保在任何模式下都清晰可读。

## 技术要点

1. **动态主题适配**：使用 `useThemeColors` hook 实时监听主题变化
2. **统一管理**：所有主题相关颜色集中在一个hook中管理
3. **类型安全**：TypeScript接口确保颜色属性的类型安全
4. **自动更新**：通过 `MutationObserver` 监听 `data-theme` 属性变化，自动更新颜色

## 相关修复

此修复与之前的深色模式优化一致，采用"动态颜色 + 可读性优先"的策略，确保UI在不同主题下都有良好的可读性。


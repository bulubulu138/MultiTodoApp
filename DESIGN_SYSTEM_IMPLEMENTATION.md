# 设计系统实施指南

本指南将帮助你逐步将新的设计系统应用到 MultiTodoApp 项目中。

## 📋 目录

1. [已完成的工作](#已完成的工作)
2. [实施步骤](#实施步骤)
3. [组件迁移清单](#组件迁移清单)
4. [测试建议](#测试建议)
5. [常见问题](#常见问题)

---

## ✅ 已完成的工作

### 1. 设计系统基础
- ✅ `design-tokens.css` - 设计令牌（颜色、间距、字体等）
- ✅ `design-system.css` - 设计系统配置和工具类
- ✅ `animations.css` - 动画配置
- ✅ 更新了 `global.css` 以引入设计系统

### 2. 组件样式模板
已创建以下组件的现代化样式模板：
- ✅ `Toolbar.module.css` - 工具栏样式
- ✅ `TodoCard.module.css` - 待办卡片样式
- ✅ `Button.module.css` - 按钮样式
- ✅ `Modal.module.css` - 模态框/抽屉样式
- ✅ `Input.module.css` - 表单输入样式

### 3. 字体配置
- ✅ 在 `index.html` 中引入 Google Fonts (Inter)

---

## 🚀 实施步骤

### 阶段 1: 验证基础设施（立即执行）

1. **启动开发服务器**
   ```bash
   npm run dev
   ```

2. **检查样式加载**
   - 打开浏览器开发者工具
   - 检查 Network 标签，确认所有 CSS 文件都成功加载
   - 检查 Console，确认没有 CSS 相关错误

3. **验证 CSS 变量**
   在浏览器控制台运行：
   ```javascript
   getComputedStyle(document.documentElement).getPropertyValue('--color-primary')
   ```
   应该返回主色值（如 `#1890ff`）

### 阶段 2: 逐步迁移组件（推荐顺序）

#### 2.1 迁移 Toolbar 组件

**文件**: `src/renderer/components/Toolbar.tsx`

**步骤**:
1. 导入新样式：
   ```typescript
   import styles from './Toolbar.module.css';
   ```

2. 替换现有的 className：
   ```typescript
   // 旧代码
   <div className="toolbar">
   
   // 新代码
   <div className={styles.toolbar}>
   ```

3. 更新所有子元素的 className

4. 测试功能：
   - 所有按钮是否可点击
   - 悬停效果是否正常
   - 响应式布局是否正常

#### 2.2 迁移 Button 组件

**文件**: 创建 `src/renderer/components/Button.tsx`（如果不存在）

**示例代码**:
```typescript
import React from 'react';
import styles from './Button.module.css';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'medium',
  icon,
  loading,
  disabled,
  onClick,
  className,
}) => {
  const buttonClass = [
    styles.button,
    styles[variant],
    styles[size],
    loading && styles.loading,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      className={buttonClass}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <span className={styles.loadingSpinner}>⏳</span>}
      <span className={styles.buttonContent}>
        {icon && <span className={styles.icon}>{icon}</span>}
        {children}
      </span>
    </button>
  );
};
```

#### 2.3 迁移 TodoCard 组件

**文件**: `src/renderer/components/DragDropTodoList.tsx` 或相关组件

**步骤**:
1. 导入样式：
   ```typescript
   import cardStyles from './TodoCard.module.css';
   ```

2. 更新卡片渲染逻辑：
   ```typescript
   <div className={`${cardStyles.card} ${todo.completed ? cardStyles.completed : ''}`}>
     <div className={cardStyles.cardBody}>
       <div className={cardStyles.header}>
         <Checkbox className={cardStyles.checkbox} />
         <div className={cardStyles.titleSection}>
           <h3 className={cardStyles.title}>{todo.title}</h3>
         </div>
       </div>
       {todo.content && (
         <div className={cardStyles.content}>{todo.content}</div>
       )}
       <div className={cardStyles.metadata}>
         {/* 元数据项 */}
       </div>
     </div>
   </div>
   ```

#### 2.4 迁移 Modal/Dialog 组件

**文件**: 创建或更新模态框组件

**示例代码**:
```typescript
import React from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  visible: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  title,
  children,
  onClose,
  footer,
  size = 'medium',
}) => {
  if (!visible) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div 
        className={`${styles.modal} ${styles[size]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.closeButton} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.content}>
          {children}
        </div>
        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
```

#### 2.5 迁移 Input/Form 组件

**文件**: 创建或更新表单组件

**示例代码**:
```typescript
import React from 'react';
import styles from './Input.module.css';

interface InputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'number';
  size?: 'small' | 'medium' | 'large';
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  size = 'medium',
  error,
  required,
  disabled,
}) => {
  return (
    <div className={styles.formGroup}>
      {label && (
        <label className={`${styles.label} ${required ? styles.required : ''}`}>
          {label}
        </label>
      )}
      <div className={styles.inputWrapper}>
        <input
          className={`${styles.input} ${styles[size]} ${error ? styles.error : ''}`}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
      {error && (
        <span className={styles.errorText}>⚠️ {error}</span>
      )}
    </div>
  );
};
```

### 阶段 3: 主题切换功能

**文件**: `src/renderer/App.tsx`

**添加主题切换逻辑**:
```typescript
import { useEffect, useState } from 'react';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // 从本地存储读取主题
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <div className="app">
      <button onClick={toggleTheme}>
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      {/* 其他内容 */}
    </div>
  );
}
```

---

## 📝 组件迁移清单

使用此清单跟踪迁移进度：

### 核心组件
- [ ] Toolbar
- [ ] TodoCard
- [ ] Button
- [ ] Modal/Dialog
- [ ] Input/Form
- [ ] CalendarDrawer
- [ ] Sidebar
- [ ] Header

### 次要组件
- [ ] Dropdown
- [ ] Tooltip
- [ ] Badge
- [ ] Tag
- [ ] Avatar
- [ ] Progress
- [ ] Notification

### 页面级组件
- [ ] TodoList
- [ ] TodoDetail
- [ ] Settings
- [ ] About

---

## 🧪 测试建议

### 视觉测试
1. **颜色一致性**
   - 检查所有组件是否使用设计令牌中的颜色
   - 验证深色主题下的颜色对比度

2. **间距一致性**
   - 检查组件间距是否符合设计系统
   - 验证响应式布局

3. **动画流畅性**
   - 测试所有交互动画
   - 确保动画性能良好（60fps）

### 功能测试
1. **交互测试**
   - 所有按钮可点击
   - 表单输入正常
   - 模态框打开/关闭正常

2. **响应式测试**
   - 在不同屏幕尺寸下测试
   - 移动端触摸交互

3. **无障碍测试**
   - 键盘导航
   - 屏幕阅读器支持
   - 焦点管理

### 性能测试
1. **加载性能**
   - CSS 文件大小
   - 首次渲染时间

2. **运行时性能**
   - 动画帧率
   - 内存使用

---

## ❓ 常见问题

### Q1: 如何处理现有的内联样式？
**A**: 逐步迁移到 CSS 模块。优先迁移静态样式，动态样式可以使用 CSS 变量：
```typescript
<div style={{ color: 'var(--color-primary)' }}>
```

### Q2: 如何处理 Ant Design 组件的样式？
**A**: 使用 Ant Design 的主题定制功能：
```typescript
import { ConfigProvider } from 'antd';

<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1890ff',
      borderRadius: 12,
      // 其他令牌
    },
  }}
>
  {/* 应用内容 */}
</ConfigProvider>
```

### Q3: 如何确保样式不冲突？
**A**: 
1. 使用 CSS 模块（`.module.css`）
2. 避免全局样式
3. 使用 BEM 命名约定作为后备

### Q4: 如何处理动画性能问题？
**A**:
1. 只对 `transform` 和 `opacity` 应用动画
2. 使用 `will-change` 提示浏览器
3. 避免在大量元素上同时应用动画

### Q5: 深色主题如何测试？
**A**:
1. 在浏览器控制台运行：
   ```javascript
   document.documentElement.setAttribute('data-theme', 'dark')
   ```
2. 或添加主题切换按钮

---

## 📚 参考资源

- [CSS 变量文档](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [CSS 模块文档](https://github.com/css-modules/css-modules)
- [Ant Design 主题定制](https://ant.design/docs/react/customize-theme)
- [Web 动画性能](https://web.dev/animations/)

---

## 🎯 下一步

1. **立即执行**: 验证基础设施（阶段 1）
2. **本周**: 迁移核心组件（Toolbar, Button, TodoCard）
3. **下周**: 迁移次要组件和页面级组件
4. **持续**: 测试和优化

---

## 💡 提示

- **渐进式迁移**: 不要一次性迁移所有组件，逐个迁移并测试
- **保留备份**: 在迁移前创建 git 分支
- **文档更新**: 迁移完成后更新组件文档
- **团队沟通**: 与团队成员分享迁移进度

---

**需要帮助？** 如果在实施过程中遇到问题，请参考本指南或查看已创建的样式模板。

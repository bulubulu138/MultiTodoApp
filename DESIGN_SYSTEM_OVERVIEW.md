# MultiTodoApp 设计系统概览

## 🎨 设计系统架构

本设计系统采用现代化的设计理念，提供一致、可扩展、易维护的UI组件库。

---

## 📁 文件结构

```
src/renderer/styles/
├── design-tokens.css          # 设计令牌（颜色、间距、字体等）
├── design-system.css          # 设计系统配置和工具类
├── animations.css             # 动画配置
└── global.css                 # 全局样式（引入上述文件）

src/renderer/components/
├── Toolbar.module.css         # 工具栏样式
├── TodoCard.module.css        # 待办卡片样式
├── Button.module.css          # 按钮样式
├── Modal.module.css           # 模态框/抽屉样式
└── Input.module.css           # 表单输入样式
```

---

## 🎯 核心概念

### 1. 设计令牌（Design Tokens）

设计令牌是设计系统的基础，定义了所有可重用的设计值。

#### 颜色系统
```css
/* 主色 */
--color-primary: #1890ff;
--color-primary-hover: #40a9ff;
--color-primary-active: #096dd9;
--color-primary-lighter: rgba(24, 144, 255, 0.1);

/* 语义色 */
--color-success: #52c41a;
--color-warning: #faad14;
--color-error: #ff4d4f;
--color-info: #1890ff;

/* 中性色 */
--color-text-primary: #262626;
--color-text-secondary: #595959;
--color-text-tertiary: #8c8c8c;
```

#### 间距系统
```css
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 12px;
--spacing-lg: 16px;
--spacing-xl: 24px;
--spacing-2xl: 32px;
--spacing-3xl: 48px;
```

#### 字体系统
```css
/* 字体家族 */
--font-body: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* 字体大小 */
--font-size-xs: 12px;
--font-size-sm: 13px;
--font-size-base: 14px;
--font-size-md: 15px;
--font-size-lg: 16px;
--font-size-xl: 18px;
--font-size-2xl: 20px;
--font-size-3xl: 24px;

/* 字重 */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

#### 圆角系统
```css
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-2xl: 24px;
--radius-full: 9999px;
```

#### 阴影系统
```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);
```

### 2. 动画系统

#### 缓动函数
```css
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
```

#### 持续时间
```css
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 350ms;
--duration-slower: 500ms;
```

#### 预设动画
- `fadeIn` / `fadeOut` - 淡入淡出
- `slideUp` / `slideDown` - 上下滑动
- `slideInLeft` / `slideInRight` - 左右滑入
- `scaleIn` / `scaleOut` - 缩放
- `spin` - 旋转
- `bounce` - 弹跳
- `shake` - 抖动
- `pulse` - 脉冲

### 3. 主题系统

支持亮色和暗色两种主题，通过 `data-theme` 属性切换：

```typescript
// 切换到暗色主题
document.documentElement.setAttribute('data-theme', 'dark');

// 切换到亮色主题
document.documentElement.setAttribute('data-theme', 'light');
```

---

## 🧩 组件样式

### Toolbar（工具栏）

**特性**:
- 现代化的玻璃态效果
- 响应式布局
- 支持多种按钮样式
- 流畅的悬停动画

**使用示例**:
```typescript
import styles from './Toolbar.module.css';

<div className={styles.toolbar}>
  <button className={styles.iconButton}>
    <span className={styles.icon}>+</span>
  </button>
</div>
```

### TodoCard（待办卡片）

**特性**:
- 优雅的卡片设计
- 支持拖拽
- 多种状态（正常、完成、逾期）
- 优先级标识
- 标签系统

**使用示例**:
```typescript
import styles from './TodoCard.module.css';

<div className={`${styles.card} ${todo.completed ? styles.completed : ''}`}>
  <div className={styles.cardBody}>
    <div className={styles.header}>
      <h3 className={styles.title}>{todo.title}</h3>
    </div>
  </div>
</div>
```

### Button（按钮）

**特性**:
- 多种变体（primary, secondary, ghost, danger）
- 三种尺寸（small, medium, large）
- 加载状态
- 图标支持
- 涟漪效果

**使用示例**:
```typescript
import styles from './Button.module.css';

<button className={`${styles.button} ${styles.primary} ${styles.medium}`}>
  确认
</button>
```

### Modal（模态框）

**特性**:
- 优雅的进入/退出动画
- 背景模糊效果
- 多种尺寸
- 支持 Drawer（抽屉）模式
- 确认对话框样式

**使用示例**:
```typescript
import styles from './Modal.module.css';

<div className={styles.overlay}>
  <div className={`${styles.modal} ${styles.medium}`}>
    <div className={styles.header}>
      <h2 className={styles.title}>标题</h2>
    </div>
    <div className={styles.content}>内容</div>
    <div className={styles.footer}>
      <button>确认</button>
    </div>
  </div>
</div>
```

### Input（输入框）

**特性**:
- 多种输入类型
- 三种尺寸
- 状态指示（error, success, warning）
- 前缀/后缀支持
- 清除按钮
- 密码可见性切换
- 复选框、单选框、开关
- 文件上传

**使用示例**:
```typescript
import styles from './Input.module.css';

<div className={styles.formGroup}>
  <label className={styles.label}>用户名</label>
  <input 
    className={`${styles.input} ${styles.medium}`}
    placeholder="请输入用户名"
  />
</div>
```

---

## 🛠️ 工具类

设计系统提供了一系列工具类，用于快速构建UI：

### 布局工具类
```css
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.gap-sm { gap: var(--spacing-sm); }
```

### 间距工具类
```css
.p-sm { padding: var(--spacing-sm); }
.m-lg { margin: var(--spacing-lg); }
.mt-xl { margin-top: var(--spacing-xl); }
```

### 文本工具类
```css
.text-primary { color: var(--color-text-primary); }
.text-sm { font-size: var(--font-size-sm); }
.font-bold { font-weight: var(--font-weight-bold); }
```

### 背景工具类
```css
.bg-surface { background: var(--color-surface); }
.bg-primary { background: var(--color-primary); }
```

### 边框工具类
```css
.border { border: 1px solid var(--color-border); }
.rounded-lg { border-radius: var(--radius-lg); }
```

### 阴影工具类
```css
.shadow-sm { box-shadow: var(--shadow-sm); }
.shadow-md { box-shadow: var(--shadow-md); }
```

---

## 📱 响应式设计

设计系统内置响应式断点：

```css
/* 移动设备 */
@media (max-width: 768px) { }

/* 平板设备 */
@media (min-width: 769px) and (max-width: 1024px) { }

/* 桌面设备 */
@media (min-width: 1025px) { }
```

---

## ♿ 无障碍支持

设计系统遵循 WCAG 2.1 AA 标准：

- **颜色对比度**: 所有文本颜色都满足 4.5:1 的对比度要求
- **键盘导航**: 所有交互元素支持键盘操作
- **焦点指示**: 清晰的焦点样式
- **语义化HTML**: 使用正确的HTML标签
- **ARIA属性**: 适当使用ARIA属性增强可访问性

---

## 🎨 设计原则

### 1. 一致性
- 使用统一的设计令牌
- 保持组件行为一致
- 统一的视觉语言

### 2. 简洁性
- 清晰的视觉层次
- 避免不必要的装饰
- 专注于内容

### 3. 响应性
- 适配不同屏幕尺寸
- 流畅的动画和交互
- 快速的响应时间

### 4. 可访问性
- 支持键盘导航
- 屏幕阅读器友好
- 高对比度支持

### 5. 可扩展性
- 模块化设计
- 易于定制
- 向后兼容

---

## 🚀 快速开始

### 1. 引入设计系统

设计系统已在 `global.css` 中引入，无需额外配置。

### 2. 使用设计令牌

在你的组件样式中使用CSS变量：

```css
.myComponent {
  color: var(--color-text-primary);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}
```

### 3. 使用组件样式

导入并使用预定义的组件样式：

```typescript
import styles from './Button.module.css';

<button className={`${styles.button} ${styles.primary}`}>
  点击我
</button>
```

### 4. 使用工具类

直接在HTML中使用工具类：

```typescript
<div className="flex items-center gap-md">
  <span className="text-primary font-bold">标题</span>
</div>
```

---

## 📊 性能优化

### CSS优化
- 使用CSS变量减少重复代码
- CSS模块避免样式冲突
- 最小化CSS文件大小

### 动画优化
- 只对 `transform` 和 `opacity` 应用动画
- 使用 `will-change` 提示浏览器
- 避免布局抖动

### 加载优化
- 字体预加载
- CSS文件合并
- 按需加载组件样式

---

## 🔧 定制化

### 修改设计令牌

在 `design-tokens.css` 中修改变量值：

```css
:root {
  --color-primary: #your-color;
  --spacing-md: 16px;
  /* 其他令牌 */
}
```

### 扩展组件样式

创建新的组件样式文件，继承设计系统：

```css
/* MyComponent.module.css */
.myComponent {
  /* 使用设计令牌 */
  padding: var(--spacing-lg);
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  
  /* 自定义样式 */
  /* ... */
}
```

### 添加新的工具类

在 `design-system.css` 中添加：

```css
.my-utility {
  /* 样式 */
}
```

---

## 📚 最佳实践

### 1. 优先使用设计令牌
```css
/* ✅ 好 */
.component {
  color: var(--color-text-primary);
}

/* ❌ 避免 */
.component {
  color: #262626;
}
```

### 2. 使用CSS模块
```typescript
/* ✅ 好 */
import styles from './Component.module.css';
<div className={styles.container} />

/* ❌ 避免 */
<div className="container" />
```

### 3. 保持样式可组合
```typescript
/* ✅ 好 */
<button className={`${styles.button} ${styles.primary} ${styles.large}`} />

/* ❌ 避免 */
<button className={styles.primaryLargeButton} />
```

### 4. 避免内联样式
```typescript
/* ✅ 好 */
<div className={styles.container} />

/* ❌ 避免（除非是动态值）*/
<div style={{ padding: '16px' }} />
```

---

## 🐛 故障排除

### 样式不生效
1. 检查CSS文件是否正确导入
2. 检查类名是否正确
3. 检查CSS模块是否正确配置

### 主题切换不工作
1. 检查 `data-theme` 属性是否正确设置
2. 检查暗色主题样式是否定义

### 动画卡顿
1. 检查是否只对 `transform` 和 `opacity` 应用动画
2. 减少同时动画的元素数量
3. 使用 `will-change` 优化

---

## 📖 参考资源

- [CSS变量文档](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)
- [CSS模块文档](https://github.com/css-modules/css-modules)
- [WCAG 2.1指南](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web动画性能](https://web.dev/animations/)

---

## 🤝 贡献指南

### 添加新组件样式
1. 创建 `ComponentName.module.css` 文件
2. 使用设计令牌定义样式
3. 添加响应式样式
4. 添加暗色主题支持
5. 更新文档

### 修改设计令牌
1. 在 `design-tokens.css` 中修改
2. 测试所有组件
3. 更新文档
4. 提交PR

---

## 📝 更新日志

### v1.0.0 (2024-01-XX)
- ✅ 初始设计系统
- ✅ 设计令牌系统
- ✅ 核心组件样式
- ✅ 动画系统
- ✅ 主题系统
- ✅ 工具类系统

---

**设计系统版本**: 1.0.0  
**最后更新**: 2024-01-XX  
**维护者**: MultiTodoApp Team

import { useState, useEffect, useCallback, useRef } from 'react';
import { GlassThemeConfig, getGlassTheme, generateCSSVariables, generateGlassClasses } from '../theme/glassTheme';

export type ThemeMode = 'light' | 'dark';

export const useGlassTheme = (initialMode: ThemeMode = 'light') => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialMode);
  const theme = useRef<GlassThemeConfig>(getGlassTheme(themeMode));
  const styleElement = useRef<HTMLStyleElement | null>(null);

  // 更新主题模式
  const updateThemeMode = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    theme.current = getGlassTheme(mode);
  }, []);

  // 应用主题到 CSS 变量
  const applyTheme = useCallback(() => {
    const root = document.documentElement;
    const variables = generateCSSVariables(theme.current);

    // 设置 CSS 变量
    Object.entries(variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // 设置主题模式类名
    root.setAttribute('data-theme', theme.current.mode);
    root.className = root.className.replace(/theme-(light|dark)/g, '');
    root.classList.add(`theme-${theme.current.mode}`);

    console.log(`[玻璃态主题] 已应用${theme.current.mode}主题`);
  }, []);

  // 获取样式类
  const getClasses = useCallback(() => {
    return generateGlassClasses(theme.current);
  }, []);

  // 检测系统主题偏好
  const detectSystemTheme = useCallback((): ThemeMode => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }, []);

  // 切换到系统主题
  const useSystemTheme = useCallback(() => {
    const systemTheme = detectSystemTheme();
    updateThemeMode(systemTheme);
  }, [detectSystemTheme, updateThemeMode]);

  // 切换主题
  const toggleTheme = useCallback(() => {
    const newMode = themeMode === 'light' ? 'dark' : 'light';
    updateThemeMode(newMode);
  }, [themeMode, updateThemeMode]);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      const newMode = e.matches ? 'dark' : 'light';
      updateThemeMode(newMode);
    };

    // 添加监听器
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // 兼容旧版 API
      mediaQuery.addListener(handleChange);
    }

    // 清理监听器
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [updateThemeMode]);

  // 保存主题设置到本地存储
  useEffect(() => {
    try {
      localStorage.setItem('glassThemeMode', themeMode);
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  }, [themeMode]);

  // 从本地存储加载主题设置
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('glassThemeMode') as ThemeMode | null;
      if (savedMode && (savedMode === 'light' || savedMode === 'dark')) {
        updateThemeMode(savedMode);
      }
    } catch (error) {
      console.error('加载主题设置失败:', error);
    }
  }, [updateThemeMode]);

  // 应用主题
  useEffect(() => {
    applyTheme();
  }, [themeMode, applyTheme]);

  // 初始化 CSS
  useEffect(() => {
    // 创建样式元素
    if (!styleElement.current) {
      styleElement.current = document.createElement('style');
      styleElement.current.id = 'glass-theme-styles';
      document.head.appendChild(styleElement.current);
    }

    // 生成基础样式
    const baseStyles = `
      /* 玻璃态基础样式 */
      :root {
        --glass-transition-base: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
        --glass-border-radius-sm: 6px;
        --glass-border-radius-md: 12px;
        --glass-border-radius-lg: 16px;
        --glass-border-radius-xl: 20px;
      }

      /* 玻璃态卡片通用样式 */
      .glass-card {
        background: var(--glass-surface-primary);
        backdrop-filter: var(--glass-blur-md);
        -webkit-backdrop-filter: var(--glass-blur-md);
        border: 1px solid var(--glass-border-primary);
        box-shadow: var(--glass-shadow-medium);
        border-radius: var(--glass-border-radius-md);
        padding: var(--glass-spacing-md);
        transition: var(--glass-transition-base);
      }

      /* 玻璃态卡片悬停效果 */
      .glass-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--glass-shadow-large);
        border-color: var(--glass-border-secondary);
      }

      /* 玻璃态按钮样式 */
      .glass-button {
        background: var(--glass-surface-secondary);
        backdrop-filter: var(--glass-blur-sm);
        -webkit-backdrop-filter: var(--glass-blur-sm);
        border: 1px solid var(--glass-border-secondary);
        border-radius: var(--glass-border-radius-sm);
        padding: var(--glass-spacing-sm) var(--glass-spacing-md);
        color: var(--glass-text-primary);
        cursor: pointer;
        transition: var(--glass-transition-base);
        font-family: var(--glass-font-family);
        font-weight: var(--glass-font-weight-medium);
      }

      .glass-button:hover {
        transform: translateY(-1px);
        background: var(--glass-surface-primary);
        border-color: var(--glass-border-primary);
        box-shadow: var(--glass-shadow-medium);
      }

      .glass-button:active {
        transform: translateY(0);
        background: var(--glass-surface-tertiary);
      }

      /* 玻璃态输入框样式 */
      .glass-input {
        background: var(--glass-surface-tertiary);
        backdrop-filter: var(--glass-blur-sm);
        -webkit-backdrop-filter: var(--glass-blur-sm);
        border: 1px solid var(--glass-border-tertiary);
        border-radius: var(--glass-border-radius-sm);
        padding: var(--glass-spacing-sm);
        color: var(--glass-text-primary);
        transition: var(--glass-transition-base);
        outline: none;
      }

      .glass-input:focus {
        border-color: var(--glass-primary);
        box-shadow: 0 0 0 3px var(--glass-backdrop-light);
        background: var(--glass-surface-secondary);
      }

      .glass-input::placeholder {
        color: var(--glass-text-tertiary);
      }

      /* 玻璃态模态框背景 */
      .glass-modal-backdrop {
        background: var(--glass-bg-overlay);
        backdrop-filter: var(--glass-blur-lg);
        -webkit-backdrop-filter: var(--glass-blur-lg);
      }

      /* 玻璃态导航栏 */
      .glass-navbar {
        background: var(--glass-surface-primary);
        backdrop-filter: var(--glass-blur-md);
        -webkit-backdrop-filter: var(--glass-blur-md);
        border-bottom: 1px solid var(--glass-border-primary);
      }

      /* 玻璃态侧边栏 */
      .glass-sidebar {
        background: var(--glass-surface-secondary);
        backdrop-filter: var(--glass-blur-md);
        -webkit-backdrop-filter: var(--glass-blur-md);
        border-right: 1px solid var(--glass-border-primary);
      }

      /* 玻璃态标签 */
      .glass-tag {
        background: var(--glass-surface-tertiary);
        backdrop-filter: var(--glass-blur-sm);
        -webkit-backdrop-filter: var(--glass-blur-sm);
        border: 1px solid var(--glass-border-tertiary);
        border-radius: var(--glass-border-radius-sm);
        padding: 2px 8px;
        font-size: 12px;
        color: var(--glass-text-primary);
        display: inline-block;
      }

      /* 玻璃态容器 */
      .glass-container {
        background: var(--glass-bg-primary);
        min-height: 100vh;
        position: relative;
      }

      .glass-container::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: radial-gradient(circle at 20% 50%, var(--glass-backdrop-light) 0%, transparent 50%),
                    radial-gradient(circle at 80% 80%, var(--glass-backdrop-medium) 0%, transparent 50%),
                    radial-gradient(circle at 40% 20%, var(--glass-backdrop-dark) 0%, transparent 50%);
        pointer-events: none;
        z-index: 1;
      }

      .glass-content {
        position: relative;
        z-index: 2;
      }

      /* 响应式设计 */
      @media (max-width: 768px) {
        .glass-card {
          padding: var(--glass-spacing-sm);
          border-radius: var(--glass-border-radius-sm);
        }

        .glass-button {
          padding: var(--glass-spacing-xs) var(--glass-spacing-sm);
          font-size: 14px;
        }

        .glass-input {
          padding: var(--glass-spacing-xs) var(--glass-spacing-sm);
          font-size: 14px;
        }
      }

      /* 暗色主题特定样式 */
      .theme-dark {
        --glass-glow-color: rgba(59, 130, 246, 0.3);
        --glass-text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      }

      /* 浅色主题特定样式 */
      .theme-light {
        --glass-glow-color: rgba(59, 130, 246, 0.15);
        --glass-text-shadow: 0 1px 2px rgba(255, 255, 255, 0.3);
      }

      /* 动画效果 */
      @keyframes glassPulse {
        0%, 100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.8;
          transform: scale(0.98);
        }
      }

      .glass-pulse {
        animation: glassPulse 2s ease-in-out infinite;
      }

      /* 滚动条样式 */
      .glass-scrollbar::-webkit-scrollbar {
        width: 8px;
      }

      .glass-scrollbar::-webkit-scrollbar-track {
        background: var(--glass-surface-tertiary);
        border-radius: var(--glass-border-radius-sm);
      }

      .glass-scrollbar::-webkit-scrollbar-thumb {
        background: var(--glass-border-secondary);
        border-radius: var(--glass-border-radius-sm);
        transition: var(--glass-transition-base);
      }

      .glass-scrollbar::-webkit-scrollbar-thumb:hover {
        background: var(--glass-border-primary);
      }
    `;

    if (styleElement.current) {
      styleElement.current.textContent = baseStyles;
    }
  }, []);

  return {
    themeMode,
    theme: theme.current,
    classes: getClasses(),
    updateThemeMode,
    toggleTheme,
    useSystemTheme,
    applyTheme
  };
};
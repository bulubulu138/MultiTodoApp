import { useEffect, useState } from 'react';

export interface ThemeColors {
  listItemBg: string;
  listItemHoverBg: string;
  listItemOverdueBg: string;
  listItemOverdueHoverBg: string;
  listItemCurrentBg: string;
  contentBg: string;
  borderColor: string;
  textColor: string;
  cardBg: string;
  textPrimary: string;
}

/**
 * 自定义 Hook：获取当前主题的颜色配置
 * 
 * 解决问题：Ant Design 的 theme token 会覆盖内联样式中的 CSS 变量
 * 解决方案：直接返回具体的颜色值，而不是 CSS 变量
 * 
 * 监听 data-theme 属性变化，自动更新颜色
 */
export const useThemeColors = (): ThemeColors => {
  const [isDark, setIsDark] = useState(
    document.documentElement.dataset.theme === 'dark'
  );
  
  useEffect(() => {
    // 使用 MutationObserver 监听 data-theme 属性变化
    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.dataset.theme;
      setIsDark(newTheme === 'dark');
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    return () => observer.disconnect();
  }, []);
  
  // 根据当前主题返回对应的颜色
  return {
    // 列表项背景 - 深色模式下使用浅色（关联上下文卡片用）
    listItemBg: isDark ? '#f5f5f5' : '#fff',
    // 列表项悬停背景
    listItemHoverBg: isDark ? '#262626' : '#f5f5f5',
    // 逾期待办背景
    listItemOverdueBg: isDark ? '#2a1215' : '#fff1f0',
    // 逾期待办悬停背景
    listItemOverdueHoverBg: isDark ? '#3d1a1f' : '#ffe7e6',
    // 当前待办高亮背景 - 深色模式下使用浅蓝色（可读性优先）
    listItemCurrentBg: isDark ? '#e6f7ff' : '#f0f9ff',
    // 内容区域背景 - 深色模式下使用浅色（可读性优先）
    contentBg: isDark ? '#f5f5f5' : '#f5f5f5',
    // 边框颜色
    borderColor: isDark ? '#404040' : '#f0f0f0',
    // 文本颜色 - 根据主题自动调整
    textColor: isDark ? '#ffffff' : '#000000',
    // 卡片背景 - 用于报告等卡片组件
    cardBg: isDark ? '#1f1f1f' : '#ffffff',
    // 主文本颜色 - 用于标题等
    textPrimary: isDark ? '#ffffff' : '#000000',
  };
};


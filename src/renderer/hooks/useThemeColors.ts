import { useEffect, useState, useMemo } from 'react';
import { COLOR_SCHEMES, ColorTheme } from '../theme/themes';

export interface ThemeColors {
  listItemBg: string;
  listItemHoverBg: string;
  listItemOverdueBg: string;
  listItemOverdueHoverBg: string;
  listItemCurrentBg: string;
  contentBg: string;
  panelHeaderBg: string;
  borderColor: string;
  textColor: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  completedBg: string;
  completedText: string;
  dragHandleBg: string;
  dragHandleBorder: string;
  dragHandleText: string;
  dragHandleDisabled: string;
  textMuted: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  infoColor: string;
  panelBg: string;
  panelElevated: string;
  groupHighlightBg: string;
  groupHighlightBorder: string;
  groupHighlightStrongBorder: string;
  tagTextOnColor: string;
  linkColor: string;
  linkHoverColor: string;
  errorBg: string;
  errorBorder: string;
  errorText: string;
  inputBg: string;
  controlBorder: string;
  handlePreviewBg: string;
  handlePreviewBorder: string;
}

export const useThemeColors = (): ThemeColors => {
  const [isDark, setIsDark] = useState(
    document.documentElement.dataset.theme === 'dark'
  );
  const [colorTheme, setColorTheme] = useState<ColorTheme>(
    (document.documentElement.dataset.colorTheme as ColorTheme) || 'purple'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.dataset.theme;
      setIsDark(newTheme === 'dark');
      const newColorTheme = (document.documentElement.dataset.colorTheme as ColorTheme) || 'purple';
      setColorTheme(newColorTheme);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-color-theme']
    });

    return () => observer.disconnect();
  }, []);

  return useMemo(() => {
    const scheme = COLOR_SCHEMES[colorTheme];
    const warningColor = isDark ? '#fb923c' : '#fa8c16';
    const infoColor = isDark ? '#60a5fa' : '#1890ff';
    const successColor = isDark ? '#4ade80' : '#52c41a';
    const dangerColor = isDark ? '#f87171' : '#ff4d4f';

    return {
      listItemBg: isDark ? '#111111' : '#ffffff',
      listItemHoverBg: isDark ? '#1a1a1a' : '#f5f5f5',
      listItemOverdueBg: isDark ? '#2a1215' : '#fff1f0',
      listItemOverdueHoverBg: isDark ? '#3d1a1f' : '#ffe7e6',
      listItemCurrentBg: isDark ? 'rgba(96, 165, 250, 0.18)' : '#f0f9ff',
      contentBg: isDark ? '#111111' : '#f5f5f5',
      panelHeaderBg: isDark ? '#181818' : '#fafafa',
      borderColor: isDark ? '#3f3f46' : '#e4e4e7',
      textColor: isDark ? '#fafafa' : '#18181b',
      cardBg: isDark ? '#111111' : '#ffffff',
      textPrimary: isDark ? '#fafafa' : '#18181b',
      textSecondary: isDark ? '#d4d4d8' : '#52525b',
      completedBg: isDark ? `hsl(${scheme.hue}, 70%, 26%)` : scheme.primaryLight,
      completedText: isDark ? '#ffffff' : '#1a1a1a',
      dragHandleBg: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(128, 128, 128, 0.08)',
      dragHandleBorder: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(128, 128, 128, 0.15)',
      dragHandleText: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)',
      dragHandleDisabled: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
      textMuted: isDark ? '#a1a1aa' : '#71717a',
      successColor,
      warningColor,
      dangerColor,
      infoColor,
      panelBg: isDark ? '#000000' : '#ffffff',
      panelElevated: isDark ? '#181818' : '#fafafa',
      groupHighlightBg: isDark ? 'rgba(251, 146, 60, 0.14)' : 'rgba(250, 140, 22, 0.08)',
      groupHighlightBorder: isDark ? 'rgba(251, 146, 60, 0.45)' : 'rgba(250, 140, 22, 0.3)',
      groupHighlightStrongBorder: warningColor,
      tagTextOnColor: '#ffffff',
      linkColor: isDark ? '#8ab4ff' : '#722ed1',
      linkHoverColor: isDark ? '#adc6ff' : '#40a9ff',
      errorBg: isDark ? '#2a1215' : '#fff2f0',
      errorBorder: isDark ? '#a61d24' : '#ff4d4f',
      errorText: isDark ? '#ff9c9c' : '#cf1322',
      inputBg: isDark ? '#181818' : '#ffffff',
      controlBorder: isDark ? '#52525b' : '#d4d4d8',
      handlePreviewBg: isDark ? '#555555' : '#555555',
      handlePreviewBorder: isDark ? '#fafafa' : '#ffffff',
    };
  }, [isDark, colorTheme]);
};

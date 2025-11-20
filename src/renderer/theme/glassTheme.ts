// 玻璃态设计系统主题配置
export interface GlassThemeConfig {
  mode: 'light' | 'dark';
  colors: GlassColors;
  effects: GlassEffects;
  spacing: GlassSpacing;
  typography: GlassTypography;
  shadows: GlassShadows;
}

// 玻璃态颜色配置
export interface GlassColors {
  // 背景颜色
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    overlay: string;
  };

  // 表面颜色
  surface: {
    primary: string;
    secondary: string;
    tertiary: string;
  };

  // 文本颜色
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    inverse: string;
  };

  // 边框颜色
  border: {
    primary: string;
    secondary: string;
    tertiary: string;
  };

  // 状态颜色
  status: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };

  // 功能颜色
  primary: string;
  accent: string;
}

// 玻璃态效果配置
export interface GlassEffects {
  blur: {
    small: string;
    medium: string;
    large: string;
  };

  opacity: {
    low: number;
    medium: number;
    high: number;
  };

  backdrop: {
    light: string;
    medium: string;
    dark: string;
  };
}

// 玻璃态间距配置
export interface GlassSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  xxl: string;
}

// 玻璃态排版配置
export interface GlassTypography {
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  fontWeight: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

// 玻璃态阴影配置
export interface GlassShadows {
  small: string;
  medium: string;
  large: string;
  inner: string;
  glow: string;
}

// 浅色主题配置
export const lightGlassTheme: GlassThemeConfig = {
  mode: 'light',
  colors: {
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      overlay: 'rgba(255, 255, 255, 0.9)'
    },
    surface: {
      primary: 'rgba(255, 255, 255, 0.8)',
      secondary: 'rgba(255, 255, 255, 0.6)',
      tertiary: 'rgba(255, 255, 255, 0.4)'
    },
    text: {
      primary: '#1e293b',
      secondary: '#475569',
      tertiary: '#64748b',
      inverse: '#ffffff'
    },
    border: {
      primary: 'rgba(255, 255, 255, 0.2)',
      secondary: 'rgba(255, 255, 255, 0.1)',
      tertiary: 'rgba(255, 255, 255, 0.05)'
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    },
    primary: '#3b82f6',
    accent: '#8b5cf6'
  },
  effects: {
    blur: {
      small: 'blur(4px)',
      medium: 'blur(12px)',
      large: 'blur(24px)'
    },
    opacity: {
      low: 0.1,
      medium: 0.2,
      high: 0.4
    },
    backdrop: {
      light: 'rgba(255, 255, 255, 0.1)',
      medium: 'rgba(255, 255, 255, 0.2)',
      dark: 'rgba(255, 255, 255, 0.3)'
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem'
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem'
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75
    }
  },
  shadows: {
    small: '0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.08)',
    large: '0 10px 15px rgba(0, 0, 0, 0.05), 0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.06)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.05), inset 0 1px 2px rgba(0, 0, 0, 0.06)',
    glow: '0 0 20px rgba(59, 130, 246, 0.15), 0 0 40px rgba(59, 130, 246, 0.1)'
  }
};

// 深色主题配置
export const darkGlassTheme: GlassThemeConfig = {
  mode: 'dark',
  colors: {
    background: {
      primary: '#000000',
      secondary: '#0f172a',
      tertiary: '#1e293b',
      overlay: 'rgba(0, 0, 0, 0.9)'
    },
    surface: {
      primary: 'rgba(0, 0, 0, 0.8)',
      secondary: 'rgba(0, 0, 0, 0.6)',
      tertiary: 'rgba(0, 0, 0, 0.4)'
    },
    text: {
      primary: '#f8fafc',
      secondary: '#e2e8f0',
      tertiary: '#cbd5e1',
      inverse: '#000000'
    },
    border: {
      primary: 'rgba(255, 255, 255, 0.2)',
      secondary: 'rgba(255, 255, 255, 0.1)',
      tertiary: 'rgba(255, 255, 255, 0.05)'
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6'
    },
    primary: '#3b82f6',
    accent: '#8b5cf6'
  },
  effects: {
    blur: {
      small: 'blur(4px)',
      medium: 'blur(12px)',
      large: 'blur(24px)'
    },
    opacity: {
      low: 0.1,
      medium: 0.2,
      high: 0.4
    },
    backdrop: {
      light: 'rgba(0, 0, 0, 0.1)',
      medium: 'rgba(0, 0, 0, 0.2)',
      dark: 'rgba(0, 0, 0, 0.3)'
    }
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem'
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem'
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75
    }
  },
  shadows: {
    small: '0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.4)',
    medium: '0 4px 6px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.4)',
    large: '0 10px 15px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.2), 0 2px 4px rgba(0, 0, 0, 0.4)',
    inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(0, 0, 0, 0.2)',
    glow: '0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(59, 130, 246, 0.2)'
  }
};

// 获取当前主题配置
export const getGlassTheme = (mode: 'light' | 'dark'): GlassThemeConfig => {
  return mode === 'dark' ? darkGlassTheme : lightGlassTheme;
};

// 生成玻璃态样式类
export const generateGlassClasses = (theme: GlassThemeConfig) => {
  return {
    // 基础玻璃态卡片
    glassCard: {
      backgroundColor: theme.colors.surface.primary,
      backdropFilter: theme.effects.blur.medium,
      WebkitBackdropFilter: theme.effects.blur.medium,
      border: `1px solid ${theme.colors.border.primary}`,
      boxShadow: theme.shadows.medium,
      borderRadius: '12px',
      padding: theme.spacing.md
    },

    // 玻璃态按钮
    glassButton: {
      backgroundColor: theme.colors.surface.secondary,
      backdropFilter: theme.effects.blur.small,
      WebkitBackdropFilter: theme.effects.blur.small,
      border: `1px solid ${theme.colors.border.secondary}`,
      borderRadius: '8px',
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      cursor: 'pointer',
      transition: 'all 0.3s ease'
    },

    // 玻璃态模态框背景
    glassModal: {
      backgroundColor: theme.colors.background.overlay,
      backdropFilter: theme.effects.blur.large,
      WebkitBackdropFilter: theme.effects.blur.large
    },

    // 玻璃态输入框
    glassInput: {
      backgroundColor: theme.colors.surface.tertiary,
      backdropFilter: theme.effects.blur.small,
      WebkitBackdropFilter: theme.effects.blur.small,
      border: `1px solid ${theme.colors.border.tertiary}`,
      borderRadius: '8px',
      padding: theme.spacing.sm,
      color: theme.colors.text.primary
    }
  };
};

// CSS 变量生成器
export const generateCSSVariables = (theme: GlassThemeConfig) => {
  const variables: { [key: string]: string } = {};

  // 颜色变量
  Object.entries(theme.colors.background).forEach(([key, value]) => {
    variables[`--glass-bg-${key}`] = value;
  });

  Object.entries(theme.colors.surface).forEach(([key, value]) => {
    variables[`--glass-surface-${key}`] = value;
  });

  Object.entries(theme.colors.text).forEach(([key, value]) => {
    variables[`--glass-text-${key}`] = value;
  });

  Object.entries(theme.colors.border).forEach(([key, value]) => {
    variables[`--glass-border-${key}`] = value;
  });

  // 效果变量
  variables['--glass-blur-sm'] = theme.effects.blur.small;
  variables['--glass-blur-md'] = theme.effects.blur.medium;
  variables['--glass-blur-lg'] = theme.effects.blur.large;

  // 间距变量
  Object.entries(theme.spacing).forEach(([key, value]) => {
    variables[`--glass-spacing-${key}`] = value;
  });

  // 阴影变量
  Object.entries(theme.shadows).forEach(([key, value]) => {
    variables[`--glass-shadow-${key}`] = value;
  });

  return variables;
};
import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';
export type ColorTheme = 'purple' | 'blue' | 'green' | 'orange' | 'red';

// ============================================
// 色彩配置接口
// ============================================
interface ColorScheme {
  hue: number;
  primary: string;
  primaryDark: string;
  primaryLight: string;
}

// 五种主题色配置
export const COLOR_SCHEMES: Record<ColorTheme, ColorScheme> = {
  purple: {
    hue: 260,
    primary: 'hsl(260, 80%, 60%)',    // #8B5CF6
    primaryDark: 'hsl(260, 80%, 45%)', // #6D28D9
    primaryLight: 'hsl(260, 80%, 92%)', // #EDE9FE
  },
  blue: {
    hue: 210,
    primary: 'hsl(210, 80%, 60%)',     // #3B82F6
    primaryDark: 'hsl(210, 80%, 45%)',  // #2563EB
    primaryLight: 'hsl(210, 80%, 92%)',  // #DBEAFE
  },
  green: {
    hue: 150,
    primary: 'hsl(150, 80%, 45%)',     // #10B981
    primaryDark: 'hsl(150, 80%, 35%)',  // #059669
    primaryLight: 'hsl(150, 80%, 92%)',  // #D1FAE5
  },
  orange: {
    hue: 35,
    primary: 'hsl(35, 90%, 60%)',      // #F59E0B
    primaryDark: 'hsl(35, 90%, 45%)',   // #D97706
    primaryLight: 'hsl(35, 90%, 92%)',   // #FEF3C7
  },
  red: {
    hue: 0,
    primary: 'hsl(0, 80%, 60%)',       // #EF4444
    primaryDark: 'hsl(0, 80%, 45%)',    // #DC2626
    primaryLight: 'hsl(0, 80%, 92%)',    // #FEE2E2
  },
};

// ============================================
// HSL转Hex函数
// ============================================
function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// ============================================
// 获取颜色主题配置
// ============================================
export const getColorTheme = (colorTheme: ColorTheme = 'purple'): ColorScheme => {
  return COLOR_SCHEMES[colorTheme];
};

// ============================================
// 浅色主题
// ============================================
export const createLightTheme = (colorTheme: ColorTheme = 'purple'): ThemeConfig => {
  const scheme = COLOR_SCHEMES[colorTheme];
  const primaryHex = hslToHex(scheme.hue, 80, 60);

  return {
    algorithm: theme.defaultAlgorithm,
    token: {
      // 主色调
      colorPrimary: primaryHex,
      colorLink: primaryHex,
      colorLinkHover: hslToHex(scheme.hue, 80, 50),
      colorLinkActive: hslToHex(scheme.hue, 80, 40),

      // 背景色
      colorBgBase: '#ffffff',
      colorBgContainer: '#ffffff',
      colorBgElevated: '#ffffff',
      colorBgLayout: '#fafafa',

      // 边框色
      colorBorder: '#e5e5e5',
      colorBorderSecondary: '#eeeeee',

      // 文字色
      colorText: '#1a1a1a',
      colorTextSecondary: '#666666',
      colorTextTertiary: '#999999',
      colorTextQuaternary: '#cccccc',
    },
    components: {
      Card: {
        colorBgContainer: '#ffffff',
        colorBorder: '#e5e5e5',
        colorBorderSecondary: '#eeeeee',
      },
      Modal: {
        contentBg: '#ffffff',
        headerBg: '#ffffff',
      },
      Drawer: {
        colorBgElevated: '#ffffff',
      },
      Input: {
        colorBgContainer: '#ffffff',
      },
      Select: {
        colorBgContainer: '#ffffff',
        colorBgElevated: '#fafafa',
      },
      Button: {
        colorBgContainer: '#fafafa',
      },
      List: {
        colorBgContainer: '#ffffff',
      },
      Tabs: {
        colorBgContainer: '#ffffff',
      },
      Checkbox: {
        colorBorder: '#d9d9d9',
        colorBgContainer: '#ffffff',
      },
      Tag: {
        colorBgContainer: '#fafafa',
        colorBorder: '#e5e5e5',
      },
      Collapse: {
        colorBgContainer: '#ffffff',
        headerBg: '#fafafa',
        colorBorder: '#e5e5e5',
      },
    },
  };
};

// ============================================
// 深色主题
// ============================================
export const createDarkTheme = (colorTheme: ColorTheme = 'purple'): ThemeConfig => {
  const scheme = COLOR_SCHEMES[colorTheme];
  const primaryHex = hslToHex(scheme.hue, 80, 60);

  return {
    algorithm: theme.darkAlgorithm,
    token: {
      // 主色调
      colorPrimary: primaryHex,
      colorLink: hslToHex(scheme.hue, 80, 70),
      colorLinkHover: hslToHex(scheme.hue, 80, 80),
      colorLinkActive: hslToHex(scheme.hue, 80, 60),

      // 背景色 - 纯黑体系
      colorBgBase: '#0a0a0a',
      colorBgContainer: '#141414',
      colorBgElevated: '#1a1a1a',
      colorBgLayout: '#0a0a0a',

      // 边框色
      colorBorder: '#404040',
      colorBorderSecondary: '#2a2a2a',

      // 文字色
      colorText: '#f5f5f5',
      colorTextSecondary: '#a0a0a0',
      colorTextTertiary: '#666666',
      colorTextQuaternary: '#444444',
    },
    components: {
      Card: {
        colorBgContainer: '#141414',
        colorBorder: '#404040',
        colorBorderSecondary: '#2a2a2a',
      },
      Modal: {
        contentBg: '#141414',
        headerBg: '#141414',
      },
      Drawer: {
        colorBgElevated: '#141414',
      },
      Input: {
        colorBgContainer: '#1a1a1a',
      },
      Select: {
        colorBgContainer: '#1a1a1a',
        colorBgElevated: '#262626',
      },
      Button: {
        colorBgContainer: '#1a1a1a',
      },
      List: {
        colorBgContainer: '#0a0a0a',
      },
      Tabs: {
        colorBgContainer: '#0a0a0a',
      },
      Checkbox: {
        colorBorder: '#505050',
        colorBgContainer: '#262626',
      },
      Tag: {
        colorBgContainer: '#262626',
        colorBorder: '#404040',
      },
      Collapse: {
        colorBgContainer: '#141414',
        headerBg: '#1a1a1a',
        colorBorder: '#404040',
      },
    },
  };
};

// ============================================
// 兼容旧API - 默认紫色主题
// ============================================
export const lightTheme = createLightTheme('purple');
export const darkTheme = createDarkTheme('purple');

// ============================================
// 获取主题 - 支持色彩主题切换
// ============================================
export const getTheme = (
  mode: ThemeMode,
  colorTheme: ColorTheme = 'purple'
): ThemeConfig => {
  return mode === 'dark'
    ? createDarkTheme(colorTheme)
    : createLightTheme(colorTheme);
};

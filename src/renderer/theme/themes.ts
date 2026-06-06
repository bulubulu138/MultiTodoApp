import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';
export type ColorTheme = 'purple' | 'blue' | 'green' | 'orange' | 'red' | 'cyan' | 'magenta' | 'yellow' | 'indigo' | 'pink' | 'teal' | 'amber';

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
  cyan: {
    hue: 180,
    primary: 'hsl(180, 80%, 50%)',
    primaryDark: 'hsl(180, 80%, 40%)',
    primaryLight: 'hsl(180, 80%, 92%)',
  },
  magenta: {
    hue: 320,
    primary: 'hsl(320, 80%, 60%)',
    primaryDark: 'hsl(320, 80%, 45%)',
    primaryLight: 'hsl(320, 80%, 92%)',
  },
  yellow: {
    hue: 48,
    primary: 'hsl(48, 90%, 58%)',
    primaryDark: 'hsl(48, 90%, 45%)',
    primaryLight: 'hsl(48, 90%, 92%)',
  },
  indigo: {
    hue: 240,
    primary: 'hsl(240, 80%, 60%)',
    primaryDark: 'hsl(240, 80%, 45%)',
    primaryLight: 'hsl(240, 80%, 92%)',
  },
  pink: {
    hue: 340,
    primary: 'hsl(340, 80%, 65%)',
    primaryDark: 'hsl(340, 80%, 50%)',
    primaryLight: 'hsl(340, 80%, 92%)',
  },
  teal: {
    hue: 170,
    primary: 'hsl(170, 80%, 45%)',
    primaryDark: 'hsl(170, 80%, 35%)',
    primaryLight: 'hsl(170, 80%, 92%)',
  },
  amber: {
    hue: 42,
    primary: 'hsl(42, 90%, 55%)',
    primaryDark: 'hsl(42, 90%, 42%)',
    primaryLight: 'hsl(42, 90%, 92%)',
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

      // 背景色 - 中性灰，明显层次 (8-12%)
      colorBgBase: '#F5F5F5',      // 主背景 - 中性浅灰
      colorBgContainer: '#EBEBEB',  // 容器背景 - 明显更深 (-10%)
      colorBgElevated: '#FFFFFF',   // 卡片悬浮 - 纯白，最突出
      colorBgLayout: '#F5F5F5',     // 布局背景 - 与主背景一致

      // 边框色 - 使用设计token
      colorBorder: '#E4E4E7',
      colorBorderSecondary: '#D4D4D8',

      // 文字色 - 使用设计token
      colorText: '#18181B',
      colorTextSecondary: '#71717A',
      colorTextTertiary: '#A1A1AA',
      colorTextQuaternary: '#D4D4D8',

      // 圆角系统 - 更大的圆角
      borderRadius: 24,
      borderRadiusLG: 28,
      borderRadiusSM: 20,
      borderRadiusXS: 14,

      // 字体系统
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 14,
      fontSizeHeading1: 34,
      fontSizeHeading2: 28,
      fontSizeHeading3: 24,
      fontSizeHeading4: 20,
      fontSizeHeading5: 18,

      // 间距
      padding: 16,
      paddingLG: 24,
      paddingMD: 16,
      paddingSM: 12,
      paddingXS: 8,
      paddingXXS: 4,

      // 阴影 - 更柔和
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.08)',
    },
    components: {
      Card: {
        colorBgContainer: '#EBEBEB',
        colorBorder: '#E4E4E7',
        colorBorderSecondary: '#D4D4D8',
        borderRadiusLG: 24,
        paddingLG: 24,
        boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
      Modal: {
        contentBg: '#FFFFFF',
        headerBg: '#FFFFFF',
        borderRadiusLG: 24,
      },
      Drawer: {
        colorBgElevated: '#FFFFFF',
      },
      Input: {
        colorBgContainer: '#EBEBEB',
        borderRadius: 24,
        paddingBlock: 12,
        paddingInline: 16,
      },
      Select: {
        colorBgContainer: '#EBEBEB',
        colorBgElevated: '#FFFFFF',
        borderRadius: 24,
      },
      Button: {
        colorBgContainer: '#EBEBEB',
        borderRadius: 24,
        paddingBlock: 10,
        paddingInline: 20,
        fontWeight: 600,
      },
      List: {
        colorBgContainer: '#F5F5F5',
      },
      Tabs: {
        colorBgContainer: '#F5F5F5',
        borderRadius: 0,
      },
      Checkbox: {
        colorBorder: '#D4D4D8',
        colorBgContainer: '#FFFFFF',
        borderRadiusSM: 6,
      },
      Tag: {
        colorBgContainer: 'rgba(139, 92, 246, 0.1)',
        colorBorder: 'transparent',
        borderRadiusSM: 14,
      },
      Collapse: {
        colorBgContainer: '#EBEBEB',
        headerBg: '#FFFFFF',
        colorBorder: '#E4E4E7',
        borderRadiusLG: 24,
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

      // 背景色 - 纯黑体系（使用设计token）
      colorBgBase: '#000000',
      colorBgContainer: '#111111',
      colorBgElevated: '#181818',
      colorBgLayout: '#000000',
      colorFillAlter: '#1c1c1c',
      colorFillSecondary: '#232323',
      colorFillTertiary: '#2a2a2a',
      colorFillQuaternary: '#303030',

      // 边框色（使用设计token）
      colorBorder: '#3f3f46',
      colorBorderSecondary: '#27272a',

      // 文字色（使用设计token）
      colorText: '#fafafa',
      colorTextSecondary: '#d4d4d8',
      colorTextTertiary: '#a1a1aa',
      colorTextQuaternary: '#71717a',

      // 圆角系统 - 与浅色模式一致
      borderRadius: 24,
      borderRadiusLG: 28,
      borderRadiusSM: 20,
      borderRadiusXS: 14,

      // 字体系统
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 14,
      fontSizeHeading1: 34,
      fontSizeHeading2: 28,
      fontSizeHeading3: 24,
      fontSizeHeading4: 20,
      fontSizeHeading5: 18,

      // 间距
      padding: 16,
      paddingLG: 24,
      paddingMD: 16,
      paddingSM: 12,
      paddingXS: 8,
      paddingXXS: 4,

      // 阴影 - 深色模式更强
      boxShadow: '0 6px 24px rgba(0, 0, 0, 0.42)',
      boxShadowSecondary: '0 10px 32px rgba(0, 0, 0, 0.5)',
    },
    components: {
      Card: {
        colorBgContainer: '#111111',
        colorBorder: '#3f3f46',
        colorBorderSecondary: '#27272a',
        borderRadiusLG: 24,
        paddingLG: 24,
        boxShadowTertiary: '0 8px 24px rgba(0, 0, 0, 0.42)',
      },
      Modal: {
        contentBg: '#111111',
        headerBg: '#111111',
        borderRadiusLG: 24,
      },
      Drawer: {
        colorBgElevated: '#111111',
        colorBgContainer: '#111111',
        colorBgMask: 'rgba(0, 0, 0, 0.65)',
        colorBorder: '#3f3f46',
        colorText: '#fafafa',
      },
      Input: {
        colorBgContainer: '#181818',
        borderRadius: 24,
        paddingBlock: 12,
        paddingInline: 16,
      },
      Select: {
        colorBgContainer: '#181818',
        colorBgElevated: '#1f1f1f',
        borderRadius: 24,
      },
      Button: {
        colorBgContainer: '#181818',
        borderRadius: 24,
        paddingBlock: 10,
        paddingInline: 20,
        fontWeight: 600,
      },
      List: {
        colorBgContainer: '#000000',
      },
      Tabs: {
        colorBgContainer: '#000000',
        borderRadius: 0,
      },
      Checkbox: {
        colorBorder: '#52525b',
        colorBgContainer: '#1f1f1f',
        borderRadiusSM: 6,
      },
      Tag: {
        colorBgContainer: 'rgba(139, 92, 246, 0.22)',
        colorBorder: 'transparent',
        borderRadiusSM: 14,
      },
      Collapse: {
        colorBgContainer: '#111111',
        headerBg: '#181818',
        colorBorder: '#3f3f46',
        borderRadiusLG: 24,
      },
      Descriptions: {
        labelBg: '#111111',
        colorBgContainer: '#111111',
        colorBorder: '#3f3f46',
        colorBorderSecondary: '#27272a',
        colorText: '#fafafa',
        colorTextSecondary: '#d4d4d8',
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

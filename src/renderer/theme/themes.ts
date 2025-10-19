import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';

export const lightTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    colorPrimary: '#1890ff',
    colorBgBase: '#ffffff',
  }
};

export const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    // 基础背景 - 纯黑
    colorBgBase: '#000000',
    
    // 容器背景 - 微微提亮
    colorBgContainer: '#0a0a0a',
    
    // 悬浮元素背景
    colorBgElevated: '#141414',
    
    // 布局背景
    colorBgLayout: '#000000',
    
    // 主色调
    colorPrimary: '#1890ff',
    
    // 边框颜色 - 深色主题下更明显（加强对比度）
    colorBorder: '#404040',
    colorBorderSecondary: '#2a2a2a',
    
    // 文字颜色
    colorText: '#ffffff',
    colorTextSecondary: '#a6a6a6',
    colorTextTertiary: '#737373',
    colorTextQuaternary: '#595959',
    
    // 链接颜色
    colorLink: '#40a9ff',
    colorLinkHover: '#69c0ff',
    colorLinkActive: '#096dd9',
  },
  components: {
    // 卡片组件 - 增强边框
    Card: {
      colorBgContainer: '#0a0a0a',
      colorBorder: '#404040',
      colorBorderSecondary: '#2a2a2a',
    },
    // Modal组件
    Modal: {
      contentBg: '#0a0a0a',
      headerBg: '#0a0a0a',
    },
    // Drawer组件
    Drawer: {
      colorBgElevated: '#0a0a0a',
    },
    // 输入框
    Input: {
      colorBgContainer: '#141414',
    },
    // 选择框
    Select: {
      colorBgContainer: '#141414',
      colorBgElevated: '#1a1a1a',
    },
    // 按钮
    Button: {
      colorBgContainer: '#141414',
    },
    // 列表
    List: {
      colorBgContainer: '#000000',
    },
    // 标签页
    Tabs: {
      colorBgContainer: '#000000',
    },
    // Checkbox组件
    Checkbox: {
      colorBorder: '#505050',
      colorBgContainer: '#1a1a1a',
    },
    // Tag组件
    Tag: {
      colorBgContainer: '#1a1a1a',
      colorBorder: '#404040',
    },
    // Collapse组件（搜索筛选区域）
    Collapse: {
      colorBgContainer: '#0a0a0a',
      headerBg: '#141414',
      colorBorder: '#404040',
    },
  }
};

export const getTheme = (mode: ThemeMode): ThemeConfig => {
  return mode === 'dark' ? darkTheme : lightTheme;
};


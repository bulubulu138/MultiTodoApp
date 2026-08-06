import { ColorTheme, FontSizeLevel, ThemeMode } from './themes';

export function applyRootThemeAttributes(
  root: HTMLElement,
  themeMode: ThemeMode,
  colorTheme: ColorTheme,
  fontSizeLevel: FontSizeLevel = 'small'
): void {
  root.dataset.theme = themeMode;
  root.dataset.colorTheme = colorTheme;
  root.dataset.fontSizeLevel = fontSizeLevel;
}

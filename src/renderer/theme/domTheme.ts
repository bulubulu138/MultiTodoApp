import { ColorTheme, ThemeMode } from './themes';

export function applyRootThemeAttributes(
  root: HTMLElement,
  themeMode: ThemeMode,
  colorTheme: ColorTheme
): void {
  root.dataset.theme = themeMode;
  root.dataset.colorTheme = colorTheme;
}


import { applyRootThemeAttributes } from './domTheme';

describe('applyRootThemeAttributes', () => {
  it('syncs theme attributes to the document root used by CSS and hooks', () => {
    const root = document.createElement('html');

    applyRootThemeAttributes(root, 'dark', 'orange');

    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.colorTheme).toBe('orange');
  });
});


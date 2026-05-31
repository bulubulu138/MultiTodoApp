import { createDarkTheme, createLightTheme } from './themes';

describe('renderer theme tokens', () => {
  it('uses darker neutral surfaces in dark mode than light mode', () => {
    const light = createLightTheme('purple');
    const dark = createDarkTheme('purple');

    expect(light.token?.colorBgBase).toBe('#FFFFFF');
    expect(dark.token?.colorBgBase).toBe('#09090B');
    expect(dark.token?.colorText).toBe('#FAFAFA');
    expect(dark.token?.colorBorder).toBe('#3F3F46');
  });

  it('keeps brand color aligned across light and dark themes', () => {
    const light = createLightTheme('orange');
    const dark = createDarkTheme('orange');

    expect(light.token?.colorPrimary).toBe(dark.token?.colorPrimary);
    expect(light.token?.colorPrimary).toBe('#F5A524');
  });
});

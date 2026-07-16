import { createDarkTheme, createLightTheme } from './themes';

describe('renderer theme tokens', () => {
  it('uses darker neutral surfaces in dark mode than light mode', () => {
    const light = createLightTheme('purple');
    const dark = createDarkTheme('purple');

    expect(light.token?.colorBgBase).toBe('#F5F5F5');
    expect(light.token?.colorBgContainer).toBe('#EBEBEB');
    expect(dark.token?.colorBgBase).toBe('#000000');
    expect(dark.token?.colorBgContainer).toBe('#111111');
    expect(dark.token?.colorText).toBe('#fafafa');
    expect(dark.token?.colorBorder).toBe('#3f3f46');
  });

  it('keeps brand color aligned across light and dark themes', () => {
    const light = createLightTheme('orange');
    const dark = createDarkTheme('orange');

    expect(light.token?.colorPrimary).toBe(dark.token?.colorPrimary);
    expect(light.token?.colorPrimary).toBe('#EBA747');
  });
});

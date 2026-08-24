import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('SettingsModal layer ordering', () => {
  it('declares a modal layer above the focus toolbar layer', () => {
    const component = readFileSync(
      resolve(__dirname, '../SettingsModal.tsx'),
      'utf8',
    );
    const tokens = readFileSync(
      resolve(__dirname, '../../styles/design-tokens.css'),
      'utf8',
    );
    const globalStyles = readFileSync(
      resolve(__dirname, '../../styles/global.css'),
      'utf8',
    );

    const stickyLayer = Number(tokens.match(/--z-sticky:\s*(\d+)/)?.[1]);
    const modalLayer = Number(tokens.match(/--z-modal:\s*(\d+)/)?.[1]);
    expect(modalLayer).toBeGreaterThan(stickyLayer);

    const modalProps = component.match(/<Modal\s+([\s\S]*?)>/)?.[1] ?? '';
    expect(modalProps).toMatch(/zIndex\s*=\s*\{\s*\d+\s*\}/);
    const declaredModalLayer = Number(modalProps.match(/zIndex\s*=\s*\{\s*(\d+)\s*\}/)?.[1]);
    expect(declaredModalLayer).toBeGreaterThan(stickyLayer);

    const focusHeader = globalStyles.match(
      /\.content-focus-item-header\s*\{([\s\S]*?)\n\}/,
    )?.[1] ?? '';
    expect(focusHeader).not.toMatch(/z-index:\s*1\d{3}\s*!important/);
  });
});

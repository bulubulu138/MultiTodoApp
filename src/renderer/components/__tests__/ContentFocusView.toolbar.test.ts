import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ContentFocusView toolbar pinning', () => {
  it('keeps each todo toolbar sticky within the dedicated focus scroll area', () => {
    const styles = readFileSync(
      resolve(__dirname, '../../styles/global.css'),
      'utf8',
    );
    const activeStyles = styles.replace(/\/\*[\s\S]*?\*\//g, '');
    const headerStyles = activeStyles.match(
      /\.content-focus-item-header\s*\{([\s\S]*?)\n\}/,
    )?.[1];
    const scrollAreaStyles = activeStyles.match(
      /\.content-focus-scroll-area\s*\{([\s\S]*?)\n\}/,
    )?.[1];

    expect(headerStyles).toBeDefined();
    expect(scrollAreaStyles).toBeDefined();
    expect(scrollAreaStyles).toMatch(/overflow-y:\s*auto/);
    expect(scrollAreaStyles).toMatch(/overflow-x:\s*hidden/);
    expect(scrollAreaStyles).toMatch(/position:\s*relative/);
    expect(scrollAreaStyles).toMatch(/--content-focus-sticky-top:\s*0px/);
    expect(headerStyles).toMatch(/position:\s*sticky/);
    expect(headerStyles).toMatch(/top:\s*var\(--content-focus-sticky-top/);
    expect(headerStyles).toMatch(/z-index:\s*var\(--z-sticky/);
    expect(headerStyles).toMatch(/background:\s*var\(--color-surface-elevated/);
    expect(headerStyles).toMatch(/border-bottom:\s*1px/);
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ContentFocusView toolbar pinning', () => {
  it('keeps each todo toolbar sticky within the dedicated focus scroll area', () => {
    const styles = readFileSync(
      resolve(__dirname, '../../styles/global.css'),
      'utf8',
    );
    const headerStyles = styles.match(
      /\.content-focus-item-header\s*\{([\s\S]*?)\n\}/,
    )?.[1];

    expect(headerStyles).toBeDefined();
    expect(headerStyles).toMatch(/position:\s*sticky/);
    expect(headerStyles).toMatch(/top:\s*var\(--content-focus-sticky-top/);
    expect(headerStyles).toMatch(/z-index:\s*var\(--z-sticky/);
  });
});

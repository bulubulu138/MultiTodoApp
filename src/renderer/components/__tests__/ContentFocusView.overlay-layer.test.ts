import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (fileName: string) =>
  readFileSync(resolve(__dirname, `../${fileName}`), 'utf8');

describe('Content focus overlay layers', () => {
  it('renders the create-todo modal above the focus toolbar and outside its parent stack', () => {
    const source = readSource('TodoForm.tsx');

    expect(source).toMatch(/<Modal[\s\S]*?zIndex=\{\s*1100\s*\}/);
    expect(source).toMatch(/getContainer=\{\(\) => document\.body\}/);
  });

  it('renders the todo details drawer above the focus toolbar and outside its parent stack', () => {
    const source = readSource('TodoViewDrawer.tsx');

    expect(source).toMatch(/<Drawer[\s\S]*?zIndex=\{\s*1100\s*\}/);
    expect(source).toMatch(/getContainer=\{\(\) => document\.body\}/);
  });
});

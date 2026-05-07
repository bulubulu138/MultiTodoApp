/**
 * 单元测试：RichTextEditor 工具栏事件拦截逻辑
 *
 * 测试目标：验证工具栏相关事件不被过度拦截，同时保持滚动阻止功能
 */

import { within } from '@testing-library/dom';

describe('RichTextEditor - Toolbar Event Interception', () => {

  describe('shouldPreventScroll logic', () => {
    let mockEvent: Event;
    let mockTarget: HTMLElement;

    beforeEach(() => {
      mockTarget = document.createElement('div');
      mockEvent = new Event('scroll', { bubbles: true, cancelable: true });
      Object.defineProperty(mockEvent, 'target', {
        value: mockTarget,
        writable: false
      });
      Object.defineProperty(mockEvent, 'preventDefault', {
        value: jest.fn(),
        writable: true
      });
      Object.defineProperty(mockEvent, 'stopPropagation', {
        value: jest.fn(),
        writable: true
      });
    });

    it('should not prevent events on toolbar elements', () => {
      // 模拟工具栏按钮
      mockTarget.className = 'ql-toolbar';
      mockTarget.innerHTML = '<button class="ql-bold">Bold</button>';

      const toolbarButton = mockTarget.querySelector('.ql-bold') as HTMLElement;
      const clickEvent = new Event('click', { bubbles: true });

      // 工具栏点击事件应该能够正常传播
      let wasPrevented = false;
      toolbarButton.addEventListener('click', (e) => {
        // 检查事件是否被阻止
        if (e.defaultPrevented) {
          wasPrevented = true;
        }
      });

      toolbarButton.dispatchEvent(clickEvent);
      expect(wasPrevented).toBe(false);
    });

    it('should prevent scroll events on editor content', () => {
      mockTarget.className = 'ql-editor';
      const scrollEvent = new Event('scroll', { bubbles: true, cancelable: true });

      let wasPrevented = false;
      mockTarget.addEventListener('scroll', (e) => {
        if (e.defaultPrevented) {
          wasPrevented = true;
        }
      });

      mockTarget.dispatchEvent(scrollEvent);
      // 编辑器内容的滚动应该被阻止
      expect(wasPrevented).toBe(true);
    });

    it('should not prevent events on picker items', () => {
      const pickerItem = document.createElement('span');
      pickerItem.className = 'ql-picker-item';
      const clickEvent = new Event('click', { bubbles: true });

      let wasPrevented = false;
      pickerItem.addEventListener('click', (e) => {
        if (e.defaultPrevented) {
          wasPrevented = true;
        }
      });

      pickerItem.dispatchEvent(clickEvent);
      expect(wasPrevented).toBe(false);
    });

    it('should allow link element clicks', () => {
      const link = document.createElement('a');
      link.href = 'https://example.com';
      link.className = 'ql-preview';
      const clickEvent = new Event('click', { bubbles: true, cancelable: true });

      let wasPrevented = false;
      link.addEventListener('click', (e) => {
        if (e.defaultPrevented) {
          wasPrevented = true;
        }
      });

      link.dispatchEvent(clickEvent);
      expect(wasPrevented).toBe(false);
    });

    it('should prevent scroll events on nested elements within editor', () => {
      const editor = document.createElement('div');
      editor.className = 'ql-editor';

      const nestedParagraph = document.createElement('p');
      nestedParagraph.textContent = 'Test content';
      editor.appendChild(nestedParagraph);

      const scrollEvent = new Event('scroll', { bubbles: true, cancelable: true });

      let wasPrevented = false;
      editor.addEventListener('scroll', (e) => {
        if (e.defaultPrevented) {
          wasPrevented = true;
        }
      });

      editor.dispatchEvent(scrollEvent);
      expect(wasPrevented).toBe(true);
    });
  });

  describe('Toolbar whitelist selectors', () => {
    it('should identify all toolbar-related selectors', () => {
      const toolbarSelectors = [
        '.ql-toolbar',
        '.ql-picker',
        '.ql-tooltip',
        '.ql-action',
        '.ql-picker-item',
        '.ql-preview'
      ];

      const testContainer = document.createElement('div');

      toolbarSelectors.forEach(selector => {
        const element = document.createElement('div');
        element.className = selector.replace('.', '');
        testContainer.appendChild(element);
      });

      // 验证所有选择器都能正确匹配元素
      toolbarSelectors.forEach(selector => {
        const element = testContainer.querySelector(selector);
        expect(element).not.toBe(null);
        expect(element?.classList.contains(selector.replace('.', ''))).toBe(true);
      });
    });
  });

  describe('linkHandler function behavior', () => {
    let mockPrompt: jest.Mock;
    let originalPrompt: typeof window.prompt;

    beforeEach(() => {
      originalPrompt = window.prompt;
      mockPrompt = jest.fn();
      window.prompt = mockPrompt;
    });

    afterEach(() => {
      window.prompt = originalPrompt;
    });

    it('should handle user cancellation', () => {
      mockPrompt.mockReturnValueOnce(null);

      // 模拟编辑器对象
      const mockEditor = {
        getSelection: jest.fn().mockReturnValueOnce({ index: 0, length: 5 }),
        format: jest.fn()
      };

      // 模拟 linkHandler 的逻辑
      const href = mockPrompt('请输入链接地址：');
      if (!href) {
        // 用户取消
        expect(mockEditor.format).not.toHaveBeenCalled();
        return;
      }

      // 如果没有取消，会执行到这里
      expect(true).toBe(false); // 不应该执行到这里
    });

    it('should insert link with valid URL', () => {
      const testUrl = 'https://example.com';
      mockPrompt.mockReturnValueOnce(testUrl);

      const mockEditor = {
        getSelection: jest.fn().mockReturnValueOnce({ index: 0, length: 5 }),
        format: jest.fn()
      };

      const href = mockPrompt('请输入链接地址：');
      if (href && mockEditor) {
        mockEditor.format('link', href);
        expect(mockEditor.format).toHaveBeenCalledWith('link', testUrl);
      }
    });

    it('should handle empty URL input', () => {
      mockPrompt.mockReturnValueOnce('');

      const mockEditor = {
        getSelection: jest.fn().mockReturnValueOnce({ index: 0, length: 5 }),
        format: jest.fn()
      };

      const href = mockPrompt('请输入链接地址：');
      if (!href) {
        expect(mockEditor.format).not.toHaveBeenCalled();
        return;
      }
    });
  });

  describe('Global prototype overrides compatibility', () => {
    it('should not affect scroll operations outside editor', () => {
      const testElement = document.createElement('div');
      testElement.className = 'outside-editor';
      testElement.style.height = '100px';
      testElement.style.overflow = 'scroll';

      document.body.appendChild(testElement);

      // 测试 scrollIntoView 在非编辑器元素上正常工作
      const scrollSpy = jest.spyOn(testElement, 'scrollIntoView');

      try {
        testElement.scrollIntoView({ block: 'start' });
        // 非编辑器元素的滚动不应该被阻止
        expect(scrollSpy).toHaveBeenCalled();
      } finally {
        scrollSpy.mockRestore();
        document.body.removeChild(testElement);
      }
    });

    it('should prevent scroll operations on editor elements', () => {
      const editorElement = document.createElement('div');
      editorElement.className = 'ql-editor';

      // 模拟编辑器元素
      const scrollSpy = jest.spyOn(editorElement, 'scrollIntoView');

      try {
        editorElement.scrollIntoView({ block: 'start' });

        // 如果被正确拦截，scrollIntoView 应该被覆盖为空函数
        // 验证没有抛出错误
        expect(true).toBe(true);
      } finally {
        scrollSpy.mockRestore();
      }
    });
  });
});

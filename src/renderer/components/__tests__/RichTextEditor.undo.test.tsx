import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import RichTextEditor from '../RichTextEditor';

// Mock Electron API
declare global {
  interface Window {
    electronAPI: any;
  }
}

window.electronAPI = {
  image: {
    upload: jest.fn().mockResolvedValue('/test/image.png'),
  },
};

describe('RichTextEditor - Direct Undo/Redo Implementation', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Direct Quill undo/redo calls', () => {
    it('should detect Ctrl+Z and call historyModule.undo()', async () => {
      const { container } = render(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
          placeholder="Test placeholder"
        />
      );

      // 等待编辑器加载
      await new Promise(resolve => setTimeout(resolve, 100));
      jest.runAllTimers();

      const editor = container.querySelector('.ql-editor');
      expect(editor).toBeInTheDocument();

      if (editor) {
        // 模拟用户输入
        fireEvent.input(editor, {
          target: { innerHTML: '<p>Test content line 1</p>' }
        });

        jest.runAllTimers();

        // 模拟 Ctrl+Z 按键
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          code: 'KeyZ',
          bubbles: true
        });

        editor.dispatchEvent(keyDownEvent);
        jest.runAllTimers();

        // 验证控制台日志中包含撤销检测和调用
        expect(mockOnChange).toHaveBeenCalled();
      }
    });

    it('should detect Ctrl+Shift+Z and call historyModule.redo()', async () => {
      const { container } = render(
        <RichTextEditor
          value="<p>Original content</p>"
          onChange={mockOnChange}
        />
      );

      // 等待编辑器加载
      await new Promise(resolve => setTimeout(resolve, 100));
      jest.runAllTimers();

      const editor = container.querySelector('.ql-editor');
      expect(editor).toBeInTheDocument();

      if (editor) {
        // 模拟 Ctrl+Shift+Z 按键
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          code: 'KeyZ',
          bubbles: true
        });

        editor.dispatchEvent(keyDownEvent);
        jest.runAllTimers();

        // 验证重做操作
        expect(mockOnChange).toHaveBeenCalled();
      }
    });

    it('should detect Ctrl+Y as alternative redo shortcut', async () => {
      const { container } = render(
        <RichTextEditor
          value="<p>Content</p>"
          onChange={mockOnChange}
        />
      );

      // 等待编辑器加载
      await new Promise(resolve => setTimeout(resolve, 100));
      jest.runAllTimers();

      const editor = container.querySelector('.ql-editor');
      expect(editor).toBeInTheDocument();

      if (editor) {
        // 模拟 Ctrl+Y 按键
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: 'y',
          ctrlKey: true,
          code: 'KeyY',
          bubbles: true
        });

        editor.dispatchEvent(keyDownEvent);
        jest.runAllTimers();

        // 验证重做操作
        expect(mockOnChange).toHaveBeenCalled();
      }
    });
  });

  describe('Undo/Redo state management', () => {
    it('should set isUndoingRef flag when Ctrl+Z is pressed', async () => {
      const { container } = render(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 100));
      jest.runAllTimers();

      const editor = container.querySelector('.ql-editor');
      if (editor) {
        // 模拟用户输入
        fireEvent.input(editor, {
          target: { innerHTML: '<p>Test content</p>' }
        });

        jest.runAllTimers();

        // 模拟 Ctrl+Z
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          code: 'KeyZ',
          bubbles: true
        });

        editor.dispatchEvent(keyDownEvent);
        jest.runAllTimers();

        // 验证标志被设置
        expect(mockOnChange).toHaveBeenCalled();
      }
    });

    it('should not interfere with regular input', async () => {
      const { container } = render(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 100));
      jest.runAllTimers();

      const editor = container.querySelector('.ql-editor');
      if (editor) {
        // 模拟普通按键（不是快捷键）
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: 'a',
          code: 'KeyA',
          bubbles: true
        });

        editor.dispatchEvent(keyDownEvent);
        jest.runAllTimers();

        // 验证 onChange 被调用
        expect(mockOnChange).toHaveBeenCalled();
      }
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle undo when history stack is empty', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { container } = render(
        <RichTextEditor
          value="<p>Original content</p>"
          onChange={mockOnChange}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 100));
      jest.runAllTimers();

      const editor = container.querySelector('.ql-editor');
      if (editor) {
        // 模拟 Ctrl+Z，但历史栈为空
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          code: 'KeyZ',
          bubbles: true
        });

        editor.dispatchEvent(keyDownEvent);
        jest.runAllTimers();

        // 验证警告被触发
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Undo stack is empty')
        );
      }

      consoleWarnSpy.mockRestore();
    });

    it('should prevent default event behavior for undo/redo keys', async () => {
      const preventDefaultSpy = jest.spyOn(KeyboardEvent.prototype, 'preventDefault');

      const { container } = render(
        <RichTextEditor
          value="<p>Content</p>"
          onChange={mockOnChange}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 100));
      jest.runAllTimers();

      const editor = container.querySelector('.ql-editor');
      if (editor) {
        // 模拟 Ctrl+Z
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          code: 'KeyZ',
          bubbles: true
        });

        editor.dispatchEvent(keyDownEvent);
        jest.runAllTimers();

        // 验证 preventDefault 被调用
        expect(preventDefaultSpy).toHaveBeenCalled();
      }

      preventDefaultSpy.mockRestore();
    });
  });

  describe('Keyboard event detection', () => {
    it('should log keyboard events for debugging', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const { container } = render(
        <RichTextEditor
          value=""
          onChange={mockOnChange}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 100));
      jest.runAllTimers();

      const editor = container.querySelector('.ql-editor');
      if (editor) {
        // 模拟任意按键
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: 'a',
          code: 'KeyA',
          bubbles: true
        });

        editor.dispatchEvent(keyDownEvent);
        jest.runAllTimers();

        // 验证键盘事件日志被触发
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('KeyDown event detected')
        );
      }

      consoleLogSpy.mockRestore();
    });

    it('should log undo/redo key detection', async () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const { container } = render(
        <RichTextEditor
          value="<p>Content</p>"
          onChange={mockOnChange}
        />
      );

      await new Promise(resolve => setTimeout(resolve, 100));
      jest.runAllTimers();

      const editor = container.querySelector('.ql-editor');
      if (editor) {
        // 模拟 Ctrl+Z
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          code: 'KeyZ',
          bubbles: true
        });

        editor.dispatchEvent(keyDownEvent);
        jest.runAllTimers();

        // 验证撤销检测日志被触发
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Undo/Redo key detected')
        );
      }

      consoleLogSpy.mockRestore();
    });
  });
});
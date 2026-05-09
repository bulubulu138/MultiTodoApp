/**
 * Console Warning Filter Verification
 *
 * This test verifies that known third-party library warnings are properly filtered
 * in the renderer process to avoid noise in the development console.
 *
 * Purpose: Document and verify the expected filter behavior for Quill.js warnings
 */

describe('Console Warning Filters', () => {
  const originalWarn = console.warn;
  const suppressedWarnings: string[] = [];
  const loggedWarnings: string[] = [];

  beforeEach(() => {
    // Mock console.warn to capture calls
    suppressedWarnings.length = 0;
    loggedWarnings.length = 0;

    console.warn = (...args: any[]) => {
      const message = args[0]?.toString?.() || '';

      // This replicates the filter logic from index.tsx
      const isSuppressed =
        // ReactQuill findDOMNode 相关警告
        message.includes('findDOMNode') ||
        message.includes('findDOMNode is deprecated') ||
        message.includes('Instead, add a ref directly to the element') ||
        message.includes('Learn more about using refs safely') ||
        // Quill DOM 相关警告
        message.includes('DOMNodeInserted') ||
        message.includes('DOM Mutation Event') ||
        message.includes('MutationObserver instead') ||
        message.includes('Listener added for a synchronous') ||
        message.includes('This event type is deprecated') ||
        // Ant Design 相关警告
        message.includes('bodyStyle is deprecated') ||
        // ReactQuill 选择范围相关警告
        message.includes('addRange(): The given range isn\'t in document') ||
        message.includes('setNativeRange') ||
        message.includes('setEditorSelection') ||
        message.includes('Selection setting failed') ||
        message.includes('Selection after image insert failed') ||
        message.includes('Content sync failed') ||
        message.includes('Content change handling failed') ||
        message.includes('Selection change failed') ||
        // React StrictMode 下的重复警告
        message.includes('Warning: ReactDOM.findDOMNode') ||
        message.includes('at ReactQuill') ||
        // Quill 内部错误
        message.includes('setRange') ||
        message.includes('setSelection') ||
        message.includes('getSelection') ||
        // 🆕 非被动事件监听器警告 (Quill list.js)
        message.includes('non-passive event listener') ||
        (message.includes('touchstart') && message.includes('passive'));

      if (isSuppressed) {
        suppressedWarnings.push(message);
      } else {
        loggedWarnings.push(message);
        originalWarn.apply(console, args);
      }
    };
  });

  afterEach(() => {
    // Restore original console.warn
    console.warn = originalWarn;
  });

  describe('Quill non-passive event listener warnings', () => {
    it('should suppress non-passive event listener warnings', () => {
      console.warn('[Violation] Added non-passive event listener to a scroll-blocking \'touchstart\' event. Consider marking event handler as \'passive\' to make the page more responsive.');
      expect(suppressedWarnings).toHaveLength(1);
      expect(loggedWarnings).toHaveLength(0);
    });

    it('should suppress touchstart passive warnings', () => {
      console.warn('[Violation] Added non-passive event listener to a scroll-blocking touchstart event.');
      expect(suppressedWarnings).toHaveLength(1);
      expect(loggedWarnings).toHaveLength(0);
    });

    it('should allow other touchstart warnings not related to passive', () => {
      console.warn('touchstart event fired');
      expect(suppressedWarnings).toHaveLength(0);
      expect(loggedWarnings).toHaveLength(1);
      expect(loggedWarnings[0]).toContain('touchstart event fired');
    });
  });

  describe('Existing Quill warnings', () => {
    it('should suppress findDOMNode warnings', () => {
      console.warn('Warning: findDOMNode is deprecated');
      expect(suppressedWarnings).toHaveLength(1);
      expect(loggedWarnings).toHaveLength(0);
    });

    it('should suppress Selection API warnings', () => {
      console.warn('addRange(): The given range isn\'t in document');
      expect(suppressedWarnings).toHaveLength(1);
      expect(loggedWarnings).toHaveLength(0);
    });
  });

  describe('Non-suppressed warnings', () => {
    it('should allow real error warnings to pass through', () => {
      console.warn('This is a real warning that should be visible');
      expect(suppressedWarnings).toHaveLength(0);
      expect(loggedWarnings).toHaveLength(1);
    });

    it('should allow network errors to pass through', () => {
      console.warn('Network request failed');
      expect(suppressedWarnings).toHaveLength(0);
      expect(loggedWarnings).toHaveLength(1);
    });
  });
});

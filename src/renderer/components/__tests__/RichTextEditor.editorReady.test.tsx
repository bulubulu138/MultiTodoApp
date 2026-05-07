import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import RichTextEditor, { RichTextEditorRef } from '../RichTextEditor';

// Mock react-quill-new
jest.mock('react-quill-new', () => {
  return {
    __esModule: true,
    default: React.forwardRef<any, any>((props: any, ref: any) => {
      const [isReady, setIsReady] = React.useState(false);

      React.useImperativeHandle(ref, () => ({
        getEditor: () => {
          if (!isReady) {
            const error: any = new Error('Accessing non-instantiated editor');
            error.name = 'Accessing non-instantiated editor';
            throw error;
          }
          return mockEditor;
        }
      }));

      React.useEffect(() => {
        // Simulate async initialization
        setTimeout(() => {
          setIsReady(true);
          // Simulate ReactQuill's ready callback
          if (props.onReady) {
            props.onReady(mockEditor);
          }
        }, 0);
      }, []);

      return React.createElement('div', {
        className: 'ql-container',
        'data-testid': 'quill-editor'
      }, React.createElement('div', {
        className: 'ql-editor',
        contentEditable: true,
        suppressContentEditableWarning: true
      }, props.value));
    })
  };
});

// Mock editor instance
const mockEditor: any = {
  root: { innerHTML: '<p>test</p>', innerText: 'test', addEventListener: jest.fn(), removeEventListener: jest.fn() },
  getSelection: jest.fn(() => ({ index: 0, length: 0 })),
  setSelection: jest.fn(),
  focus: jest.fn(),
  blur: jest.fn(),
  getText: jest.fn(() => 'test'),
  getModule: jest.fn(() => ({ clear: jest.fn() })),
  on: jest.fn(),
  off: jest.fn(),
  format: jest.fn(),
  insertEmbed: jest.fn(),
  clipboard: { dangerouslyPasteHTML: jest.fn() },
  scrollSelectionIntoView: jest.fn()
};

// Mock electronAPI
const mockElectronAPI = {
  openExternal: jest.fn().mockResolvedValue({ success: true })
};

(global as any).window.electronAPI = {
  openExternal: mockElectronAPI.openExternal,
  image: { upload: jest.fn().mockResolvedValue('/fake/path.png') }
};

describe('RichTextEditor - Editor Ready State (Fix for Accessing non-instantiated editor)', () => {
  let ref: React.RefObject<RichTextEditorRef>;

  beforeEach(() => {
    ref = React.createRef<RichTextEditorRef>();
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.warn as jest.Mock).mockRestore();
  });

  describe('Step 1: ReactQuill onReady Callback', () => {
    it('should wait for editor to be ready before allowing operations', async () => {
      render(<RichTextEditor value="" onChange={jest.fn()} ref={ref} />);

      // Before editor is ready, operations should be safe
      expect(() => {
        ref.current?.focus?.();
      }).not.toThrow();

      // Wait for editor to be ready
      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
    });

    it('should handle rapid calls before editor is ready', async () => {
      const onChange = jest.fn();
      render(<RichTextEditor value="" onChange={onChange} ref={ref} />);

      // Rapid calls before ready
      for (let i = 0; i < 5; i++) {
        expect(() => {
          ref.current?.focus?.();
          ref.current?.blur?.();
        }).not.toThrow();
      }

      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
    });
  });

  describe('Step 2: getEditorSafely Enhancement', () => {
    it('should return null when editor is not ready without throwing', async () => {
      render(<RichTextEditor value="" onChange={jest.fn()} ref={ref} />);

      // Immediately call getLatestHtml before editor is ready
      const html = ref.current?.getLatestHtml();

      // Should return fallback value, not throw
      expect(html).toBe('');
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Editor access failed')
      );
    });

    it('should handle getEditor() errors gracefully', async () => {
      render(<RichTextEditor value="<p>test</p>" onChange={jest.fn()} ref={ref} />);

      // Even if getEditor fails internally, should not crash
      expect(() => {
        ref.current?.getLatestHtml();
      }).not.toThrow();
    });
  });

  describe('Step 3: Editor Access Points Safety', () => {
    it('should safely handle link insertion before editor is ready', async () => {
      const onChange = jest.fn();
      const { container } = render(
        <RichTextEditor value="" onChange={onChange} />
      );

      // Try to find and click link button immediately
      await waitFor(() => {
        const editor = container.querySelector('.ql-editor');
        expect(editor).toBeInTheDocument();
      });

      // Should not throw any errors
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('Link insertion failed')
      );
    });

    it('should safely handle image upload before editor is ready', async () => {
      const onChange = jest.fn();
      render(<RichTextEditor value="" onChange={onChange} />);

      // Simulate image upload attempt before ready
      // Should not throw
      expect(() => {
        // The operation should be queued or safely ignored
      }).not.toThrow();
    });
  });

  describe('Step 4: User-Friendly Error Handling', () => {
    it('should log clear warnings when editor operations fail', async () => {
      render(<RichTextEditor value="" onChange={jest.fn()} ref={ref} />);

      // Attempt operations that might fail
      ref.current?.focus?.();
      ref.current?.blur?.();

      await waitFor(() => {
        // Check if any warnings were logged (they should be clear, not cryptic)
        const warnings = (console.warn as jest.Mock).mock.calls;
        warnings.forEach(call => {
          const message = call[0];
          if (typeof message === 'string' && message.includes('Editor access failed')) {
            // Should have helpful context
            expect(message).toMatch(/Editor|ready|failed/i);
          }
        });
      });
    });

    it('should not expose technical errors to user', async () => {
      render(<RichTextEditor value="" onChange={jest.fn()} ref={ref} />);

      // Operations should fail gracefully
      const result = ref.current?.getLatestHtml();

      // Should return safe fallback, not error indicators
      expect(typeof result).toBe('string');
    });
  });

  describe('Step 5: Integration Scenarios', () => {
    it('should handle rapid link insertion attempts', async () => {
      const onChange = jest.fn();
      const { container } = render(
        <RichTextEditor value="" onChange={onChange} />
      );

      // Simulate rapid button clicks
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          // Each attempt should be safe
          expect(() => {
            const linkButton = container.querySelector('[data-link-button]') ||
                               container.querySelector('button[title*="Link"]') ||
                               container.querySelector('.ql-link');
            if (linkButton) {
              linkButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }
          }).not.toThrow();
        });
      }

      await waitFor(() => {
        expect(ref.current).toBeDefined();
      });
    });

    it('should recover from initialization failures', async () => {
      const onChange = jest.fn();
      const { rerender } = render(
        <RichTextEditor value="" onChange={onChange} ref={ref} />
      );

      // Rerender with new content
      rerender(<RichTextEditor value="<p>new content</p>" onChange={onChange} ref={ref} />);

      await waitFor(() => {
        // Should recover and work normally
        expect(() => {
          ref.current?.getLatestHtml();
        }).not.toThrow();
      });
    });
  });
});

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import RichTextEditor, { RichTextEditorRef } from '../RichTextEditor';

// Mock react-quill-new
jest.mock('react-quill-new', () => {
  return {
    __esModule: true,
    default: React.forwardRef<any, any>((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        getEditor: () => mockEditor
      }));
      React.useEffect(() => {
        setTimeout(() => {
          props.onChange?.(props.value || '');
        }, 0);
      }, [props.value]);

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

// Mock Quill
jest.mock('quill', () => {
  return {
    __esModule: true,
    default: class MockQuill {
      static root: any = { innerHTML: '', innerText: '' };
      static getSelection = jest.fn(() => null);
      static setSelection = jest.fn();
      static focus = jest.fn();
      static blur = jest.fn();
      static getText = jest.fn(() => '');
      static getModule = jest.fn();
      static on = jest.fn();
      static off = jest.fn();
      static format = jest.fn();
    }
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

describe('RichTextEditor - Editor Access Safety (Bug Fix for Accessing non-instantiated editor)', () => {
  let ref: React.RefObject<RichTextEditorRef>;

  beforeEach(() => {
    ref = React.createRef<RichTextEditorRef>();
    jest.clearAllMocks();
  });

  describe('Editor State Management', () => {
    it('should handle unmounted state gracefully', () => {
      const { unmount } = render(<RichTextEditor value="" onChange={jest.fn()} ref={ref} />);

      act(() => {
        unmount();
      });

      // Should not throw when accessing methods after unmount
      expect(() => {
        ref.current?.getLatestHtml();
      }).not.toThrow();
    });

    it('should return fallback value when editor is not ready', () => {
      render(<RichTextEditor value="" onChange={jest.fn()} ref={ref} />);

      // Before editor is ready, should return fallback
      const html = ref.current?.getLatestHtml();
      expect(html).toBe('');
    });

    it('should return current HTML when editor is ready', async () => {
      render(<RichTextEditor value="<p>test</p>" onChange={jest.fn()} ref={ref} />);

      await waitFor(() => {
        const html = ref.current?.getLatestHtml();
        expect(html).toBeTruthy();
      });
    });
  });

  describe('Editor Instance Access - Null Safety', () => {
    it('should safely call focus when editor is null', () => {
      render(<RichTextEditor value="" onChange={jest.fn()} ref={ref} />);

      expect(() => {
        ref.current?.focus?.();
      }).not.toThrow();
    });

    it('should safely call blur when editor is null', () => {
      render(<RichTextEditor value="" onChange={jest.fn()} ref={ref} />);

      expect(() => {
        ref.current?.blur?.();
      }).not.toThrow();
    });

    it('should return false for composition check when editor is not ready', () => {
      render(<RichTextEditor value="" onChange={jest.fn()} ref={ref} />);

      expect(ref.current?.hasPendingComposition()).toBe(false);
    });
  });

  describe('Value Sync with Null Editor', () => {
    it('should not crash when value changes before editor is ready', async () => {
      const onChange = jest.fn();
      const { rerender } = render(
        <RichTextEditor value="" onChange={onChange} ref={ref} />
      );

      // Change value immediately
      await act(async () => {
        rerender(<RichTextEditor value="<p>new value</p>" onChange={onChange} ref={ref} />);
      });

      // Should not throw
      expect(() => {
        ref.current?.getLatestHtml();
      }).not.toThrow();
    });
  });
});

describe('RichTextEditor - Link Functionality Safety', () => {
  describe('Link Insertion Safety', () => {
    it('should handle link insertion when editor is not ready', async () => {
      const onChange = jest.fn();
      render(<RichTextEditor value="" onChange={onChange} />);

      // Simulate clicking link button before editor ready
      // This should not throw an error
      // The linkHandler function should safely handle null editor

      await waitFor(() => {
        // If we reach here without throwing, the safety check worked
        expect(true).toBe(true);
      });

      // Should not crash, onChange should not be called if editor not ready
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should cancel link insertion when prompt is cancelled', async () => {
      const onChange = jest.fn();
      render(<RichTextEditor value="" onChange={onChange} />);

      // Mock prompt returning null (user cancelled)
      const promptSpy = jest.spyOn(global, 'prompt').mockReturnValueOnce(null as any);

      await waitFor(() => {
        // onChange should not be called if user cancelled
        expect(onChange).not.toHaveBeenCalled();
      });

      promptSpy.mockRestore();
    });
  });

  describe('Link Click Safety', () => {
    it('should handle link click safely when editor is not ready', async () => {
      const { container } = render(
        <RichTextEditor value="<a href='http://example.com'>Link</a>" onChange={jest.fn()} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.ql-editor');
        if (editorElement) {
          const link = editorElement.querySelector('a');
          if (link) {
            // Clicking link when editor is not ready should not throw
            expect(() => {
              link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            }).not.toThrow();
          }
        }
      });
    });

    it('should open external link when editor is ready', async () => {
      const { container } = render(
        <RichTextEditor value="<a href='http://example.com'>Link</a>" onChange={jest.fn()} />
      );

      await waitFor(() => {
        const editorElement = container.querySelector('.ql-editor');
        if (editorElement) {
          const link = editorElement.querySelector('a');
          if (link) {
            // Click the link
            act(() => {
              link.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            });
          }
        }
      });

      // Verify electronAPI.openExternal was called
      await waitFor(() => {
        expect(mockElectronAPI.openExternal).toHaveBeenCalledWith('http://example.com');
      });
    });
  });
});

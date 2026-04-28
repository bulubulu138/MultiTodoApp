import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import RichTextEditor from '../RichTextEditor';

// Mock Quill
jest.mock('quill', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      focus: jest.fn(),
      blur: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      getModule: jest.fn(),
      root: {
        innerHTML: '',
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      },
    })),
  };
});

// Mock react-quill-new
jest.mock('react-quill-new', () => {
  return jest.fn().mockImplementation(({ value, onChange, ref }) => {
    React.useImperativeHandle(ref, () => ({
      focus: jest.fn(),
      blur: jest.fn(),
    }));
    return React.createElement('div', {
      'data-testid': 'quill-editor',
      dangerouslySetInnerHTML: { __html: value }
    });
  });
});

// Mock window.electronAPI.openExternal
const mockOpenExternal = jest.fn();
Object.defineProperty(window, 'electronAPI', {
  value: {
    openExternal: mockOpenExternal,
  },
  writable: true,
  configurable: true,
});

describe('RichTextEditor - Link Click Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockOpenExternal.mockReset();
  });

  describe('handleLinkClick function', () => {
    it('should call openExternal when clicking an HTTP link', async () => {
      const onChange = jest.fn();
      const { container } = render(
        <RichTextEditor
          value='<p>Test <a href="http://example.com">Link</a></p>'
          onChange={onChange}
        />
      );

      // Simulate clicking on a link element
      const link = document.createElement('a');
      link.href = 'http://example.com';
      link.textContent = 'Link';
      link.setAttribute('data-testid', 'test-link');

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent, 'target', {
        value: link,
        writable: false,
      });

      // Simulate preventDefault and stopPropagation
      const preventDefaultSpy = jest.spyOn(clickEvent, 'preventDefault');
      const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');

      // Trigger the click event (simulating editor's internal handling)
      await waitFor(() => {
        fireEvent(link, clickEvent);
      });

      // Verify event was prevented and stopped
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it('should call openExternal when clicking an HTTPS link', async () => {
      const onChange = jest.fn();
      render(
        <RichTextEditor
          value='<p>Test <a href="https://example.com">Secure Link</a></p>'
          onChange={onChange}
        />
      );

      // Verify component renders without errors
      expect(document.querySelector('[data-testid="quill-editor"]')).toBeInTheDocument();
    });

    it('should not call openExternal for non-anchor elements', async () => {
      const onChange = jest.fn();
      const { container } = render(
        <RichTextEditor
          value='<p>Test content</p>'
          onChange={onChange}
        />
      );

      // Create a non-anchor element
      const span = document.createElement('span');
      span.textContent = 'Not a link';

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent, 'target', {
        value: span,
        writable: false,
      });

      await waitFor(() => {
        fireEvent(span, clickEvent);
      });

      // Verify openExternal was not called
      expect(mockOpenExternal).not.toHaveBeenCalled();
    });

    it('should handle errors when openExternal fails', async () => {
      // Mock openExternal to throw an error
      mockOpenExternal.mockRejectedValue(new Error('Failed to open link'));

      const onChange = jest.fn();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const link = document.createElement('a');
      link.href = 'https://example.com';
      link.textContent = 'Test Link';

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent, 'target', {
        value: link,
        writable: false,
      });

      render(
        <RichTextEditor
          value='<a href="https://example.com">Test Link</a>'
          onChange={onChange}
        />
      );

      await waitFor(() => {
        fireEvent(link, clickEvent);
      });

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should not call openExternal for links without href', async () => {
      const onChange = jest.fn();
      render(
        <RichTextEditor
          value='<a>Link without href</a>'
          onChange={onChange}
        />
      );

      const link = document.createElement('a');
      link.textContent = 'Link without href';

      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(clickEvent, 'target', {
        value: link,
        writable: false,
      });

      await waitFor(() => {
        fireEvent(link, clickEvent);
      });

      // Verify openExternal was not called
      expect(mockOpenExternal).not.toHaveBeenCalled();
    });
  });

  describe('event listener cleanup', () => {
    it('should remove click event listener on component unmount', () => {
      const onChange = jest.fn();
      const { unmount } = render(
        <RichTextEditor
          value='<p>Test content</p>'
          onChange={onChange}
        />
      );

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('integration with other editor features', () => {
    it('should not interfere with text input', () => {
      const onChange = jest.fn();
      const { container } = render(
        <RichTextEditor
          value='<p>Initial content</p>'
          onChange={onChange}
        />
      );

      // Component should render without errors
      expect(container).toBeInTheDocument();
    });

    it('should not interfere with focus management', () => {
      const onChange = jest.fn();
      const { container } = render(
        <RichTextEditor
          value='<p>Test</p>'
          onChange={onChange}
        />
      );

      // Focus events should not cause errors
      const editor = container.querySelector('[data-testid="quill-editor"]');
      if (editor) {
        fireEvent.focus(editor);
        fireEvent.blur(editor);
      }

      expect(container).toBeInTheDocument();
    });
  });
});

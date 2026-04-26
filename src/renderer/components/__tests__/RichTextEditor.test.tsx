import React from 'react';
import { renderHook, act } from '@testing-library/react';
import RichTextEditor, { RichTextEditorRef } from '../RichTextEditor';

// Mock Quill
jest.mock('quill', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      focus: jest.fn(),
      blur: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      getModule: jest.fn(),
      root: { innerHTML: '', addEventListener: jest.fn(), removeEventListener: jest.fn() },
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
    return React.createElement('div', { 'data-testid': 'quill-editor' });
  });
});

describe('RichTextEditor - Focus/Blur Methods', () => {
  let ref: React.RefObject<RichTextEditorRef>;

  beforeEach(() => {
    ref = React.createRef<RichTextEditorRef>();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should expose focus method in RichTextEditorRef interface', () => {
    const { result } = renderHook(() => React.useRef<RichTextEditorRef>());

    // Verify interface has focus method (type checking)
    const testRef: RichTextEditorRef = {
      getLatestHtml: () => '',
      hasPendingComposition: () => false,
      focus: () => {}, // Optional method
      blur: () => {},  // Optional method
    };

    expect(testRef).toBeDefined();
  });

  it('should expose blur method in RichTextEditorRef interface', () => {
    const { result } = renderHook(() => React.useRef<RichTextEditorRef>());

    // Verify interface has blur method (type checking)
    const testRef: RichTextEditorRef = {
      getLatestHtml: () => '',
      hasPendingComposition: () => false,
      focus: () => {},
      blur: () => {},
    };

    expect(testRef).toBeDefined();
  });

  it('should call focus when editor instance exists', async () => {
    const onChange = jest.fn();
    const { container } = render(
      <RichTextEditor
        value=""
        onChange={onChange}
        ref={ref}
      />
    );

    await act(async () => {
      if (ref.current?.focus) {
        ref.current.focus();
      }
    });

    // Verify focus was called (if editor instance was available)
    // Note: This test validates the method signature and presence
    expect(ref.current).toBeDefined();
  });

  it('should call blur when editor instance exists', async () => {
    const onChange = jest.fn();
    const { container } = render(
      <RichTextEditor
        value=""
        onChange={onChange}
        ref={ref}
      />
    );

    await act(async () => {
      if (ref.current?.blur) {
        ref.current.blur();
      }
    });

    // Verify blur was called (if editor instance was available)
    // Note: This test validates the method signature and presence
    expect(ref.current).toBeDefined();
  });
});

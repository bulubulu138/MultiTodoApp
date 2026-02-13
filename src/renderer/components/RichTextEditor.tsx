import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import Quill from 'quill';
import ReactQuill from 'react-quill-new';
import 'quill/dist/quill.snow.css';
import type { EmbeddedFlowchartV1 } from '../../shared/types';
import { FlowchartModal } from './FlowchartModal';
import { registerFlowchartBlot } from './quill-blots/FlowchartBlot';
import {
  createEmptyEmbeddedFlowchart,
  normalizeEmbeddedFlowchart,
  parseEmbeddedFlowchart,
} from '../utils/embeddedFlowchart';
import { generateFlowchartThumbnail } from '../utils/flowchartThumbnailGenerator';

registerFlowchartBlot();

const FLOWCHART_MARKUP_PATTERN = /<flowchart-preview\b|data-flowchart=/i;

export interface RichTextEditorRef {
  getLatestHtml: () => string;
  hasPendingComposition: () => boolean;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  enableFlowchartEmbed?: boolean;
  flowchartContext?: {
    todoId?: number;
    todoTitle?: string;
  };
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  value,
  onChange,
  placeholder = '输入内容...',
  style,
  enableFlowchartEmbed = false,
  flowchartContext,
}, ref) => {
  const quillRef = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [hasError, setHasError] = useState(false);

  const [flowchartModalOpen, setFlowchartModalOpen] = useState(false);
  const [activeFlowchart, setActiveFlowchart] = useState<EmbeddedFlowchartV1 | null>(null);
  const [flowchartInsertIndex, setFlowchartInsertIndex] = useState<number | null>(null);
  const [isEditingEmbeddedFlowchart, setIsEditingEmbeddedFlowchart] = useState(false);

  // 添加输入状态和焦点状态追踪
  const isComposingRef = useRef(false);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
    setHasError(false);

    const timer = setTimeout(() => {
      setIsReady(true);
    }, 50);

    return () => {
      clearTimeout(timer);
      setIsMounted(false);
      setEditorInstance(null);
    };
  }, []);

  useEffect(() => {
    if (isReady && editorInstance && value !== editorInstance.root.innerHTML) {
      try {
        if (isComposingRef.current || isFocusedRef.current) {
          return;
        }

        const currentHtml = editorInstance.root.innerHTML;
        const containsFlowchartEmbed =
          FLOWCHART_MARKUP_PATTERN.test(value) ||
          FLOWCHART_MARKUP_PATTERN.test(currentHtml);
        const currentText = editorInstance.getText();
        const incomingText = value.replace(/<[^>]*>/g, '').trim();
        const shouldSyncHtml = containsFlowchartEmbed || currentText.trim() !== incomingText;

        if (shouldSyncHtml) {
          const selection = editorInstance.getSelection();

          try {
            const historyModule = editorInstance.getModule('history');
            if (historyModule) {
              historyModule.clear();
            }
          } catch (error) {
            console.warn('Failed to clear history:', error);
          }

          editorInstance.clipboard.dangerouslyPasteHTML(value);

          if (selection) {
            try {
              editorInstance.setSelection(selection.index, selection.length);
            } catch {
              // noop
            }
          }
        }
      } catch (error) {
        console.warn('Content sync failed:', error);
      }
    }
  }, [value, isReady, editorInstance]);

  // Verify flowchart format registration
  useEffect(() => {
    if (isReady && editorInstance && enableFlowchartEmbed) {
      // Verify flowchart format is registered
      try {
        console.log('[RichTextEditor] Verifying flowchart format registration...');
        registerFlowchartBlot();
        console.log('[RichTextEditor] Flowchart format verified');
      } catch (error) {
        console.error('[RichTextEditor] Format verification failed:', error);
      }
    }
  }, [isReady, editorInstance, enableFlowchartEmbed]);

  const getEditorSafely = useCallback(() => {
    if (!isMounted || !quillRef.current) return null;

    try {
      if (!editorInstance) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          setEditorInstance(editor);
          return editor;
        }
        return null;
      }

      return editorInstance;
    } catch (error) {
      console.warn('Editor access failed:', error);
      setEditorInstance(null);
      return null;
    }
  }, [isMounted, editorInstance]);

  const getLatestHtml = useCallback(() => {
    const editor = getEditorSafely();
    return editor?.root?.innerHTML ?? value;
  }, [getEditorSafely, value]);

  useImperativeHandle(ref, () => ({
    getLatestHtml,
    hasPendingComposition: () => isComposingRef.current,
  }), [getLatestHtml]);

  useEffect(() => {
    const editor = getEditorSafely();
    if (!editor) return;

    const editorElement = editor.root;
    if (!editorElement) return;

    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;

      try {
        const currentContent = editor.root.innerHTML;
        onChange(currentContent);
      } catch (error) {
        console.warn('Failed to trigger onChange after composition:', error);
      }
    };

    const handleFocus = () => {
      isFocusedRef.current = true;
    };

    const handleBlur = () => {
      isFocusedRef.current = false;
    };

    editorElement.addEventListener('compositionstart', handleCompositionStart);
    editorElement.addEventListener('compositionend', handleCompositionEnd);
    editorElement.addEventListener('focus', handleFocus);
    editorElement.addEventListener('blur', handleBlur);

    return () => {
      editorElement.removeEventListener('compositionstart', handleCompositionStart);
      editorElement.removeEventListener('compositionend', handleCompositionEnd);
      editorElement.removeEventListener('focus', handleFocus);
      editorElement.removeEventListener('blur', handleBlur);
    };
  }, [editorInstance, getEditorSafely, onChange]);

  const openFlowchartModal = useCallback(
    (index: number, flowchart: EmbeddedFlowchartV1, editingExisting: boolean) => {
      setFlowchartInsertIndex(index);
      setActiveFlowchart(flowchart);
      setIsEditingEmbeddedFlowchart(editingExisting);
      setFlowchartModalOpen(true);
    },
    []
  );

  useEffect(() => {
    if (!enableFlowchartEmbed) {
      return;
    }

    const editor = getEditorSafely();
    if (!editor?.root) {
      return;
    }

    const editorRoot = editor.root as HTMLElement;

    const clearFlowchartSelectionState = () => {
      editorRoot
        .querySelectorAll("flowchart-preview[data-selected='true']")
        .forEach((element) => element.removeAttribute('data-selected'));
    };

    const markFlowchartSelectionState = (range: { index: number; length: number } | null) => {
      clearFlowchartSelectionState();
      if (!range || range.length !== 1) {
        return;
      }

      const [leaf] = editor.getLeaf(range.index);
      if ((leaf as any)?.statics?.blotName !== 'flowchart') {
        return;
      }

      const flowchartElement = (leaf as any)?.domNode as HTMLElement | undefined;
      if (flowchartElement?.tagName?.toLowerCase() === 'flowchart-preview') {
        flowchartElement.dataset.selected = 'true';
      }
    };

    const getFlowchartFromEventTarget = (target: EventTarget | null): HTMLElement | null => {
      const element = target as HTMLElement | null;
      if (!element) {
        return null;
      }
      return element.closest('flowchart-preview') as HTMLElement | null;
    };

    const resolveFlowchartDeleteIndex = (key: 'Backspace' | 'Delete'): number | null => {
      const range = editor.getSelection();
      if (!range) {
        return null;
      }

      let targetIndex: number;
      if (range.length === 1) {
        targetIndex = range.index;
      } else if (range.length === 0) {
        targetIndex = key === 'Backspace' ? range.index - 1 : range.index;
      } else {
        return null;
      }

      if (targetIndex < 0 || targetIndex >= editor.getLength()) {
        return null;
      }

      const [leaf] = editor.getLeaf(targetIndex);
      if ((leaf as any)?.statics?.blotName !== 'flowchart') {
        return null;
      }

      return targetIndex;
    };

    const handleFlowchartClick = (event: MouseEvent) => {
      const flowchartElement = getFlowchartFromEventTarget(event.target);
      if (!flowchartElement) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const blot = Quill.find(flowchartElement);
      if (!blot) {
        return;
      }

      const index = editor.getIndex(blot);
      editor.focus();
      editor.setSelection(index, 1, 'user');
      markFlowchartSelectionState({ index, length: 1 });
    };

    const handleFlowchartDoubleClick = (event: MouseEvent) => {
      const flowchartElement = getFlowchartFromEventTarget(event.target);
      if (!flowchartElement) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const blot = Quill.find(flowchartElement);
      if (!blot) {
        return;
      }

      const index = editor.getIndex(blot);
      const raw = flowchartElement.getAttribute('data-flowchart') ?? flowchartElement.dataset.flowchart ?? '';
      const flowchart = parseEmbeddedFlowchart(raw);
      openFlowchartModal(index, flowchart, true);
    };

    const handleEditorKeyDown = (event: KeyboardEvent) => {
      if (flowchartModalOpen) {
        return;
      }

      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return;
      }

      const deleteIndex = resolveFlowchartDeleteIndex(event.key);
      if (deleteIndex === null) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      editor.deleteText(deleteIndex, 1, 'user');
      markFlowchartSelectionState(editor.getSelection());

      setTimeout(() => {
        try {
          onChange(editor.root.innerHTML);
        } catch (error) {
          console.warn('[RichTextEditor] Failed to sync content after flowchart delete:', error);
        }
      }, 0);
    };

    const handleSelectionChange = (range: { index: number; length: number } | null) => {
      markFlowchartSelectionState(range);
    };

    editorRoot.addEventListener('click', handleFlowchartClick);
    editorRoot.addEventListener('dblclick', handleFlowchartDoubleClick);
    editorRoot.addEventListener('keydown', handleEditorKeyDown);
    editor.on('selection-change', handleSelectionChange);
    markFlowchartSelectionState(editor.getSelection());

    return () => {
      editorRoot.removeEventListener('click', handleFlowchartClick);
      editorRoot.removeEventListener('dblclick', handleFlowchartDoubleClick);
      editorRoot.removeEventListener('keydown', handleEditorKeyDown);
      editor.off('selection-change', handleSelectionChange);
      clearFlowchartSelectionState();
    };
  }, [enableFlowchartEmbed, flowchartModalOpen, getEditorSafely, onChange, openFlowchartModal]);

  useEffect(() => {
    if (!enableFlowchartEmbed || !containerRef.current || !isReady) {
      return;
    }

    const customizeButton = () => {
      const button = containerRef.current?.querySelector('.ql-flowchart') as HTMLButtonElement | null;
      if (!button || button.dataset.customized) {
        return;
      }

      button.title = '插入流程图';
      button.setAttribute('aria-label', '插入流程图');
      button.innerHTML = `
        <svg viewBox="0 0 18 18" aria-hidden="true">
          <rect class="ql-stroke" x="3" y="3" width="4" height="4"></rect>
          <rect class="ql-stroke" x="11" y="11" width="4" height="4"></rect>
          <path class="ql-stroke" d="M7 5h3a1 1 0 0 1 1 1v5"></path>
        </svg>
      `;
      button.dataset.customized = 'true';
    };

    customizeButton();

    const observer = new MutationObserver(() => {
      customizeButton();
    });

    observer.observe(containerRef.current, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [enableFlowchartEmbed, isReady, editorInstance]);

  const imageHandler = async () => {
    const editor = getEditorSafely();
    if (!editor) return;

    try {
      const imagePath = await window.electronAPI.image.upload();
      if (imagePath) {
        const range = editor.getSelection(true);
        if (range) {
          const safePath = imagePath.replace(/\\/g, '/');
          editor.insertEmbed(range.index, 'image', `file://${safePath}`);

          setTimeout(() => {
            try {
              const newPosition = range.index + 1;
              editor.setSelection(newPosition, 0);
            } catch {
              // noop
            }
          }, 0);
        }
      }
    } catch (error) {
      console.error('Image upload error:', error);
    }
  };

  const flowchartHandler = useCallback(() => {
    if (!enableFlowchartEmbed) {
      return;
    }

    const editor = getEditorSafely();
    if (!editor) {
      return;
    }

    const range = editor.getSelection(true);
    const index = range ? range.index : editor.getLength();

    openFlowchartModal(index, createEmptyEmbeddedFlowchart(), false);
  }, [enableFlowchartEmbed, getEditorSafely, openFlowchartModal]);

  const closeFlowchartModal = useCallback(() => {
    setFlowchartModalOpen(false);
    setActiveFlowchart(null);
    setFlowchartInsertIndex(null);
    setIsEditingEmbeddedFlowchart(false);
  }, []);

  const handleFlowchartSave = useCallback(
    async (flowchart: EmbeddedFlowchartV1) => {
      const editor = getEditorSafely();
      if (!editor) {
        closeFlowchartModal();
        return;
      }

      const index =
        flowchartInsertIndex ??
        (editor.getSelection(true)?.index ?? editor.getLength());

      try {
        const thumbnail = await generateFlowchartThumbnail(
          flowchart.nodes,
          flowchart.edges,
          flowchart.viewport
        );

        const valueToInsert = normalizeEmbeddedFlowchart({
          ...flowchart,
          thumbnail,
          updatedAt: Date.now(),
        });

        if (isEditingEmbeddedFlowchart) {
          editor.deleteText(index, 1, 'user');
        }

        editor.insertEmbed(index, 'flowchart', valueToInsert, 'user');
        editor.setSelection(index + 1, 0, 'silent');

        setTimeout(() => {
          try {
            const latestHtml = editor.root.innerHTML;
            onChange(latestHtml);

            if (process.env.NODE_ENV === 'development') {
              console.log('[RichTextEditor] Synced flowchart HTML after insert', {
                length: latestHtml.length,
                hasFlowchart: FLOWCHART_MARKUP_PATTERN.test(latestHtml),
              });
            }
          } catch (syncError) {
            console.warn('[RichTextEditor] Failed to sync flowchart HTML after insert:', syncError);
          }
        }, 0);

        // Verify insertion was successful
        setTimeout(() => {
          try {
            const insertedContent = editor.getContents();
            const hasFlowchart = insertedContent.ops?.some((op: any) =>
              op.insert && typeof op.insert === 'object' && 'flowchart' in op.insert
            );

            if (!hasFlowchart) {
              console.error('[RichTextEditor] Flowchart insertion validation failed', {
                index,
                valueToInsert
              });
            } else {
              console.log('[RichTextEditor] Flowchart inserted successfully');
            }
          } catch (error) {
            console.warn('[RichTextEditor] Flowchart verification check failed:', error);
          }
        }, 100);
      } catch (error) {
        console.error('Failed to insert flowchart embed:', error);
      } finally {
        closeFlowchartModal();
      }
    },
    [closeFlowchartModal, flowchartInsertIndex, getEditorSafely, isEditingEmbeddedFlowchart, onChange]
  );

  const toolbarConfig = [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    enableFlowchartEmbed ? ['link', 'image', 'flowchart'] : ['link', 'image'],
    ['clean'],
  ];

  const modules = {
    toolbar: {
      container: toolbarConfig,
      handlers: {
        image: imageHandler,
        ...(enableFlowchartEmbed ? { flowchart: flowchartHandler } : {}),
      },
    },
    clipboard: {
      matchVisual: false,
    },
    history: {
      delay: 1000,
      maxStack: 50,
      userOnly: true,
    },
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'indent',
    'link', 'image',
    ...(enableFlowchartEmbed ? ['flowchart'] : []),
  ];

  if (hasError) {
    return (
      <div style={{ ...style, minHeight: '250px' }}>
        <div style={{
          padding: '20px',
          border: '1px solid #ff4d4f',
          borderRadius: '6px',
          backgroundColor: '#fff2f0',
          textAlign: 'center'
        }}>
          <p style={{ color: '#ff4d4f', marginBottom: '10px' }}>富文本编辑器加载失败</p>
          <textarea
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '10px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              resize: 'vertical'
            }}
            value={value.replace(/<[^>]*>/g, '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        </div>
      </div>
    );
  }

  if (!isReady) {
    return <div style={{ ...style, minHeight: '250px', padding: '10px' }}>加载编辑器...</div>;
  }

  return (
    <>
      <div ref={containerRef} style={{ ...style, minHeight: '250px' }}>
        <ReactQuill
          ref={quillRef}
          theme="snow"
          value={value}
          onChange={(content) => {
            try {
              if (isComposingRef.current) {
                return;
              }

              onChange(content);
            } catch (error) {
              console.warn('Content change handling failed:', error);
              setHasError(true);
            }
          }}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          preserveWhitespace={false}
          bounds={containerRef.current || undefined}
        />
      </div>

      {enableFlowchartEmbed && (
        <FlowchartModal
          open={flowchartModalOpen}
          initialValue={activeFlowchart}
          todoTitle={flowchartContext?.todoTitle}
          onCancel={closeFlowchartModal}
          onSave={handleFlowchartSave}
        />
      )}
    </>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;


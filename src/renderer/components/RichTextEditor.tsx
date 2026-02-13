import React, { useRef, useEffect, useState, useCallback } from 'react';
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

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '输入内容...',
  style,
  enableFlowchartEmbed = false,
  flowchartContext,
}) => {
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

        const currentText = editorInstance.getText();

        if (currentText.trim() !== value.replace(/<[^>]*>/g, '').trim()) {
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

    const handleFlowchartClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      const flowchartElement = target.closest('flowchart-preview') as HTMLElement | null;
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

    editor.root.addEventListener('click', handleFlowchartClick);

    return () => {
      editor.root.removeEventListener('click', handleFlowchartClick);
    };
  }, [enableFlowchartEmbed, getEditorSafely, openFlowchartModal]);

  useEffect(() => {
    if (!enableFlowchartEmbed || !containerRef.current) {
      return;
    }

    const button = containerRef.current.querySelector('.ql-flowchart') as HTMLButtonElement | null;
    if (button && !button.dataset.customized) {
      button.textContent = 'Flow';
      button.title = '插入流程图';
      button.dataset.customized = 'true';
    }
  }, [enableFlowchartEmbed, isReady]);

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
      } catch (error) {
        console.error('Failed to insert flowchart embed:', error);
      } finally {
        closeFlowchartModal();
      }
    },
    [closeFlowchartModal, flowchartInsertIndex, getEditorSafely, isEditingEmbeddedFlowchart]
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
};

export default RichTextEditor;


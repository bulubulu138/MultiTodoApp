import React, { useRef, forwardRef, useImperativeHandle, useEffect, useState, Component, useCallback } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { upload, uploadConfig } from '@milkdown/plugin-upload';
import { replaceAll } from '@milkdown/utils';
import type { Ctx } from '@milkdown/ctx';
import type { Schema, Node, Fragment } from '@milkdown/prose/model';
import { DOMParser } from '@milkdown/prose/model';
import type { EditorState, Transaction, Selection } from '@milkdown/prose/state';
import { TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import '@milkdown/theme-nord/style.css';
import MarkdownToolbar from './MarkdownToolbar';

export interface MilkdownEditorRef {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  blur: () => void;
  insertMarkdown: (type: 'bold' | 'italic' | 'strike' | 'underline' | 'link', value?: string) => void;
}

export interface MilkdownEditorProps {
  value?: string;
  onChange?: (markdown: string) => void;
  readOnly?: boolean;
  style?: React.CSSProperties;
  minHeight?: string | number;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function makeImageNode(src: string, alt: string, schema: Schema): Promise<Node> {
  return schema.nodes.image.createAndFill({ src, alt, title: alt }) as Node;
}

function buildUploader(schema: Schema) {
  return async (files: FileList): Promise<Fragment | Node | Node[]> => {
    const nodes: Node[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      try {
        let src: string;

        const base64 = await fileToBase64(file);
        if (window.electronAPI?.image?.saveBase64) {
          const savedPath = await window.electronAPI.image.saveBase64(base64, file.name);
          src = savedPath ?? base64;
        } else {
          src = base64;
        }

        const node = await makeImageNode(src, file.name, schema);
        nodes.push(node);
      } catch (err) {
        console.error('[MilkdownEditor] Image upload failed:', err);
      }
    }

    return nodes;
  };
}

// ErrorBoundary组件：捕获子组件中的JavaScript错误
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

class MilkdownEditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MilkdownEditorErrorBoundary] ❌ Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div
          style={{
            border: '1px solid #ff4d4f',
            borderRadius: '6px',
            backgroundColor: '#fff2f0',
            padding: '16px',
            textAlign: 'center',
            color: '#ff4d4f',
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold' }}>⚠️ 编辑器发生错误</p>
          <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
            {this.state.error?.message || '未知错误'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

const MilkdownEditor = forwardRef<MilkdownEditorRef, MilkdownEditorProps>(
  ({ value = '', onChange, readOnly = false, style, minHeight = '200px' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);
    const contentRef = useRef<string>(value);
    const onChangeRef = useRef(onChange);
    // 每次 initEditor 生成一个唯一 ID，cleanup 时令其失效，
    // 防止 React Strict Mode 第一次 mount 的回调污染第二次 mount
    const activeInstanceIdRef = useRef<number>(0);

    // 状态管理：初始化状态和错误信息
    const [initStatus, setInitStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [initError, setInitError] = useState<string | null>(null);
    // ref 跟踪内部初始化是否完成，避免超时检测与 state 形成循环依赖
    const isInitializedRef = useRef<boolean>(false);

    // 添加一个 ref 来存储 insertMarkdown 方法
    const insertMarkdownRef = useRef<((type: 'bold' | 'italic' | 'strike' | 'underline' | 'link', value?: string) => void) | null>(null);

    // 始终指向最新 onChange，避免闭包陷阱
    onChangeRef.current = onChange;

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      isInitializedRef.current = false;
      let editor: Editor | null = null;
      // 为本次 mount 分配唯一 ID
      const instanceId = Date.now() + Math.random();
      activeInstanceIdRef.current = instanceId;
      // 捕获本次 mount 的初始值（不受后续 prop 变化影响）
      const initialValue = value;

      // 超时检测：只在本次 effect 生命周期内生效，不依赖 state
      const isDev = process.env.NODE_ENV === 'development';
      const timeoutMs = isDev ? 15000 : 10000;
      const timeoutId = setTimeout(() => {
        if (!isInitializedRef.current) {
          console.error(`[MilkdownEditor] ❌ Initialization timeout (${timeoutMs / 1000}s)`);
          setInitStatus('error');
          setInitError(`编辑器初始化超时（${timeoutMs / 1000}秒），请刷新页面重试`);
        }
      }, timeoutMs);

      const initEditor = async () => {
        const t0 = performance.now();
        try {
          editor = await Editor.make()
            .config((ctx: Ctx) => {
              ctx.set(rootCtx, container);
              ctx.set(defaultValueCtx, initialValue);
              ctx.set(editorViewOptionsCtx, { editable: () => !readOnly });

              ctx.get(listenerCtx).markdownUpdated((_, markdown) => {
                // 若当前实例已被 cleanup 失效，直接忽略所有回调
                if (activeInstanceIdRef.current !== instanceId) {
                  return;
                }

                // 内容与已知值相同时不触发（包含初始化后的首次同步）
                if (markdown === contentRef.current) {
                  return;
                }

                contentRef.current = markdown;
                onChangeRef.current?.(markdown);
              });

              ctx.update(uploadConfig.key, (prev) => ({
                ...prev,
                uploader: (_files: FileList, schema: Schema) => buildUploader(schema)(_files),
              }));
            })
            .use(commonmark)
            .use(gfm)
            .use(history)
            .use(listener)
            .use(upload)
            .create();

          // 若在 async create() 期间已被 cleanup，立即销毁并返回
          if (activeInstanceIdRef.current !== instanceId) {
            editor.destroy().catch(() => {});
            return;
          }

          editorRef.current = editor;
          // 初始化完成时，将 contentRef 对齐为初始值，
          // 确保 markdownUpdated 的首次回调（值等于 initialValue）被正确过滤
          contentRef.current = initialValue;
          isInitializedRef.current = true;
          console.log(`[MilkdownEditor] ✅ Initialization completed in ${(performance.now() - t0).toFixed(0)}ms`);
          setInitStatus('success');

        } catch (error) {
          isInitializedRef.current = true; // 标记已处理，防止超时再次触发
          console.error('[MilkdownEditor] ❌ Init error:', error);
          setInitStatus('error');
          setInitError(error instanceof Error ? error.message : '编辑器初始化失败');
        }
      };

      initEditor();

      return () => {
        clearTimeout(timeoutId);
        // 令本实例 ID 失效，所有未完成的异步回调将被忽略
        activeInstanceIdRef.current = 0;

        if (editor) {
          editor.destroy().catch(() => {});
        }
        editorRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readOnly]);

    // 创建 insertMarkdown 方法
    const insertMarkdown = useCallback((type: 'bold' | 'italic' | 'strike' | 'underline' | 'link', value?: string) => {
      if (!editorRef.current) return;

      try {
        editorRef.current.action((ctx: Ctx) => {
          const view = ctx.get(editorViewCtx);
          const { state, dispatch } = view;

          // 获取当前选中的文本
          const { from, to } = state.selection;
          const selectedText = state.doc.textBetween(from, to);

          switch (type) {
            case 'bold': {
              const markType = state.schema.marks['strong'];
              if (!markType) return;

              const tr = state.tr;
              if (selectedText) {
                tr.addMark(from, to, markType.create());
              } else {
                tr.setStoredMarks([markType.create()]);
              }
              dispatch(tr);
              view.focus();
              break;
            }

            case 'italic': {
              const markType = state.schema.marks['emphasis'];
              if (!markType) return;

              const tr = state.tr;
              if (selectedText) {
                tr.addMark(from, to, markType.create());
              } else {
                tr.setStoredMarks([markType.create()]);
              }
              dispatch(tr);
              view.focus();
              break;
            }

            case 'strike': {
              const markType = state.schema.marks['strike_through'];
              if (!markType) return;

              const tr = state.tr;
              if (selectedText) {
                tr.addMark(from, to, markType.create());
              } else {
                tr.setStoredMarks([markType.create()]);
              }
              dispatch(tr);
              view.focus();
              break;
            }

            case 'underline': {
              // 下划线需要使用 HTML 标签，使用 DOMParser
              const underlineHTML = selectedText ? `<ins>${selectedText}</ins>` : '<ins> </ins>';

              try {
                const dom = document.createElement('div');
                dom.innerHTML = underlineHTML;

                const domParser = DOMParser.fromSchema(state.schema);
                const slice = domParser.parseSlice(dom.firstChild!);
                let tr = state.tr.replaceSelectionWith(slice.content.firstChild!);

                // 如果没有选中文本，定位光标到标签内部
                if (!selectedText) {
                  const insertPos = from + 5; // <ins> 长度为 5
                  tr = tr.setSelection(
                    TextSelection.create(tr.doc, insertPos, insertPos)
                  );
                }

                dispatch(tr);
                view.focus();
              } catch (error) {
                console.warn('[MilkdownEditor] Failed to insert underline, falling back to text:', error);
                // 降级到纯文本插入
                const fallbackText = selectedText ? `<ins>${selectedText}</ins>` : '<ins></ins>';
                let tr = state.tr.replaceSelectionWith(state.schema.text(fallbackText));
                if (!selectedText) {
                  const insertPos = from + 5;
                  tr = tr.setSelection(TextSelection.create(tr.doc, insertPos, insertPos));
                }
                dispatch(tr);
                view.focus();
              }
              break;
            }

            case 'link': {
              const markType = state.schema.marks['link'];
              if (!markType) return;

              if (value) {
                if (selectedText) {
                  const tr = state.tr.addMark(from, to, markType.create({ href: value }));
                  dispatch(tr);
                } else {
                  const linkText = '链接文本';
                  const textNode = state.schema.text(linkText);
                  let tr = state.tr.replaceSelectionWith(textNode);
                  const startPos = tr.selection.from - linkText.length;
                  tr = tr.addMark(startPos, tr.selection.from, markType.create({ href: value }));
                  dispatch(tr);
                }
              } else {
                // 无 URL：插入 Markdown 链接模板
                const template = selectedText ? `[${selectedText}]()` : `[]()`;
                const textNode = state.schema.text(template);
                let tr = state.tr.replaceSelectionWith(textNode);

                // 定位光标到括号中间
                if (!selectedText) {
                  const insertPos = tr.selection.from - template.length + 1;
                  tr = tr.setSelection(TextSelection.create(tr.doc, insertPos, insertPos));
                } else {
                  const insertPos = tr.selection.from - template.length + selectedText.length + 3;
                  tr = tr.setSelection(TextSelection.create(tr.doc, insertPos, insertPos));
                }

                dispatch(tr);
              }

              view.focus();
              break;
            }

            default:
              return;
          }
        });
      } catch (error) {
        console.error('[MilkdownEditor] Failed to insert markdown:', error);
      }
    }, []);

    // 存储 insertMarkdown 方法到 ref 中，供工具栏使用
    insertMarkdownRef.current = insertMarkdown;

    useImperativeHandle(ref, () => ({
      getMarkdown: () => {
        return contentRef.current || '';
      },
      setMarkdown: (markdown: string) => {
        if (markdown === contentRef.current) {
          console.log('[MilkdownEditor] Content unchanged, skipping setMarkdown');
          return;
        }

        contentRef.current = markdown;
        if (editorRef.current) {
          editorRef.current.action(replaceAll(markdown));
        }
        // 不主动调用 onChangeRef，replaceAll 会触发 markdownUpdated 回调
        // 该回调已做内容相等过滤，不会产生额外的 onChange
      },
      focus: () => {
        if (!editorRef.current) return;
        try {
          editorRef.current.action((ctx: Ctx) => {
            const view = ctx.get(editorViewCtx);
            view.focus();
          });
        } catch {
          containerRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.focus();
        }
      },
      blur: () => {
        containerRef.current?.querySelector<HTMLElement>('[contenteditable="true"]')?.blur();
      },
      insertMarkdown,
    }), [insertMarkdown]);

    // 始终渲染编辑器容器以保证 containerRef 在 useEffect 触发时已挂载到 DOM。
    // loading/error 状态通过绝对定位覆盖层呈现，不再条件性地替换容器节点。
    return (
      <div style={{ position: 'relative', ...style }}>
        {/* Markdown 工具栏 */}
        {!readOnly && (
          <MarkdownToolbar
            onInsertMarkdown={(type, value) => {
              if (insertMarkdownRef.current) {
                insertMarkdownRef.current(type, value);
              }
            }}
            disabled={initStatus !== 'success'}
          />
        )}

        {/* 编辑器挂载容器：始终存在，containerRef 始终有效 */}
        <div
          ref={containerRef}
          className="milkdown-editor-container"
          style={{
            minHeight,
            border: '1px solid #d9d9d9',
            borderRadius: readOnly ? '6px' : '0 0 6px 6px',
            backgroundColor: '#ffffff',
            overflowY: 'auto',
            // 初始化完成前对用户不可见，但节点必须存在于 DOM
            visibility: initStatus === 'success' ? 'visible' : 'hidden',
          }}
        />

        {/* loading 覆盖层 */}
        {initStatus === 'loading' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              minHeight,
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: '14px',
            }}
          >
            编辑器加载中...
          </div>
        )}

        {/* error 覆盖层 */}
        {initStatus === 'error' && (
          <div
            className="milkdown-editor-error"
            style={{
              position: 'absolute',
              inset: 0,
              minHeight,
              border: '1px solid #ff4d4f',
              borderRadius: '6px',
              backgroundColor: '#fff2f0',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <p style={{ margin: 0, color: '#ff4d4f', fontWeight: 'bold' }}>⚠️ 编辑器加载失败</p>
            <p style={{ margin: 0, color: '#666', fontSize: '14px', textAlign: 'center' }}>
              {initError || '未知错误'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '6px 12px',
                backgroundColor: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              刷新页面
            </button>
          </div>
        )}
      </div>
    );
  }
);

MilkdownEditor.displayName = 'MilkdownEditor';

// 包裹组件：提供ErrorBoundary和降级方案
interface MilkdownEditorWrapperProps extends MilkdownEditorProps {
  fallback?: React.ReactNode;
}

const MilkdownEditorWrapper = forwardRef<MilkdownEditorRef, MilkdownEditorWrapperProps>(({
  fallback,
  ...props
}, ref) => {
  const defaultFallback = (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        backgroundColor: '#f5f5f5',
        padding: '8px',
      }}
    >
      <textarea
        value={props.value || ''}
        onChange={(e) => props.onChange?.(e.target.value)}
        placeholder="编辑器加载失败，请刷新页面。您可以在上述文本框中临时编辑内容。"
        style={{
          width: '100%',
          minHeight: props.minHeight || '200px',
          border: 'none',
          outline: 'none',
          resize: 'vertical',
          backgroundColor: 'transparent',
          fontFamily: 'inherit',
          fontSize: '14px',
          lineHeight: '1.5',
        }}
      />
    </div>
  );

  return (
    <MilkdownEditorErrorBoundary fallback={fallback || defaultFallback}>
      <MilkdownEditor {...props} ref={ref} />
    </MilkdownEditorErrorBoundary>
  );
});

MilkdownEditorWrapper.displayName = 'MilkdownEditorWrapper';

// 导出原始组件（用于测试）和包裹组件（用于生产）
export { MilkdownEditor as MilkdownEditorRaw };
export default MilkdownEditorWrapper;
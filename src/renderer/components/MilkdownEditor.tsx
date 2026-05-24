import React, { useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, editorViewOptionsCtx } from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { upload, uploadConfig } from '@milkdown/plugin-upload';
import { replaceAll } from '@milkdown/utils';
import type { Ctx } from '@milkdown/ctx';
import type { Schema, Node, Fragment } from '@milkdown/prose/model';
import '@milkdown/theme-nord/style.css';

export interface MilkdownEditorRef {
  getMarkdown: () => string;
  setMarkdown: (markdown: string) => void;
  focus: () => void;
  blur: () => void;
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

const MilkdownEditor = forwardRef<MilkdownEditorRef, MilkdownEditorProps>(
  ({ value = '', onChange, readOnly = false, style, minHeight = '200px' }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<Editor | null>(null);
    const contentRef = useRef<string>(value);
    const onChangeRef = useRef(onChange);
    // 每次 initEditor 生成一个唯一 ID，cleanup 时令其失效，
    // 防止 React Strict Mode 第一次 mount 的回调污染第二次 mount
    const activeInstanceIdRef = useRef<number>(0);

    // 始终指向最新 onChange，避免闭包陷阱
    onChangeRef.current = onChange;

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let editor: Editor | null = null;
      // 为本次 mount 分配唯一 ID
      const instanceId = Date.now() + Math.random();
      activeInstanceIdRef.current = instanceId;
      // 捕获本次 mount 的初始值（不受后续 prop 变化影响）
      const initialValue = value;

      const initEditor = async () => {
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

                console.log('[MilkdownEditor] ✅ Content changed - triggering onChange');
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
          console.log('[MilkdownEditor] ✅ Initialization completed - onChange now active');

        } catch (error) {
          console.error('[MilkdownEditor] ❌ Init error:', error);
        }
      };

      initEditor();

      return () => {
        console.log('[MilkdownEditor] 🔧 Cleanup - destroying editor');
        // 令本实例 ID 失效，所有未完成的异步回调将被忽略
        activeInstanceIdRef.current = 0;

        if (editor) {
          editor.destroy().catch(() => {});
        }
        editorRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [readOnly]);

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
    }), []);

    return (
      <div style={{ position: 'relative', minHeight, ...style }}>
        <div
          ref={containerRef}
          className="milkdown-editor-container"
          style={{
            minHeight,
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            overflowY: 'auto',
          }}
        />
      </div>
    );
  }
);

MilkdownEditor.displayName = 'MilkdownEditor';
export default MilkdownEditor;
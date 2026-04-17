import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import Quill from 'quill';
import ReactQuill from 'react-quill-new';
import 'quill/dist/quill.snow.css';

export interface RichTextEditorRef {
  getLatestHtml: () => string;
  hasPendingComposition: () => boolean;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(({
  value,
  onChange,
  placeholder = '输入内容...',
  style,
}, ref) => {
  const quillRef = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [hasError, setHasError] = useState(false);

  // 添加输入状态和焦点状态追踪
  const isComposingRef = useRef(false);
  const isFocusedRef = useRef(false);
  const scrollBlockRef = useRef<(() => void) | null>(null);

  // 🔥 新增：外部滚动容器的滚动锁定
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const originalScrollTopRef = useRef(0);
  const isScrollLockedRef = useRef(false);

  // 🔥 新增：查找外部滚动容器的函数
  const findScrollContainer = useCallback(() => {
    if (!editorInstance) return null;

    try {
      // 从编辑器根元素开始，向上查找最近的滚动容器
      const editorRoot = editorInstance.root;
      if (!editorRoot) return null;

      let currentElement: HTMLElement | null = editorRoot.parentElement;
      while (currentElement) {
        // 查找具有 overflow: auto 或 scroll 的元素
        const computedStyle = window.getComputedStyle(currentElement);
        const overflow = computedStyle.getPropertyValue('overflow');
        const overflowY = computedStyle.getPropertyValue('overflow-y');

        if ((overflow === 'auto' || overflow === 'scroll' ||
             overflowY === 'auto' || overflowY === 'scroll') &&
            currentElement.scrollHeight > currentElement.clientHeight) {
          console.log('[QuillScrollBlock] Found scroll container:', currentElement.className);
          return currentElement;
        }

        currentElement = currentElement.parentElement;
      }

      return null;
    } catch (error) {
      console.warn('[QuillScrollBlock] Failed to find scroll container:', error);
      return null;
    }
  }, [editorInstance]);

  // 🔥 新增：锁定外部滚动容器的滚动
  const lockScrollContainer = useCallback(() => {
    const container = findScrollContainer();
    if (!container) return;

    scrollContainerRef.current = container;
    originalScrollTopRef.current = container.scrollTop;
    isScrollLockedRef.current = true;

    console.log('[QuillScrollBlock] Locked scroll container, scrollTop:', container.scrollTop);

    // 添加滚动事件监听器，阻止滚动
    const handleScrollLock = (e: Event) => {
      if (isScrollLockedRef.current && scrollContainerRef.current === e.target) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // 恢复到锁定时的滚动位置
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = originalScrollTopRef.current;
        }

        console.log('[QuillScrollBlock] Blocked scroll container scroll');
        return false;
      }
    };

    container.addEventListener('scroll', handleScrollLock, { passive: false, capture: true });

    // 保存清理函数
    (container as any)._scrollLockHandler = handleScrollLock;
    (container as any)._scrollLockOriginalScrollTop = originalScrollTopRef.current;
  }, [findScrollContainer]);

  // 🔥 新增：解锁外部滚动容器的滚动
  const unlockScrollContainer = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    isScrollLockedRef.current = false;

    console.log('[QuillScrollBlock] Unlocked scroll container');

    // 移除滚动事件监听器
    if ((container as any)._scrollLockHandler) {
      container.removeEventListener('scroll', (container as any)._scrollLockHandler, { capture: true });
      delete (container as any)._scrollLockHandler;
    }

    scrollContainerRef.current = null;
  }, []);

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

      // 🔥 清理：确保解锁滚动容器
      unlockScrollContainer();
    };
  }, [unlockScrollContainer]);

  useEffect(() => {
    if (isReady && editorInstance && value !== editorInstance.root.innerHTML) {
      try {
        if (isComposingRef.current || isFocusedRef.current) {
          return;
        }

        const currentHtml = editorInstance.root.innerHTML;
        const currentText = editorInstance.getText();
        const incomingText = value.replace(/<[^>]*>/g, '').trim();
        const shouldSyncHtml = currentText.trim() !== incomingText;

        if (shouldSyncHtml) {
          // 🔥🔥 关键修复：在内容同步前锁定外部滚动容器的滚动
          lockScrollContainer();

          const selection = editorInstance.getSelection();

          try {
            const historyModule = editorInstance.getModule('history');
            if (historyModule) {
              historyModule.clear();
            }
          } catch (error) {
            console.warn('Failed to clear history:', error);
          }

          // 🔥 关键修复：内容替换后重新覆盖 scrollSelectionIntoView，确保始终有效
          editorInstance.clipboard.dangerouslyPasteHTML(value);

          // 🔥 确保滚动覆盖在内容替换后仍然有效
          editorInstance.scrollSelectionIntoView = function() {
            return;
          };

          // 🔥 强化防护：内容同步后重新锁定
          if (scrollBlockRef.current && typeof scrollBlockRef.current === 'function') {
            try {
              scrollBlockRef.current();
            } catch (error) {
              console.warn('[QuillScrollBlock] Reinforcement call failed:', error);
            }
          }

          if (selection) {
            try {
              editorInstance.setSelection(selection.index, selection.length);
            } catch {
              // noop
            }
          }

          // 🔥🔥 延迟解锁滚动容器（确保滚动不会在内容更新后立即发生）
          setTimeout(() => {
            unlockScrollContainer();
          }, 100);
        }
      } catch (error) {
        console.warn('Content sync failed:', error);
        unlockScrollContainer();
      }
    }
  }, [value, isReady, editorInstance, lockScrollContainer, unlockScrollContainer]);

  const getEditorSafely = useCallback(() => {
    if (!isMounted || !quillRef.current) return null;

    try {
      if (!editorInstance) {
        const editor = quillRef.current.getEditor();
        if (editor) {
          // 🔥 核心修复1：覆盖 scrollSelectionIntoView 方法
          const originalScrollIntoView = editor.scrollSelectionIntoView.bind(editor);
          editor.scrollSelectionIntoView = function() {
            // 不做任何操作，直接返回，阻止 window.scrollBy() 调用
            return;
          };

          // 🔥 核心修复2：使用 Object.defineProperty 永久锁定，防止被重置
          try {
            Object.defineProperty(editor, 'scrollSelectionIntoView', {
              value: function() {
                console.log('[QuillScrollBlock] Blocked scrollSelectionIntoView call');
                return;
              },
              writable: false,
              configurable: false
            });
          } catch (error) {
            console.warn('[QuillScrollBlock] Failed to lock scrollSelectionIntoView:', error);
          }

          // 🔥 核心修复3：拦截 window.scrollBy 调用（最后防线）
          if (!(window.scrollBy as any)._quillIntercepted) {
            const originalScrollBy = window.scrollBy.bind(window);
            (window.scrollBy as any) = function(...args: [number, number] | [ScrollToOptions]) {
              // 检查是否是编辑器触发的滚动
              const activeElement = document.activeElement;
              if (activeElement?.closest('.ql-editor')) {
                console.log('[QuillScrollBlock] Blocked window.scrollBy from editor');
                return; // 阻止编辑器触发的滚动
              }
              return originalScrollBy.apply(window, args as any);
            };
            (window.scrollBy as any)._quillIntercepted = true;
          }

          // 🔥🔥 最后防线：拦截 window.scrollTo 和 Element.scrollIntoView
          if (!(window.scrollTo as any)._quillIntercepted) {
            const originalScrollTo = window.scrollTo.bind(window);
            (window.scrollTo as any) = function(...args: [number, number] | [ScrollToOptions]) {
              const activeElement = document.activeElement;
              if (activeElement?.closest('.ql-editor')) {
                console.log('[QuillScrollBlock] Blocked window.scrollTo from editor');
                return;
              }
              return originalScrollTo.apply(window, args as any);
            };
            (window.scrollTo as any)._quillIntercepted = true;
          }

          // 拦截 Element.scrollIntoView
          if (!(Element.prototype.scrollIntoView as any)._quillIntercepted) {
            const originalScrollIntoView = Element.prototype.scrollIntoView;
            (Element.prototype.scrollIntoView as any) = function(this: Element, arg?: boolean | ScrollIntoViewOptions) {
              // 如果是编辑器元素，阻止滚动
              if (this instanceof HTMLElement && (this as HTMLElement).closest('.ql-editor')) {
                console.log('[QuillScrollBlock] Blocked Element.scrollIntoView from editor');
                return;
              }
              return originalScrollIntoView.apply(this, [arg]);
            };
            (Element.prototype.scrollIntoView as any)._quillIntercepted = true;
          }

          // 🔥 核心修复4：创建强化函数，在关键事件后调用
          const reinforceScrollBlock = () => {
            try {
              Object.defineProperty(editor, 'scrollSelectionIntoView', {
                value: function() { return; },
                writable: false,
                configurable: false
              });
            } catch (error) {
              console.warn('[QuillScrollBlock] Reinforcement failed:', error);
            }
          };
          scrollBlockRef.current = reinforceScrollBlock;

          // 🔥🔥 防护层3：禁用 Quill Scroller 模块
          try {
            const editorAny = editor as any;
            if (editorAny.scroller && editorAny.scroller.scroll) {
              const originalScrollerScroll = editorAny.scroller.scroll.bind(editorAny.scroller);
              editorAny.scroller.scroll = function() {
                console.log('[QuillScrollBlock] Blocked scroller.scroll()');
                return;
              };
            }
          } catch (error) {
            console.warn('[QuillScrollBlock] Failed to disable scroller:', error);
          }

          // 🔥🔥 防护层4：拦截 Selection API 导致的滚动
          if (!(window.Selection.prototype.modify as any)._quillIntercepted) {
            const originalModify = window.Selection.prototype.modify;
            (window.Selection.prototype.modify as any) = function(
              this: Selection,
              alter?: string,
              direction?: string,
              granularity?: string
            ) {
              // 检查是否在编辑器中
              const activeElement = document.activeElement;
              if (activeElement?.closest('.ql-editor')) {
                console.log('[QuillScrollBlock] Intercepted Selection.modify');
                // 临时禁用 window.scrollBy
                const originalScrollBy = window.scrollBy;
                (window.scrollBy as any) = () => {};

                try {
                  const result = originalModify.call(this, alter, direction, granularity);
                  // 恢复 scrollBy
                  (window.scrollBy as any) = originalScrollBy;
                  return result;
                } catch (error) {
                  (window.scrollBy as any) = originalScrollBy;
                  throw error;
                }
              }
              return originalModify.call(this, alter, direction, granularity);
            };
            (window.Selection.prototype.modify as any)._quillIntercepted = true;
          }

          // 🔥🔥 防护层5：拦截所有 DOM 滚动操作
          const setupDOMScrollInterception = () => {
            try {
              // 拦截编辑器根元素的 scrollTop/scrollLeft 设置
              const editorRoot = editor.root;
              if (editorRoot) {
                Object.defineProperty(editorRoot, 'scrollTop', {
                  get: function() {
                    return this._cachedScrollTop || 0;
                  },
                  set: function(value) {
                    console.log('[QuillScrollBlock] Blocked scrollTop set:', value);
                    this._cachedScrollTop = value;
                    // 不实际设置，阻止滚动
                  }
                });

                Object.defineProperty(editorRoot, 'scrollLeft', {
                  get: function() {
                    return this._cachedScrollLeft || 0;
                  },
                  set: function(value) {
                    console.log('[QuillScrollBlock] Blocked scrollLeft set:', value);
                    this._cachedScrollLeft = value;
                    // 不实际设置，阻止滚动
                  }
                });
              }
            } catch (error) {
              console.warn('[QuillScrollBlock] Failed to setup DOM interception:', error);
            }
          };
          setupDOMScrollInterception();

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
    if (!editor?.root) {
      return;
    }

    const editorElement = editor.root;
    if (!editorElement) return;

    const handleCompositionStart = () => {
      isComposingRef.current = true;
      // 在编辑器根元素设置 composition 状态标记
      if (editor.root) {
        editor.root.setAttribute('data-composing', 'true');
      }
    };

    const handleCompositionEnd = () => {
      isComposingRef.current = false;
      // 移除 composition 状态标记
      if (editor.root) {
        editor.root.removeAttribute('data-composing');
      }

      try {
        const currentContent = editor.root.innerHTML;
        onChange(currentContent);
      } catch (error) {
        console.warn('Failed to trigger onChange after composition:', error);
      }
    };

    const handleFocus = () => {
      isFocusedRef.current = true;
      // 🔥 强化防护：focus 后重新锁定滚动
      if (scrollBlockRef.current && typeof scrollBlockRef.current === 'function') {
        try {
          scrollBlockRef.current();
        } catch (error) {
          console.warn('[QuillScrollBlock] Focus reinforcement failed:', error);
        }
      }
    };

    const handleBlur = () => {
      isFocusedRef.current = false;
    };

    // 优化：只阻止可能触发页面滚动的按键，完全不干预输入键
    const handleKeyDown = (event: KeyboardEvent) => {
      // 只阻止可能触发父级滚动容器滚动的按键
      const isScrollKey = ['PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key);

      if (isScrollKey && !event.ctrlKey && !event.metaKey) {
        // 只阻止传播，不阻止默认行为
        event.stopPropagation();
      }

      // 🔥 强化防护：输入键后重新锁定滚动（带安全守卫）
      if (scrollBlockRef.current && typeof scrollBlockRef.current === 'function') {
        setTimeout(() => {
          try {
            if (scrollBlockRef.current && typeof scrollBlockRef.current === 'function') {
              scrollBlockRef.current();
            }
          } catch (error) {
            console.warn('[QuillScrollBlock] Keydown reinforcement failed:', error);
          }
        }, 0);
      }
    };

    // 🔥🔥 防护层2：阻止所有 DOM 滚动事件
    const preventAnyScroll = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      console.log('[QuillScrollBlock] Prevented scroll event:', event.type, event);
    };

    const handleWheel = (event: WheelEvent) => {
      // 只阻止垂直滚动，保留水平滚动（如果需要）
      if (event.deltaY !== 0) {
        preventAnyScroll(event);
      } else {
        // 水平滚动仍然阻止，防止意外滚动
        event.stopPropagation();
      }
    };

    // 监听所有可能的滚动事件
    editorElement.addEventListener('scroll', preventAnyScroll, { passive: false, capture: true });
    editorElement.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    editorElement.addEventListener('touchmove', preventAnyScroll, { passive: false, capture: true });

    editorElement.addEventListener('compositionstart', handleCompositionStart);
    editorElement.addEventListener('compositionend', handleCompositionEnd);
    editorElement.addEventListener('focus', handleFocus);
    editorElement.addEventListener('blur', handleBlur);
    // 优化：在冒泡阶段添加事件监听器，避免干扰Quill内部处理
    editorElement.addEventListener('keydown', handleKeyDown);

    return () => {
      editorElement.removeEventListener('compositionstart', handleCompositionStart);
      editorElement.removeEventListener('compositionend', handleCompositionEnd);
      editorElement.removeEventListener('focus', handleFocus);
      editorElement.removeEventListener('blur', handleBlur);
      // 清理事件监听器
      editorElement.removeEventListener('keydown', handleKeyDown);

      // 🔥 清理所有滚动事件监听器
      editorElement.removeEventListener('scroll', preventAnyScroll);
      editorElement.removeEventListener('wheel', handleWheel);
      editorElement.removeEventListener('touchmove', preventAnyScroll);

      // 🔥 清理强化函数引用（设置为安全的空函数，而不是 null）
      scrollBlockRef.current = () => {
        // 空函数，安全的 noop
      };

      // 🔥🔥 清理：确保解锁滚动容器
      unlockScrollContainer();
    };
  }, [editorInstance, getEditorSafely, onChange, unlockScrollContainer]);

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

  const toolbarConfig = [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['link', 'image'],
    ['clean'],
  ];

  const modules = {
    toolbar: {
      container: toolbarConfig,
      handlers: {
        image: imageHandler,
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
    <div
      ref={containerRef}
      style={{
        ...style,
        minHeight: '250px',
        // 🔥🔥 防护层1：CSS 样式覆盖 - 禁用容器滚动
        overflow: 'hidden',
        overflowX: 'hidden',
        overflowY: 'hidden',
        overscrollBehavior: 'none',
        overscrollBehaviorX: 'none',
        overscrollBehaviorY: 'none',
      }}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={(content) => {
          try {
            if (isComposingRef.current) {
              return;
            }

            // 🔥🔥 关键修复：在内容变化时锁定外部滚动容器的滚动
            lockScrollContainer();

            // 🔥 强化防护：内容变化时重新锁定滚动（带安全守卫）
            if (scrollBlockRef.current && typeof scrollBlockRef.current === 'function') {
              setTimeout(() => {
                try {
                  if (scrollBlockRef.current && typeof scrollBlockRef.current === 'function') {
                    scrollBlockRef.current();
                  }
                } catch (error) {
                  console.warn('[QuillScrollBlock] Change reinforcement failed:', error);
                }
              }, 0);
            }

            // 🔥🔥 延迟解锁滚动容器（确保滚动不会在内容更新后立即发生）
            setTimeout(() => {
              unlockScrollContainer();
            }, 100);

            onChange(content);
          } catch (error) {
            console.warn('Content change handling failed:', error);
            setHasError(true);
            unlockScrollContainer();
          }
        }}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        preserveWhitespace={false}
        bounds={containerRef.current || undefined}
      />
    </div>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;

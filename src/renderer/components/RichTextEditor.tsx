import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactQuill from 'react-quill-new';
import 'quill/dist/quill.snow.css';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = '输入内容...',
  style
}) => {
  const quillRef = useRef<ReactQuill>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [hasError, setHasError] = useState(false);
  
  // 添加输入状态和焦点状态追踪
  const isComposingRef = useRef(false);
  const isFocusedRef = useRef(false);
  const lastValueRef = useRef(value);

  useEffect(() => {
    setIsMounted(true);
    setHasError(false);
    
    // react-quill-new has better lifecycle management, so we can reduce the delay
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 50);
    
    return () => {
      clearTimeout(timer);
      setIsMounted(false);
      setEditorInstance(null);
    };
  }, []);

  // 监听 value 变化，确保内容同步（优化：仅在非输入状态时同步）
  useEffect(() => {
    if (isReady && editorInstance && value !== editorInstance.root.innerHTML) {
      try {
        // 关键优化：仅在用户未输入且编辑器未聚焦时才同步内容
        // 这避免了在用户输入时被外部更新打断
        if (isComposingRef.current || isFocusedRef.current) {
          // 用户正在输入或编辑器有焦点，跳过同步
          return;
        }
        
        // 安全地更新编辑器内容
        const currentText = editorInstance.getText();
        
        // 只有当内容真正不同时才更新
        if (currentText.trim() !== value.replace(/<[^>]*>/g, '').trim()) {
          // 保存光标位置
          const selection = editorInstance.getSelection();
          
          // 方案2：在使用 dangerouslyPasteHTML 前清空历史记录
          // 双重保障，确保程序化更新不会污染撤销栈
          try {
            const historyModule = editorInstance.getModule('history');
            if (historyModule) {
              historyModule.clear();  // 清空历史记录
            }
          } catch (error) {
            console.warn('Failed to clear history:', error);
          }
          
          // 更新内容
          editorInstance.clipboard.dangerouslyPasteHTML(value);
          
          // 恢复光标位置（如果之前有选择）
          if (selection) {
            try {
              editorInstance.setSelection(selection.index, selection.length);
            } catch (error) {
              // 光标恢复失败，静默处理
            }
          }
        }
        
        lastValueRef.current = value;
      } catch (error) {
        console.warn('Content sync failed:', error);
      }
    }
  }, [value, isReady, editorInstance]);

  // 安全获取编辑器实例的方法
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
      
      // 返回现有实例
      return editorInstance;
    } catch (error) {
      console.warn('Editor access failed:', error);
      setEditorInstance(null);
      return null;
    }
  }, [isMounted, editorInstance]);

  // 设置输入法和焦点事件监听
  useEffect(() => {
    const editor = getEditorSafely();
    if (!editor) return;
    
    const editorElement = editor.root;
    if (!editorElement) return;
    
    // 输入法事件监听
    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };
    
    const handleCompositionEnd = () => {
      isComposingRef.current = false;
    };
    
    // 焦点事件监听
    const handleFocus = () => {
      isFocusedRef.current = true;
    };
    
    const handleBlur = () => {
      isFocusedRef.current = false;
    };
    
    // 添加事件监听
    editorElement.addEventListener('compositionstart', handleCompositionStart);
    editorElement.addEventListener('compositionend', handleCompositionEnd);
    editorElement.addEventListener('focus', handleFocus);
    editorElement.addEventListener('blur', handleBlur);
    
    // 清理函数
    return () => {
      editorElement.removeEventListener('compositionstart', handleCompositionStart);
      editorElement.removeEventListener('compositionend', handleCompositionEnd);
      editorElement.removeEventListener('focus', handleFocus);
      editorElement.removeEventListener('blur', handleBlur);
    };
  }, [editorInstance, getEditorSafely]);

  // Toolbar configuration - react-quill-new handles DOM operations better
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link', 'image'],
      ['clean']
    ],
    clipboard: {
      matchVisual: false,
    },
    history: {
      delay: 1000,
      maxStack: 50,
      userOnly: true  // 只记录用户操作，不记录程序化更新，避免 Ctrl+Z 删除内容
    }
  };

  // 支持的格式
  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'list', 'bullet', 'indent',
    'link', 'image'
  ];

  // Image upload handler - simplified for react-quill-new
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
          
          // 自动将光标移动到图片后面，但不强制
          setTimeout(() => {
            try {
              const newPosition = range.index + 1;
              editor.setSelection(newPosition, 0);
            } catch (error) {
              // Silent fail - selection will be handled by the editor
            }
          }, 0);
        }
      }
    } catch (error) {
      console.error('Image upload error:', error);
    }
  };

  // 自定义工具栏配置，包含图片上传处理
  const modulesWithImageHandler = {
    ...modules,
    toolbar: {
      container: modules.toolbar,
      handlers: {
        image: imageHandler
      }
    }
  };

  // 错误处理组件
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
            value={value.replace(/<[^>]*>/g, '')} // 移除HTML标签显示纯文本
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
    <div ref={containerRef} style={{ ...style, minHeight: '250px' }}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={(content) => {
          try {
            onChange(content);
          } catch (error) {
            console.warn('Content change handling failed:', error);
            setHasError(true);
          }
        }}
        modules={modulesWithImageHandler}
        formats={formats}
        placeholder={placeholder}
        preserveWhitespace={false}
        bounds={containerRef.current || undefined}
      />
    </div>
  );
};

export default RichTextEditor;

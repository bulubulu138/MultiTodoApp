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

  // 监听 value 变化，确保内容同步
  useEffect(() => {
    if (isReady && editorInstance && value !== editorInstance.root.innerHTML) {
      try {
        // 安全地更新编辑器内容
        const currentText = editorInstance.getText();
        
        // 只有当内容真正不同时才更新
        if (currentText.trim() !== value.replace(/<[^>]*>/g, '').trim()) {
          editorInstance.clipboard.dangerouslyPasteHTML(value);
        }
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

  // Simplified selection handling - react-quill-new handles this better
  const handleSelection = useCallback(() => {
    const editor = getEditorSafely();
    if (!editor) return;
    
    try {
      const length = editor.getLength();
      if (length > 0) {
        editor.setSelection(length, 0);
      }
    } catch (error) {
      // Silent fail - react-quill-new handles selection more gracefully
    }
  }, [getEditorSafely]);

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
      userOnly: false
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
          
          // react-quill-new handles selection updates more reliably
          setTimeout(() => {
            try {
              editor.setSelection(range.index + 1, 0);
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

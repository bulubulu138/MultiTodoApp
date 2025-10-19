import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

// 在生产模式下抑制第三方库的已知警告
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.warn = (...args) => {
    const message = args[0]?.toString?.() || '';
    if (
      // ReactQuill findDOMNode 相关警告
      message.includes('findDOMNode') ||
      message.includes('findDOMNode is deprecated') ||
      message.includes('Instead, add a ref directly to the element') ||
      message.includes('Learn more about using refs safely') ||
      // Quill DOM 相关警告
      message.includes('DOMNodeInserted') ||
      message.includes('DOM Mutation Event') ||
      message.includes('MutationObserver instead') ||
      message.includes('Listener added for a synchronous') ||
      message.includes('This event type is deprecated') ||
      // Ant Design 相关警告
      message.includes('bodyStyle is deprecated') ||
      // ReactQuill 选择范围相关警告
      message.includes('addRange(): The given range isn\'t in document') ||
      message.includes('setNativeRange') ||
      message.includes('setEditorSelection') ||
      message.includes('Selection setting failed') ||
      message.includes('Selection after image insert failed') ||
      message.includes('Content sync failed') ||
      message.includes('Content change handling failed') ||
      message.includes('Selection change failed') ||
      // React StrictMode 下的重复警告
      message.includes('Warning: ReactDOM.findDOMNode') ||
      message.includes('at ReactQuill') ||
      // Quill 内部错误
      message.includes('setRange') ||
      message.includes('setSelection') ||
      message.includes('getSelection')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
  
  console.error = (...args) => {
    const message = args[0]?.toString?.() || '';
    if (
      // 核心 addRange 错误抑制
      message.includes('addRange(): The given range isn\'t in document') ||
      message.includes('The given range isn\'t in document') ||
      message.includes('setNativeRange') ||
      message.includes('setEditorSelection') ||
      message.includes('findDOMNode') ||
      message.includes('ReactDOM.findDOMNode') ||
      // Quill 选择相关错误
      message.includes('setRange') ||
      message.includes('setSelection') ||
      message.includes('getSelection') ||
      // ReactQuill 组件错误
      message.includes('ReactQuill.setEditorSelection') ||
      message.includes('ReactQuill.componentDidUpdate') ||
      // DOM 操作错误
      message.includes('postpone') ||
      message.includes('commitLayoutEffectOnFiber')
    ) {
      return; // 抑制这些已知的 ReactQuill 错误
    }
    originalError.apply(console, args);
  };
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

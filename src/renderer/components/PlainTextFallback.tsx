import React from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

interface PlainTextFallbackProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const PlainTextFallback: React.FC<PlainTextFallbackProps> = ({
  value,
  onChange,
  placeholder = '输入内容...',
  style
}) => {
  // 将HTML内容转换为纯文本
  const getPlainText = (htmlContent: string): string => {
    if (!htmlContent) return '';
    
    // 使用正则表达式移除HTML标签（构建时安全，不依赖DOM API）
    return htmlContent
      .replace(/<[^>]*>/g, '')     // 移除所有HTML标签
      .replace(/&nbsp;/g, ' ')     // 替换&nbsp;
      .replace(/&lt;/g, '<')       // 替换&lt;
      .replace(/&gt;/g, '>')       // 替换&gt;
      .replace(/&amp;/g, '&')      // 替换&amp;
      .replace(/&quot;/g, '"')     // 替换&quot;
      .replace(/&#39;/g, "'")      // 替换&#39;
      .replace(/\s+/g, ' ')        // 压缩多个空格为一个
      .trim();                     // 移除首尾空格
  };

  // 处理内容变化
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div style={{ ...style, minHeight: '250px' }}>
      <div style={{ 
        marginBottom: '8px', 
        padding: '8px 12px',
        backgroundColor: '#fff7e6',
        border: '1px solid #ffd591',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#d48806'
      }}>
        ⚠️ 富文本编辑器不可用，已切换到纯文本模式
      </div>
      <TextArea
        value={getPlainText(value)}
        onChange={handleChange}
        placeholder={placeholder}
        autoSize={{ minRows: 8, maxRows: 16 }}
        style={{
          fontSize: '14px',
          lineHeight: '1.6',
          resize: 'vertical'
        }}
      />
    </div>
  );
};

export default PlainTextFallback;

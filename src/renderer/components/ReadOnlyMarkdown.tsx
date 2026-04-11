import React from 'react';
import { Card, Button, Space, Typography, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

interface ReadOnlyMarkdownProps {
  content: string;
  maxHeight?: number;
  showCopyButton?: boolean;
  title?: string;
}

const ReadOnlyMarkdown: React.FC<ReadOnlyMarkdownProps> = ({
  content,
  maxHeight,
  showCopyButton = true,
  title
}) => {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      message.success('已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
    }
  };

  // 简单的Markdown转HTML函数
  const markdownToHtml = (text: string): string => {
    if (!text) return '';

    // 转义HTML特殊字符
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 处理标题 #
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');

    // 处理加粗 **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 处理斜体 *text*
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 处理代码块 ```code```
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // 处理行内代码 `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 处理无序列表 - item
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // 处理有序列表 1. item
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // 处理换行
    html = html.replace(/\n/g, '<br>');

    // 处理空行
    html = html.replace(/<br><br>/g, '<p></p>');

    return html;
  };

  return (
    <Card
      title={title}
      size="small"
      extra={
        showCopyButton && content && (
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={handleCopy}
          >
            复制
          </Button>
        )
      }
    >
      <div
        style={{
          maxHeight: maxHeight || 'none',
          overflow: maxHeight ? 'auto' : 'visible',
          paddingRight: 8
        }}
      >
        {content ? (
          <div
            className="readonly-markdown-content"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }}
            style={{
              lineHeight: 1.6,
              fontSize: '14px'
            }}
          />
        ) : (
          <Text type="secondary">暂无内容</Text>
        )}
      </div>
    </Card>
  );
};

export default ReadOnlyMarkdown;

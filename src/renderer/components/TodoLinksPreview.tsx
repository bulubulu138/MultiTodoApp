import React, { useMemo } from 'react';
import { Space, Typography } from 'antd';
import { extractUrlTitlesFromContent } from '../utils/urlTitleStorage';

const { Text } = Typography;
const URL_REGEX = /(https?:\/\/[^\s<>"]+)/g;

interface TodoLinksPreviewProps {
  content: string;
  urlTitles: Map<string, string>;
  maxLinks?: number;
}

/**
 * 从文本中提取所有URL
 */
function extractURLs(text: string): string[] {
  if (!text) return [];

  const urls = new Set<string>();
  let match: RegExpExecArray | null;

  // 重置正则表达式的lastIndex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    urls.add(match[1]);
  }

  return Array.from(urls);
}

/**
 * TodoLinksPreview - 在卡片中显示待办事项的链接
 *
 * 特点：
 * - 只显示链接，不显示内容预览
 * - 优先显示标题，没有标题时显示原始URL
 * - 简洁样式，不包含授权/刷新按钮（详情页已有）
 * - 可选限制显示数量
 */
const TodoLinksPreview: React.FC<TodoLinksPreviewProps> = ({
  content,
  urlTitles,
  maxLinks = Infinity
}) => {
  // 提取嵌入在内容中的标题
  const embeddedTitles = useMemo(() => {
    return extractUrlTitlesFromContent(content);
  }, [content]);

  // 提取所有URL
  const urls = useMemo(() => {
    return extractURLs(content);
  }, [content]);

  // 如果没有链接，不显示任何内容
  if (urls.length === 0) {
    return null;
  }

  // 限制显示数量
  const displayUrls = urls.slice(0, maxLinks);
  const remainingCount = urls.length - maxLinks;

  return (
    <div style={{ marginBottom: 6 }}>
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        {displayUrls.map((url) => {
          // 优先使用传入的标题（可能是缓存的），其次使用嵌入的标题，最后使用原始URL
          const displayTitle = urlTitles.get(url) || embeddedTitles.get(url) || url;

          return (
            <div key={url} style={{ display: 'flex', alignItems: 'center' }}>
              <Typography.Link
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                ellipsis
                style={{ fontSize: 13, color: '#1890ff', maxWidth: '100%' }}
                title={url}
                onClick={(e) => {
                  // 阻止事件冒泡，避免触发卡片点击
                  e.stopPropagation();
                }}
              >
                {displayTitle}
              </Typography.Link>
            </div>
          );
        })}
        {remainingCount > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            还有 {remainingCount} 个链接...
          </Text>
        )}
      </Space>
    </div>
  );
};

export default React.memo(TodoLinksPreview);

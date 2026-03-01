/**
 * URL Title Storage Utility
 *
 * Stores URL titles as HTML comments in the format:
 * <!-- URL_TITLE:https%3A%2F%2Fexample.com:Page Title -->
 *
 * Note: URLs are encodeURIComponent-encoded to avoid conflicts with the colon separator
 *
 * This approach:
 * - Requires no database schema changes
 * - Persists titles across sessions
 * - Works with existing content rendering
 * - Backward compatible with existing todos
 */

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Embed a URL title as an HTML comment in the content
 * @param content - The todo content
 * @param url - The URL to embed the title for
 * @param title - The title to embed
 * @returns Updated content with the embedded title
 */
export function embedUrlTitleInContent(content: string, url: string, title: string): string {
  // 对 URL 进行编码，避免冒号等特殊字符导致正则匹配问题
  const encodedUrl = encodeURIComponent(url);
  const comment = `<!-- URL_TITLE:${encodedUrl}:${title} -->`;

  console.log('[urlTitleStorage] Embedding title:', { url, encodedUrl, title, comment });

  // Check if title comment already exists for this URL
  const existingCommentRegex = new RegExp(`<!-- URL_TITLE:${escapeRegex(encodedUrl)}:[^>]* -->`);
  if (existingCommentRegex.test(content)) {
    // Replace existing title comment
    console.log('[urlTitleStorage] Replacing existing title comment for URL:', url);
    return content.replace(existingCommentRegex, comment);
  }

  // Insert new title comment before the URL
  const urlIndex = content.indexOf(url);
  if (urlIndex > -1) {
    // Find the start of the line containing the URL
    const insertIndex = content.lastIndexOf('\n', urlIndex) + 1;
    console.log('[urlTitleStorage] Inserting title comment before URL:', { urlIndex, insertIndex });
    return content.slice(0, insertIndex) + comment + '\n' + content.slice(insertIndex);
  }

  // Append to end if URL not found
  console.log('[urlTitleStorage] URL not found in content, appending comment to end');
  return content + '\n' + comment;
}

/**
 * Extract all URL titles from content as HTML comments
 * @param content - The todo content
 * @returns Map of URLs to their titles
 */
export function extractUrlTitlesFromContent(content: string): Map<string, string> {
  const titles = new Map<string, string>();
  const regex = /<!-- URL_TITLE:([^:]+):([^>]+) -->/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const url = decodeURIComponent(match[1]); // 添加解码
      const title = match[2];
      console.log('[urlTitleStorage] Extracted embedded title:', { url, title });
      titles.set(url, title);
    } catch (error) {
      console.error('Failed to parse embedded URL title:', error);
    }
  }

  console.log('[urlTitleStorage] Total embedded titles extracted:', titles.size);
  return titles;
}

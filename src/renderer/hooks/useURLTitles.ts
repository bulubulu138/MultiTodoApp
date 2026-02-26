import { useState, useEffect, useRef, useCallback } from 'react';
import { Todo } from '../../shared/types';
import { extractUrlTitlesFromContent } from '../utils/urlTitleStorage';

// URL提取正则
const URL_REGEX = /(https?:\/\/[^\s<>"]+)/g;

/**
 * LRU缓存类 - 用于缓存URL标题
 */
class URLTitleCache {
  private cache = new Map<string, { title: string; timestamp: number }>();
  private maxSize = 50;

  /**
   * 获取缓存的标题
   */
  get(url: string): string | null {
    const entry = this.cache.get(url);
    if (entry) {
      // LRU: 移到最后（最近使用）
      this.cache.delete(url);
      this.cache.set(url, entry);
      return entry.title;
    }
    return null;
  }

  /**
   * 设置缓存
   */
  set(url: string, title: string): void {
    // 如果已存在，先删除
    if (this.cache.has(url)) {
      this.cache.delete(url);
    }
    // 如果超过最大容量，删除最旧的
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(url, { title, timestamp: Date.now() });
  }

  /**
   * 检查是否已缓存
   */
  has(url: string): boolean {
    return this.cache.has(url);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size;
  }
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
 * useURLTitles Hook
 * 提供URL标题获取和缓存功能
 */
export function useURLTitles(todo: Todo | null): {
  titles: Map<string, string>;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const cache = useRef(new URLTitleCache());
  const lastContentRef = useRef<string>('');

  /**
   * 获取URL标题
   * First extracts embedded titles from content, then fetches missing ones
   */
  const fetchTitles = useCallback(async (urls: string[], content?: string) => {
    if (urls.length === 0) {
      setTitles(new Map());
      return new Map();
    }

    setLoading(true);

    try {
      // First, extract embedded titles from content
      const embeddedTitles = content
        ? extractUrlTitlesFromContent(content)
        : new Map<string, string>();

      // Only fetch URLs without embedded titles
      const urlsToFetch = urls.filter(url => !embeddedTitles.has(url));

      // Fetch remaining URLs from the network
      const fetchedTitles = urlsToFetch.length > 0
        ? await window.electronAPI.urlTitles.fetchBatch(urlsToFetch)
        : {};

      // Combine embedded and fetched titles
      const allTitles = new Map<string, string>();
      urls.forEach(url => {
        // Priority: embedded title > fetched title > no title
        const title = embeddedTitles.get(url) || fetchedTitles[url];
        if (title) {
          cache.current.set(url, title);
          allTitles.set(url, title);
        }
      });

      setTitles(allTitles);
      return allTitles;
    } catch (error) {
      console.error('Failed to fetch URL titles:', error);
      // 失败时不更新缓存，允许重试
      return new Map();
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 刷新标题获取
   */
  const refresh = useCallback(async () => {
    if (!todo?.content) return;

    const urls = extractURLs(todo.content);
    if (urls.length > 0) {
      // Clear cache and fetch fresh titles (including embedded ones)
      cache.current.clear();
      await fetchTitles(urls, todo.content);
    }
  }, [todo?.content, fetchTitles]);

  /**
   * 当待办内容变化时，提取并获取URL标题
   */
  useEffect(() => {
    if (!todo?.content) {
      setTitles(new Map());
      lastContentRef.current = '';
      return;
    }

    // 避免重复处理相同内容
    if (todo.content === lastContentRef.current) {
      return;
    }
    lastContentRef.current = todo.content;

    const urls = extractURLs(todo.content);

    if (urls.length === 0) {
      setTitles(new Map());
      return;
    }

    // Extract embedded titles first
    const embeddedTitles = extractUrlTitlesFromContent(todo.content);

    // Separate cached and uncached URLs (excluding embedded titles)
    const uncachedUrls: string[] = [];
    const cachedTitles = new Map<string, string>();

    urls.forEach(url => {
      const embeddedTitle = embeddedTitles.get(url);
      if (embeddedTitle) {
        // Use embedded title immediately
        cachedTitles.set(url, embeddedTitle);
      } else {
        const cachedTitle = cache.current.get(url);
        if (cachedTitle) {
          cachedTitles.set(url, cachedTitle);
        } else {
          uncachedUrls.push(url);
        }
      }
    });

    // If all URLs have embedded or cached titles, use them
    if (uncachedUrls.length === 0) {
      setTitles(cachedTitles);
      return;
    }

    // Fetch remaining URL titles
    fetchTitles(uncachedUrls, todo.content).then((fetchedTitles) => {
      // Merge all titles
      const finalTitles = new Map<string, string>();
      urls.forEach(url => {
        const title = embeddedTitles.get(url) || cache.current.get(url);
        if (title) {
          finalTitles.set(url, title);
        }
      });
      setTitles(finalTitles);
    });
  }, [todo?.content, fetchTitles]);

  return {
    titles,
    loading,
    refresh,
  };
}

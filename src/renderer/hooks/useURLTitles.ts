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
  refresh: (content?: string) => Promise<void>;
} {
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const cache = useRef(new URLTitleCache());
  const lastContentRef = useRef<string>('');

  /**
   * 获取URL标题
   * Priority: embedded titles > authorization database > cache > network
   */
  const fetchTitles = useCallback(async (urls: string[], content?: string) => {
    if (urls.length === 0) {
      setTitles(new Map());
      return new Map();
    }

    setLoading(true);

    try {
      // 1. Extract embedded titles from content (highest priority)
      const embeddedTitles = content
        ? extractUrlTitlesFromContent(content)
        : new Map<string, string>();

      // 2. Get titles from authorization database (second priority)
      const urlsToCheckAuth = urls.filter(url => !embeddedTitles.has(url));
      const authTitles = urlsToCheckAuth.length > 0
        ? await window.electronAPI.urlAuth.getTitles?.(urlsToCheckAuth)
        : {};

      // 3. Only fetch URLs without embedded or auth titles
      const urlsToFetch = urls.filter(url =>
        !embeddedTitles.has(url) && !authTitles[url]
      );

      // 4. Fetch remaining URLs from the network
      const fetchedTitles = urlsToFetch.length > 0
        ? await window.electronAPI.urlTitles.fetchBatch(urlsToFetch)
        : {};

      // 5. Combine all titles by priority
      const allTitles = new Map<string, string>();
      urls.forEach(url => {
        const title = embeddedTitles.get(url) || authTitles[url] || fetchedTitles[url];
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
   * @param content - 可选的 content 参数，如果提供则使用该内容而不是 todo.content
   */
  const refresh = useCallback(async (content?: string) => {
    // 使用传入的 content，如果没有则使用 todo.content
    const contentToUse = content || todo?.content;

    console.log('[useURLTitles] refresh called:', {
      hasContentParam: !!content,
      hasTodoContent: !!todo?.content,
      contentToUse: contentToUse?.substring(0, 100),
      contentToUseLength: contentToUse?.length
    });

    if (!contentToUse) return;

    const urls = extractURLs(contentToUse);
    console.log('[useURLTitles] URLs extracted:', urls.length, urls);

    if (urls.length > 0) {
      // Log embedded titles for debugging
      const embeddedTitles = extractUrlTitlesFromContent(contentToUse);
      console.log('[useURLTitles] Embedded titles found:', Object.fromEntries(embeddedTitles));

      // Clear cache and fetch fresh titles (including embedded ones)
      cache.current.clear();
      await fetchTitles(urls, contentToUse);
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

    // Extract embedded titles first (highest priority)
    const embeddedTitles = extractUrlTitlesFromContent(todo.content);

    // Get URLs that need titles (not in embedded)
    const urlsNeedingTitles = urls.filter(url => !embeddedTitles.has(url));

    // Load titles from authorization database (async)
    const loadTitles = async () => {
      // Separate cached and uncached URLs (excluding embedded titles)
      const uncachedUrls: string[] = [];
      const initialTitles = new Map<string, string>();

      // Add embedded titles immediately
      embeddedTitles.forEach((title, url) => {
        initialTitles.set(url, title);
      });

      // Check cache for remaining URLs
      urlsNeedingTitles.forEach(url => {
        const cachedTitle = cache.current.get(url);
        if (cachedTitle) {
          initialTitles.set(url, cachedTitle);
        } else {
          uncachedUrls.push(url);
        }
      });

      // If all URLs have embedded or cached titles, use them
      if (uncachedUrls.length === 0) {
        setTitles(initialTitles);
        return;
      }

      // Fetch remaining URL titles (will check auth db then network)
      const fetchedTitles = await fetchTitles(uncachedUrls, todo.content);

      // Merge all titles by priority: embedded > auth > cache > fetched
      const finalTitles = new Map<string, string>();
      urls.forEach(url => {
        const embeddedTitle = embeddedTitles.get(url);
        const cachedTitle = cache.current.get(url);
        const fetchedTitle = fetchedTitles.get(url);
        const title = embeddedTitle || cachedTitle || fetchedTitle;
        if (title) {
          finalTitles.set(url, title);
        }
      });

      setTitles(finalTitles);
    };

    loadTitles();
  }, [todo?.content, fetchTitles]);

  return {
    titles,
    loading,
    refresh,
  };
}

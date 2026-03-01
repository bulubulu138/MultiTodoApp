import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Todo } from '../../shared/types';
import { extractUrlTitlesFromContent } from '../utils/urlTitleStorage';

// URL提取正则
const URL_REGEX = /(https?:\/\/[^\s<>"]+)/g;

/**
 * LRU缓存类 - 用于缓存URL标题
 */
class URLTitleCache {
  private cache = new Map<string, { title: string; timestamp: number }>();
  private maxSize = 100; // 增加缓存大小以支持批量获取

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
   * 批量设置缓存
   */
  setBatch(entries: [string, string][]): void {
    entries.forEach(([url, title]) => {
      this.set(url, title);
    });
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
 * useBatchURLTitles Hook
 * 为多个待办事项批量获取URL标题
 */
export function useBatchURLTitles(todos: Todo[]): {
  getUrlTitlesForTodo: (todoId: number) => Map<string, string>;
  loading: boolean;
  refresh: () => Promise<void>;
} {
  const [titlesByTodo, setTitlesByTodo] = useState<Map<number, Map<string, string>>>(new Map());
  const [loading, setLoading] = useState(false);
  const cache = useRef(new URLTitleCache());
  const lastContentHashRef = useRef<string>('');

  /**
   * 计算所有待办内容的哈希值，用于检测变化
   */
  const contentHash = useMemo(() => {
    return todos.map(todo => `${todo.id}:${todo.content?.substring(0, 100)}`).join('|');
  }, [todos]);

  /**
   * 获取特定待办的URL标题
   */
  const getUrlTitlesForTodo = useCallback((todoId: number): Map<string, string> => {
    return titlesByTodo.get(todoId) || new Map();
  }, [titlesByTodo]);

  /**
   * 批量获取URL标题
   */
  const fetchTitles = useCallback(async (todosToFetch: Todo[]) => {
    if (todosToFetch.length === 0) {
      setTitlesByTodo(new Map());
      return;
    }

    setLoading(true);

    try {
      // 收集所有需要获取的URL
      const urlToTodoIds = new Map<string, number[]>();
      const embeddedTitlesByTodo = new Map<number, Map<string, string>>();

      todosToFetch.forEach(todo => {
        if (!todo.content) return;

        // 提取嵌入的标题
        const embeddedTitles = extractUrlTitlesFromContent(todo.content);
        embeddedTitlesByTodo.set(todo.id!, embeddedTitles);

        // 提取所有URL
        const urls = extractURLs(todo.content);
        urls.forEach(url => {
          if (!urlToTodoIds.has(url)) {
            urlToTodoIds.set(url, []);
          }
          urlToTodoIds.get(url)!.push(todo.id!);
        });
      });

      // 分离已缓存和未缓存的URL（排除已有嵌入标题的）
      const urlsToFetch: string[] = [];
      const cachedTitles = new Map<string, string>();

      urlToTodoIds.forEach((todoIds, url) => {
        // 检查是否有任何一个待办有嵌入标题
        const hasEmbeddedTitle = Array.from(embeddedTitlesByTodo.values())
          .some(titles => titles.has(url));

        if (!hasEmbeddedTitle) {
          const cachedTitle = cache.current.get(url);
          if (cachedTitle) {
            cachedTitles.set(url, cachedTitle);
          } else {
            urlsToFetch.push(url);
          }
        }
      });

      // 批量获取未缓存的URL标题
      const fetchedTitles = urlsToFetch.length > 0
        ? await window.electronAPI.urlTitles.fetchBatch(urlsToFetch)
        : {};

      // 更新缓存
      const fetchedEntries = Object.entries(fetchedTitles);
      if (fetchedEntries.length > 0) {
        cache.current.setBatch(fetchedEntries);
      }

      // 为每个待办构建标题Map
      const newTitlesByTodo = new Map<number, Map<string, string>>();

      todosToFetch.forEach(todo => {
        if (!todo.content) return;

        const todoTitles = new Map<string, string>();
        const urls = extractURLs(todo.content);
        const embeddedTitles = embeddedTitlesByTodo.get(todo.id!) || new Map();

        urls.forEach(url => {
          // 优先级：嵌入标题 > 缓存标题 > 新获取的标题
          const title = embeddedTitles.get(url)
            || cachedTitles.get(url)
            || fetchedTitles[url];

          if (title) {
            todoTitles.set(url, title);
          }
        });

        newTitlesByTodo.set(todo.id!, todoTitles);
      });

      setTitlesByTodo(newTitlesByTodo);
    } catch (error) {
      console.error('Failed to fetch batch URL titles:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 刷新所有标题
   */
  const refresh = useCallback(async () => {
    cache.current.clear();
    await fetchTitles(todos);
  }, [todos, fetchTitles]);

  /**
   * 当待办内容变化时，提取并获取URL标题
   */
  useEffect(() => {
    // 避免重复处理相同内容
    if (contentHash === lastContentHashRef.current) {
      return;
    }
    lastContentHashRef.current = contentHash;

    // 过滤出有内容的待办
    const todosWithContent = todos.filter(todo => todo.content && todo.content.trim().length > 0);

    if (todosWithContent.length === 0) {
      setTitlesByTodo(new Map());
      return;
    }

    fetchTitles(todosWithContent);
  }, [contentHash, todos, fetchTitles]);

  return {
    getUrlTitlesForTodo,
    loading,
    refresh,
  };
}

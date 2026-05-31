import { useRef, useCallback } from 'react';

/**
 * FLIP 动画 Hook - 用于列表重排序的流畅过渡
 *
 * FLIP = First, Last, Invert, Play
 * 1. First: 记录元素的初始位置
 * 2. Last: 执行 DOM 更新（元素移动到新位置）
 * 3. Invert: 计算位移差值，用 transform 将元素"拉回"初始位置
 * 4. Play: 移除 transform，让元素以动画过渡到最终位置
 *
 * 性能优化：
 * - 使用 Web Animations API（比 CSS transition 性能更好）
 * - 仅操作 transform 和 opacity（GPU 加速）
 * - 自动禁用大列表（>100 项）以保证性能
 *
 * @param options 配置选项
 * @returns FLIP 动画控制函数
 */
export interface FLIPOptions {
  /** 动画时长（毫秒），默认 250ms */
  duration?: number;
  /** 缓动函数，默认 cubic-bezier(0.2, 0, 0, 1) - Apple 风格 */
  easing?: string;
  /** 最大项数限制，超过此数量自动禁用动画，默认 100 */
  maxItems?: number;
  /** 是否启用动画，默认 true */
  enabled?: boolean;
}

interface ElementPosition {
  element: HTMLElement;
  rect: DOMRect;
}

export const useFLIPAnimation = (options: FLIPOptions = {}) => {
  const {
    duration = 250,
    easing = 'cubic-bezier(0.2, 0, 0, 1)',
    maxItems = 100,
    enabled = true
  } = options;

  // 存储元素的初始位置
  const positionsRef = useRef<Map<string, ElementPosition>>(new Map());
  // 存储正在运行的动画
  const animationsRef = useRef<Map<string, Animation>>(new Map());

  /**
   * 第一步：记录所有元素的初始位置
   * 在 DOM 更新之前调用
   */
  const capturePositions = useCallback((container: HTMLElement, itemSelector: string = '[data-flip-id]') => {
    if (!enabled) return;

    const elements = container.querySelectorAll<HTMLElement>(itemSelector);

    // 性能保护：超过最大项数时禁用动画
    if (elements.length > maxItems) {
      console.log(`[FLIP] Disabled: ${elements.length} items exceeds maxItems (${maxItems})`);
      return;
    }

    positionsRef.current.clear();

    elements.forEach(element => {
      const id = element.getAttribute('data-flip-id');
      if (id) {
        positionsRef.current.set(id, {
          element,
          rect: element.getBoundingClientRect()
        });
      }
    });

    console.log(`[FLIP] Captured ${positionsRef.current.size} positions`);
  }, [enabled, maxItems]);

  /**
   * 第二步：执行动画
   * 在 DOM 更新之后调用
   */
  const animate = useCallback((container: HTMLElement, itemSelector: string = '[data-flip-id]') => {
    if (!enabled || positionsRef.current.size === 0) return;

    const elements = container.querySelectorAll<HTMLElement>(itemSelector);

    // 取消所有正在运行的动画
    animationsRef.current.forEach(animation => animation.cancel());
    animationsRef.current.clear();

    elements.forEach(element => {
      const id = element.getAttribute('data-flip-id');
      if (!id) return;

      const oldPosition = positionsRef.current.get(id);
      if (!oldPosition) return;

      // Last: 获取元素的最终位置
      const newRect = element.getBoundingClientRect();

      // Invert: 计算位移差值
      const deltaX = oldPosition.rect.left - newRect.left;
      const deltaY = oldPosition.rect.top - newRect.top;

      // 如果位置没有变化，跳过动画
      if (deltaX === 0 && deltaY === 0) return;

      // Play: 使用 Web Animations API 执行动画
      const animation = element.animate(
        [
          {
            transform: `translate(${deltaX}px, ${deltaY}px)`,
            offset: 0
          },
          {
            transform: 'translate(0, 0)',
            offset: 1
          }
        ],
        {
          duration,
          easing,
          fill: 'none' // 动画结束后不保留最终状态
        }
      );

      animationsRef.current.set(id, animation);

      // 动画完成后清理
      animation.onfinish = () => {
        animationsRef.current.delete(id);
      };
    });

    console.log(`[FLIP] Animated ${animationsRef.current.size} elements`);

    // 清理位置缓存
    positionsRef.current.clear();
  }, [enabled, duration, easing]);

  /**
   * 便捷方法：自动执行完整的 FLIP 流程
   *
   * @param container 容器元素
   * @param updateFn DOM 更新函数（会在 First 和 Last 之间执行）
   * @param itemSelector 项目选择器，默认 '[data-flip-id]'
   */
  const runFLIP = useCallback(async (
    container: HTMLElement,
    updateFn: () => void | Promise<void>,
    itemSelector: string = '[data-flip-id]'
  ) => {
    if (!enabled) {
      await updateFn();
      return;
    }

    // First: 记录初始位置
    capturePositions(container, itemSelector);

    // 执行 DOM 更新
    await updateFn();

    // Last + Invert + Play: 执行动画
    // 使用 requestAnimationFrame 确保 DOM 更新已完成
    requestAnimationFrame(() => {
      animate(container, itemSelector);
    });
  }, [enabled, capturePositions, animate]);

  /**
   * 取消所有正在运行的动画
   */
  const cancelAll = useCallback(() => {
    animationsRef.current.forEach(animation => animation.cancel());
    animationsRef.current.clear();
    positionsRef.current.clear();
  }, []);

  return {
    capturePositions,
    animate,
    runFLIP,
    cancelAll
  };
};

export default useFLIPAnimation;

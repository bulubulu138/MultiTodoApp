/**
 * 拖拽动画工具函数
 * 实现 macOS Finder 风格的拖拽效果
 */

/**
 * 检测是否应该减少动画效果
 */
export const shouldReduceMotion = (): boolean => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * 获取动画配置
 */
export const getAnimationConfig = () => {
  const reduced = shouldReduceMotion();

  return {
    shadow: reduced ? 'none' : '0 12px 28px rgba(0, 0, 0, 0.35)',
    scale: reduced ? 1 : 1.05,
    rotate: reduced ? 0 : 2,
    transitionDuration: reduced ? 0 : 150,
    opacity: reduced ? 1 : 0.85,
  };
};

/**
 * 计算磁吸位置
 * @param dragPosition 当前拖拽位置
 * @param targetPosition 目标位置
 * @param threshold 磁吸阈值（像素）
 * @returns 计算后的位置
 */
export const calculateSnapPosition = (
  dragPosition: number,
  targetPosition: number,
  threshold = 40
): number => {
  const distance = Math.abs(dragPosition - targetPosition);

  if (distance < threshold) {
    // 使用 easeOutCubic 缓动函数
    const t = distance / threshold;
    const easedT = 1 - Math.pow(1 - t, 3);
    return targetPosition + (dragPosition - targetPosition) * easedT;
  }

  return dragPosition;
};

/**
 * 应用磁吸动画
 * @param element 要动画的元素
 * @param targetPosition 目标位置
 * @param duration 动画持续时间（毫秒）
 */
export const applySnapAnimation = (
  element: HTMLElement,
  targetPosition: number,
  duration = 250
): void => {
  const startTime = performance.now();
  const startPosition = parseFloat(element.style.transform.replace('translate3d(0, ', '').replace('px, 0)', '')) || 0;

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // easeOutCubic
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentPosition = startPosition + (targetPosition - startPosition) * easedProgress;

    element.style.transform = `translate3d(0, ${currentPosition}px, 0)`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};

/**
 * 应用弹性释放动画（easeOutBack）
 * @param element 要动画的元素
 * @param targetPosition 目标位置
 * @param duration 动画持续时间（毫秒）
 */
export const applyElasticDropAnimation = (
  element: HTMLElement,
  targetPosition: number,
  duration = 300
): void => {
  if (shouldReduceMotion()) {
    // 如果用户偏好减少动画，直接设置到目标位置
    element.style.transform = `translate3d(0, ${targetPosition}px, 0)`;
    return;
  }

  const startTime = performance.now();
  const startPosition = parseFloat(element.style.transform.replace('translate3d(0, ', '').replace('px, 0)', '')) || 0;

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // easeOutBack 缓动函数，创建弹性效果
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const easedProgress = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

    const currentPosition = startPosition + (targetPosition - startPosition) * easedProgress;
    element.style.transform = `translate3d(0, ${currentPosition}px, 0)`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};

/**
 * FLIP (First, Last, Invert, Play) 动画技术
 * @param elements 要动画的元素数组
 * @param duration 动画持续时间（毫秒）
 */
export const applyFlipAnimation = (
  elements: HTMLElement[],
  duration = 250
): void => {
  if (shouldReduceMotion()) {
    return; // 如果用户偏好减少动画，跳过 FLIP 动画
  }

  // First: 记录初始位置
  const first = elements.map(el => ({
    el,
    rect: el.getBoundingClientRect()
  }));

  // Last: 应用新状态
  requestAnimationFrame(() => {
    const last = elements.map(el => el.getBoundingClientRect());

    // Invert: 计算位置差异并反转
    first.forEach((firstState, index) => {
      const lastState = last[index];
      const deltaX = firstState.rect.left - lastState.left;
      const deltaY = firstState.rect.top - lastState.top;

      // Play: 播放动画
      if (deltaX !== 0 || deltaY !== 0) {
        firstState.el.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        firstState.el.style.transition = 'none';

        requestAnimationFrame(() => {
          firstState.el.style.transition = `transform ${duration}ms ease-out`;
          firstState.el.style.transform = '';
        });
      }
    });
  });
};

/**
 * 缓动函数集合
 */
export const EasingFunctions = {
  linear: (t: number) => t,

  easeInQuad: (t: number) => t * t,

  easeOutQuad: (t: number) => t * (2 - t),

  easeInOutQuad: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  easeInCubic: (t: number) => t * t * t,

  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),

  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  easeInBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },

  easeOutBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  easeInOutBack: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  }
};

/**
 * 应用缓动动画
 * @param element 要动画的元素
 * @param from 起始值
 * @param to 目标值
 * @param duration 动画持续时间（毫秒）
 * @param easing 缓动函数
 * @param onUpdate 每帧更新回调
 */
export const applyEasingAnimation = (
  from: number,
  to: number,
  duration: number,
  easing: keyof typeof EasingFunctions = 'easeOutCubic',
  onUpdate: (value: number) => void
): void => {
  const startTime = performance.now();
  const easingFunction = EasingFunctions[easing];

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easingFunction(progress);
    const currentValue = from + (to - from) * easedProgress;

    onUpdate(currentValue);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
};

/**
 * 监听系统动画偏好设置变化
 * @param callback 回调函数
 * @returns 清理函数
 */
export const watchMotionPreference = (callback: (prefersReducedMotion: boolean) => void): (() => void) => {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const handleChange = (event: MediaQueryListEvent) => {
    callback(event.matches);
  };

  // 添加事件监听器（兼容不同浏览器）
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  } else {
    // 旧浏览器兼容
    (mediaQuery as any).addListener(handleChange);
    return () => (mediaQuery as any).removeListener(handleChange);
  }
};
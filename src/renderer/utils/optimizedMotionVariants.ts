import { Variants, MotionProps } from 'framer-motion';
import { useRef, useCallback } from 'react';

// 性能优化的动画变体配置
export const optimizedMotionVariants = {
  // 轻量级页面切换动画
  pageTransition: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  },

  // 简化的列表项动画
  listItem: {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2, // 减少动画时长
        ease: 'easeOut'
      }
    },
    hover: {
      scale: 1.01, // 减少缩放幅度
      transition: {
        duration: 0.15
      }
    }
  },

  // 简化的卡片动画
  card: {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    }
  },

  // 简化的模态框动画
  modal: {
    hidden: {
      opacity: 0,
      scale: 0.95
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.25,
        ease: 'easeOut'
      }
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  },

  // 最小化按钮动画
  button: {
    hover: {
      scale: 1.02, // 极小的缩放
      transition: {
        duration: 0.1
      }
    },
    tap: {
      scale: 0.98,
      transition: {
        duration: 0.05
      }
    }
  },

  // 简化的加载动画
  loading: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },

  // 简化的通知动画
  notification: {
    initial: {
      opacity: 0,
      y: -20,
      scale: 0.95
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  }
} as const;

// 性能优化的动画属性
export const optimizedMotionProps: MotionProps = {
  // 使用 transform 而不是 layout 属性
  transformTemplate: (value) => String(value),

  // 禁用某些昂贵的动画特性
  initial: false,
  animate: true,
  transition: {
    duration: 0.2, // 默认更短的动画时长
    ease: 'easeOut'
  },

  // 预设的轻量级过渡
  lightTransition: {
    duration: 0.15,
    ease: 'easeOut'
  },

  // 预设的中等过渡
  mediumTransition: {
    duration: 0.25,
    ease: 'easeOut'
  }
};

// 动画节流 Hook
export const useMotionThrottle = () => {
  const lastUpdate = useRef<number>(0);
  const animationFrame = useRef<number>();

  const throttle = useCallback((callback: () => void, delay: number = 16) => {
    const now = performance.now();

    if (now - lastUpdate.current < delay) {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }

      animationFrame.current = requestAnimationFrame(() => {
        callback();
        lastUpdate.current = performance.now();
      });
    } else {
      callback();
      lastUpdate.current = now;
    }
  }, []);

  return { throttle };
};

// 条件动画 Hook - 只在特定条件下启用动画
export const useConditionalAnimation = (
  condition: boolean,
  enabled: boolean = true,
  reducedMotion: boolean = false
) => {
  // 检测用户是否偏好减少动画
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  return {
    shouldAnimate: enabled && condition && !prefersReducedMotion && !reducedMotion,
    variants: enabled && condition && !prefersReducedMotion && !reducedMotion
      ? optimizedMotionVariants
      : {}
  };
};

// 批量动画配置生成器
export const createBatchAnimations = (count: number, stagger: number = 50) => {
  return Array.from({ length: count }, (_, index) => ({
    initial: { opacity: 0, y: 10 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        delay: index * stagger / 1000, // 转换为秒
        duration: 0.2
      }
    },
    exit: {
      opacity: 0,
      y: -10,
      transition: {
        duration: 0.15
      }
    }
  }));
};

// GPU 加速的 CSS 类
export const gpuAcceleratedStyles = {
  // 使用 GPU 加速的变换
  transform: {
    transform: 'translate3d(0, 0, 0)', // 强制 GPU 加速
    willChange: 'transform', // 提示浏览器优化
    backfaceVisibility: 'hidden' as const, // 避免闪烁
  },

  // 优化的过渡
  optimizedTransition: {
    transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
    transform: 'translate3d(0, 0, 0)',
    willChange: 'transform, opacity',
    backfaceVisibility: 'hidden' as const,
  },

  // 高性能的缩放
  scalable: {
    transform: 'translate3d(0, 0, 0) scale(1)',
    transformOrigin: 'center center',
    backfaceVisibility: 'hidden' as const,
  }
};

// 动画性能监控 Hook
export const useMotionPerformanceMonitor = () => {
  const frameCount = useRef(0);
  const startTime = useRef(performance.now());
  const lastFrameTime = useRef(performance.now());

  const measureFPS = useCallback(() => {
    frameCount.current++;
    const now = performance.now();

    if (now - lastFrameTime.current >= 1000) {
      const fps = Math.round((frameCount.current * 1000) / (now - startTime.current));

      // 性能警告
      if (fps < 30) {
        console.warn(`[动画性能] FPS 较低: ${fps}，建议减少动画复杂度`);
      }

      // 重置计数器
      frameCount.current = 0;
      startTime.current = now;
      lastFrameTime.current = now;

      return fps;
    }

    return null;
  }, []);

  const startMonitoring = useCallback(() => {
    const monitor = () => {
      measureFPS();
      requestAnimationFrame(monitor);
    };
    requestAnimationFrame(monitor);

    return () => {
      // 清理逻辑（如果需要）
    };
  }, [measureFPS]);

  return { startMonitoring, measureFPS };
};

// 减少动画的检测
export const shouldReduceMotion = (): boolean => {
  if (typeof window === 'undefined') return false;

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};
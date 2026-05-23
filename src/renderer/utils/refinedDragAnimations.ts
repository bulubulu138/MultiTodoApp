/**
 * 精致拖拽动画系统
 * 基于物理引擎的高级动画效果，创造丝滑的交互体验
 */

import { shouldReduceMotion } from './dragAnimations';

/**
 * 物理参数配置
 */
interface PhysicsConfig {
  stiffness: number;    // 弹簧硬度
  damping: number;     // 阻尼系数
  mass: number;        // 质量
}

/**
 * 缓动函数类型
 */
export type EasingFunction = (t: number) => number;

/**
 * 精致的缓动函数集合
 */
export const RefinedEasing = {
  // 指数缓动 - 更自然的开始和结束
  easeInExpo: (t: number) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  easeOutExpo: (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: (t: number) => {
    if (t === 0 || t === 1) return t;
    return t < 0.5
      ? Math.pow(2, 20 * t - 10) / 2
      : (2 - Math.pow(2, -20 * t + 10)) / 2;
  },

  // 弹性缓动 - 带有弹跳效果
  easeOutElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 :
      Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },

  easeInElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 :
      -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
  },

  easeInOutElastic: (t: number) => {
    const c5 = (2 * Math.PI) / 4.5;
    return t === 0 || t === 1 ? t :
      t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1;
  },

  // 贝塞尔缓动 - 平滑的S形曲线
  easeInOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInCubic: (t: number) => t * t * t,

  // 自定义"丝滑"缓动 - 专门为拖拽设计
  smoothDrag: (t: number) => {
    // 组合多个缓动函数创造独特效果
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  },

  // 精致释放动画
  refinedDrop: (t: number) => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  }
};

/**
 * 物理弹簧系统
 */
export class SpringPhysics {
  private config: PhysicsConfig;
  private position: number = 0;
  private velocity: number = 0;
  private target: number = 0;

  constructor(config: PhysicsConfig = { stiffness: 0.1, damping: 0.8, mass: 1 }) {
    this.config = config;
  }

  /**
   * 设置目标位置
   */
  setTarget(target: number): void {
    this.target = target;
  }

  /**
   * 更新物理状态
   * @returns 当前是否还在运动
   */
  update(): boolean {
    const force = (this.target - this.position) * this.config.stiffness;
    const acceleration = force / this.config.mass;

    this.velocity += acceleration;
    this.velocity *= (1 - this.config.damping);
    this.position += this.velocity;

    // 检查是否稳定
    const isStable = Math.abs(this.velocity) < 0.01 &&
                     Math.abs(this.position - this.target) < 0.01;

    if (isStable) {
      this.position = this.target;
      this.velocity = 0;
    }

    return !isStable;
  }

  /**
   * 获取当前位置
   */
  getPosition(): number {
    return this.position;
  }

  /**
   * 重置状态
   */
  reset(position: number = 0): void {
    this.position = position;
    this.velocity = 0;
    this.target = position;
  }
}

/**
 * 精致拖拽动画控制器
 */
export class RefinedDragAnimation {
  private spring: SpringPhysics;
  private isAnimating: boolean = false;
  private animationFrame: number | null = null;

  constructor() {
    this.spring = new SpringPhysics({
      stiffness: 0.15,
      damping: 0.85,
      mass: 0.8
    });
  }

  /**
   * 启动弹簧动画
   */
  animateTo(
    from: number,
    to: number,
    onUpdate: (value: number) => void,
    onComplete?: () => void
  ): void {
    if (shouldReduceMotion()) {
      // 直接跳到目标位置
      onUpdate(to);
      onComplete?.();
      return;
    }

    this.spring.reset(from);
    this.spring.setTarget(to);
    this.isAnimating = true;

    const animate = () => {
      if (!this.isAnimating) {
        onComplete?.();
        return;
      }

      const isStillMoving = this.spring.update();
      onUpdate(this.spring.getPosition());

      if (isStillMoving) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
        onComplete?.();
      }
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * 停止动画
   */
  stop(): void {
    this.isAnimating = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  /**
   * 使用缓动函数进行动画
   */
  animateWithEasing(
    from: number,
    to: number,
    duration: number,
    easing: EasingFunction = RefinedEasing.smoothDrag,
    onUpdate: (value: number) => void,
    onComplete?: () => void
  ): void {
    if (shouldReduceMotion()) {
      onUpdate(to);
      onComplete?.();
      return;
    }

    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);
      const currentValue = from + (to - from) * easedProgress;

      onUpdate(currentValue);

      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    this.animationFrame = requestAnimationFrame(animate);
  }
}

/**
 * 精致动画配置
 */
export interface RefinedAnimationConfig {
  // 拖拽时的视觉效果
  dragScale: number;
  dragOpacity: number;
  dragRotation: number;
  dragShadow: string;
  dragBlur: number;

  // 动画时长
  dragStartDuration: number;
  dragEndDuration: number;
  reorderDuration: number;

  // 缓动函数
  dragStartEasing: EasingFunction;
  dragEndEasing: EasingFunction;
  reorderEasing: EasingFunction;

  // 磁吸效果
  snapThreshold: number;
  snapStrength: number;
}

/**
 * 获取精致动画配置
 */
export const getRefinedAnimationConfig = (): RefinedAnimationConfig => {
  const reduced = shouldReduceMotion();

  if (reduced) {
    return {
      dragScale: 1,
      dragOpacity: 1,
      dragRotation: 0,
      dragShadow: 'none',
      dragBlur: 0,
      dragStartDuration: 0,
      dragEndDuration: 0,
      reorderDuration: 0,
      dragStartEasing: (t) => t,
      dragEndEasing: (t) => t,
      reorderEasing: (t) => t,
      snapThreshold: 0,
      snapStrength: 0
    };
  }

  return {
    // 更精致的拖拽效果
    dragScale: 1.08,
    dragOpacity: 0.9,
    dragRotation: 3,
    dragShadow: '0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
    dragBlur: 2,

    // 适度优化的动画时间，平衡流畅度和视觉效果
    dragStartDuration: 150,
    dragEndDuration: 250,
    reorderDuration: 200,

    // 使用更高级的缓动函数
    dragStartEasing: RefinedEasing.easeOutExpo,
    dragEndEasing: RefinedEasing.refinedDrop,
    reorderEasing: RefinedEasing.smoothDrag,

    // 磁吸效果
    snapThreshold: 50,
    snapStrength: 0.8
  };
};

/**
 * 配置验证函数
 */
const validateAnimationConfig = (config: RefinedAnimationConfig): RefinedAnimationConfig => {
  if (config.dragStartDuration < 0 || config.dragEndDuration < 0 || config.reorderDuration < 0) {
    console.warn('Invalid animation duration detected, using fallback values');
    return getRefinedAnimationConfig();
  }
  return config;
};

/**
 * 获取紧凑模式动画配置
 * 专为紧凑视图优化，减少动画时长，提升响应速度
 */
export const getCompactAnimationConfig = (): RefinedAnimationConfig => {
  const reduced = shouldReduceMotion();

  if (reduced) {
    return getRefinedAnimationConfig(); // 复用现有的简化配置
  }

  const config: RefinedAnimationConfig = {
    // 紧凑模式优化：更快的动画，更轻量的视觉效果
    dragScale: 1.05,
    dragOpacity: 0.95,
    dragRotation: 2,
    dragShadow: '0 12px 24px rgba(0, 0, 0, 0.2)',
    dragBlur: 1,

    // 核心优化：大幅减少动画时长
    dragStartDuration: 80,
    dragEndDuration: 120,
    reorderDuration: 100,

    // 使用更快速的缓动函数
    dragStartEasing: RefinedEasing.easeOutCubic,
    dragEndEasing: RefinedEasing.easeOutCubic,
    reorderEasing: RefinedEasing.smoothDrag,

    // 更灵敏的磁吸效果
    snapThreshold: 30,
    snapStrength: 0.9
  };

  return validateAnimationConfig(config);
};

/**
 * 精致磁吸效果计算
 */
export const calculateRefinedSnap = (
  currentPosition: number,
  targetPosition: number,
  threshold: number = 50,
  strength: number = 0.8
): { position: number; isSnapping: boolean } => {
  const distance = Math.abs(targetPosition - currentPosition);

  if (distance < threshold) {
    // 使用缓动函数计算磁吸位置
    const progress = 1 - (distance / threshold);
    const easedProgress = RefinedEasing.smoothDrag(progress);
    const snapOffset = (targetPosition - currentPosition) * easedProgress * strength;

    return {
      position: currentPosition + snapOffset,
      isSnapping: true
    };
  }

  return {
    position: currentPosition,
    isSnapping: false
  };
};

/**
 * 精致阴影生成器
 */
export const createRefinedShadow = (
  elevation: number,
  color: string = 'rgba(0, 0, 0, 0.2)'
): string => {
  const shadows = [];

  // 多层阴影创造深度感
  for (let i = 1; i <= elevation; i++) {
    const offset = i * 2;
    const blur = i * 4;
    const opacity = 0.1 / i;
    const shadowColor = color.replace('0.2)', `${opacity})`);

    shadows.push(`0 ${offset}px ${blur}px ${shadowColor}`);
  }

  return shadows.join(', ');
};

/**
 * 精致拖拽光晕效果
 */
export const createRefinedGlow = (
  color: string = '#1890ff',
  intensity: number = 0.3
): string => {
  return `0 0 ${20 * intensity}px ${color}, 0 0 ${40 * intensity}px ${color}`;
};

/**
 * 精致动画工具类
 */
export class RefinedAnimationUtils {
  /**
   * 元素进入动画
   */
  static animateIn(
    element: HTMLElement,
    delay: number = 0
  ): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';

        requestAnimationFrame(() => {
          element.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
          element.style.opacity = '1';
          element.style.transform = 'translateY(0)';

          setTimeout(resolve, 600);
        });
      }, delay);
    });
  }

  /**
   * 元素离开动画
   */
  static animateOut(
    element: HTMLElement
  ): Promise<void> {
    return new Promise((resolve) => {
      element.style.transition = 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      element.style.opacity = '0';
      element.style.transform = 'translateY(-10px) scale(0.95)';

      setTimeout(resolve, 300);
    });
  }

  /**
   * 批量交错动画
   */
  static async staggeredAnimate(
    elements: HTMLElement[],
    staggerDelay: number = 50
  ): Promise<void> {
    const promises = elements.map((element, index) =>
      this.animateIn(element, index * staggerDelay)
    );

    await Promise.all(promises);
  }

  /**
   * 精致震动反馈
   */
  static refinedShake(
    element: HTMLElement,
    intensity: number = 1
  ): void {
    const keyframes = [
      { transform: 'translateX(0)' },
      { transform: `translateX(-${5 * intensity}px)` },
      { transform: `translateX(${5 * intensity}px)` },
      { transform: `translateX(-${3 * intensity}px)` },
      { transform: `translateX(${3 * intensity}px)` },
      { transform: 'translateX(0)' }
    ];

    element.animate(keyframes, {
      duration: 400,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
    });
  }
}

/**
 * 全局精致动画实例
 */
export const refinedDragAnimation = new RefinedDragAnimation();
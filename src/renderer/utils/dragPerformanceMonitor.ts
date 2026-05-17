/**
 * 拖拽性能监控工具
 * 实时监控拖拽时的帧率，自动降级策略
 */

/**
 * 性能级别
 */
export enum PerformanceLevel {
  HIGH = 'high',      // 高性能，所有动画效果
  MEDIUM = 'medium',  // 中等性能，简化动画
  LOW = 'low',        // 低性能，最小化动画
}

/**
 * 拖拽性能监控器
 */
export class DragPerformanceMonitor {
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private fps = 60;
  private isMonitoring = false;
  private performanceLevel: PerformanceLevel = PerformanceLevel.HIGH;
  private monitoringInterval: number | null = null;

  /**
   * 开始监控性能
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return; // 已经在监控中
    }

    this.isMonitoring = true;
    this.frameCount = 0;
    this.lastFrameTime = performance.now();
    this.performanceLevel = PerformanceLevel.HIGH;

    this.measureFPS();
  }

  /**
   * 停止监控性能
   */
  stopMonitoring(): void {
    this.isMonitoring = false;

    if (this.monitoringInterval !== null) {
      cancelAnimationFrame(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * 测量 FPS
   */
  private measureFPS(): void {
    if (!this.isMonitoring) {
      return;
    }

    const currentTime = performance.now();
    this.frameCount++;

    const elapsed = currentTime - this.lastFrameTime;

    // 每秒计算一次 FPS
    if (elapsed >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFrameTime = currentTime;

      // 根据FPS自动调整性能级别
      this.updatePerformanceLevel();
    }

    this.monitoringInterval = requestAnimationFrame(() => this.measureFPS());
  }

  /**
   * 更新性能级别
   */
  private updatePerformanceLevel(): void {
    const previousLevel = this.performanceLevel;

    if (this.fps >= 55) {
      this.performanceLevel = PerformanceLevel.HIGH;
    } else if (this.fps >= 45) {
      this.performanceLevel = PerformanceLevel.MEDIUM;
    } else {
      this.performanceLevel = PerformanceLevel.LOW;
    }

    // 性能级别变化时应用降级策略
    if (previousLevel !== this.performanceLevel) {
      this.applyPerformanceLevel();
    }
  }

  /**
   * 应用性能级别
   */
  private applyPerformanceLevel(): void {
    const body = document.body;

    // 移除所有性能级别类
    body.classList.remove('performance-high', 'performance-medium', 'performance-low');

    // 添加当前性能级别类
    body.classList.add(`performance-${this.performanceLevel}`);

    console.log(`性能级别更新: ${this.performanceLevel}, FPS: ${this.fps}`);
  }

  /**
   * 获取当前 FPS
   */
  getCurrentFPS(): number {
    return this.fps;
  }

  /**
   * 获取当前性能级别
   */
  getPerformanceLevel(): PerformanceLevel {
    return this.performanceLevel;
  }

  /**
   * 手动设置性能级别
   */
  setPerformanceLevel(level: PerformanceLevel): void {
    this.performanceLevel = level;
    this.applyPerformanceLevel();
  }

  /**
   * 重置监控器
   */
  reset(): void {
    this.stopMonitoring();
    this.frameCount = 0;
    this.fps = 60;
    this.performanceLevel = PerformanceLevel.HIGH;
    document.body.classList.remove('performance-high', 'performance-medium', 'performance-low');
  }
}

/**
 * 单例实例
 */
export const dragPerformanceMonitor = new DragPerformanceMonitor();

/**
 * 监控拖拽性能的 Hook
 */
export const useDragPerformanceMonitor = () => {
  const startMonitoring = () => {
    dragPerformanceMonitor.startMonitoring();
  };

  const stopMonitoring = () => {
    dragPerformanceMonitor.stopMonitoring();
  };

  const getCurrentFPS = () => {
    return dragPerformanceMonitor.getCurrentFPS();
  };

  const getPerformanceLevel = () => {
    return dragPerformanceMonitor.getPerformanceLevel();
  };

  return {
    startMonitoring,
    stopMonitoring,
    getCurrentFPS,
    getPerformanceLevel,
  };
};

/**
 * 根据性能级别获取动画配置
 */
export const getAnimationConfigByPerformance = (performanceLevel: PerformanceLevel) => {
  switch (performanceLevel) {
    case PerformanceLevel.HIGH:
      return {
        shadow: '0 12px 28px rgba(0, 0, 0, 0.35)',
        scale: 1.05,
        rotate: 2,
        transitionDuration: 150,
        opacity: 0.85,
        enableFlipAnimation: true,
        enableElasticAnimation: true,
      };
    case PerformanceLevel.MEDIUM:
      return {
        shadow: '0 8px 16px rgba(0, 0, 0, 0.25)',
        scale: 1.02,
        rotate: 1,
        transitionDuration: 100,
        opacity: 0.9,
        enableFlipAnimation: true,
        enableElasticAnimation: false,
      };
    case PerformanceLevel.LOW:
      return {
        shadow: 'none',
        scale: 1,
        rotate: 0,
        transitionDuration: 0,
        opacity: 1,
        enableFlipAnimation: false,
        enableElasticAnimation: false,
      };
    default:
      return {
        shadow: 'none',
        scale: 1,
        rotate: 0,
        transitionDuration: 0,
        opacity: 1,
        enableFlipAnimation: false,
        enableElasticAnimation: false,
      };
  }
};
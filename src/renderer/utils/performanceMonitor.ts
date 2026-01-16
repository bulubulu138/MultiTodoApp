/**
 * PerformanceMonitor - 性能监控工具
 * 
 * 监控应用性能，包括渲染时间、内存使用等关键指标
 * 提供性能警告和优化建议
 */

interface PerformanceMetrics {
  // 加载性能
  initialLoadTime: number;      // 目标 < 1s
  todoListRenderTime: number;   // 目标 < 500ms
  flowchartRenderTime: number;  // 目标 < 300ms
  
  // 运行时性能
  scrollFPS: number;             // 目标 > 55fps
  searchResponseTime: number;    // 目标 < 300ms
  saveResponseTime: number;      // 目标 < 100ms
  
  // 资源使用
  memoryUsage: number;           // 目标 < 200MB
  cpuUsage: number;              // 目标 < 30%
  domNodeCount: number;          // 目标 < 500
}

interface PerformanceThresholds {
  initialLoadTime: number;
  todoListRenderTime: number;
  flowchartRenderTime: number;
  scrollFPS: number;
  searchResponseTime: number;
  saveResponseTime: number;
  memoryUsage: number;
  domNodeCount: number;
}

export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map();
  private static memorySnapshots: number[] = [];
  private static isDevelopment = process.env.NODE_ENV === 'development';
  
  // 性能阈值配置
  private static thresholds: PerformanceThresholds = {
    initialLoadTime: 1000,      // 1s
    todoListRenderTime: 500,    // 500ms
    flowchartRenderTime: 300,   // 300ms
    scrollFPS: 55,              // 55fps
    searchResponseTime: 300,    // 300ms
    saveResponseTime: 100,      // 100ms
    memoryUsage: 200 * 1024 * 1024, // 200MB
    domNodeCount: 500,          // 500 nodes
  };

  /**
   * 开始性能测量
   */
  static start(label: string): void {
    performance.mark(`${label}-start`);
  }

  /**
   * 结束性能测量并记录
   */
  static end(label: string): number {
    const startMark = `${label}-start`;
    const endMark = `${label}-end`;
    
    performance.mark(endMark);
    
    try {
      performance.measure(label, startMark, endMark);
      const measure = performance.getEntriesByName(label)[0];
      const duration = measure.duration;

      // 记录到历史
      if (!this.measurements.has(label)) {
        this.measurements.set(label, []);
      }
      const history = this.measurements.get(label)!;
      history.push(duration);

      // 只保留最近 100 次测量
      if (history.length > 100) {
        history.shift();
      }

      // 清理 marks 和 measures
      performance.clearMarks(startMark);
      performance.clearMarks(endMark);
      performance.clearMeasures(label);

      // 检查是否超过阈值并发出警告
      this.checkThreshold(label, duration);

      return duration;
    } catch (error) {
      console.warn(`Performance measurement failed for ${label}:`, error);
      return 0;
    }
  }

  /**
   * 获取平均性能
   */
  static getAverage(label: string): number {
    const history = this.measurements.get(label);
    if (!history || history.length === 0) return 0;

    const sum = history.reduce((a, b) => a + b, 0);
    return sum / history.length;
  }

  /**
   * 测量同步函数执行时间
   */
  static measure(label: string, fn: () => void): number {
    const start = performance.now();
    fn();
    const end = performance.now();
    const duration = end - start;
    
    // 记录到历史
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    const history = this.measurements.get(label)!;
    history.push(duration);
    
    if (history.length > 100) {
      history.shift();
    }
    
    if (this.isDevelopment) {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }
    
    // 检查阈值
    this.checkThreshold(label, duration);
    
    return duration;
  }

  /**
   * 测量异步函数执行时间
   */
  static async measureAsync(label: string, fn: () => Promise<void>): Promise<number> {
    const start = performance.now();
    await fn();
    const end = performance.now();
    const duration = end - start;
    
    // 记录到历史
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    const history = this.measurements.get(label)!;
    history.push(duration);
    
    if (history.length > 100) {
      history.shift();
    }
    
    if (this.isDevelopment) {
      console.log(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
    }
    
    // 检查阈值
    this.checkThreshold(label, duration);
    
    return duration;
  }

  /**
   * 记录内存使用情况
   */
  static recordMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usedJSHeapSize = memory.usedJSHeapSize;
      
      this.memorySnapshots.push(usedJSHeapSize);
      
      // 只保留最近 100 次快照
      if (this.memorySnapshots.length > 100) {
        this.memorySnapshots.shift();
      }
      
      // 检查内存使用是否超过阈值
      if (usedJSHeapSize > this.thresholds.memoryUsage) {
        this.warn('memory-usage', `内存使用过高: ${(usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      }
      
      if (this.isDevelopment) {
        console.log(`[Performance] Memory: ${(usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`);
      }
      
      return usedJSHeapSize;
    }
    return 0;
  }

  /**
   * 获取平均内存使用
   */
  static getAverageMemoryUsage(): number {
    if (this.memorySnapshots.length === 0) return 0;
    const sum = this.memorySnapshots.reduce((a, b) => a + b, 0);
    return sum / this.memorySnapshots.length;
  }

  /**
   * 获取当前内存使用
   */
  static getCurrentMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * 记录 DOM 节点数量
   */
  static recordDOMNodeCount(): number {
    const nodeCount = document.getElementsByTagName('*').length;
    
    if (nodeCount > this.thresholds.domNodeCount) {
      this.warn('dom-nodes', `DOM 节点数量过多: ${nodeCount}`);
    }
    
    if (this.isDevelopment) {
      console.log(`[Performance] DOM Nodes: ${nodeCount}`);
    }
    
    return nodeCount;
  }

  /**
   * 检查性能指标是否超过阈值
   */
  private static checkThreshold(label: string, duration: number): void {
    let threshold: number | undefined;
    let metricName: string = label;
    
    // 根据标签确定阈值
    if (label.includes('initial-load') || label.includes('initialLoad')) {
      threshold = this.thresholds.initialLoadTime;
      metricName = '初始加载时间';
    } else if (label.includes('todo-list') || label.includes('todoList')) {
      threshold = this.thresholds.todoListRenderTime;
      metricName = '待办列表渲染时间';
    } else if (label.includes('flowchart')) {
      threshold = this.thresholds.flowchartRenderTime;
      metricName = '流程图渲染时间';
    } else if (label.includes('search')) {
      threshold = this.thresholds.searchResponseTime;
      metricName = '搜索响应时间';
    } else if (label.includes('save')) {
      threshold = this.thresholds.saveResponseTime;
      metricName = '保存响应时间';
    }
    
    if (threshold && duration > threshold) {
      this.warn(label, `${metricName}超过阈值: ${duration.toFixed(2)}ms (阈值: ${threshold}ms)`);
    }
  }

  /**
   * 发出性能警告
   */
  private static warn(label: string, message: string): void {
    console.warn(`[Performance Warning] ${message}`);
    
    // 在开发环境中，可以显示更详细的信息
    if (this.isDevelopment) {
      console.warn(`[Performance Warning] Label: ${label}`);
      console.warn(`[Performance Warning] Average: ${this.getAverage(label).toFixed(2)}ms`);
      console.warn(`[Performance Warning] History:`, this.measurements.get(label));
    }
  }

  /**
   * 获取性能报告
   */
  static getReport(): Record<string, { avg: number; count: number; last: number }> {
    const report: Record<string, { avg: number; count: number; last: number }> = {};

    this.measurements.forEach((history, label) => {
      if (history.length > 0) {
        const sum = history.reduce((a, b) => a + b, 0);
        report[label] = {
          avg: sum / history.length,
          count: history.length,
          last: history[history.length - 1]
        };
      }
    });

    return report;
  }

  /**
   * 获取完整的性能指标
   */
  static getMetrics(): Partial<PerformanceMetrics> {
    const metrics: Partial<PerformanceMetrics> = {};
    
    // 渲染时间指标
    if (this.measurements.has('initial-load')) {
      metrics.initialLoadTime = this.getAverage('initial-load');
    }
    if (this.measurements.has('todo-list-render')) {
      metrics.todoListRenderTime = this.getAverage('todo-list-render');
    }
    if (this.measurements.has('flowchart-render')) {
      metrics.flowchartRenderTime = this.getAverage('flowchart-render');
    }
    
    // 响应时间指标
    if (this.measurements.has('search')) {
      metrics.searchResponseTime = this.getAverage('search');
    }
    if (this.measurements.has('save')) {
      metrics.saveResponseTime = this.getAverage('save');
    }
    
    // 资源使用指标
    metrics.memoryUsage = this.getAverageMemoryUsage();
    metrics.domNodeCount = this.recordDOMNodeCount();
    
    return metrics;
  }

  /**
   * 打印性能报告（开发环境）
   */
  static printReport(): void {
    if (!this.isDevelopment) return;
    
    console.group('📊 Performance Report');
    
    const metrics = this.getMetrics();
    
    console.log('⏱️  Rendering Performance:');
    if (metrics.initialLoadTime) {
      console.log(`  - Initial Load: ${metrics.initialLoadTime.toFixed(2)}ms (target: <1000ms)`);
    }
    if (metrics.todoListRenderTime) {
      console.log(`  - Todo List Render: ${metrics.todoListRenderTime.toFixed(2)}ms (target: <500ms)`);
    }
    if (metrics.flowchartRenderTime) {
      console.log(`  - Flowchart Render: ${metrics.flowchartRenderTime.toFixed(2)}ms (target: <300ms)`);
    }
    
    console.log('\n⚡ Response Time:');
    if (metrics.searchResponseTime) {
      console.log(`  - Search: ${metrics.searchResponseTime.toFixed(2)}ms (target: <300ms)`);
    }
    if (metrics.saveResponseTime) {
      console.log(`  - Save: ${metrics.saveResponseTime.toFixed(2)}ms (target: <100ms)`);
    }
    
    console.log('\n💾 Resource Usage:');
    if (metrics.memoryUsage) {
      console.log(`  - Memory: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB (target: <200MB)`);
    }
    if (metrics.domNodeCount) {
      console.log(`  - DOM Nodes: ${metrics.domNodeCount} (target: <500)`);
    }
    
    console.groupEnd();
  }

  /**
   * 检查性能是否达标
   */
  static checkPerformance(label: string, threshold: number): boolean {
    const avg = this.getAverage(label);
    return avg < threshold;
  }

  /**
   * 清除所有测量数据
   */
  static clear(): void {
    this.measurements.clear();
    this.memorySnapshots = [];
    performance.clearMarks();
    performance.clearMeasures();
  }

  /**
   * 记录大规模流程图警告
   */
  static warnLargeFlowchart(nodeCount: number, edgeCount: number): void {
    if (nodeCount > 100 || edgeCount > 150) {
      this.warn(
        'large-flowchart',
        `Large flowchart detected: ${nodeCount} nodes, ${edgeCount} edges. ` +
        'Performance may be affected. Consider splitting into smaller flowcharts.'
      );
    }
  }

  /**
   * 获取性能建议
   */
  static getPerformanceSuggestions(nodeCount?: number, edgeCount?: number): string[] {
    const suggestions: string[] = [];

    // 流程图相关建议
    if (nodeCount !== undefined && nodeCount > 100) {
      suggestions.push('节点数量较多（>100），建议拆分为多个流程图');
    }

    if (edgeCount !== undefined && edgeCount > 150) {
      suggestions.push('连线数量较多（>150），可能影响渲染性能');
    }

    // 渲染性能建议
    const todoListRenderTime = this.getAverage('todo-list-render');
    if (todoListRenderTime > this.thresholds.todoListRenderTime) {
      suggestions.push(`待办列表渲染时间较长（${todoListRenderTime.toFixed(0)}ms），建议启用虚拟滚动`);
    }

    const flowchartRenderTime = this.getAverage('flowchart-render');
    if (flowchartRenderTime > this.thresholds.flowchartRenderTime) {
      suggestions.push(`流程图渲染时间较长（${flowchartRenderTime.toFixed(0)}ms），建议优化流程图结构`);
    }

    // 内存使用建议
    const avgMemory = this.getAverageMemoryUsage();
    if (avgMemory > this.thresholds.memoryUsage) {
      suggestions.push(`内存使用较高（${(avgMemory / 1024 / 1024).toFixed(0)}MB），建议减少同时渲染的元素数量`);
    }

    // DOM 节点建议
    const domNodeCount = document.getElementsByTagName('*').length;
    if (domNodeCount > this.thresholds.domNodeCount) {
      suggestions.push(`DOM 节点数量较多（${domNodeCount}），建议使用虚拟滚动或懒加载`);
    }

    return suggestions;
  }

  /**
   * 启动定期性能监控（开发环境）
   */
  static startMonitoring(intervalMs: number = 10000): NodeJS.Timeout | null {
    if (!this.isDevelopment) return null;
    
    console.log('🔍 Performance monitoring started');
    
    return setInterval(() => {
      this.recordMemoryUsage();
      this.recordDOMNodeCount();
      
      const suggestions = this.getPerformanceSuggestions();
      if (suggestions.length > 0) {
        console.group('💡 Performance Suggestions');
        suggestions.forEach(s => console.log(`  - ${s}`));
        console.groupEnd();
      }
    }, intervalMs);
  }

  /**
   * 停止定期性能监控
   */
  static stopMonitoring(timerId: NodeJS.Timeout): void {
    clearInterval(timerId);
    if (this.isDevelopment) {
      console.log('🔍 Performance monitoring stopped');
      this.printReport();
    }
  }
}

/**
 * PerformanceMonitor - 性能监控工具
 * 
 * 监控流程图渲染性能，提供性能优化建议
 */
export class PerformanceMonitor {
  private static measurements: Map<string, number[]> = new Map();

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
    performance.clearMarks();
    performance.clearMeasures();
  }

  /**
   * 记录大规模流程图警告
   */
  static warnLargeFlowchart(nodeCount: number, edgeCount: number): void {
    if (nodeCount > 100 || edgeCount > 150) {
      console.warn(
        `Large flowchart detected: ${nodeCount} nodes, ${edgeCount} edges. ` +
        'Performance may be affected. Consider splitting into smaller flowcharts.'
      );
    }
  }

  /**
   * 获取性能建议
   */
  static getPerformanceSuggestions(nodeCount: number, edgeCount: number): string[] {
    const suggestions: string[] = [];

    if (nodeCount > 100) {
      suggestions.push('节点数量较多（>100），建议拆分为多个流程图');
    }

    if (edgeCount > 150) {
      suggestions.push('连线数量较多（>150），可能影响渲染性能');
    }

    const renderTime = this.getAverage('flowchart-render');
    if (renderTime > 1000) {
      suggestions.push(`渲染时间较长（${renderTime.toFixed(0)}ms），建议优化流程图结构`);
    }

    return suggestions;
  }
}

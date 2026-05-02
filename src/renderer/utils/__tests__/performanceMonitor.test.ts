/**
 * PerformanceMonitor 单元测试
 *
 * 测试覆盖：
 * 1. 正常 start-end 配对调用
 * 2. 重复调用 end（防御性测试）
 * 3. 未 start 就 end（防御性测试）
 * 4. 并发调用同一 label（隔离性测试）
 */

import { PerformanceMonitor } from '../performanceMonitor';

// Mock performance API
const mockMarks: { [key: string]: number } = {};
const mockMeasures: { [key: string]: { duration: number } } = {};

// 保存原始 performance API
const originalPerformance = global.performance;
const originalMark = global.performance.mark;
const originalMeasure = global.performance.measure;
const originalGetEntriesByName = global.performance.getEntriesByName;
const originalClearMarks = global.performance.clearMarks;
const originalClearMeasures = global.performance.clearMeasures;

beforeEach(() => {
  // Mock performance API
  global.performance.mark = jest.fn((name: string) => {
    mockMarks[name] = Date.now();
  });

  global.performance.measure = jest.fn((name: string, startMark: string, endMark: string) => {
    if (!mockMarks[startMark]) {
      throw new DOMException(`The mark ${startMark} does not exist`);
    }
    mockMeasures[name] = { duration: 100 };
  });

  global.performance.getEntriesByName = jest.fn((name: string) => {
    const results = [];
    if (mockMarks[name]) {
      results.push({ name, startTime: mockMarks[name], duration: 0 });
    }
    if (mockMeasures[name]) {
      results.push(mockMeasures[name]);
    }
    return results;
  });

  global.performance.clearMarks = jest.fn((name?: string) => {
    if (name) {
      delete mockMarks[name];
    } else {
      Object.keys(mockMarks).forEach(key => delete mockMarks[key]);
    }
  });

  global.performance.clearMeasures = jest.fn((name?: string) => {
    if (name) {
      delete mockMeasures[name];
    } else {
      Object.keys(mockMeasures).forEach(key => delete mockMeasures[key]);
    }
  });

  // 清理状态
  PerformanceMonitor.clear();
});

afterEach(() => {
  // 恢复原始 performance API
  global.performance.mark = originalMark;
  global.performance.measure = originalMeasure;
  global.performance.getEntriesByName = originalGetEntriesByName;
  global.performance.clearMarks = originalClearMarks;
  global.performance.clearMeasures = originalClearMeasures;

  // 清理 mock 数据
  Object.keys(mockMarks).forEach(key => delete mockMarks[key]);
  Object.keys(mockMeasures).forEach(key => delete mockMeasures[key]);
});

describe('PerformanceMonitor.end() - 防御性测试', () => {

  it('应该正常处理 start-end 配对调用', () => {
    PerformanceMonitor.start('test-label');
    const duration = PerformanceMonitor.end('test-label');

    expect(duration).toBe(100);
    expect(performance.mark).toHaveBeenCalledWith('test-label-start');
    expect(performance.mark).toHaveBeenCalledWith('test-label-end');
    expect(performance.measure).toHaveBeenCalledWith('test-label', 'test-label-start', 'test-label-end');
    expect(performance.clearMarks).toHaveBeenCalledWith('test-label-start');
    expect(performance.clearMarks).toHaveBeenCalledWith('test-label-end');
    expect(performance.clearMeasures).toHaveBeenCalledWith('test-label');
  });

  it('应该安全处理重复调用 end（幂等性）', () => {
    PerformanceMonitor.start('test-label');

    // 第一次调用
    const duration1 = PerformanceMonitor.end('test-label');
    expect(duration1).toBe(100);

    // 第二次调用（start mark 已被清理）
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const duration2 = PerformanceMonitor.end('test-label');

    expect(duration2).toBe(0);
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot end measurement "test-label"')
    );

    consoleWarnSpy.mockRestore();
  });

  it('应该安全处理未 start 就 end', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const duration = PerformanceMonitor.end('never-started');

    expect(duration).toBe(0);
    expect(consoleWarnSpy).toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cannot end measurement "never-started"')
    );

    consoleWarnSpy.mockRestore();
  });

  it('应该安全处理并发调用同一 label', () => {
    // 模拟并发场景：多个异步操作使用相同 label
    const results: number[] = [];

    // 启动第一个测量
    PerformanceMonitor.start('concurrent-label');
    results.push(PerformanceMonitor.end('concurrent-label'));

    // 启动第二个测量（相同 label）
    PerformanceMonitor.start('concurrent-label');
    results.push(PerformanceMonitor.end('concurrent-label'));

    // 两次调用都应该成功
    expect(results[0]).toBe(100);
    expect(results[1]).toBe(100);

    // 验证每个测量都被记录
    const history = (PerformanceMonitor as any).measurements.get('concurrent-label');
    expect(history).toHaveLength(2);
  });

  it('应该正确记录测量历史', () => {
    // 执行多次测量
    for (let i = 0; i < 5; i++) {
      PerformanceMonitor.start('history-test');
      PerformanceMonitor.end('history-test');
    }

    const avg = PerformanceMonitor.getAverage('history-test');
    expect(avg).toBe(100);
  });

  it('应该限制历史记录为 100 次', () => {
    // 执行超过 100 次测量
    for (let i = 0; i < 150; i++) {
      PerformanceMonitor.start('limit-test');
      PerformanceMonitor.end('limit-test');
    }

    const history = (PerformanceMonitor as any).measurements.get('limit-test');
    expect(history).toHaveLength(100);
  });

  it('应该处理 start mark 被 external 清理后的 end 调用', () => {
    PerformanceMonitor.start('external-clear');

    // 模拟外部代码清理了 marks
    performance.clearMarks('external-clear-start');

    // end 应该安全处理这种情况
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const duration = PerformanceMonitor.end('external-clear');

    expect(duration).toBe(0);
    expect(consoleWarnSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it('应该在开发环境输出警告，在生产环境静默', () => {
    const originalEnv = process.env.NODE_ENV;

    // 测试开发环境
    process.env.NODE_ENV = 'development';
    PerformanceMonitor.start('dev-test');
    performance.clearMarks('dev-test-start');

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    PerformanceMonitor.end('dev-test');

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();

    // 测试生产环境
    process.env.NODE_ENV = 'production';
    PerformanceMonitor.start('prod-test');
    performance.clearMarks('prod-test-start');

    const consoleWarnSpy2 = jest.spyOn(console, 'warn').mockImplementation();
    PerformanceMonitor.end('prod-test');

    expect(consoleWarnSpy2).not.toHaveBeenCalled();
    consoleWarnSpy2.mockRestore();

    process.env.NODE_ENV = originalEnv;
  });
});

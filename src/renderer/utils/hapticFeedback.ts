/**
 * 触感反馈工具函数
 * 实现设备震动反馈（如果设备支持）
 */

/**
 * 触感反馈类型
 */
export type HapticFeedbackType = 'start' | 'move' | 'end' | 'success' | 'error' | 'warning';

/**
 * 检查设备是否支持触感反馈
 */
export const supportsHapticFeedback = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * 触感反馈配置
 */
const HAPTIC_PATTERNS: Record<HapticFeedbackType, number | number[]> = {
  start: 10,           // 轻微震动，开始拖拽
  move: 0,             // 拖拽经过时不震动，避免过于频繁
  end: [15, 50, 15],   // 双击震动确认放置成功
  success: [50, 100, 50], // 三次震动，成功完成
  error: [100, 50, 100, 50, 100], // 错误提示，连续震动
  warning: [30, 50, 30], // 警告提示，中等震动
};

/**
 * 触发触感反馈
 * @param type 反馈类型
 * @param customPattern 自定义震动模式（可选）
 */
export const triggerHapticFeedback = (
  type: HapticFeedbackType,
  customPattern?: number | number[]
): void => {
  if (!supportsHapticFeedback()) {
    return; // 设备不支持震动
  }

  const pattern = customPattern !== undefined ? customPattern : HAPTIC_PATTERNS[type];

  if (pattern === 0) {
    return; // 不震动
  }

  try {
    navigator.vibrate(pattern);
  } catch (error) {
    console.warn('触感反馈失败:', error);
  }
};

/**
 * 轻量级震动反馈
 * 用于 subtle 交互，如悬停、轻微触碰等
 */
export const subtleHapticFeedback = (): void => {
  triggerHapticFeedback('start');
};

/**
 * 成功震动反馈
 * 用于操作成功确认，如拖拽放置成功、保存完成等
 */
export const successHapticFeedback = (): void => {
  triggerHapticFeedback('success');
};

/**
 * 错误震动反馈
 * 用于操作失败，如保存失败、权限错误等
 */
export const errorHapticFeedback = (): void => {
  triggerHapticFeedback('error');
};

/**
 * 警告震动反馈
 * 用于需要注意的操作，如删除确认、重要提示等
 */
export const warningHapticFeedback = (): void => {
  triggerHapticFeedback('warning');
};

/**
 * 拖拽开始反馈
 */
export const dragStartFeedback = (): void => {
  triggerHapticFeedback('start');
};

/**
 * 拖拽结束反馈
 */
export const dragEndFeedback = (): void => {
  triggerHapticFeedback('end');
};

/**
 * 自定义震动模式
 * @param pattern 震动模式数组（毫秒）
 */
export const customHapticFeedback = (pattern: number[]): void => {
  triggerHapticFeedback('end', pattern);
};
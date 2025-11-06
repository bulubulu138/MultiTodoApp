import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

// 扩展 dayjs 以支持相对时间显示
dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

/**
 * 智能格式化完成时间
 * - 1周内：显示相对时间（"2分钟前"、"3小时前"、"昨天"）
 * - 1周后：显示完整时间（"2024-11-06 14:30"）
 * 
 * @param completedAt ISO 8601 格式的完成时间字符串
 * @returns 格式化后的时间字符串
 */
export const formatCompletedTime = (completedAt: string): string => {
  const now = dayjs();
  const completed = dayjs(completedAt);
  const diffDays = now.diff(completed, 'day');
  
  if (diffDays < 7) {
    // 1周内：相对时间（"2分钟前"）
    return completed.fromNow();
  } else {
    // 1周后：完整时间（"2024-11-06 14:30"）
    return completed.format('YYYY-MM-DD HH:mm');
  }
};


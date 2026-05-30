/**
 * 截止时间格式化工具
 * 根据截止时间的紧急程度返回不同的显示文本和颜色
 */

export interface DeadlineDisplay {
  text: string;
  color: string;
  isOverdue: boolean;
}

/**
 * 计算截止时间的相对显示
 * @param deadline 截止时间字符串
 * @returns 显示文本、颜色和是否逾期
 */
export function getDeadlineDisplay(deadline: string): DeadlineDisplay {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffMs < 0) {
    // 已逾期
    const overdueDays = Math.abs(Math.floor(diffDays));
    const overdueHours = Math.abs(Math.floor(diffHours));
    return {
      text: overdueDays > 0 ? `已逾期${overdueDays}天` : `已逾期${overdueHours}小时`,
      color: '#ff4d4f', // 红色
      isOverdue: true
    };
  } else if (diffHours <= 24) {
    // 24小时内到期
    const remainingHours = Math.floor(diffHours);
    return {
      text: remainingHours > 0 ? `还剩${remainingHours}小时` : '即将到期',
      color: '#fa8c16', // 橙色
      isOverdue: false
    };
  } else {
    // 正常状态
    const remainingDays = Math.ceil(diffDays);
    return {
      text: `还剩${remainingDays}天`,
      color: '#8c8c8c', // 灰色
      isOverdue: false
    };
  }
}

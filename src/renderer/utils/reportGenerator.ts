import { Todo } from '../../shared/types';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekday from 'dayjs/plugin/weekday';

dayjs.extend(isoWeek);
dayjs.extend(weekday);

// 日报统计数据
export interface DailyStats {
  date: string;
  dateFormatted: string;
  created: Todo[];
  completed: Todo[];
  overdue: Todo[];
  inProgress: Todo[];
  pending: Todo[];
  completionRate: number;
  totalCreated: number;
  totalCompleted: number;
  totalOverdue: number;
}

// 周报统计数据
export interface WeeklyStats {
  weekStart: string;
  weekEnd: string;
  weekFormatted: string;
  created: Todo[];
  completed: Todo[];
  completedByQuality: Todo[]; // 按质量排序的完成项
  inProgress: Todo[];
  pending: Todo[];
  overdue: Todo[];
  completionRate: number;
  dailyStats: {
    [key: string]: {
      date: string;
      dayName: string;
      created: number;
      completed: number;
    };
  };
  highPriorityCompleted: Todo[];
  avgDailyCompleted: number;
  qualityMetrics: {
    totalQualityScore: number;
    avgQualityScore: number;
    highQualityCount: number;
  };
}

// 月报统计数据
export interface MonthlyStats {
  month: string;
  monthFormatted: string;
  created: Todo[];
  completed: Todo[];
  inProgress: Todo[];
  pending: Todo[];
  completionRate: number;
  weeklyStats: {
    weekNum: number;
    completed: number;
    created: number;
  }[];
  highPriorityCompleted: Todo[];
  priorityDistribution: {
    high: number;
    medium: number;
    low: number;
  };
  avgDailyCompleted: number;
  longestStreak: number;
}

// 生成日报
export function generateDailyReport(todos: Todo[], date: Dayjs): DailyStats {
  const targetDate = date.startOf('day');
  const nextDate = targetDate.add(1, 'day');
  
  // 当天创建的待办（基于 createdAt）
  const created = todos.filter(todo => {
    if (!todo.createdAt) return false;
    const createDate = dayjs(todo.createdAt);
    return createDate.isSame(targetDate, 'day');
  });

  // 当天完成的待办（状态为已完成，且 completedAt 在当天）
  const completed = todos.filter(todo => {
    if (todo.status !== 'completed' || !todo.completedAt) return false;
    const completedDate = dayjs(todo.completedAt);
    return completedDate.isSame(targetDate, 'day');
  });

  // 当天逾期的待办
  const overdue = todos.filter(todo => {
    if (!todo.deadline || todo.status === 'completed') return false;
    const deadline = dayjs(todo.deadline);
    return deadline.isBefore(targetDate) || 
           (deadline.isSame(targetDate, 'day') && deadline.isBefore(dayjs()));
  });

  // 当天的进行中待办
  const inProgress = todos.filter(todo => {
    return todo.status === 'in_progress' && 
           dayjs(todo.createdAt).isBefore(nextDate);
  });

  // 当天的待办
  const pending = todos.filter(todo => {
    return todo.status === 'pending' && 
           dayjs(todo.createdAt).isBefore(nextDate);
  });

  const totalCompleted = completed.length;
  const totalCreated = created.length;
  const completionRate = totalCreated > 0 
    ? Math.round((totalCompleted / totalCreated) * 100) 
    : 0;

  return {
    date: targetDate.format('YYYY-MM-DD'),
    dateFormatted: targetDate.format('YYYY年MM月DD日'),
    created,
    completed,
    overdue,
    inProgress,
    pending,
    completionRate,
    totalCreated,
    totalCompleted,
    totalOverdue: overdue.length,
  };
}

// 计算任务完成质量评分
function calculateTaskQuality(todo: Todo): number {
  let score = 0;

  // 优先级权重：高优先级=3分，中=2分，低=1分
  const priorityScores = { high: 3, medium: 2, low: 1 };
  score += priorityScores[todo.priority as keyof typeof priorityScores] || 1;

  // 是否有内容（详细程度）：有内容+2分
  if (todo.content && todo.content.trim().length > 20) {
    score += 2;
  }

  // 是否按时完成：按时完成+3分，提前+5分
  if (todo.deadline && todo.completedAt) {
    const completedTime = dayjs(todo.completedAt);
    const deadline = dayjs(todo.deadline);
    const diffHours = deadline.diff(completedTime, 'hour');

    if (diffHours > 0) {
      score += 5; // 提前完成
    } else if (diffHours >= -24) {
      score += 3; // 按时完成（24小时内）
    }
  }

  // 是否有关键词：有关键词+1分
  if (todo.keywords && todo.keywords.length > 0) {
    score += 1;
  }

  // 是否有标签：有标签+1分
  if (todo.tags && todo.tags.trim().length > 0) {
    score += 1;
  }

  return score;
}

// 生成周报（工作周：周一到周五）
export function generateWeeklyReport(todos: Todo[], weekStart: Dayjs): WeeklyStats {
  // 确保从周一开始
  const monday = weekStart.startOf('isoWeek');
  const friday = monday.add(4, 'day').endOf('day');

  // 本周创建的待办
  const created = todos.filter(todo => {
    if (!todo.createdAt) return false;
    const createDate = dayjs(todo.createdAt);
    return createDate.isAfter(monday.subtract(1, 'second')) &&
           createDate.isBefore(friday.add(1, 'second'));
  });

  // 本周完成的待办
  const completed = todos.filter(todo => {
    if (todo.status !== 'completed' || !todo.completedAt) return false;
    const completedDate = dayjs(todo.completedAt);
    return completedDate.isAfter(monday.subtract(1, 'second')) &&
           completedDate.isBefore(friday.add(1, 'second'));
  });

  // 按完成时间正序排列（最早完成的在前）
  const completedChronologically = [...completed].sort((a, b) => {
    return dayjs(a.completedAt!).valueOf() - dayjs(b.completedAt!).valueOf();
  });

  // 计算质量评分并按质量排序
  const completedWithQuality = completed.map(todo => ({
    ...todo,
    qualityScore: calculateTaskQuality(todo)
  }));

  const completedByQuality = [...completedWithQuality]
    .sort((a, b) => b.qualityScore - a.qualityScore);

  // 计算质量指标
  const totalQualityScore = completedWithQuality.reduce((sum, todo) => sum + todo.qualityScore, 0);
  const avgQualityScore = completed.length > 0 ? Math.round(totalQualityScore / completed.length * 10) / 10 : 0;
  const highQualityCount = completedWithQuality.filter(todo => todo.qualityScore >= 8).length;

  // 当前进行中的待办
  const inProgress = todos.filter(todo => todo.status === 'in_progress');

  // 当前待办
  const pending = todos.filter(todo => todo.status === 'pending');

  // 本周逾期的待办
  const overdue = todos.filter(todo => {
    if (!todo.deadline || todo.status === 'completed') return false;
    const deadline = dayjs(todo.deadline);
    return deadline.isBefore(friday);
  });

  // 每日统计（周一到周五）
  const dailyStats: WeeklyStats['dailyStats'] = {};
  const dayNames = ['周一', '周二', '周三', '周四', '周五'];

  for (let i = 0; i < 5; i++) {
    const day = monday.add(i, 'day');
    const dayKey = day.format('YYYY-MM-DD');

    const dayCreated = todos.filter(todo => {
      return todo.createdAt && dayjs(todo.createdAt).isSame(day, 'day');
    });

    const dayCompleted = todos.filter(todo => {
      return todo.status === 'completed' &&
             todo.completedAt &&
             dayjs(todo.completedAt).isSame(day, 'day');
    });

    dailyStats[dayKey] = {
      date: dayKey,
      dayName: dayNames[i],
      created: dayCreated.length,
      completed: dayCompleted.length,
    };
  }

  // 高优先级完成项
  const highPriorityCompleted = completed.filter(todo => todo.priority === 'high');

  const completionRate = created.length > 0
    ? Math.round((completed.length / created.length) * 100)
    : 0;

  const avgDailyCompleted = Math.round(completed.length / 5 * 10) / 10;

  return {
    weekStart: monday.format('YYYY-MM-DD'),
    weekEnd: friday.format('YYYY-MM-DD'),
    weekFormatted: `${monday.format('MM月DD日')} - ${friday.format('MM月DD日')}`,
    created,
    completed: completedChronologically, // 使用按时间排序的结果
    completedByQuality,
    inProgress,
    pending,
    overdue,
    completionRate,
    dailyStats,
    highPriorityCompleted,
    avgDailyCompleted,
    qualityMetrics: {
      totalQualityScore,
      avgQualityScore,
      highQualityCount
    }
  };
}

// 生成月报
export function generateMonthlyReport(todos: Todo[], month: Dayjs): MonthlyStats {
  const monthStart = month.startOf('month');
  const monthEnd = month.endOf('month');
  
  // 本月创建的待办
  const created = todos.filter(todo => {
    if (!todo.createdAt) return false;
    const createDate = dayjs(todo.createdAt);
    return createDate.isAfter(monthStart.subtract(1, 'second')) && 
           createDate.isBefore(monthEnd.add(1, 'second'));
  });

  // 本月完成的待办
  const completed = todos.filter(todo => {
    if (todo.status !== 'completed' || !todo.completedAt) return false;
    const completedDate = dayjs(todo.completedAt);
    return completedDate.isAfter(monthStart.subtract(1, 'second')) && 
           completedDate.isBefore(monthEnd.add(1, 'second'));
  });

  // 当前进行中和待办
  const inProgress = todos.filter(todo => todo.status === 'in_progress');
  const pending = todos.filter(todo => todo.status === 'pending');

  // 每周统计
  const weeklyStats: MonthlyStats['weeklyStats'] = [];
  let currentWeek = monthStart.startOf('isoWeek');
  let weekNum = 1;
  
  while (currentWeek.isBefore(monthEnd)) {
    const weekEnd = currentWeek.add(6, 'day').endOf('day');
    
    const weekCompleted = completed.filter(todo => {
      const completedDate = dayjs(todo.completedAt!);
      return completedDate.isAfter(currentWeek.subtract(1, 'second')) && 
             completedDate.isBefore(weekEnd.add(1, 'second'));
    });
    
    const weekCreated = created.filter(todo => {
      const createDate = dayjs(todo.createdAt!);
      return createDate.isAfter(currentWeek.subtract(1, 'second')) && 
             createDate.isBefore(weekEnd.add(1, 'second'));
    });
    
    weeklyStats.push({
      weekNum,
      completed: weekCompleted.length,
      created: weekCreated.length,
    });
    
    currentWeek = currentWeek.add(1, 'week');
    weekNum++;
  }

  // 高优先级完成项
  const highPriorityCompleted = completed.filter(todo => todo.priority === 'high');

  // 优先级分布
  const priorityDistribution = {
    high: completed.filter(todo => todo.priority === 'high').length,
    medium: completed.filter(todo => todo.priority === 'medium').length,
    low: completed.filter(todo => todo.priority === 'low').length,
  };

  const completionRate = created.length > 0 
    ? Math.round((completed.length / created.length) * 100) 
    : 0;

  const daysInMonth = monthEnd.date();
  const avgDailyCompleted = Math.round(completed.length / daysInMonth * 10) / 10;

  // 计算最长连续完成天数
  const longestStreak = calculateLongestStreak(todos, monthStart, monthEnd);

  return {
    month: monthStart.format('YYYY-MM'),
    monthFormatted: monthStart.format('YYYY年MM月'),
    created,
    completed,
    inProgress,
    pending,
    completionRate,
    weeklyStats,
    highPriorityCompleted,
    priorityDistribution,
    avgDailyCompleted,
    longestStreak,
  };
}

// 计算最长连续完成天数
function calculateLongestStreak(todos: Todo[], start: Dayjs, end: Dayjs): number {
  let maxStreak = 0;
  let currentStreak = 0;
  let currentDay = start;
  
  while (currentDay.isBefore(end) || currentDay.isSame(end, 'day')) {
    const hasCompleted = todos.some(todo => {
      return todo.status === 'completed' && 
             todo.completedAt && 
             dayjs(todo.completedAt).isSame(currentDay, 'day');
    });
    
    if (hasCompleted) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
    
    currentDay = currentDay.add(1, 'day');
  }
  
  return maxStreak;
}

// 格式化日报为 Markdown
export function formatDailyReportAsMarkdown(stats: DailyStats): string {
  const lines: string[] = [];
  
  lines.push(`### ${stats.dateFormatted} 工作日报\n`);
  
  // 今日概览
  lines.push(`**今日概览**`);
  lines.push(`- 创建待办：${stats.totalCreated}个`);
  lines.push(`- 完成待办：${stats.totalCompleted}个`);
  lines.push(`- 完成率：${stats.completionRate}%`);
  lines.push(`- 逾期待办：${stats.totalOverdue}个\n`);
  
  // 今日创建的待办
  if (stats.created.length > 0) {
    lines.push(`**今日创建的待办**`);
    stats.created.forEach((todo, index) => {
      const priority = getPriorityText(todo.priority);
      const status = getStatusEmoji(todo.status);
      lines.push(`${index + 1}. [${priority}] ${todo.title} ${status}`);
    });
    lines.push('');
  }
  
  // 今日完成的待办
  if (stats.completed.length > 0) {
    lines.push(`**今日完成的待办**`);
    stats.completed.forEach((todo, index) => {
      const priority = getPriorityText(todo.priority);
      lines.push(`${index + 1}. [${priority}] ${todo.title} ✅`);
    });
    lines.push('');
  }
  
  // 逾期提醒
  if (stats.overdue.length > 0) {
    lines.push(`**逾期提醒** ⚠️`);
    stats.overdue.forEach((todo, index) => {
      const priority = getPriorityText(todo.priority);
      const daysOverdue = dayjs().diff(dayjs(todo.deadline), 'day');
      lines.push(`${index + 1}. [${priority}] ${todo.title} - 逾期 ${daysOverdue} 天`);
    });
    lines.push('');
  }
  
  // 进行中的待办
  if (stats.inProgress.length > 0) {
    lines.push(`**进行中的待办**`);
    stats.inProgress.forEach((todo, index) => {
      const priority = getPriorityText(todo.priority);
      lines.push(`${index + 1}. [${priority}] ${todo.title}`);
    });
    lines.push('');
  }
  
  return lines.join('\n');
}

// 格式化周报为 Markdown（增强版）
export function formatWeeklyReportAsMarkdown(stats: WeeklyStats): string {
  const lines: string[] = [];

  lines.push(`### 工作周报（${stats.weekFormatted}）\n`);

  // 本周概览
  lines.push(`**本周概览**`);
  lines.push(`- 创建待办：${stats.created.length}个`);
  lines.push(`- 完成待办：${stats.completed.length}个`);
  lines.push(`- 完成率：${stats.completionRate}%`);
  lines.push(`- 进行中：${stats.inProgress.length}个`);
  lines.push(`- 平均每日完成：${stats.avgDailyCompleted}个`);
  lines.push(`- 平均质量评分：${stats.qualityMetrics.avgQualityScore}分`);
  lines.push(`- 高质量任务：${stats.qualityMetrics.highQualityCount}个\n`);

  // 每日统计
  lines.push(`**每日统计**`);
  Object.values(stats.dailyStats).forEach(day => {
    lines.push(`📅 ${day.dayName}：创建 ${day.created}个 | 完成 ${day.completed}个`);
  });
  lines.push('');

  // 本周已完成任务（按完成时间正序排列）
  if (stats.completed.length > 0) {
    lines.push(`**本周已完成任务** ✅（按完成时间顺序）`);
    lines.push('');

    stats.completed.forEach((todo, index) => {
      const priority = getPriorityText(todo.priority);
      const completedTime = dayjs(todo.completedAt).format('MM-DD HH:mm');
      const duration = calculateTaskDuration(todo);

      lines.push(`${index + 1}. **${todo.title}**`);
      lines.push(`   - 优先级：${priority}`);
      lines.push(`   - 完成时间：${completedTime}`);

      if (duration) {
        lines.push(`   - 耗时：${duration}`);
      }

      if (todo.deadline) {
        const deadlineStatus = getDeadlineStatus(todo);
        lines.push(`   - 截止时间：${dayjs(todo.deadline).format('MM-DD HH:mm')} ${deadlineStatus}`);
      }

      if (todo.content && todo.content.trim().length > 0) {
        lines.push(`   - 内容：${todo.content.substring(0, 100)}${todo.content.length > 100 ? '...' : ''}`);
      }

      if (todo.tags && todo.tags.trim().length > 0) {
        lines.push(`   - 标签：${todo.tags}`);
      }

      lines.push('');
    });
  }

  // 高质量任务展示
  if (stats.completedByQuality.length > 0) {
    lines.push(`**🌟 本周高质量任务**（按质量评分排序）`);
    stats.completedByQuality.slice(0, 5).forEach((todo, index) => {
      const qualityScore = (todo as any).qualityScore || 0;
      lines.push(`${index + 1}. ${todo.title}（评分：${qualityScore}分）`);
    });
    lines.push('');
  }

  // 待处理事项
  const pendingHighPriority = [...stats.inProgress, ...stats.pending]
    .filter(todo => todo.priority === 'high' || todo.priority === 'medium')
    .slice(0, 5);

  if (pendingHighPriority.length > 0) {
    lines.push(`**待处理事项**`);
    pendingHighPriority.forEach((todo, index) => {
      const priority = getPriorityText(todo.priority);
      const status = getStatusText(todo.status);
      lines.push(`${index + 1}. [${priority}] ${todo.title} - ${status}`);
    });
    lines.push('');
  }

  // 下周计划
  const highPriorityPending = stats.pending.filter(todo => todo.priority === 'high');
  lines.push(`**下周计划**`);
  lines.push(`- 重点关注 ${highPriorityPending.length} 个高优先级待办`);
  lines.push(`- 需要跟进 ${stats.inProgress.length} 个进行中任务`);
  lines.push(`- 目标质量评分：8分以上`);

  return lines.join('\n');
}

// 计算任务耗时
function calculateTaskDuration(todo: Todo): string | null {
  if (!todo.createdAt || !todo.completedAt) return null;

  const start = dayjs(todo.createdAt);
  const end = dayjs(todo.completedAt);
  const durationMs = end.diff(start);

  const hours = Math.floor(durationMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}小时${minutes > 0 ? minutes + '分钟' : ''}`;
  } else if (minutes > 0) {
    return `${minutes}分钟`;
  } else {
    return '不到1分钟';
  }
}

// 获取截止时间状态
function getDeadlineStatus(todo: Todo): string {
  if (!todo.deadline || !todo.completedAt) return '';

  const deadline = dayjs(todo.deadline);
  const completedAt = dayjs(todo.completedAt);
  const diffHours = deadline.diff(completedAt, 'hour');

  if (diffHours > 0) {
    return `🎉 提前${diffHours}小时`;
  } else if (diffHours >= -24) {
    return '✅ 按时完成';
  } else {
    return `⚠️ 延期${Math.abs(diffHours)}小时`;
  }
}

// 格式化月报为 Markdown
export function formatMonthlyReportAsMarkdown(stats: MonthlyStats): string {
  const lines: string[] = [];
  
  lines.push(`### ${stats.monthFormatted} 工作月报\n`);
  
  // 本月概览
  lines.push(`**本月概览**`);
  lines.push(`- 创建待办：${stats.created.length}个`);
  lines.push(`- 完成待办：${stats.completed.length}个`);
  lines.push(`- 完成率：${stats.completionRate}%`);
  lines.push(`- 平均每日完成：${stats.avgDailyCompleted}个\n`);
  
  // 每周统计
  if (stats.weeklyStats.length > 0) {
    lines.push(`**每周统计**`);
    stats.weeklyStats.forEach(week => {
      lines.push(`第${week.weekNum}周：创建 ${week.created}个 | 完成 ${week.completed}个`);
    });
    lines.push('');
  }
  
  // 月度亮点
  lines.push(`**月度亮点** ✨`);
  lines.push(`1. 完成 ${stats.highPriorityCompleted.length} 个高优先级任务`);
  lines.push(`2. 平均每日完成 ${stats.avgDailyCompleted} 个待办`);
  lines.push(`3. ${stats.longestStreak} 天连续完成任务\n`);
  
  // 优先级分布
  const total = stats.priorityDistribution.high + 
                stats.priorityDistribution.medium + 
                stats.priorityDistribution.low;
  
  if (total > 0) {
    lines.push(`**优先级分布**`);
    lines.push(`- 高优先级：${stats.priorityDistribution.high}个（${Math.round(stats.priorityDistribution.high / total * 100)}%）`);
    lines.push(`- 中优先级：${stats.priorityDistribution.medium}个（${Math.round(stats.priorityDistribution.medium / total * 100)}%）`);
    lines.push(`- 低优先级：${stats.priorityDistribution.low}个（${Math.round(stats.priorityDistribution.low / total * 100)}%）\n`);
  }
  
  // 下月目标建议
  lines.push(`**下月目标建议**`);
  lines.push(`- 关注 ${stats.inProgress.length} 个进行中任务`);
  lines.push(`- 计划处理 ${stats.pending.length} 个待办任务`);
  
  return lines.join('\n');
}

// 辅助函数
function getPriorityText(priority: string): string {
  switch (priority) {
    case 'high': return '高';
    case 'medium': return '中';
    case 'low': return '低';
    default: return priority;
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'pending': return '待办';
    case 'in_progress': return '进行中';
    case 'completed': return '已完成';
    case 'paused': return '暂停';
    default: return status;
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'pending': return '📋';
    case 'in_progress': return '🔄';
    case 'completed': return '✅';
    case 'paused': return '⏸';
    default: return '';
  }
}


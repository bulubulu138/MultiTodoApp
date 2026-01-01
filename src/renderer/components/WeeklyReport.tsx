import React from 'react';
import { Card, Row, Col, Statistic, List, Tag, Empty, Typography, Space, Table, Collapse, Timeline, Badge } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, FileAddOutlined, RiseOutlined, TrophyOutlined, FireOutlined } from '@ant-design/icons';
import { WeeklyStats } from '../utils/reportGenerator';
import { Todo } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';
import dayjs from 'dayjs';

const { Text, Title } = Typography;
const { Panel } = Collapse;

interface WeeklyReportProps {
  stats: WeeklyStats;
}

const WeeklyReport: React.FC<WeeklyReportProps> = ({ stats }) => {
  const colors = useThemeColors();

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'high': return 'red';
      case 'medium': return 'orange';
      case 'low': return 'green';
      default: return 'default';
    }
  };

  const getPriorityText = (priority: string): string => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return priority;
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'completed': return '已完成';
      case 'in_progress': return '进行中';
      case 'pending': return '待办';
      case 'paused': return '暂停';
      default: return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'green';
      case 'in_progress': return 'blue';
      case 'pending': return 'orange';
      case 'paused': return 'default';
      default: return 'default';
    }
  };

  // 计算任务耗时
  const calculateTaskDuration = (todo: Todo): string => {
    if (!todo.createdAt || !todo.completedAt) return '未知';

    const start = dayjs(todo.createdAt);
    const end = dayjs(todo.completedAt);
    const durationMs = end.diff(start);

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h${minutes > 0 ? minutes + 'm' : ''}`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return '<1m';
    }
  };

  // 获取截止时间状态
  const getDeadlineStatus = (todo: Todo): { text: string; color: string } => {
    if (!todo.deadline || !todo.completedAt) return { text: '', color: '' };

    const deadline = dayjs(todo.deadline);
    const completedAt = dayjs(todo.completedAt);
    const diffHours = deadline.diff(completedAt, 'hour');

    if (diffHours > 0) {
      return { text: `🎉 提前${diffHours}h`, color: 'green' };
    } else if (diffHours >= -24) {
      return { text: '✅ 按时', color: 'blue' };
    } else {
      return { text: `⚠️ 延期${Math.abs(diffHours)}h`, color: 'red' };
    }
  };

  // 每日统计表格列
  const dailyColumns = [
    {
      title: '日期',
      dataIndex: 'dayName',
      key: 'dayName',
      width: 80,
    },
    {
      title: '创建',
      dataIndex: 'created',
      key: 'created',
      width: 80,
      render: (value: number) => (
        <Tag color="blue">{value}个</Tag>
      ),
    },
    {
      title: '完成',
      dataIndex: 'completed',
      key: 'completed',
      width: 80,
      render: (value: number) => (
        <Tag color="green">{value}个</Tag>
      ),
    },
  ];

  // 渲染完成的任务详细信息
  const renderCompletedTodoItem = (todo: Todo, index: number) => {
    const deadlineStatus = getDeadlineStatus(todo);
    const duration = calculateTaskDuration(todo);

    return (
      <Timeline.Item
        key={todo.id}
        color="green"
        dot={<CheckCircleOutlined />}
      >
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space>
              <Text strong style={{ fontSize: '14px' }}>{todo.title}</Text>
              <Tag color={getPriorityColor(todo.priority)}>
                {getPriorityText(todo.priority)}
              </Tag>
            </Space>

            <Space size="small">
              <Text type="secondary" style={{ fontSize: '12px' }}>
                完成时间: {dayjs(todo.completedAt).format('MM-DD HH:mm')}
              </Text>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                耗时: <Text code>{duration}</Text>
              </Text>
              {deadlineStatus.text && (
                <Tag color={deadlineStatus.color}>
                  {deadlineStatus.text}
                </Tag>
              )}
            </Space>

            {todo.content && todo.content.trim().length > 0 && (
              <Text
                type="secondary"
                style={{ fontSize: '12px', display: 'block', marginTop: 4 }}
                ellipsis={{ tooltip: todo.content }}
              >
                {todo.content}
              </Text>
            )}

            {todo.tags && todo.tags.trim().length > 0 && (
              <div style={{ marginTop: 4 }}>
                {todo.tags.split(',').map((tag, idx) => (
                  <Tag key={idx} style={{ fontSize: '11px' }}>
                    🏷️ {tag.trim()}
                  </Tag>
                ))}
              </div>
            )}
          </Space>
        </div>
      </Timeline.Item>
    );
  };

  const dailyDataSource = Object.values(stats.dailyStats).map((day, index) => ({
    key: day.date,
    ...day,
  }));

  const renderTodoItem = (todo: Todo) => (
    <List.Item>
      <Space>
        <Tag color={getPriorityColor(todo.priority)}>
          {getPriorityText(todo.priority)}
        </Tag>
        <Text strong>{todo.title}</Text>
      </Space>
    </List.Item>
  );

  const renderPendingItem = (todo: Todo) => (
    <List.Item>
      <Space>
        <Tag color={getPriorityColor(todo.priority)}>
          {getPriorityText(todo.priority)}
        </Tag>
        <Text strong>{todo.title}</Text>
        <Tag color={getStatusColor(todo.status)}>
          {getStatusText(todo.status)}
        </Tag>
      </Space>
    </List.Item>
  );

  const highPriorityPending = [...stats.inProgress, ...stats.pending]
    .filter(todo => todo.priority === 'high' || todo.priority === 'medium')
    .slice(0, 5);

  return (
    <div style={{ padding: '0 8px' }}>
      {/* 概览统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="创建待办"
              value={stats.created.length}
              prefix={<FileAddOutlined />}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="完成待办"
              value={stats.completed.length}
              prefix={<CheckCircleOutlined />}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="完成率"
              value={stats.completionRate}
              suffix="%"
              valueStyle={{ color: stats.completionRate >= 60 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="日均完成"
              value={stats.avgDailyCompleted}
              prefix={<RiseOutlined />}
              suffix="个"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="质量评分"
              value={stats.qualityMetrics.avgQualityScore}
              prefix={<TrophyOutlined />}
              suffix="分"
              valueStyle={{ color: '#fa541c' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="高质量任务"
              value={stats.qualityMetrics.highQualityCount}
              prefix={<FireOutlined />}
              suffix="个"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 每日统计 */}
      <Title level={5} style={{ color: colors.textPrimary }}>
        📅 每日统计（周一至周五）
      </Title>
      <Card 
        variant="borderless" 
        style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
        styles={{ body: { padding: '12px' } }}
      >
        <Table
          size="small"
          columns={dailyColumns}
          dataSource={dailyDataSource}
          pagination={false}
          bordered
        />
      </Card>

      {/* 本周已完成任务（按时间排序） */}
      {stats.completed.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            ✅ 本周已完成任务（按完成时间顺序）
          </Title>
          <Card
            variant="borderless"
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            styles={{ body: { padding: '16px' } }}
          >
            <Collapse
              ghost
              items={[
                {
                  key: 'completed-tasks',
                  label: (
                    <Space>
                      <Text>查看所有 {stats.completed.length} 个已完成任务</Text>
                      <Badge count={stats.completed.length} showZero />
                    </Space>
                  ),
                  children: (
                    <Timeline style={{ marginTop: 16 }}>
                      {stats.completed.map(renderCompletedTodoItem)}
                    </Timeline>
                  ),
                }
              ]}
              defaultActiveKey={[]}
            />
          </Card>
        </>
      )}

      {/* 高质量任务展示 */}
      {stats.completedByQuality.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            🌟 本周高质量任务（按质量评分排序）
          </Title>
          <Card
            variant="borderless"
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            styles={{ body: { padding: '12px' } }}
          >
            <List
              size="small"
              dataSource={stats.completedByQuality.slice(0, 5)}
              renderItem={(todo, index) => {
                const qualityScore = (todo as any).qualityScore || 0;
                return (
                  <List.Item>
                    <Space>
                      <Badge count={index + 1} style={{ backgroundColor: '#52c41a' }} />
                      <Text strong>{todo.title}</Text>
                      <Tag color="gold">评分: {qualityScore}分</Tag>
                      <Tag color={getPriorityColor(todo.priority)}>
                        {getPriorityText(todo.priority)}
                      </Tag>
                    </Space>
                  </List.Item>
                );
              }}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
            />
          </Card>
        </>
      )}

      {/* 重要完成项（保留原有功能） */}
      {stats.highPriorityCompleted.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            ⭐ 重要完成项（高优先级）
          </Title>
          <Card
            variant="borderless"
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            styles={{ body: { padding: '12px' } }}
          >
            <List
              size="small"
              dataSource={stats.highPriorityCompleted.slice(0, 5)}
              renderItem={renderTodoItem}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
            />
          </Card>
        </>
      )}

      {/* 待处理事项 */}
      {highPriorityPending.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            📋 待处理事项
          </Title>
          <Card 
            variant="borderless" 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            styles={{ body: { padding: '12px' } }}
          >
            <List
              size="small"
              dataSource={highPriorityPending}
              renderItem={renderPendingItem}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
            />
          </Card>
        </>
      )}

      {/* 下周计划 */}
      <Title level={5} style={{ color: colors.textPrimary }}>
        📅 下周计划
      </Title>
      <Card 
        variant="borderless" 
        style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
        styles={{ body: { padding: '16px' } }}
      >
        <Space direction="vertical" size={12}>
          <Text>
            • 重点关注 <Text strong style={{ color: '#ff4d4f' }}>
              {stats.pending.filter(t => t.priority === 'high').length}
            </Text> 个高优先级待办
          </Text>
          <Text>
            • 需要跟进 <Text strong style={{ color: '#1890ff' }}>
              {stats.inProgress.length}
            </Text> 个进行中任务
          </Text>
          <Text>
            • 本周完成率 <Text strong style={{ 
              color: stats.completionRate >= 60 ? '#52c41a' : '#faad14' 
            }}>
              {stats.completionRate}%
            </Text>，继续保持！
          </Text>
        </Space>
      </Card>

      {/* 空状态 */}
      {stats.created.length === 0 && stats.completed.length === 0 && (
        <Empty
          description="本周暂无数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 60 }}
        />
      )}
    </div>
  );
};

export default WeeklyReport;


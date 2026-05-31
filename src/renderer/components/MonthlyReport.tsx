import React from 'react';
import { Card, Row, Col, Statistic, List, Tag, Empty, Typography, Space, Progress, Table } from 'antd';
import { CheckCircleOutlined, TrophyOutlined, FileAddOutlined, RiseOutlined, FireOutlined } from '@ant-design/icons';
import { MonthlyStats } from '../utils/reportGenerator';
import { Todo } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';

const { Text, Title } = Typography;

interface MonthlyReportProps {
  stats: MonthlyStats;
}

const MonthlyReport: React.FC<MonthlyReportProps> = ({ stats }) => {
  const colors = useThemeColors();

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'mental': return 'blue';
      case 'communication': return 'orange';
      case 'trivial': return 'default';
      default: return 'default';
    }
  };

  const getPriorityText = (priority: string): string => {
    switch (priority) {
      case 'mental': return '脑力劳动';
      case 'communication': return '沟通对齐';
      case 'trivial': return '临时小活';
      default: return priority;
    }
  };

  // 每周统计表格列
  const weeklyColumns = [
    {
      title: '周次',
      dataIndex: 'weekNum',
      key: 'weekNum',
      width: 80,
      render: (value: number) => `第${value}周`,
    },
    {
      title: '创建',
      dataIndex: 'created',
      key: 'created',
      width: 100,
      render: (value: number) => (
        <Tag color="blue">{value}个</Tag>
      ),
    },
    {
      title: '完成',
      dataIndex: 'completed',
      key: 'completed',
      width: 100,
      render: (value: number) => (
        <Tag color="green">{value}个</Tag>
      ),
    },
  ];

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

  const totalPriority = stats.priorityDistribution.mental +
                        stats.priorityDistribution.communication +
                        stats.priorityDistribution.trivial;

  const highPercent = totalPriority > 0
    ? Math.round(stats.priorityDistribution.mental / totalPriority * 100)
    : 0;
  const mediumPercent = totalPriority > 0
    ? Math.round(stats.priorityDistribution.communication / totalPriority * 100)
    : 0;
  const lowPercent = totalPriority > 0
    ? Math.round(stats.priorityDistribution.trivial / totalPriority * 100)
    : 0;

  return (
    <div style={{ padding: '0 8px' }}>
      {/* 概览统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="创建待办"
              value={stats.created.length}
              prefix={<FileAddOutlined />}
              suffix="个"
              valueStyle={{ color: colors.infoColor }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="完成待办"
              value={stats.completed.length}
              prefix={<CheckCircleOutlined />}
              suffix="个"
              valueStyle={{ color: colors.successColor }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="完成率"
              value={stats.completionRate}
              suffix="%"
              valueStyle={{ color: stats.completionRate >= 60 ? colors.successColor : colors.warningColor }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless" style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="日均完成"
              value={stats.avgDailyCompleted}
              prefix={<RiseOutlined />}
              suffix="个"
              valueStyle={{ color: colors.linkColor }}
            />
          </Card>
        </Col>
      </Row>

      {/* 每周统计 */}
      {stats.weeklyStats.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            📊 每周统计
          </Title>
          <Card 
            variant="borderless" 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            styles={{ body: { padding: '12px' } }}
          >
            <Table
              size="small"
              columns={weeklyColumns}
              dataSource={stats.weeklyStats.map((week, index) => ({
                key: index,
                ...week,
              }))}
              pagination={false}
              bordered
            />
          </Card>
        </>
      )}

      {/* 月度亮点 */}
      <Title level={5} style={{ color: colors.textPrimary }}>
        ✨ 月度亮点
      </Title>
      <Card 
        variant="borderless" 
        style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
        styles={{ body: { padding: '16px' } }}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={8}>
              <Space>
                <TrophyOutlined style={{ fontSize: 24, color: '#faad14' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>高优先级任务</Text>
                  <div>
                    <Text strong style={{ fontSize: 20, color: colors.warningColor }}>
                      {stats.highPriorityCompleted.length}
                    </Text>
                    <Text type="secondary"> 个</Text>
                  </div>
                </div>
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <RiseOutlined style={{ fontSize: 24, color: colors.linkColor }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>平均每日完成</Text>
                  <div>
                    <Text strong style={{ fontSize: 20, color: colors.linkColor }}>
                      {stats.avgDailyCompleted}
                    </Text>
                    <Text type="secondary"> 个</Text>
                  </div>
                </div>
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <FireOutlined style={{ fontSize: 24, color: colors.dangerColor }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>连续完成天数</Text>
                  <div>
                    <Text strong style={{ fontSize: 20, color: colors.dangerColor }}>
                      {stats.longestStreak}
                    </Text>
                    <Text type="secondary"> 天</Text>
                  </div>
                </div>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* 优先级分布 */}
      {totalPriority > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            📈 优先级分布
          </Title>
          <Card 
            variant="borderless" 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            styles={{ body: { padding: '16px' } }}
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                  <Text>脑力劳动</Text>
                  <Text strong>{stats.priorityDistribution.mental}个 ({highPercent}%)</Text>
                </Space>
                <Progress
                  percent={highPercent}
                  strokeColor={colors.infoColor}
                  showInfo={false}
                />
              </div>
              <div>
                <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                  <Text>沟通对齐</Text>
                  <Text strong>{stats.priorityDistribution.communication}个 ({mediumPercent}%)</Text>
                </Space>
                <Progress
                  percent={mediumPercent}
                  strokeColor={colors.warningColor}
                  showInfo={false}
                />
              </div>
              <div>
                <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                  <Text>临时小活</Text>
                  <Text strong>{stats.priorityDistribution.trivial}个 ({lowPercent}%)</Text>
                </Space>
                <Progress
                  percent={lowPercent}
                  strokeColor={colors.textMuted}
                  showInfo={false}
                />
              </div>
            </Space>
          </Card>
        </>
      )}

      {/* 重要完成项 */}
      {stats.highPriorityCompleted.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            ⭐ 重要完成项（前5个高优先级）
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

      {/* 下月目标建议 */}
      <Title level={5} style={{ color: colors.textPrimary }}>
        🎯 下月目标建议
      </Title>
      <Card 
        variant="borderless" 
        style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
        styles={{ body: { padding: '16px' } }}
      >
        <Space direction="vertical" size={12}>
          <Text>
            • 关注 <Text strong style={{ color: colors.infoColor }}>
              {stats.inProgress.length}
            </Text> 个今日事任务
          </Text>
          <Text>
            • 计划处理 <Text strong style={{ color: colors.warningColor }}>
              {stats.pending.length}
            </Text> 个待办任务
          </Text>
          <Text>
            • 本月完成率 <Text strong style={{ 
              color: stats.completionRate >= 60 ? colors.successColor : colors.warningColor 
            }}>
              {stats.completionRate}%
            </Text>，{stats.completionRate >= 60 ? '表现优秀！' : '仍有提升空间'}
          </Text>
        </Space>
      </Card>

      {/* 空状态 */}
      {stats.created.length === 0 && stats.completed.length === 0 && (
        <Empty
          description="本月暂无数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 60 }}
        />
      )}
    </div>
  );
};

export default MonthlyReport;


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

  const totalPriority = stats.priorityDistribution.high + 
                        stats.priorityDistribution.medium + 
                        stats.priorityDistribution.low;

  const highPercent = totalPriority > 0 
    ? Math.round(stats.priorityDistribution.high / totalPriority * 100) 
    : 0;
  const mediumPercent = totalPriority > 0 
    ? Math.round(stats.priorityDistribution.medium / totalPriority * 100) 
    : 0;
  const lowPercent = totalPriority > 0 
    ? Math.round(stats.priorityDistribution.low / totalPriority * 100) 
    : 0;

  return (
    <div style={{ padding: '0 8px' }}>
      {/* 概览统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false} style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="创建待办"
              value={stats.created.length}
              prefix={<FileAddOutlined />}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="完成待办"
              value={stats.completed.length}
              prefix={<CheckCircleOutlined />}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="完成率"
              value={stats.completionRate}
              suffix="%"
              valueStyle={{ color: stats.completionRate >= 60 ? '#52c41a' : '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false} style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="日均完成"
              value={stats.avgDailyCompleted}
              prefix={<RiseOutlined />}
              suffix="个"
              valueStyle={{ color: '#722ed1' }}
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
            bordered={false} 
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
        bordered={false} 
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
                    <Text strong style={{ fontSize: 20, color: '#faad14' }}>
                      {stats.highPriorityCompleted.length}
                    </Text>
                    <Text type="secondary"> 个</Text>
                  </div>
                </div>
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <RiseOutlined style={{ fontSize: 24, color: '#722ed1' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>平均每日完成</Text>
                  <div>
                    <Text strong style={{ fontSize: 20, color: '#722ed1' }}>
                      {stats.avgDailyCompleted}
                    </Text>
                    <Text type="secondary"> 个</Text>
                  </div>
                </div>
              </Space>
            </Col>
            <Col span={8}>
              <Space>
                <FireOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>连续完成天数</Text>
                  <div>
                    <Text strong style={{ fontSize: 20, color: '#ff4d4f' }}>
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
            bordered={false} 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            styles={{ body: { padding: '16px' } }}
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                  <Text>高优先级</Text>
                  <Text strong>{stats.priorityDistribution.high}个 ({highPercent}%)</Text>
                </Space>
                <Progress 
                  percent={highPercent} 
                  strokeColor="#ff4d4f" 
                  showInfo={false}
                />
              </div>
              <div>
                <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                  <Text>中优先级</Text>
                  <Text strong>{stats.priorityDistribution.medium}个 ({mediumPercent}%)</Text>
                </Space>
                <Progress 
                  percent={mediumPercent} 
                  strokeColor="#faad14" 
                  showInfo={false}
                />
              </div>
              <div>
                <Space style={{ marginBottom: 8, width: '100%', justifyContent: 'space-between' }}>
                  <Text>低优先级</Text>
                  <Text strong>{stats.priorityDistribution.low}个 ({lowPercent}%)</Text>
                </Space>
                <Progress 
                  percent={lowPercent} 
                  strokeColor="#52c41a" 
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
            bordered={false} 
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
        bordered={false} 
        style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
        styles={{ body: { padding: '16px' } }}
      >
        <Space direction="vertical" size={12}>
          <Text>
            • 关注 <Text strong style={{ color: '#1890ff' }}>
              {stats.inProgress.length}
            </Text> 个进行中任务
          </Text>
          <Text>
            • 计划处理 <Text strong style={{ color: '#faad14' }}>
              {stats.pending.length}
            </Text> 个待办任务
          </Text>
          <Text>
            • 本月完成率 <Text strong style={{ 
              color: stats.completionRate >= 60 ? '#52c41a' : '#faad14' 
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


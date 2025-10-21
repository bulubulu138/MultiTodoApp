import React from 'react';
import { Card, Row, Col, Statistic, List, Tag, Empty, Typography, Space, Table } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, FileAddOutlined, RiseOutlined } from '@ant-design/icons';
import { WeeklyStats } from '../utils/reportGenerator';
import { Todo } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';

const { Text, Title } = Typography;

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

      {/* 每日统计 */}
      <Title level={5} style={{ color: colors.textPrimary }}>
        📅 每日统计（周一至周五）
      </Title>
      <Card 
        bordered={false} 
        style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
        bodyStyle={{ padding: '12px' }}
      >
        <Table
          size="small"
          columns={dailyColumns}
          dataSource={dailyDataSource}
          pagination={false}
          bordered
        />
      </Card>

      {/* 重要完成项 */}
      {stats.highPriorityCompleted.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            ⭐ 重要完成项（高优先级）
          </Title>
          <Card 
            bordered={false} 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            bodyStyle={{ padding: '12px' }}
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
            bordered={false} 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            bodyStyle={{ padding: '12px' }}
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
        bordered={false} 
        style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
        bodyStyle={{ padding: '16px' }}
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


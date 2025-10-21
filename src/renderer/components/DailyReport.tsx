import React from 'react';
import { Card, Row, Col, Statistic, List, Tag, Empty, Typography, Space, Divider } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, WarningOutlined, FileAddOutlined } from '@ant-design/icons';
import { DailyStats } from '../utils/reportGenerator';
import { Todo } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface DailyReportProps {
  stats: DailyStats;
}

const DailyReport: React.FC<DailyReportProps> = ({ stats }) => {
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

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'green';
      case 'in_progress': return 'blue';
      case 'pending': return 'orange';
      case 'paused': return 'default';
      default: return 'default';
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

  const renderTodoItem = (todo: Todo) => (
    <List.Item>
      <Space direction="vertical" style={{ width: '100%' }} size={4}>
        <Space>
          <Tag color={getPriorityColor(todo.priority)}>
            {getPriorityText(todo.priority)}
          </Tag>
          <Tag color={getStatusColor(todo.status)}>
            {getStatusText(todo.status)}
          </Tag>
          <Text strong>{todo.title}</Text>
        </Space>
        {todo.content && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {todo.content.length > 50 ? todo.content.substring(0, 50) + '...' : todo.content}
          </Text>
        )}
      </Space>
    </List.Item>
  );

  const renderOverdueItem = (todo: Todo) => {
    const daysOverdue = dayjs().diff(dayjs(todo.deadline), 'day');
    return (
      <List.Item>
        <Space direction="vertical" style={{ width: '100%' }} size={4}>
          <Space>
            <Tag color={getPriorityColor(todo.priority)}>
              {getPriorityText(todo.priority)}
            </Tag>
            <Text strong>{todo.title}</Text>
            <Tag color="red">逾期 {daysOverdue} 天</Tag>
          </Space>
          {todo.deadline && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              截止时间：{dayjs(todo.deadline).format('YYYY-MM-DD HH:mm')}
            </Text>
          )}
        </Space>
      </List.Item>
    );
  };

  return (
    <div style={{ padding: '0 8px' }}>
      {/* 概览统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card bordered={false} style={{ backgroundColor: colors.cardBg }}>
            <Statistic
              title="创建待办"
              value={stats.totalCreated}
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
              value={stats.totalCompleted}
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
              title="逾期待办"
              value={stats.totalOverdue}
              prefix={<WarningOutlined />}
              suffix="个"
              valueStyle={{ color: stats.totalOverdue > 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 今日创建的待办 */}
      {stats.created.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            📝 今日创建的待办 ({stats.created.length})
          </Title>
          <Card 
            bordered={false} 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            bodyStyle={{ padding: '12px' }}
          >
            <List
              size="small"
              dataSource={stats.created}
              renderItem={renderTodoItem}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
            />
          </Card>
        </>
      )}

      {/* 今日完成的待办 */}
      {stats.completed.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            ✅ 今日完成的待办 ({stats.completed.length})
          </Title>
          <Card 
            bordered={false} 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            bodyStyle={{ padding: '12px' }}
          >
            <List
              size="small"
              dataSource={stats.completed}
              renderItem={renderTodoItem}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
            />
          </Card>
        </>
      )}

      {/* 逾期提醒 */}
      {stats.overdue.length > 0 && (
        <>
          <Title level={5} style={{ color: '#ff4d4f' }}>
            ⚠️ 逾期提醒 ({stats.overdue.length})
          </Title>
          <Card 
            bordered={false} 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg, borderLeft: '3px solid #ff4d4f' }}
            bodyStyle={{ padding: '12px' }}
          >
            <List
              size="small"
              dataSource={stats.overdue}
              renderItem={renderOverdueItem}
              locale={{ emptyText: <Empty description="暂无逾期" /> }}
            />
          </Card>
        </>
      )}

      {/* 进行中的待办 */}
      {stats.inProgress.length > 0 && (
        <>
          <Title level={5} style={{ color: colors.textPrimary }}>
            🔄 进行中的待办 ({stats.inProgress.length})
          </Title>
          <Card 
            bordered={false} 
            style={{ marginBottom: 16, backgroundColor: colors.cardBg }}
            bodyStyle={{ padding: '12px' }}
          >
            <List
              size="small"
              dataSource={stats.inProgress}
              renderItem={renderTodoItem}
              locale={{ emptyText: <Empty description="暂无数据" /> }}
            />
          </Card>
        </>
      )}

      {/* 空状态 */}
      {stats.created.length === 0 && 
       stats.completed.length === 0 && 
       stats.overdue.length === 0 &&
       stats.inProgress.length === 0 && (
        <Empty
          description="今日暂无数据"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 60 }}
        />
      )}
    </div>
  );
};

export default DailyReport;


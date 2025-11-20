import React, { useState, useMemo } from 'react';
import { Modal, Segmented, DatePicker, Space, Button, App, Typography } from 'antd';
import { CopyOutlined, LeftOutlined, RightOutlined, FileTextOutlined, BarChartOutlined, PieChartOutlined } from '@ant-design/icons';
import { Todo } from '../../shared/types';
import dayjs, { Dayjs } from 'dayjs';
import DailyReport from './DailyReport';
import WeeklyReport from './WeeklyReport';
import MonthlyReport from './MonthlyReport';
import {
  generateDailyReport,
  generateWeeklyReport,
  generateMonthlyReport,
  formatDailyReportAsMarkdown,
  formatWeeklyReportAsMarkdown,
  formatMonthlyReportAsMarkdown,
} from '../utils/reportGenerator';

const { Title } = Typography;

export type ReportType = 'daily' | 'weekly' | 'monthly';

interface ReportModalProps {
  visible: boolean;
  todos: Todo[];
  initialType?: ReportType;
  initialDate?: Dayjs;
  onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  todos,
  initialType = 'daily',
  initialDate,
  onClose,
}) => {
  const { message } = App.useApp();
  const [reportType, setReportType] = useState<ReportType>(initialType);
  const [selectedDate, setSelectedDate] = useState<Dayjs>(initialDate || dayjs());

  // 生成报告数据
  const reportData = useMemo(() => {
    switch (reportType) {
      case 'daily':
        return generateDailyReport(todos, selectedDate);
      case 'weekly':
        return generateWeeklyReport(todos, selectedDate);
      case 'monthly':
        return generateMonthlyReport(todos, selectedDate);
      default:
        return generateDailyReport(todos, selectedDate);
    }
  }, [reportType, selectedDate, todos]);

  // 生成 Markdown 文本
  const markdownText = useMemo(() => {
    switch (reportType) {
      case 'daily':
        return formatDailyReportAsMarkdown(reportData as any);
      case 'weekly':
        return formatWeeklyReportAsMarkdown(reportData as any);
      case 'monthly':
        return formatMonthlyReportAsMarkdown(reportData as any);
      default:
        return '';
    }
  }, [reportType, reportData]);

  // 一键复制功能
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownText);
      message.success('报告已复制到剪贴板！');
    } catch (error) {
      message.error('复制失败，请重试');
      console.error('Copy error:', error);
    }
  };

  // 日期导航
  const handlePrevious = () => {
    switch (reportType) {
      case 'daily':
        setSelectedDate(selectedDate.subtract(1, 'day'));
        break;
      case 'weekly':
        setSelectedDate(selectedDate.subtract(1, 'week'));
        break;
      case 'monthly':
        setSelectedDate(selectedDate.subtract(1, 'month'));
        break;
    }
  };

  const handleNext = () => {
    switch (reportType) {
      case 'daily':
        setSelectedDate(selectedDate.add(1, 'day'));
        break;
      case 'weekly':
        setSelectedDate(selectedDate.add(1, 'week'));
        break;
      case 'monthly':
        setSelectedDate(selectedDate.add(1, 'month'));
        break;
    }
  };

  const handleToday = () => {
    setSelectedDate(dayjs());
  };

  // 获取日期选择器类型
  const getPickerType = () => {
    switch (reportType) {
      case 'daily':
        return 'date';
      case 'weekly':
        return 'week';
      case 'monthly':
        return 'month';
      default:
        return 'date';
    }
  };

  // 获取标题
  const getTitle = () => {
    switch (reportType) {
      case 'daily':
        return '工作日报';
      case 'weekly':
        return '工作周报';
      case 'monthly':
        return '工作月报';
      default:
        return '工作报告';
    }
  };

  // 获取日期格式
  const getDateFormat = () => {
    switch (reportType) {
      case 'daily':
        return 'YYYY-MM-DD';
      case 'weekly':
        return 'YYYY-第WW周';
      case 'monthly':
        return 'YYYY-MM';
      default:
        return 'YYYY-MM-DD';
    }
  };

  return (
    <Modal
      title={
        <Space>
          {reportType === 'daily' && <FileTextOutlined />}
          {reportType === 'weekly' && <BarChartOutlined />}
          {reportType === 'monthly' && <PieChartOutlined />}
          <span>{getTitle()}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={[
        <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={handleCopy}>
          复制报告
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
      ]}
      style={{ top: 20 }}
      styles={{ body: { maxHeight: 'calc(100vh - 200px)', overflowY: 'auto', padding: '16px' } }}
    >
      {/* 控制栏 */}
      <Space direction="vertical" size={16} style={{ width: '100%', marginBottom: 16 }}>
        {/* 报告类型切换 */}
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Segmented
            value={reportType}
            onChange={(value) => setReportType(value as ReportType)}
            options={[
              {
                label: (
                  <Space>
                    <FileTextOutlined />
                    日报
                  </Space>
                ),
                value: 'daily',
              },
              {
                label: (
                  <Space>
                    <BarChartOutlined />
                    周报
                  </Space>
                ),
                value: 'weekly',
              },
              {
                label: (
                  <Space>
                    <PieChartOutlined />
                    月报
                  </Space>
                ),
                value: 'monthly',
              },
            ]}
          />
        </Space>

        {/* 日期选择和导航 */}
        <Space style={{ width: '100%', justifyContent: 'center' }}>
          <Button 
            icon={<LeftOutlined />} 
            onClick={handlePrevious}
            size="small"
          />
          <DatePicker
            value={selectedDate}
            onChange={(date) => date && setSelectedDate(date)}
            picker={getPickerType() as any}
            format={getDateFormat()}
            allowClear={false}
            style={{ width: 200 }}
          />
          <Button 
            icon={<RightOutlined />} 
            onClick={handleNext}
            size="small"
            disabled={selectedDate.isAfter(dayjs(), reportType === 'daily' ? 'day' : reportType === 'weekly' ? 'week' : 'month')}
          />
          <Button 
            onClick={handleToday}
            size="small"
            type="link"
          >
            今天
          </Button>
        </Space>
      </Space>

      {/* 报告内容 */}
      <div style={{ marginTop: 16 }}>
        {reportType === 'daily' && <DailyReport stats={reportData as any} />}
        {reportType === 'weekly' && <WeeklyReport stats={reportData as any} />}
        {reportType === 'monthly' && <MonthlyReport stats={reportData as any} />}
      </div>
    </Modal>
  );
};

export default ReportModal;


import { Todo } from '../../shared/types';
import React, { useState } from 'react';
import { Modal, Radio, Button, Space, App, Typography, Divider } from 'antd';
import { DownloadOutlined, CopyOutlined } from '@ant-design/icons';
import { processImagesInHtml } from '../utils/processImagesInHtml';

const { Text, Paragraph } = Typography;

interface ExportModalProps {
  visible: boolean;
  todos: Todo[];
  onClose: () => void;
}

const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  todos,
  onClose
}) => {
  const { message } = App.useApp();
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'markdown'>('json');
  const [exportData, setExportData] = useState<string>('');

  const generateExportData = (format: 'json' | 'csv' | 'markdown') => {
    switch (format) {
      case 'json':
        return JSON.stringify(todos, null, 2);
      
      case 'csv':
        const headers = ['ID', '标题', '内容', '状态', '优先级', '标签', '创建时间', '更新时间', '完成时间'];
        const csvRows = [headers.join(',')];
        
        todos.forEach(todo => {
          // 处理content中的图片，移除base64数据并添加图片数量标记
          const processedContent = processImagesInHtml(todo.content || '');

          const row = [
            todo.id?.toString() || '',
            `"${todo.title.replace(/"/g, '""')}"`,
            `"${processedContent.replace(/"/g, '""')}"`,
            todo.status,
            todo.priority,
            `"${todo.tags.replace(/"/g, '""')}"`,
            todo.createdAt,
            todo.updatedAt,
            ''
          ];
          csvRows.push(row.join(','));
        });
        
        return csvRows.join('\n');
      
      case 'markdown':
        let markdown = '# 待办事项导出\n\n';
        
        todos.forEach(todo => {
          markdown += `## ${todo.title}\n\n`;
          markdown += `**状态**: ${getStatusText(todo.status)}\n`;
          markdown += `**优先级**: ${getPriorityText(todo.priority)}\n`;
          
          if (todo.tags) {
            markdown += `**标签**: ${todo.tags}\n`;
          }
          
          if (todo.content) {
            // 处理content中的图片，移除base64数据并添加图片数量标记
            const processedContent = processImagesInHtml(todo.content);
            markdown += `**描述**:\n${processedContent}\n`;
          }
          
          markdown += `**创建时间**: ${new Date(todo.createdAt).toLocaleString()}\n`;
          markdown += `**更新时间**: ${new Date(todo.updatedAt).toLocaleString()}\n`;
          
          if (todo.updatedAt) {
            markdown += `**完成时间**: ${new Date(todo.updatedAt).toLocaleString()}\n`;
          }
          
          markdown += '\n---\n\n';
        });
        
        return markdown;
      
      default:
        return '';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待办';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      case 'paused': return '暂停';
      default: return status;
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return priority;
    }
  };

  const handleFormatChange = (format: 'json' | 'csv' | 'markdown') => {
    setExportFormat(format);
    const data = generateExportData(format);
    setExportData(data);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportData);
      message.success('数据已复制到剪贴板');
    } catch (error) {
      message.error('复制失败');
      console.error('Copy error:', error);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([exportData], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `todos_export_${timestamp}.${exportFormat}`;
    
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    message.success('文件下载成功');
  };

  React.useEffect(() => {
    if (visible) {
      handleFormatChange(exportFormat);
    }
  }, [visible, todos]);

  return (
    <Modal
      title="导出待办事项"
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Text strong>选择导出格式：</Text>
        <Radio.Group
          value={exportFormat}
          onChange={(e) => handleFormatChange(e.target.value)}
          style={{ marginLeft: 16 }}
        >
          <Radio value="json">JSON</Radio>
          <Radio value="csv">CSV</Radio>
          <Radio value="markdown">Markdown</Radio>
        </Radio.Group>
      </div>

      <Divider />

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={handleCopyToClipboard}
          >
            复制到剪贴板
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            下载文件
          </Button>
        </Space>
      </div>

      <div>
        <Text strong>预览数据：</Text>
        <div
          style={{
            marginTop: 8,
            padding: 12,
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            backgroundColor: '#fafafa',
            maxHeight: 300,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: '12px',
            whiteSpace: 'pre-wrap'
          }}
        >
          {exportData}
        </div>
      </div>

      <Divider />

      <div style={{ background: '#f6f8fa', padding: 12, borderRadius: 6 }}>
        <Text strong>导出说明：</Text>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: 20 }}>
          <li><strong>JSON</strong>: 完整的数据结构，适合程序处理和数据备份</li>
          <li><strong>CSV</strong>: 表格格式，可用Excel等软件打开</li>
          <li><strong>Markdown</strong>: 文档格式，便于阅读和分享</li>
        </ul>
      </div>
    </Modal>
  );
};

export default ExportModal;

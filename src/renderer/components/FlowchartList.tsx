import React, { useState, useEffect, useCallback } from 'react';
import { List, Card, Button, Space, Empty, Popconfirm, Input, Modal, Tag, Tooltip } from 'antd';
import {
  FileTextOutlined,
  EditOutlined,
  DeleteOutlined,
  ExportOutlined,
  PlusOutlined,
  SearchOutlined,
  FolderOpenOutlined
} from '@ant-design/icons';
import type { MessageInstance } from 'antd/es/message/interface';
import { FlowchartSchema } from '../../shared/types';
import dayjs from 'dayjs';

interface FlowchartListProps {
  message: MessageInstance;
  onOpenFlowchart: (flowchartId: string) => void;
  onCreateNew: () => void;
}

/**
 * FlowchartList - 流程图列表组件
 * 
 * 显示所有流程图，提供搜索、打开、重命名、删除等操作
 */
export const FlowchartList: React.FC<FlowchartListProps> = ({
  message,
  onOpenFlowchart,
  onCreateNew
}) => {
  const [flowcharts, setFlowcharts] = useState<FlowchartSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renamingFlowchart, setRenamingFlowchart] = useState<FlowchartSchema | null>(null);
  const [newName, setNewName] = useState('');

  // 加载流程图列表
  const loadFlowcharts = useCallback(async () => {
    try {
      setLoading(true);
      // 从 localStorage 加载（临时方案）
      const keys = Object.keys(localStorage).filter(key => key.startsWith('flowchart_'));
      const flowchartList: FlowchartSchema[] = [];

      keys.forEach(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.schema) {
            flowchartList.push(data.schema);
          }
        } catch (error) {
          console.error(`Failed to parse flowchart ${key}:`, error);
        }
      });

      // 按更新时间排序
      flowchartList.sort((a, b) => {
        const timeA = new Date(a.updatedAt).getTime();
        const timeB = new Date(b.updatedAt).getTime();
        return timeB - timeA;
      });

      setFlowcharts(flowchartList);
    } catch (error) {
      message.error('加载流程图列表失败');
      console.error('Error loading flowcharts:', error);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    loadFlowcharts();
  }, [loadFlowcharts]);

  // 搜索过滤
  const filteredFlowcharts = flowcharts.filter(flowchart =>
    flowchart.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // 打开重命名对话框
  const handleRenameClick = (flowchart: FlowchartSchema) => {
    setRenamingFlowchart(flowchart);
    setNewName(flowchart.name);
    setRenameModalVisible(true);
  };

  // 确认重命名
  const handleRenameConfirm = async () => {
    if (!renamingFlowchart || !newName.trim()) {
      message.error('请输入流程图名称');
      return;
    }

    try {
      // 更新 localStorage
      const key = `flowchart_${renamingFlowchart.id}`;
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      data.schema.name = newName.trim();
      data.schema.updatedAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(data));

      message.success('重命名成功');
      setRenameModalVisible(false);
      setRenamingFlowchart(null);
      setNewName('');
      loadFlowcharts();
    } catch (error) {
      message.error('重命名失败');
      console.error('Error renaming flowchart:', error);
    }
  };

  // 删除流程图
  const handleDelete = async (flowchart: FlowchartSchema) => {
    try {
      const key = `flowchart_${flowchart.id}`;
      localStorage.removeItem(key);
      message.success('删除成功');
      loadFlowcharts();
    } catch (error) {
      message.error('删除失败');
      console.error('Error deleting flowchart:', error);
    }
  };

  // 导出流程图
  const handleExport = (flowchart: FlowchartSchema) => {
    try {
      const key = `flowchart_${flowchart.id}`;
      const data = localStorage.getItem(key);
      if (!data) {
        message.error('流程图数据不存在');
        return;
      }

      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${flowchart.name}.json`;
      a.click();
      URL.revokeObjectURL(url);

      message.success('导出成功');
    } catch (error) {
      message.error('导出失败');
      console.error('Error exporting flowchart:', error);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 顶部操作栏 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Input
            placeholder="搜索流程图..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Tag color="blue">{filteredFlowcharts.length} 个流程图</Tag>
        </Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onCreateNew}
        >
          新建流程图
        </Button>
      </div>

      {/* 流程图列表 */}
      {filteredFlowcharts.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={searchText ? '没有找到匹配的流程图' : '还没有创建流程图'}
        >
          {!searchText && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreateNew}>
              创建第一个流程图
            </Button>
          )}
        </Empty>
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 2, lg: 3, xl: 4, xxl: 4 }}
          dataSource={filteredFlowcharts}
          loading={loading}
          renderItem={(flowchart) => (
            <List.Item>
              <Card
                hoverable
                actions={[
                  <Tooltip title="打开">
                    <FolderOpenOutlined
                      key="open"
                      onClick={() => onOpenFlowchart(flowchart.id)}
                    />
                  </Tooltip>,
                  <Tooltip title="重命名">
                    <EditOutlined
                      key="rename"
                      onClick={() => handleRenameClick(flowchart)}
                    />
                  </Tooltip>,
                  <Tooltip title="导出">
                    <ExportOutlined
                      key="export"
                      onClick={() => handleExport(flowchart)}
                    />
                  </Tooltip>,
                  <Popconfirm
                    title="确定要删除这个流程图吗？"
                    onConfirm={() => handleDelete(flowchart)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Tooltip title="删除">
                      <DeleteOutlined key="delete" style={{ color: '#ff4d4f' }} />
                    </Tooltip>
                  </Popconfirm>
                ]}
              >
                <Card.Meta
                  avatar={<FileTextOutlined style={{ fontSize: 32, color: '#1890ff' }} />}
                  title={
                    <div
                      style={{ cursor: 'pointer' }}
                      onClick={() => onOpenFlowchart(flowchart.id)}
                    >
                      {flowchart.name}
                    </div>
                  }
                  description={
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        创建于 {dayjs(flowchart.createdAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                      <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                        更新于 {dayjs(flowchart.updatedAt).format('YYYY-MM-DD HH:mm')}
                      </div>
                    </Space>
                  }
                />
              </Card>
            </List.Item>
          )}
        />
      )}

      {/* 重命名对话框 */}
      <Modal
        title="重命名流程图"
        open={renameModalVisible}
        onOk={handleRenameConfirm}
        onCancel={() => {
          setRenameModalVisible(false);
          setRenamingFlowchart(null);
          setNewName('');
        }}
        okText="确定"
        cancelText="取消"
      >
        <Input
          placeholder="请输入新名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onPressEnter={handleRenameConfirm}
          autoFocus
          maxLength={50}
        />
      </Modal>
    </div>
  );
};


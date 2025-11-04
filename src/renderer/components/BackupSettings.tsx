import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, message, Typography, Tag } from 'antd';
import { ReloadOutlined, SaveOutlined, RollbackOutlined } from '@ant-design/icons';
import { BackupInfo } from '../../shared/types';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

const BackupSettings: React.FC = () => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 加载备份列表
  const loadBackups = async () => {
    setLoading(true);
    try {
      const list = await window.electronAPI.backup.list();
      setBackups(list);
    } catch (error) {
      message.error('加载备份列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadBackups();
  }, []);
  
  // 手动创建备份
  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await window.electronAPI.backup.create();
      message.success('备份创建成功');
      await loadBackups();
    } catch (error) {
      message.error('备份创建失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 恢复备份
  const handleRestore = (backup: BackupInfo) => {
    Modal.confirm({
      title: '确认恢复备份？',
      content: `将使用 ${dayjs(backup.createdAt).format('YYYY-MM-DD HH:mm:ss')} 的备份覆盖当前数据，此操作不可撤销！`,
      okText: '确认恢复',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await window.electronAPI.backup.restore(backup.filepath);
          message.success('备份恢复成功，请重启应用');
          // 建议用户重启应用
          Modal.info({
            title: '恢复成功',
            content: '备份已恢复，建议重启应用以加载新数据',
          });
        } catch (error) {
          message.error('备份恢复失败');
        }
      }
    });
  };
  
  const columns = [
    {
      title: '备份时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a: BackupInfo, b: BackupInfo) => b.timestamp - a.timestamp,
    },
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => `${(size / 1024).toFixed(2)} KB`,
    },
    {
      title: '文件路径',
      dataIndex: 'filepath',
      key: 'filepath',
      render: (path: string) => (
        <Paragraph 
          copyable={{ text: path }} 
          style={{ margin: 0, fontSize: 12 }}
          ellipsis={{ rows: 1, expandable: true }}
        >
          {path}
        </Paragraph>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: BackupInfo) => (
        <Button
          size="small"
          type="link"
          icon={<RollbackOutlined />}
          onClick={() => handleRestore(record)}
        >
          恢复
        </Button>
      ),
    },
  ];
  
  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>自动备份设置</Text>
          <Paragraph type="secondary" style={{ marginTop: 8 }}>
            系统每24小时自动备份一次数据库，最多保留最近7天的备份。
          </Paragraph>
          <Space>
            <Tag color="blue">备份频率: 24小时</Tag>
            <Tag color="green">保留时长: 7天</Tag>
            <Tag color="orange">当前备份数: {backups.length}</Tag>
          </Space>
        </div>
        
        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleCreateBackup}
            loading={loading}
          >
            立即备份
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadBackups}
            loading={loading}
          >
            刷新列表
          </Button>
        </Space>
        
        <Table
          columns={columns}
          dataSource={backups}
          rowKey="filepath"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      </Space>
    </div>
  );
};

export default BackupSettings;


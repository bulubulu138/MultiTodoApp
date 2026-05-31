import React, { useState, useEffect } from 'react';
import { Table, Button, Space, message, Typography, Tag, Card, Statistic, Row, Col, Modal } from 'antd';
import { ReloadOutlined, SaveOutlined, ClockCircleOutlined, CheckCircleOutlined, RollbackOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { BackupInfo } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

const BackupSettings: React.FC = () => {
  const colors = useThemeColors();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{
    lastBackupTime: string;
    nextBackupTime: string;
    backupEnabled: boolean;
  }>({ lastBackupTime: '', nextBackupTime: '', backupEnabled: false });

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

  // 加载备份状态
  const loadBackupStatus = async () => {
    try {
      const status = await window.electronAPI.backup.getCurrentBackupStatus();
      setBackupStatus(status);
    } catch (error) {
      console.error('加载备份状态失败:', error);
    }
  };

  useEffect(() => {
    loadBackups();
    loadBackupStatus();

    // 每5分钟刷新一次备份状态
    const interval = setInterval(() => {
      loadBackupStatus();
      loadBackups();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // 手动创建备份
  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await window.electronAPI.backup.create();
      message.success('备份创建成功');
      await loadBackups();
      await loadBackupStatus();
    } catch (error) {
      message.error('备份创建失败');
    } finally {
      setLoading(false);
    }
  };

  // 恢复备份
  const handleRestoreBackup = async (backupPath: string) => {
    Modal.confirm({
      title: '确认恢复备份',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <Paragraph>
            恢复备份将会：
          </Paragraph>
          <ul>
            <li>删除当前所有待办数据</li>
            <li>从备份文件中恢复数据</li>
            <li>恢复完成后自动重启应用</li>
          </ul>
          <Paragraph type="danger" strong>
            ⚠️ 当前数据将被覆盖，此操作不可撤销！
          </Paragraph>
        </div>
      ),
      okText: '确认恢复',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await window.electronAPI.backup.restore(backupPath);
          if (result.success) {
            message.success('备份恢复成功，应用即将重启...');
          } else {
            message.error(`备份恢复失败: ${result.error}`);
          }
        } catch (error) {
          message.error('备份恢复失败');
          console.error('Restore backup error:', error);
        }
      },
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
          type="link"
          icon={<RollbackOutlined />}
          onClick={() => handleRestoreBackup(record.filepath)}
          size="small"
        >
          恢复
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 备份状态卡片 */}
        <Card>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title="上次备份时间"
                value={backupStatus.lastBackupTime ? dayjs(backupStatus.lastBackupTime).format('YYYY-MM-DD HH:mm:ss') : '从未备份'}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="下次备份时间"
                value={backupStatus.nextBackupTime ? dayjs(backupStatus.nextBackupTime).format('YYYY-MM-DD HH:mm:ss') : '未知'}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ fontSize: '14px' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="自动备份"
                value={backupStatus.backupEnabled ? '已启用' : '未启用'}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ fontSize: '14px', color: backupStatus.backupEnabled ? colors.successColor : colors.dangerColor }}
              />
            </Col>
          </Row>
        </Card>

        {/* 备份设置说明 */}
        <Card title="自动备份设置" size="small">
          <Paragraph type="secondary">
            系统每1小时自动备份一次数据，备份保存为 ZIP 压缩包（包含 Markdown 文件和图片），保留最近3个备份版本。
            备份文件存储在应用数据目录的 <code>backups</code> 文件夹中。
          </Paragraph>
          <Space>
            <Tag color="blue">备份频率: 1小时</Tag>
            <Tag color="green">备份格式: ZIP (Markdown + 图片)</Tag>
            <Tag color="orange">保留策略: 最近3个版本</Tag>
          </Space>
        </Card>

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


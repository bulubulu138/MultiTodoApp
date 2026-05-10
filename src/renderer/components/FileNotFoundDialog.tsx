import React, { useState } from 'react';
import { Modal, Button, Space, Typography, Alert, Spin, Progress, Card, Descriptions, Radio, Tag } from 'antd';
import {
  ReloadOutlined,
  FolderOpenOutlined,
  RestOutlined,
  SettingOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

type RecoveryOption = 'relocate' | 'change' | 'restore' | 'backup-manager';

interface StorageLocation {
  type: string;
  customPath?: string;
  lastUpdated: string;
}

interface RecoveryOptions {
  relocate: boolean;
  change: boolean;
  restore: boolean;
  backupManager: boolean;
  backupCount?: number;
  lastBackupPath?: string;
}

interface RecoveryProgress {
  stage: string;
  percent: number;
  message: string;
}

interface FileNotFoundDialogProps {
  visible: boolean;
  currentConfig: StorageLocation;
  recoveryOptions: RecoveryOptions;
  onRecovery: (option: RecoveryOption, customData?: any) => Promise<void>;
  onCancel: () => void;
}

const RECOVERY_OPTIONS = [
  {
    value: 'relocate' as RecoveryOption,
    title: '重新定位数据库',
    description: '如果您已将数据库文件移动到其他位置，可以选择该选项重新连接',
    icon: <ReloadOutlined style={{ fontSize: '24px', color: '#1890ff' }} />,
    available: (options: RecoveryOptions) => options.relocate
  },
  {
    value: 'change' as RecoveryOption,
    title: '更改存储位置',
    description: '选择新的存储位置并创建新的数据库文件',
    icon: <FolderOpenOutlined style={{ fontSize: '24px', color: '#52c41a' }} />,
    available: (options: RecoveryOptions) => options.change
  },
  {
    value: 'restore' as RecoveryOption,
    title: '从备份恢复',
    description: '从最近的自动备份中恢复数据库',
    icon: <RestOutlined style={{ fontSize: '24px', color: '#722ed1' }} />,
    available: (options: RecoveryOptions) => options.restore
  },
  {
    value: 'backup-manager' as RecoveryOption,
    title: '备份管理器',
    description: '打开完整的备份管理界面，选择特定备份进行恢复',
    icon: <SettingOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />,
    available: (options: RecoveryOptions) => options.backupManager
  }
];

const FileNotFoundDialog: React.FC<FileNotFoundDialogProps> = ({
  visible,
  currentConfig,
  recoveryOptions,
  onRecovery,
  onCancel
}) => {
  const [selectedOption, setSelectedOption] = useState<RecoveryOption>('relocate');
  const [customPath, setCustomPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<RecoveryProgress | null>(null);

  const availableOptions = RECOVERY_OPTIONS.filter(option =>
    option.available(recoveryOptions)
  );

  const handleSelectCustomPath = async () => {
    try {
      const result = await window.electronAPI.storageLocation.selectFolder();
      if (result) {
        setCustomPath(result);
      }
    } catch (error) {
      console.error('Error selecting custom path:', error);
    }
  };

  const handleRecovery = async () => {
    setLoading(true);
    setProgress({ stage: '准备中', percent: 0, message: '正在初始化恢复过程...' });

    try {
      let customData: any = {};

      if (selectedOption === 'relocate') {
        if (!customPath) {
          setProgress(null);
          setLoading(false);
          return;
        }
        customData.path = customPath;
      } else if (selectedOption === 'change') {
        if (!customPath) {
          setProgress(null);
          setLoading(false);
          return;
        }
        customData.path = customPath;
      }

      setProgress({ stage: '处理中', percent: 50, message: '正在执行恢复操作...' });

      await onRecovery(selectedOption, customData);

      setProgress({ stage: '完成', percent: 100, message: '恢复操作成功完成' });
    } catch (error) {
      console.error('Error during recovery:', error);
      setProgress({ stage: '失败', percent: 0, message: '恢复操作失败，请重试' });
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(null), 2000);
    }
  };

  const handleCancel = () => {
    if (!loading) {
      onCancel();
    }
  };

  const isRecoveryDisabled = loading ||
    (selectedOption === 'relocate' && !customPath) ||
    (selectedOption === 'change' && !customPath) ||
    (selectedOption === 'restore' && !recoveryOptions.restore);

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={handleCancel}
      width={800}
      footer={null}
      closable={!loading}
      maskClosable={!loading}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 错误提示 */}
        <Alert
          message="数据库文件未找到"
          description="应用程序无法在配置的位置找到数据库文件。请选择以下恢复选项之一。"
          type="error"
          icon={<WarningOutlined />}
          showIcon
        />

        {/* 当前配置信息 */}
        <Card size="small" title="当前配置">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="存储类型">
              <Tag color="blue">{currentConfig.type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="自定义路径">
              {currentConfig.customPath || '无'}
            </Descriptions.Item>
            <Descriptions.Item label="最后更新">
              {new Date(currentConfig.lastUpdated).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 备份信息 */}
        {recoveryOptions.restore && recoveryOptions.backupCount && recoveryOptions.backupCount > 0 && (
          <Card size="small" style={{ backgroundColor: '#f6ffed' }}>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text strong>发现 {recoveryOptions.backupCount} 个可用备份</Text>
              </Space>
              {recoveryOptions.lastBackupPath && (
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  最新备份: {recoveryOptions.lastBackupPath}
                </Text>
              )}
            </Space>
          </Card>
        )}

        {/* 恢复选项 */}
        <Card title="选择恢复选项">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Radio.Group
              value={selectedOption}
              onChange={(e) => {
                setSelectedOption(e.target.value);
                setCustomPath('');
              }}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {availableOptions.map((option) => (
                  <div
                    key={option.value}
                    style={{
                      border: `1px solid ${selectedOption === option.value ? '#1890ff' : '#d9d9d9'}`,
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: selectedOption === option.value ? '#e6f7ff' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                    onClick={() => setSelectedOption(option.value)}
                  >
                    <Space size="large">
                      <Radio value={option.value} style={{ marginRight: 0 }}>
                        {option.icon}
                      </Radio>
                      <Space direction="vertical" size={0}>
                        <Text strong>{option.title}</Text>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {option.description}
                        </Text>
                      </Space>
                    </Space>
                  </div>
                ))}
              </Space>
            </Radio.Group>

            {/* 自定义路径选择 */}
            {(selectedOption === 'relocate' || selectedOption === 'change') && (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={handleSelectCustomPath}
                  disabled={loading}
                  block
                >
                  选择数据库/文件夹位置
                </Button>
                {customPath && (
                  <Alert
                    message={`已选择: ${customPath}`}
                    type="info"
                    icon={<InfoCircleOutlined />}
                    showIcon
                    style={{ fontSize: '12px' }}
                  />
                )}
              </Space>
            )}
          </Space>
        </Card>

        {/* 进度显示 */}
        {progress && (
          <Card size="small">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space>
                {loading ? <Spin size="small" /> : <CheckCircleOutlined />}
                <Text strong>{progress.stage}</Text>
              </Space>
              <Progress percent={progress.percent} status={loading ? 'active' : 'success'} />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {progress.message}
              </Text>
            </Space>
          </Card>
        )}

        {/* 操作按钮 */}
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={handleCancel} disabled={loading}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleRecovery}
              disabled={isRecoveryDisabled}
              loading={loading}
            >
              开始恢复
            </Button>
          </Space>
        </div>

        {/* 帮助信息 */}
        <Alert
          message="需要帮助？"
          description={
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li>如果您不确定数据库文件的位置，建议使用"从备份恢复"选项</li>
              <li>如果您有数据库的备份文件，可以使用"备份管理器"进行恢复</li>
              <li>如果您想重新开始，可以选择"更改存储位置"创建新的数据库</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </Space>
    </Modal>
  );
};

export default FileNotFoundDialog;
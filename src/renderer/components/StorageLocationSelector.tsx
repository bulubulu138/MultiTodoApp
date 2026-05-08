import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Alert, Space, Typography, Progress, Card, Steps, Result } from 'antd';
import { FolderOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

interface StorageLocationSelectorProps {
  visible: boolean;
  onClose: () => void;
  onMigrationStart: (location: string) => Promise<void>;
}

interface MigrationProgress {
  stage: 'preparing' | 'migrating_todos' | 'migrating_relations' | 'migrating_assets' | 'finalizing' | 'verifying' | 'completed' | 'error';
  current: number;
  total: number;
  message: string;
  errors: string[];
  progress: number;
}

const StorageLocationSelector: React.FC<StorageLocationSelectorProps> = ({
  visible,
  onClose,
  onMigrationStart
}) => {
  const [form] = Form.useForm();
  const [location, setLocation] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const stages = [
    { key: 'preparing', label: '准备环境', description: '创建备份和初始化' },
    { key: 'migrating_todos', label: '迁移待办', description: '转换待办数据为 Markdown' },
    { key: 'migrating_relations', label: '迁移关系', description: '转换待办关系' },
    { key: 'finalizing', label: '完成迁移', description: '验证和清理' }
  ];

  const handleSelectLocation = async () => {
    try {
      const result = await window.electronAPI.file.openDirectory();
      if (result) {
        setLocation(result);
        form.setFieldsValue({ location: result });
      }
    } catch (error) {
      console.error('选择目录失败:', error);
    }
  };

  const handleStartMigration = async () => {
    try {
      setError(null);
      setIsMigrating(true);
      setCurrentStep(1);

      // 模拟进度更新（实际应该通过 IPC 从主进程接收）
      const simulateProgress = async () => {
        const stages: MigrationProgress['stage'][] = [
          'preparing',
          'migrating_todos',
          'migrating_relations',
          'migrating_assets',
          'finalizing',
          'verifying',
          'completed'
        ];

        for (const stage of stages) {
          let progress = 0;
          const baseProgress = stages.indexOf(stage) * (100 / stages.length);

          while (progress < 100) {
            await new Promise(resolve => setTimeout(resolve, 100));
            progress += Math.random() * 20;

            setMigrationProgress({
              stage,
              current: Math.floor(progress),
              total: 100,
              message: getStageMessage(stage),
              errors: [],
              progress: Math.min(baseProgress + (progress / stages.length), 99)
            });
          }

          setCurrentStep(stages.indexOf(stage) + 1);
        }

        setMigrationProgress({
          stage: 'completed',
          current: 100,
          total: 100,
          message: '迁移完成！',
          errors: [],
          progress: 100
        });
      };

      await onMigrationStart(location);
      await simulateProgress();

    } catch (error) {
      setError(String(error));
      setMigrationProgress({
        stage: 'error',
        current: 0,
        total: 100,
        message: `迁移失败: ${error}`,
        errors: [String(error)],
        progress: 0
      });
    } finally {
      setIsMigrating(false);
    }
  };

  const getStageMessage = (stage: MigrationProgress['stage']): string => {
    const messages: Record<MigrationProgress['stage'], string> = {
      'preparing': '正在准备迁移环境...',
      'migrating_todos': '正在迁移待办数据...',
      'migrating_relations': '正在迁移待办关系...',
      'migrating_assets': '正在迁移附件...',
      'finalizing': '正在完成迁移...',
      'verifying': '正在验证迁移结果...',
      'completed': '迁移完成！',
      'error': '迁移失败！'
    };
    return messages[stage];
  };

  const getCurrentStageStep = (): number => {
    if (!migrationProgress) return 0;
    const stageOrder: MigrationProgress['stage'][] = [
      'preparing',
      'migrating_todos',
      'migrating_relations',
      'migrating_assets',
      'finalizing',
      'verifying',
      'completed'
    ];
    return stageOrder.indexOf(migrationProgress.stage) + 1;
  };

  return (
    <Modal
      title="选择存储位置"
      open={visible}
      onCancel={onClose}
      width={700}
      footer={null}
      destroyOnClose
    >
      <div style={{ padding: '20px 0' }}>
        {/* 迁移说明 */}
        {currentStep === 0 && (
          <Alert
            message="迁移到 Markdown 文件存储"
            description={
              <div>
                <Paragraph>
                  将您的待办数据从 SQLite 数据库迁移到 Markdown 文件格式，实现：
                </Paragraph>
                <ul>
                  <li>✓ 人类可读的数据格式</li>
                  <li>✓ 支持任何文本编辑器</li>
                  <li>✓ 版本控制友好（Git）</li>
                  <li>✓ 完全去中心化，应用删除不影响数据</li>
                  <li>✓ 支持云同步（Dropbox、Google Drive 等）</li>
                </ul>
                <Paragraph type="warning">
                  <ExclamationCircleOutlined /> 迁移过程会自动备份数据库，确保数据安全。
                </Paragraph>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}

        {/* 步骤指示 */}
        {currentStep > 0 && (
          <Steps current={getCurrentStageStep() - 1} style={{ marginBottom: 30 }}>
            {stages.map((stage, index) => (
              <Step
                key={stage.key}
                title={stage.label}
                description={stage.description}
              />
            ))}
          </Steps>
        )}

        {/* 迁移完成 */}
        {migrationProgress?.stage === 'completed' && (
          <Result
            status="success"
            title="迁移成功完成！"
            subTitle={`您的待办数据已成功迁移到 Markdown 文件格式。存储位置: ${location}`}
            extra={[
              <Button type="primary" key="reopen" onClick={() => window.location.reload()}>
                重新启动应用
              </Button>            ]}
          />
        )}

        {/* 迁移失败 */}
        {migrationProgress?.stage === 'error' && (
          <Result
            status="error"
            title="迁移失败"
            subTitle={error || migrationProgress.message}
            extra={[
              <Button key="retry" onClick={() => setCurrentStep(0)}>
                重试
              </Button>,
              <Button key="close" onClick={onClose}>
                关闭
              </Button>
            ]}
          />
        )}

        {/* 迁移进度 */}
        {isMigrating && migrationProgress?.stage !== 'completed' && migrationProgress?.stage !== 'error' && (
          <Card>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <Text strong>{migrationProgress?.message}</Text>
                <Progress
                  percent={Math.floor(migrationProgress?.progress || 0)}
                  status={(migrationProgress?.errors?.length || 0) > 0 ? 'exception' : 'active'}
                />
              </div>

              {(migrationProgress?.total || 0) > 0 && (
                <Text type="secondary">
                  进度: {migrationProgress?.current || 0} / {migrationProgress?.total || 0}
                </Text>
              )}

              {(migrationProgress?.errors?.length || 0) > 0 && (
                <Alert
                  message="迁移过程中出现错误"
                  description={
                    <ul>
                      {migrationProgress?.errors?.map((err, index) => (
                        <li key={index}>{err}</li>
                      ))}
                    </ul>
                  }
                  type="warning"
                  showIcon
                />
              )}
            </Space>
          </Card>
        )}

        {/* 位置选择表单 */}
        {currentStep === 0 && !isMigrating && (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleStartMigration}
          >
            <Form.Item
              label="存储位置"
              name="location"
              rules={[{ required: true, message: '请选择存储位置' }]}
            >
              <Input
                placeholder="选择存储待办数据的文件夹"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                suffix={
                  <Button
                    icon={<FolderOutlined />}
                    onClick={handleSelectLocation}
                    type="text"
                  >
                    浏览
                  </Button>
                }
                readOnly
              />
            </Form.Item>

            {location && (
              <Alert
                message="已选择存储位置"
                description={location}
                type="success"
                showIcon
                style={{ marginBottom: 20 }}
              />
            )}

            <Form.Item style={{ marginBottom: 0 }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button onClick={onClose}>
                  取消
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  disabled={!location || isMigrating}
                >
                  开始迁移
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </div>
    </Modal>
  );
};

export default StorageLocationSelector;
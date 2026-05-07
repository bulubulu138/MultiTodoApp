import React, { useState, useEffect } from 'react';
import { Modal, Steps, Button, Alert, Typography, Progress, Space, Result, Card, Descriptions } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

interface MigrationWizardProps {
  visible: boolean;
  onClose: () => void;
  onMigrate: (targetPath: string) => Promise<void>;
}

interface MigrationProgress {
  stage: 'preparing' | 'migrating_todos' | 'migrating_relations' | 'migrating_assets' | 'finalizing' | 'verifying' | 'completed' | 'error';
  current: number;
  total: number;
  message: string;
  errors: string[];
  progress: number;
}

const MigrationWizard: React.FC<MigrationWizardProps> = ({
  visible,
  onClose,
  onMigrate
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetPath, setTargetPath] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<any>(null);

  interface StepContentProps {
    targetPath: string;
    setTargetPath: (path: string) => void;
    migrationProgress: MigrationProgress | null;
    setMigrationProgress: (progress: MigrationProgress | null) => void;
    migrationResult: any;
    setMigrationResult: (result: any) => void;
    isMigrating: boolean;
    handleStartMigration: () => Promise<void>;
    handlePrev: () => void;
    handleNext: () => void;
  }

  const steps = [
    {
      title: '欢迎使用',
      description: '了解 Markdown 文件存储',
      content: (props: StepContentProps) => renderWelcomeStep(props)
    },
    {
      title: '选择位置',
      description: '选择数据存储位置',
      content: (props: StepContentProps) => renderLocationStep(props)
    },
    {
      title: '迁移中',
      description: '正在迁移数据',
      content: (props: StepContentProps) => renderMigrationStep(props)
    },
    {
      title: '完成',
      description: '迁移完成',
      content: (props: StepContentProps) => renderCompletionStep(props)
    }
  ];

  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setTargetPath('');
      setMigrationProgress(null);
      setMigrationResult(null);
    }
  }, [visible]);

  const handleNext = () => {
    setCurrentStep(currentStep + 1);
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleStartMigration = async () => {
    if (!targetPath) {
      return;
    }

    try {
      setIsMigrating(true);
      setCurrentStep(2);

      await onMigrate(targetPath);

    } catch (error) {
      console.error('迁移失败:', error);
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

  // 渲染欢迎步骤
  function renderWelcomeStep() {
    return (
      <div style={{ padding: '20px 0' }}>
        <Title level={3}>欢迎使用 Markdown 文件存储迁移向导</Title>

        <Paragraph>
          这个向导将帮助您将待办数据从 SQLite 数据库迁移到 Markdown 文件格式。
        </Paragraph>

        <Card title="Markdown 文件存储的优势" style={{ marginBottom: 20 }}>
          <Space direction="vertical" size="middle">
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <Text strong>人类可读：</Text>数据以纯文本格式存储，可用任何编辑器查看
            </div>
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <Text strong>版本控制：</Text>完美支持 Git 进行版本管理和协作
            </div>
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <Text strong>便携性：</Text>轻松导出、备份和跨设备同步
            </div>
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <Text strong>去中心化：</Text>应用删除后，数据依然可用
            </div>
            <div>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              <Text strong>云同步：</Text>支持 Dropbox、Google Drive、OneDrive 等云存储
            </div>
          </Space>
        </Card>

        <Alert
          message="迁移过程说明"
          description={
            <ul>
              <li>迁移过程会自动创建数据库备份</li>
              <li>每个待办将转换为独立的 Markdown 文件</li>
              <li>附件将从数据库提取到独立文件夹</li>
              <li>待办关系将通过 Markdown 链接维护</li>
              <li>迁移完成后可以选择是否删除原数据库</li>
            </ul>
          }
          type="info"
          showIcon
        />
      </div>
    );
  }

  // 渲染位置选择步骤
  function renderLocationStep() {
    return (
      <div style={{ padding: '20px 0' }}>
        <Title level={3}>选择数据存储位置</Title>

        <Paragraph>
          请选择一个文件夹来存储您的待办 Markdown 文件。建议选择：
        </Paragraph>

        <Card title="推荐的存储位置" style={{ marginBottom: 20 }}>
          <Space direction="vertical">
            <Text>• Dropbox 文件夹（用于云同步）</Text>
            <Text>• Google Drive 文件夹（用于云同步）</Text>
            <Text>• OneDrive 文件夹（用于云同步）</Text>
            <Text>• 本地文档文件夹（离线使用）</Text>
          </Space>
        </Card>

        <Alert
          message="注意事项"
          description={
            <ul>
              <li>选择的文件夹必须存在且有写入权限</li>
              <li>文件夹会被创建子目录来组织数据</li>
              <li>请确保有足够的磁盘空间</li>
            </ul>
          }
          type="warning"
          showIcon
          style={{ marginBottom: 20 }}
        />

        {/* 这里应该添加目录选择器 */}
        <Text type="secondary">
          当前选择的路径: {targetPath || '未选择'}
        </Text>

        {/* 临时使用输入框，实际应该使用文件选择对话框 */}
        <input
          type="text"
          value={targetPath}
          onChange={(e) => setTargetPath(e.target.value)}
          placeholder="输入存储路径或点击浏览选择"
          style={{
            width: '100%',
            padding: '8px',
            marginTop: '10px',
            marginBottom: '20px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px'
          }}
        />

        <Button
          type="primary"
          onClick={() => {
            // 模拟文件选择
            const mockPath = 'C:\\Users\\YourName\\Documents\\MyTodos';
            setTargetPath(mockPath);
          }}
          style={{ marginBottom: 20 }}
        >
          浏览文件夹
        </Button>
      </div>
    );
  }

  // 渲染迁移步骤
  function renderMigrationStep() {
    const progress = migrationProgress;
    const isCompleted = progress?.stage === 'completed';
    const hasError = progress?.stage === 'error';

    return (
      <div style={{ padding: '20px 0' }}>
        <Title level={3}>数据迁移中...</Title>

        {progress && (
          <Card>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* 当前阶段 */}
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  {progress.stage === 'preparing' && '📦 准备迁移环境'}
                  {progress.stage === 'migrating_todos' && '📝 迁移待办数据'}
                  {progress.stage === 'migrating_relations' && '🔗 迁移待办关系'}
                  {progress.stage === 'migrating_assets' && '📎 迁移附件'}
                  {progress.stage === 'finalizing' && '✨ 完成迁移'}
                  {progress.stage === 'verifying' && '✅ 验证数据'}
                  {progress.stage === 'completed' && '🎉 迁移完成'}
                  {progress.stage === 'error' && '❌ 迁移失败'}
                </Text>
                <Progress
                  percent={Math.floor(progress.progress)}
                  status={hasError ? 'exception' : isCompleted ? 'success' : 'active'}
                  style={{ marginTop: 10 }}
                />
              </div>

              {/* 详细信息 */}
              <Descriptions column={1} size="small">
                <Descriptions.Item label="当前状态">
                  {progress.message}
                </Descriptions.Item>
                {progress.total > 0 && (
                  <Descriptions.Item label="进度">
                    {progress.current} / {progress.total}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {/* 错误信息 */}
              {hasError && progress.errors.length > 0 && (
                <Alert
                  message="迁移过程中出现错误"
                  description={
                    <ul>
                      {progress.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  }
                  type="error"
                  showIcon
                />
              )}

              {/* 完成信息 */}
              {isCompleted && migrationResult && (
                <Alert
                  message="迁移成功完成！"
                  description={
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="迁移待办">
                        {migrationResult.todosMigrated} 个
                      </Descriptions.Item>
                      <Descriptions.Item label="迁移关系">
                        {migrationResult.relationsMigrated} 个
                      </Descriptions.Item>
                      <Descriptions.Item label="迁移附件">
                        {migrationResult.assetsMigrated} 个
                      </Descriptions.Item>
                      <Descriptions.Item label="耗时">
                        {Math.round(migrationResult.duration / 1000)} 秒
                      </Descriptions.Item>
                    </Descriptions>
                  }
                  type="success"
                  showIcon
                />
              )}
            </Space>
          </Card>
        )}

        {!progress && (
          <Card>
            <Space>
              <LoadingOutlined />
              <Text>正在准备迁移...</Text>
            </Space>
          </Card>
        )}
      </div>
    );
  }

  // 渲染完成步骤
  function renderCompletionStep() {
    const isSuccess = migrationProgress?.stage === 'completed';
    const hasError = migrationProgress?.stage === 'error';

    return (
      <div style={{ padding: '20px 0' }}>
        {isSuccess ? (
          <Result
            status="success"
            title="迁移成功完成！"
            subTitle="您的待办数据已成功迁移到 Markdown 文件格式"
            extra={[
              <Button type="primary" key="restart" onClick={() => window.location.reload()}>
                重新启动应用
              </Button>,
              <Button key="close" onClick={onClose}>
                稍后重启
              </Button>
            ]}
          >
            <Descriptions column={1} bordered style={{ marginTop: 20 }}>
              <Descriptions.Item label="存储位置">
                {targetPath}
              </Descriptions.Item>
              <Descriptions.Item label="迁移待办">
                {migrationResult?.todosMigrated} 个
              </Descriptions.Item>
              <Descriptions.Item label="迁移关系">
                {migrationResult?.relationsMigrated} 个
              </Descriptions.Item>
              <Descriptions.Item label="迁移附件">
                {migrationResult?.assetsMigrated} 个
              </Descriptions.Item>
              <Descriptions.Item label="总耗时">
                {migrationResult ? Math.round(migrationResult.duration / 1000) : 0} 秒
              </Descriptions.Item>
            </Descriptions>
          </Result>
        ) : hasError ? (
          <Result
            status="error"
            title="迁移失败"
            subTitle={migrationProgress?.message}
            extra={[
              <Button type="primary" key="retry" onClick={() => setCurrentStep(1)}>
                重试
              </Button>,
              <Button key="close" onClick={onClose}>
                关闭
              </Button>
            ]}
          >
            {migrationProgress?.errors && migrationProgress.errors.length > 0 && (
              <Alert
                message="错误详情"
                description={
                  <ul>
                    {migrationProgress.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                }
                type="error"
                style={{ marginTop: 20 }}
              />
            )}
          </Result>
        ) : null}
      </div>
    );
  }

  return (
    <Modal
      title="Markdown 文件存储迁移向导"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
      destroyOnClose
    >
      <Steps current={currentStep} style={{ marginBottom: 30 }}>
        {steps.map((step, index) => (
          <Step
            key={index}
            title={step.title}
            description={step.description}
          />
        ))}
      </Steps>

      <div className="steps-content">
        {steps[currentStep].content({
          targetPath,
          setTargetPath,
          migrationProgress,
          setMigrationProgress,
          migrationResult,
          setMigrationResult,
          isMigrating,
          handleStartMigration,
          handlePrev,
          handleNext
        })}
      </div>

      <div style={{ marginTop: 30, textAlign: 'right' }}>
        {currentStep > 0 && currentStep < 2 && (
          <Button style={{ marginRight: 8 }} onClick={handlePrev}>
            上一步
          </Button>
        )}
        {currentStep === 0 && (
          <Button type="primary" onClick={handleNext}>
            下一步
          </Button>
        )}
        {currentStep === 1 && (
          <Button
            type="primary"
            onClick={handleStartMigration}
            disabled={!targetPath || isMigrating}
          >
            开始迁移
          </Button>
        )}
      </div>
    </Modal>
  );
};

export default MigrationWizard;

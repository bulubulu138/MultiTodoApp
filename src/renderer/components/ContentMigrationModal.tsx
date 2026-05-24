/**
 * Content Migration Modal
 *
 * Prompts user to migrate existing HTML content to Markdown format when needed.
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button, Typography, Alert, Space, Progress, Card } from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface ContentMigrationModalProps {
  visible: boolean;
  onComplete: () => void;
}

interface MigrationResult {
  success: boolean;
  totalProcessed: number;
  migrated: number;
  skipped: number;
  errors: number;
  backupPath?: string;
  details?: string[];
}

const ContentMigrationModal: React.FC<ContentMigrationModalProps> = ({ visible, onComplete }) => {
  const [status, setStatus] = useState<'check' | 'prompt' | 'migrating' | 'completed' | 'error'>('check');
  const [needsMigration, setNeedsMigration] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      checkMigrationNeeded();
    }
  }, [visible]);

  const checkMigrationNeeded = async () => {
    try {
      setStatus('check');
      const needs = await (window.electronAPI as any).migration?.needsMigration();
      setNeedsMigration(needs || false);

      if (needs) {
        setStatus('prompt');
      } else {
        setStatus('completed');
        setTimeout(() => onComplete(), 1000);
      }
    } catch (err) {
      console.error('[ContentMigrationModal] Check failed:', err);
      setError('检查迁移状态失败');
      setStatus('error');
    }
  };

  const startMigration = async () => {
    try {
      setStatus('migrating');
      setError(null);

      const result = await (window.electronAPI as any).migration?.runMigration();

      setMigrationResult(result);

      if (result.success) {
        setStatus('completed');
        setTimeout(() => onComplete(), 2000);
      } else {
        setError('迁移过程中出现错误');
        setStatus('error');
      }
    } catch (err) {
      console.error('[ContentMigrationModal] Migration failed:', err);
      setError('迁移失败: ' + (err as Error).message);
      setStatus('error');
    }
  };

  const closeModal = () => {
    if (status === 'completed') {
      onComplete();
    }
  };

  return (
    <Modal
      title={
        <Space>
          {status === 'completed' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <ExclamationCircleOutlined style={{ color: '#faad14' }} />}
          <span>内容迁移</span>
        </Space>
      }
      open={visible}
      onCancel={closeModal}
      footer={null}
      maskClosable={status === 'completed'}
      closable={status === 'completed'}
    >
      {status === 'check' && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <LoadingOutlined style={{ fontSize: '24px', marginBottom: '16px' }} />
          <Paragraph>正在检查是否需要迁移内容...</Paragraph>
        </div>
      )}

      {status === 'prompt' && needsMigration && (
        <div>
          <Alert
            message="检测到需要迁移内容"
            description="系统发现现有内容使用 HTML 格式，需要迁移到 Markdown 格式以适配新的编辑器。"
            type="warning"
            showIcon
            style={{ marginBottom: '16px' }}
          />

          <Card title="迁移详情" size="small" style={{ marginBottom: '16px' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text><strong>迁移类型：</strong> HTML → Markdown</Text>
              <Text><strong>备份：</strong> 自动创建备份</Text>
              <Text><strong>安全性：</strong> 安全，可回退</Text>
            </Space>
          </Card>

          <Paragraph type="secondary">
            迁移将自动创建备份，确保数据安全。迁移过程可能需要几分钟时间，请勿关闭应用。
          </Paragraph>

          <Space style={{ marginTop: '16px', width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => onComplete()} disabled={false}>
              稍后迁移
            </Button>
            <Button type="primary" onClick={startMigration}>
              立即迁移
            </Button>
          </Space>
        </div>
      )}

      {status === 'migrating' && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <LoadingOutlined style={{ fontSize: '24px', marginBottom: '16px' }} />
          <Title level={4}>正在迁移内容...</Title>
          <Paragraph type="secondary">请稍候，这可能需要几分钟时间</Paragraph>
          <Progress percent={undefined} status="active" />
        </div>
      )}

      {status === 'completed' && migrationResult && (
        <div>
          <Alert
            message="迁移完成"
            description={`成功迁移 ${migrationResult.migrated} 个文件，跳过 ${migrationResult.skipped} 个文件`}
            type="success"
            showIcon
            style={{ marginBottom: '16px' }}
          />

          {migrationResult.backupPath && (
            <Card title="备份信息" size="small" style={{ marginBottom: '16px' }}>
              <Text><strong>备份位置：</strong> {migrationResult.backupPath}</Text>
            </Card>
          )}

          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={onComplete}>
              开始使用
            </Button>
          </Space>
        </div>
      )}

      {status === 'error' && (
        <div>
          <Alert
            message="迁移失败"
            description={error || '未知错误'}
            type="error"
            showIcon
            style={{ marginBottom: '16px' }}
          />
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={checkMigrationNeeded}>
              重试
            </Button>
            <Button onClick={() => onComplete()}>
              跳过
            </Button>
          </Space>
        </div>
      )}

      {status === 'completed' && !needsMigration && (
        <div>
          <Alert
            message="无需迁移"
            description="您的内容已经是最新格式，无需迁移。"
            type="success"
            showIcon
          />
        </div>
      )}
    </Modal>
  );
};

export default ContentMigrationModal;
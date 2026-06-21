import React, { useState, useEffect } from 'react';
import { Modal, Button, Progress, Typography, Space } from 'antd';
import { WifiOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// 临时类型声明，直到webpack识别到更新的ElectronAPI
declare global {
  interface Window {
    electronAPI: {
      sync: {
        startServer: () => Promise<{success: boolean; error?: string}>;
        stopServer: () => Promise<{success: boolean; error?: string}>;
        startDiscovery: (deviceName: string) => Promise<{success: boolean; error?: string}>;
        stopDiscovery: () => Promise<{success: boolean; error?: string}>;
        getStats: () => Promise<{syncCount: number; lastSyncTime: string | null}>;
        onPairingCodeGenerated: (callback: (data: {code: string; deviceName: string; deviceId: string}) => void) => () => void;
        onPairingSuccess: (callback: () => void) => () => void;
        onProgress: (callback: (progress: {phase: string; current: number; total: number}) => void) => () => void;
        onComplete: (callback: (stats: {sent: number; received: number; skipped: number; total: number}) => void) => () => void;
        onError: (callback: (error: {message: string; code?: string}) => void) => () => void;
      };
      [key: string]: any;
    };
  }
}

interface SyncModalProps {
  visible: boolean;
  onClose: () => void;
}

type SyncState = 'waiting' | 'pairing' | 'syncing' | 'complete' | 'error';

interface SyncProgress {
  phase: string;
  current: number;
  total: number;
}

interface SyncStats {
  sent: number;
  received: number;
  skipped: number;
  total: number;
}

const SyncModal: React.FC<SyncModalProps> = ({ visible, onClose }) => {
  const [state, setState] = useState<SyncState>('waiting');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [progress, setProgress] = useState<SyncProgress>({ phase: '', current: 0, total: 0 });
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(300); // 5分钟 = 300秒

  // 启动同步服务
  useEffect(() => {
    if (!visible) return;

    const startSync = async () => {
      try {
        // 启动WebSocket服务器
        const serverResult = await window.electronAPI.sync.startServer();
        console.log('Start server result:', serverResult);

        if (!serverResult.success) {
          throw new Error(serverResult.error || 'Failed to start server');
        }

        // 启动UDP设备发现广播
        const deviceName = '我的电脑';
        const discoveryResult = await window.electronAPI.sync.startDiscovery(deviceName);
        console.log('Start discovery result:', discoveryResult);

        if (!discoveryResult.success) {
          throw new Error(discoveryResult.error || 'Failed to start discovery');
        }

        setState('waiting');
        console.log('Sync services started successfully');
      } catch (error) {
        console.error('Failed to start sync:', error);
        setErrorMessage(`启动同步服务失败: ${(error as Error).message}`);
        setState('error');
      }
    };

    startSync();

    // 清理函数
    return () => {
      window.electronAPI.sync.stopServer();
      window.electronAPI.sync.stopDiscovery();
    };
  }, [visible]);

  // 监听同步事件
  useEffect(() => {
    if (!visible) return;

    // 配对码生成
    const removePairingListener = window.electronAPI.sync.onPairingCodeGenerated((data) => {
      setPairingCode(data.code);
      setState('pairing');
      setCountdown(300); // 重置倒计时
    });

    // 配对成功
    const removePairingSuccessListener = window.electronAPI.sync.onPairingSuccess(() => {
      setState('syncing');
    });

    // 同步进度
    const removeProgressListener = window.electronAPI.sync.onProgress((prog) => {
      setProgress(prog);
    });

    // 同步完成
    const removeCompleteListener = window.electronAPI.sync.onComplete((syncStats) => {
      setStats(syncStats);
      setState('complete');

      // 2秒后自动关闭
      setTimeout(() => {
        onClose();
      }, 2000);
    });

    // 同步错误
    const removeErrorListener = window.electronAPI.sync.onError((error) => {
      setErrorMessage(error.message);
      setState('error');
    });

    return () => {
      removePairingListener();
      removePairingSuccessListener();
      removeProgressListener();
      removeCompleteListener();
      removeErrorListener();
    };
  }, [visible, onClose]);

  // 配对码倒计时
  useEffect(() => {
    if (state !== 'pairing') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [state]);

  // 格式化倒计时
  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // 渲染不同状态的内容
  const renderContent = () => {
    switch (state) {
      case 'waiting':
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <WifiOutlined style={{ fontSize: 64, color: '#1890ff', marginBottom: 24 }} />
            <Title level={4}>等待移动端连接...</Title>
            <Paragraph type="secondary">
              请在移动端打开同步功能并连接到此设备
            </Paragraph>
          </div>
        );

      case 'pairing':
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Title level={2}>配对码</Title>
            <div
              style={{
                fontSize: 48,
                fontWeight: 'bold',
                letterSpacing: 8,
                margin: '30px 0',
                color: '#1890ff',
              }}
            >
              {pairingCode}
            </div>
            <Paragraph type="secondary">
              请在移动端输入此配对码
            </Paragraph>
            <Text type="secondary" style={{ fontSize: 12 }}>
              有效时间：{formatCountdown(countdown)}
            </Text>
          </div>
        );

      case 'syncing':
        const percentage = progress.total > 0
          ? Math.round((progress.current / progress.total) * 100)
          : 0;

        return (
          <div style={{ padding: '40px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <SyncOutlined spin style={{ fontSize: 48, color: '#1890ff' }} />
              <Title level={4} style={{ marginTop: 16 }}>
                {progress.phase === 'sending' ? '正在发送文件...' : '正在接收文件...'}
              </Title>
            </div>
            <Progress percent={percentage} status="active" />
            <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 16 }}>
              已同步 {progress.current} / {progress.total} 个文件
            </Text>
          </div>
        );

      case 'complete':
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
            <Title level={4}>同步完成！</Title>
            {stats && (
              <Space direction="vertical" style={{ marginTop: 16 }}>
                <Text>发送：{stats.sent} 个文件</Text>
                <Text>接收：{stats.received} 个文件</Text>
                <Text>跳过：{stats.skipped} 个文件</Text>
                <Text strong>总计：{stats.total} 个文件</Text>
              </Space>
            )}
          </div>
        );

      case 'error':
        return (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <CloseCircleOutlined style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 24 }} />
            <Title level={4}>同步失败</Title>
            <Paragraph type="danger">{errorMessage}</Paragraph>
            <Button type="primary" onClick={() => {
              setState('waiting');
              setErrorMessage('');
            }}>
              重试
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      title="局域网同步"
      footer={state === 'complete' || state === 'error' ? [
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>
      ] : [
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>
      ]}
      width={500}
      centered
    >
      {renderContent()}
    </Modal>
  );
};

export default SyncModal;

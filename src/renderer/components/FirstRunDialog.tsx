import React, { useState, useEffect } from 'react';
import { Modal, Radio, Button, Space, Typography, Alert, Spin, Progress, Card, Descriptions } from 'antd';
import {
  FolderOutlined,
  HomeOutlined,
  AppstoreOutlined,
  FolderOpenOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface StorageLocation {
  type: 'documents' | 'home' | 'app' | 'custom';
  customPath?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

interface FirstRunDialogProps {
  visible: boolean;
  onComplete: (location: StorageLocation) => Promise<void>;
  onCancel: () => void;
}

const STORAGE_OPTIONS = [
  {
    value: 'documents' as const,
    label: '文档目录',
    description: '推荐选择，数据存储在用户文档目录中',
    icon: <FolderOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
  },
  {
    value: 'home' as const,
    label: '主目录',
    description: '数据存储在用户主目录中',
    icon: <HomeOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
  },
  {
    value: 'app' as const,
    label: '应用目录',
    description: '数据存储在应用数据目录中（默认）',
    icon: <AppstoreOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
  },
  {
    value: 'custom' as const,
    label: '自定义位置',
    description: '选择您自己的存储位置',
    icon: <FolderOpenOutlined style={{ fontSize: '24px', color: '#fa8c16' }} />
  }
];

const FirstRunDialog: React.FC<FirstRunDialogProps> = ({ visible, onComplete, onCancel }) => {
  const [selectedType, setSelectedType] = useState<'documents' | 'home' | 'app' | 'custom'>('documents');
  const [customPath, setCustomPath] = useState<string>('');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [recommendedPaths, setRecommendedPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');

  // 加载推荐路径
  useEffect(() => {
    if (visible) {
      loadRecommendedPaths();
    }
  }, [visible]);

  // 验证选中的路径
  useEffect(() => {
    if (visible) {
      validateCurrentSelection();
    }
  }, [selectedType, customPath, visible]);

  const loadRecommendedPaths = async () => {
    try {
      const paths = await window.electronAPI.storageLocation.getRecommendedPaths();
      setRecommendedPaths(paths);
      updateCurrentPath('documents', paths);
    } catch (error) {
      console.error('Error loading recommended paths:', error);
    }
  };

  const updateCurrentPath = (type: 'documents' | 'home' | 'app' | 'custom', paths?: string[]) => {
    if (type === 'custom') {
      setCurrentPath(customPath);
    } else if (paths) {
      switch (type) {
        case 'documents':
          setCurrentPath(paths[0] || '');
          break;
        case 'home':
          setCurrentPath(paths[1] || '');
          break;
        case 'app':
          setCurrentPath(paths[2] || '');
          break;
      }
    }
  };

  const validateCurrentSelection = async () => {
    setValidating(true);
    try {
      let pathToValidate = '';

      if (selectedType === 'custom') {
        pathToValidate = customPath;
      } else {
        pathToValidate = currentPath;
      }

      if (!pathToValidate) {
        setValidation({
          valid: false,
          error: '请选择存储位置'
        });
        return;
      }

      const result = await window.electronAPI.storageLocation.validatePath(pathToValidate);
      setValidation(result);
    } catch (error) {
      console.error('Error validating path:', error);
      setValidation({
        valid: false,
        error: '路径验证失败'
      });
    } finally {
      setValidating(false);
    }
  };

  const handleTypeChange = (value: 'documents' | 'home' | 'app' | 'custom') => {
    setSelectedType(value);
    updateCurrentPath(value, recommendedPaths);
  };

  const handleSelectCustomFolder = async () => {
    try {
      const result = await window.electronAPI.storageLocation.selectFolder();
      if (result) {
        setCustomPath(result);
        updateCurrentPath('custom', recommendedPaths);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      setValidation({
        valid: false,
        error: '选择文件夹失败'
      });
    }
  };

  const handleComplete = async () => {
    if (!validation?.valid) {
      return;
    }

    setLoading(true);
    try {
      const location: StorageLocation = {
        type: selectedType,
        customPath: selectedType === 'custom' ? customPath : undefined
      };

      await onComplete(location);
    } catch (error) {
      console.error('Error completing setup:', error);
      setValidation({
        valid: false,
        error: '设置失败，请重试'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!loading) {
      onCancel();
    }
  };

  const isCompleteDisabled = !validation?.valid || loading || validating;

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={handleCancel}
      width={700}
      footer={null}
      closable={!loading}
      maskClosable={!loading}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 欢迎标题 */}
        <div style={{ textAlign: 'center' }}>
          <Title level={3} style={{ marginBottom: 8 }}>
            欢迎使用 MultiTodo
          </Title>
          <Text type="secondary">请选择数据存储位置以开始使用</Text>
        </div>

        {/* 存储选项 */}
        <Card>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Text strong>选择存储位置：</Text>
            <Radio.Group
              value={selectedType}
              onChange={(e) => handleTypeChange(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {STORAGE_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    style={{
                      border: `1px solid ${selectedType === option.value ? '#1890ff' : '#d9d9d9'}`,
                      borderRadius: '8px',
                      padding: '16px',
                      backgroundColor: selectedType === option.value ? '#e6f7ff' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                    onClick={() => handleTypeChange(option.value)}
                  >
                    <Space size="large">
                      <Radio value={option.value} style={{ marginRight: 0 }}>
                        {option.icon}
                      </Radio>
                      <Space direction="vertical" size={0}>
                        <Text strong>{option.label}</Text>
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
            {selectedType === 'custom' && (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={handleSelectCustomFolder}
                  disabled={loading}
                  block
                >
                  选择文件夹
                </Button>
                {customPath && (
                  <Text ellipsis={{ tooltip: customPath }} style={{ fontSize: '12px' }}>
                    已选择: {customPath}
                  </Text>
                )}
              </Space>
            )}
          </Space>
        </Card>

        {/* 路径信息 */}
        {currentPath && (
          <Card size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="存储位置">
                <Text ellipsis={{ tooltip: currentPath }} style={{ fontSize: '12px' }}>
                  {currentPath}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* 验证状态 */}
        {validating && (
          <div style={{ textAlign: 'center' }}>
            <Spin size="small" />
            <Text type="secondary" style={{ marginLeft: 8 }}>
              正在验证路径...
            </Text>
          </div>
        )}

        {validation && !validating && (
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {validation.valid ? (
              <Alert
                message="路径验证通过"
                type="success"
                icon={<CheckCircleOutlined />}
                showIcon
              />
            ) : (
              <Alert
                message="路径验证失败"
                description={validation.error}
                type="error"
                icon={<WarningOutlined />}
                showIcon
              />
            )}

            {validation.warnings && validation.warnings.length > 0 && (
              <Alert
                message="注意事项"
                description={
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {validation.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                }
                type="warning"
                showIcon
              />
            )}
          </Space>
        )}

        {/* 操作按钮 */}
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={handleCancel} disabled={loading}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleComplete}
              disabled={isCompleteDisabled}
              loading={loading}
            >
              开始使用
            </Button>
          </Space>
        </div>
      </Space>
    </Modal>
  );
};

export default FirstRunDialog;
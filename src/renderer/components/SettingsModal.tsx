import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, Typography, Space, Tabs, Card, Tag, Divider, Input, Switch, Alert, Tooltip, Collapse, Descriptions, Progress, Result, message, Spin } from 'antd';
import { BulbOutlined, FolderOpenOutlined, DatabaseOutlined, TagOutlined, ThunderboltOutlined, RobotOutlined, CheckCircleOutlined, CloseCircleOutlined, ExportOutlined, LinkOutlined, BgColorsOutlined, CloudUploadOutlined, LockOutlined, SwapOutlined, FileTextOutlined, ToolOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { Todo, CustomTab } from '../../shared/types';
import { ColorTheme } from '../theme/themes';
import TagManagement from './TagManagement';
import BackupSettings from './BackupSettings';
import CustomTabManager from './CustomTabManager';
import URLAuthorizationManager from './URLAuthorizationManager';
import PromptTemplateManager from './PromptTemplateManager';
import MarkdownFileBrowser from './MarkdownFileBrowser';

const { Text } = Typography;

// Color theme selector component
interface ColorThemeSelectorProps {
  value: ColorTheme;
  onChange: (theme: ColorTheme) => void;
}

const ColorThemeSelector: React.FC<ColorThemeSelectorProps> = ({ value, onChange }) => {
  const colors: Array<{ key: ColorTheme; color: string; label: string }> = [
    { key: 'purple', color: '#8B5CF6', label: '紫色' },
    { key: 'blue', color: '#3B82F6', label: '蓝色' },
    { key: 'green', color: '#10B981', label: '绿色' },
    { key: 'orange', color: '#F59E0B', label: '橙色' },
    { key: 'red', color: '#EF4444', label: '红色' },
  ];

  return (
    <Space size={12}>
      {colors.map(({ key, color, label }) => (
        <Tooltip key={key} title={label}>
          <div
            onClick={() => onChange(key)}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: color,
              cursor: 'pointer',
              border: value === key ? '3px solid var(--ant-colorText)' : '3px solid transparent',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          />
        </Tooltip>
      ))}
    </Space>
  );
};

interface SettingsModalProps {
  visible: boolean;
  settings: Record<string, string>;
  todos?: Todo[];
  onSave: (settings: Record<string, string>) => void;
  onCancel: () => void;
  onReload?: () => Promise<void>;
  customTabs?: CustomTab[];
  onSaveCustomTabs?: (tabs: CustomTab[]) => void;
  existingTags?: string[];
  colorTheme?: ColorTheme;
  onColorThemeChange?: (theme: ColorTheme) => void;
  promptTemplates?: any[];
  onTemplatesChange?: () => Promise<void>;
  onAIConfigUpdate?: (settings: Record<string, string>) => void;
}

// 存储管理组件
const StorageManagement: React.FC = () => {
  const [storagePath, setStoragePath] = useState<string>('');
  const [showMarkdownBrowser, setShowMarkdownBrowser] = useState(false);

  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    try {
      const info = await window.electronAPI.storage.getMode();
      setStoragePath(info.path || '');
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const handleImportMarkdownFile = async (filePath: string) => {
    try {
      const result = await window.electronAPI.hybridStorage.importMarkdownFile(filePath);
      if (result.success) {
        message.success(`成功导入文件: ${result.todo.title}`);
        await loadStorageInfo();
      } else {
        message.error(`导入失败: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing markdown file:', error);
      message.error('导入文件时发生错误');
    }
  };

  const handleRefreshMarkdownFiles = async () => {
    try {
      await window.electronAPI.hybridStorage.invalidateCache();
      await loadStorageInfo();
    } catch (error) {
      console.error('Error refreshing markdown files:', error);
    }
  };

  const handleOpenMarkdownFolder = async () => {
    try {
      if (!storagePath) {
        message.warning('存储路径未配置');
        return;
      }

      const result = await window.electronAPI.storageLocation.openInExplorer(storagePath);
      if (!result.success) {
        message.error(result.error || '打开失败');
      }
    } catch (error) {
      console.error('Error opening markdown folder:', error);
      message.error('打开失败');
    }
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Markdown存储位置管理 */}
        <Card title={<><FolderOpenOutlined /> Markdown存储位置</>}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">当前存储位置：</Text>
              <div style={{ marginTop: 8 }}>
                <Text ellipsis={{ tooltip: storagePath }} style={{ maxWidth: '100%' }}>
                  {storagePath || '默认位置'}
                </Text>
              </div>
            </div>

            <Space>
              <Button
                icon={<FolderOpenOutlined />}
                onClick={handleOpenMarkdownFolder}
              >
                打开文件夹
              </Button>
              <Button
                icon={<FileTextOutlined />}
                onClick={() => setShowMarkdownBrowser(true)}
              >
                浏览和导入MD文件
              </Button>
            </Space>
          </Space>
        </Card>

        {/* Markdown文件浏览器 */}
        <MarkdownFileBrowser
          visible={showMarkdownBrowser}
          storagePath={storagePath || ''}
          onClose={() => setShowMarkdownBrowser(false)}
          onImportFile={handleImportMarkdownFile}
          onRefresh={handleRefreshMarkdownFiles}
        />
      </Space>
    </div>
  );
};

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  settings,
  todos = [],
  onSave,
  onCancel,
  onReload,
  customTabs = [],
  onSaveCustomTabs,
  existingTags = [],
  colorTheme,
  onColorThemeChange,
  promptTemplates = [],
  onTemplatesChange,
  onAIConfigUpdate,
}) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [importExportLoading, setImportExportLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue(settings);
    }
  }, [visible, settings, form]);

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      onSave(values);
      message.success('设置已保存');
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      setImportExportLoading(true);
      const result = await window.electronAPI.todo.exportAll();
      if (result.success && result.data) {
        // 创建并下载文件
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `todos-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        message.success('数据导出成功');
      } else {
        message.error('导出失败');
      }
    } catch (error) {
      console.error('Export failed:', error);
      message.error('导出失败');
    } finally {
      setImportExportLoading(false);
    }
  };

  const handleImportData = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const text = await file.text();
          const data = JSON.parse(text);
          const result = await window.electronAPI.todo.importAll(data);
          if (result.success) {
            message.success('数据导入成功，正在重新加载...');
            if (onReload) {
              await onReload();
            }
          } else {
            message.error('导入失败');
          }
        }
      };
      input.click();
    } catch (error) {
      console.error('Import failed:', error);
      message.error('导入失败');
    }
  };

  const tabItems = [
    {
      key: 'general',
      label: '通用',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card title={<><BulbOutlined /> AI 配置</>}>
            <Form.Item
              label="API 密钥"
              name="apiKey"
              tooltip="用于 AI 功能的 API 密钥"
            >
              <Input.Password placeholder="输入 API 密钥" />
            </Form.Item>
            <Form.Item
              label="API 基础 URL"
              name="apiBaseUrl"
              tooltip="自定义 API 基础 URL"
            >
              <Input placeholder="输入 API 基础 URL" />
            </Form.Item>
            <Form.Item
              label="AI 模型"
              name="aiModel"
              tooltip="选择使用的 AI 模型"
            >
              <Select placeholder="选择 AI 模型">
                <Select.Option value="gpt-4">GPT-4</Select.Option>
                <Select.Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Select.Option>
                <Select.Option value="claude-3">Claude 3</Select.Option>
              </Select>
            </Form.Item>
          </Card>

          <Card title={<><TagOutlined /> 主题设置</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>选择主题颜色：</Text>
                <div style={{ marginTop: 12 }}>
                  <ColorThemeSelector
                    value={colorTheme || 'blue'}
                    onChange={onColorThemeChange || (() => {})}
                  />
                </div>
              </div>
            </Space>
          </Card>

          <Card title={<><ExportOutlined /> 数据管理</>}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                type="primary"
                icon={<ExportOutlined />}
                onClick={handleExportData}
                loading={importExportLoading}
              >
                导出所有数据
              </Button>
              <Button
                icon={<CloudUploadOutlined />}
                onClick={handleImportData}
                loading={importExportLoading}
              >
                导入数据
              </Button>
            </Space>
          </Card>
        </Space>
      ),
    },
    {
      key: 'tags',
      label: '标签管理',
      children: <TagManagement todos={todos} onReload={onReload || (() => Promise.resolve())} />,
    },
    {
      key: 'storage',
      label: '存储管理',
      children: <StorageManagement />,
    },
    {
      key: 'backup',
      label: '备份与恢复',
      children: <BackupSettings />,
    },
    {
      key: 'customTabs',
      label: '自定义标签页',
      children: <CustomTabManager
        visible={false}
        onClose={() => {}}
        customTabs={customTabs}
        onSave={onSaveCustomTabs || (() => {})}
        existingTags={existingTags}
        embedded={true}
      />,
    },
    {
      key: 'urlAuth',
      label: 'URL 授权',
      children: <URLAuthorizationManager />,
    },
    {
      key: 'templates',
      label: '提示词模板',
      children: <PromptTemplateManager
        visible={false}
        onClose={() => {}}
        templates={promptTemplates}
        onReload={onTemplatesChange || (() => Promise.resolve())}
        embedded={true}
      />,
    },
  ];

  return (
    <Modal
      title="设置"
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          onClick={handleSave}
          loading={loading}
        >
          保存
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Form>
    </Modal>
  );
};

export default SettingsModal;
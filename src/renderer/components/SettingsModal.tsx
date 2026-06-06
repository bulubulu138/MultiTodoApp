import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, Typography, Space, Tabs, Card, Tag, Divider, Input, Switch, Alert, Tooltip, Collapse, Descriptions, Progress, Result, message, Spin, List, Radio } from 'antd';
import { BulbOutlined, FolderOpenOutlined, DatabaseOutlined, TagOutlined, ThunderboltOutlined, RobotOutlined, CheckCircleOutlined, CloseCircleOutlined, LinkOutlined, BgColorsOutlined, LockOutlined, SwapOutlined, FileTextOutlined, ToolOutlined, PlusOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { Todo, CustomTab } from '../../shared/types';
import { ColorTheme, ThemeMode } from '../theme/themes';
import TagManagement from './TagManagement';
import BackupSettings from './BackupSettings';
import CustomTabManager from './CustomTabManager';
import URLAuthorizationManager from './URLAuthorizationManager';
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
    { key: 'cyan', color: '#14B8A6', label: '青色' },
    { key: 'magenta', color: '#D946EF', label: '品红' },
    { key: 'yellow', color: '#EAB308', label: '金黄' },
    { key: 'indigo', color: '#6366F1', label: '靛蓝' },
    { key: 'pink', color: '#EC4899', label: '粉色' },
    { key: 'teal', color: '#0D9488', label: '青绿' },
    { key: 'amber', color: '#F9A825', label: '琥珀' },
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
  themeMode?: ThemeMode;
  onThemeModeChange?: (mode: ThemeMode) => void;
  colorTheme?: ColorTheme;
  onColorThemeChange?: (theme: ColorTheme) => void;
}

// 存储管理组件
const StorageManagement: React.FC = () => {
  const { modal } = App.useApp();
  const [storagePath, setStoragePath] = useState<string>('');
  const [recentDatabases, setRecentDatabases] = useState<any[]>([]);
  const [showMarkdownBrowser, setShowMarkdownBrowser] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStorageInfo();
    loadRecentDatabases();
  }, []);

  const loadStorageInfo = async () => {
    try {
      const info = await window.electronAPI.storage.getMode();
      setStoragePath(info.path || '');
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  const loadRecentDatabases = async () => {
    try {
      const result = await window.electronAPI.storageLocation.getRecentDatabases();
      if (result.success && result.databases) {
        setRecentDatabases(result.databases);
      }
    } catch (error) {
      console.error('Error loading recent databases:', error);
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

  const handleSwitchDatabase = async (dbPath: string) => {
    console.log('[StorageManagement] Attempting to switch database:', dbPath);

    modal.confirm({
      title: '切换数据库？',
      content: '切换数据库将重新加载应用，未保存的更改将会丢失。',
      onOk: async () => {
        setLoading(true);
        try {
          console.log('[StorageManagement] Calling switchDatabase API...');
          const result = await window.electronAPI.storageLocation.switchDatabase(dbPath);
          console.log('[StorageManagement] Switch result:', result);

          if (result.success) {
            message.success('数据库切换成功，正在重新加载...');
            setTimeout(() => {
              location.reload();
            }, 1000);
          } else {
            message.error(result.error || '切换失败');
          }
        } catch (error) {
          console.error('[StorageManagement] Switch error:', error);
          message.error(`切换失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleAddNewDatabase = async () => {
    try {
      const folderPath = await window.electronAPI.storageLocation.selectFolder();
      if (folderPath) {
        setLoading(true);

        // 验证数据库
        const validation = await window.electronAPI.storageLocation.validateDatabase(folderPath);

        if (!validation.valid) {
          modal.confirm({
            title: '初始化新数据库？',
            content: `选择的文件夹似乎不是有效的数据库，是否要初始化为新数据库？`,
            onOk: async () => {
              const initResult = await window.electronAPI.storageLocation.initializeDatabase(folderPath);
              if (initResult.success) {
                message.success('数据库初始化成功');
                await handleSwitchDatabase(folderPath);
              } else {
                message.error(initResult.error || '初始化失败');
                setLoading(false);
              }
            },
            onCancel: () => {
              setLoading(false);
            }
          });
        } else {
          await handleSwitchDatabase(folderPath);
        }
      }
    } catch (error) {
      message.error('添加数据库失败');
      setLoading(false);
    }
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Markdown存储位置管理 */}
        <Card title={<><FolderOpenOutlined /> 当前数据库</>}>
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

        {/* 最近使用的数据库 */}
        <Card title={<><DatabaseOutlined /> 最近使用的数据库</>}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddNewDatabase}
              loading={loading}
            >
              添加新数据库
            </Button>

            <List
              dataSource={recentDatabases}
              renderItem={(db: any) => (
                <List.Item
                  actions={[
                    <Button
                      type="link"
                      onClick={() => handleSwitchDatabase(db.path)}
                      disabled={db.path === storagePath}
                    >
                      切换
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={db.isValid ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                    title={db.name}
                    description={
                      <Space direction="vertical" size="small">
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {db.path}
                        </Text>
                        <Space>
                          <Tag color="blue">{db.todoCount} 待办</Tag>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            最后使用: {new Date(db.lastUsed).toLocaleString()}
                          </Text>
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
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
  themeMode = 'light',
  onThemeModeChange,
  colorTheme,
  onColorThemeChange,
}) => {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);

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


  const tabItems = [
    {
      key: 'general',
      label: '通用',
      children: (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card title={<><TagOutlined /> 主题设置</>}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <Text strong>选择主题模式：</Text>
                <div style={{ marginTop: 12, marginBottom: 16 }}>
                  <Radio.Group
                    value={themeMode}
                    onChange={(e) => onThemeModeChange?.(e.target.value as ThemeMode)}
                    optionType="button"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="light">浅色</Radio.Button>
                    <Radio.Button value="dark">暗黑</Radio.Button>
                  </Radio.Group>
                </div>

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
  ];

  return (
    <Modal
      title="设置"
      open={visible}
      onCancel={onCancel}
      rootClassName="ios-modal settings-modal"
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
          className="ios-subtabs"
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </Form>
    </Modal>
  );
};

export default SettingsModal;
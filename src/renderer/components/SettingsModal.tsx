import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, Typography, Space, Tabs, Card, Tag, Divider, Input, Switch, Alert } from 'antd';
import { BulbOutlined, FolderOpenOutlined, DatabaseOutlined, TagOutlined, ThunderboltOutlined, RobotOutlined, CheckCircleOutlined, CloseCircleOutlined, ExportOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { Todo, CustomTab } from '../../shared/types';
import TagManagement from './TagManagement';
import BackupSettings from './BackupSettings';
import CustomTabManager from './CustomTabManager';
import FlowchartMigrationPanel from './FlowchartMigrationModal';

const { Text } = Typography;

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
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  settings,
  todos = [],
  onSave,
  onCancel,
  onReload,
  customTabs = [],
  onSaveCustomTabs,
  existingTags = []
}) => {
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  const { message } = App.useApp();
  const [dbPath, setDbPath] = useState<string>('加载中...');
  const [activeTab, setActiveTab] = useState('general');
  const [aiProviders, setAiProviders] = useState<Array<{value: string; label: string; endpoint: string}>>([]);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [generatingKeywords, setGeneratingKeywords] = useState(false);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        theme: settings.theme || 'light',
        calendarViewSize: settings.calendarViewSize || 'compact',
      });
      
      // 加载AI配置
      aiForm.setFieldsValue({
        ai_provider: settings.ai_provider || 'disabled',
        ai_api_key: settings.ai_api_key || '',
        ai_api_endpoint: settings.ai_api_endpoint || '',
        ai_enabled: settings.ai_enabled === 'true',
      });
      
      // 获取数据库路径
      window.electronAPI.settings.get('dbPath').then((path) => {
        if (path) {
          setDbPath(path);
        } else {
          setDbPath('未知路径');
        }
      }).catch(() => {
        setDbPath('获取失败');
      });
      
      // 获取支持的AI提供商
      window.electronAPI.ai.getSupportedProviders().then((providers) => {
        setAiProviders(providers);
      }).catch(() => {
        console.error('Failed to load AI providers');
      });
    }
  }, [visible, settings, form, aiForm]);

  const handleSubmit = () => {
    const values = form.getFieldsValue();
    onSave(values);
  };

  const handleOpenDataFolder = async () => {
    try {
      const result = await window.electronAPI.settings.openDataFolder();
      if (result.success) {
        message.success('已打开数据文件夹');
      } else {
        message.error('打开失败: ' + result.error);
      }
    } catch (error) {
      message.error('无法打开数据文件夹');
    }
  };

  const handleCopyPath = () => {
    if (dbPath && dbPath !== '加载中...' && dbPath !== '未知路径') {
      navigator.clipboard.writeText(dbPath).then(() => {
        message.success('路径已复制到剪贴板');
      }).catch(() => {
        message.error('复制失败');
      });
    }
  };

  const handleAIConfigSave = async () => {
    try {
      const values = await aiForm.validateFields();
      const result = await window.electronAPI.ai.configure(
        values.ai_provider,
        values.ai_api_key || '',
        values.ai_api_endpoint || ''
      );
      
      if (result.success) {
        message.success('AI配置已保存');
        // 同时更新settings
        await window.electronAPI.settings.update({
          ai_provider: values.ai_provider,
          ai_api_key: values.ai_api_key || '',
          ai_api_endpoint: values.ai_api_endpoint || '',
          ai_enabled: values.ai_provider !== 'disabled' && values.ai_api_key ? 'true' : 'false'
        });
        setConnectionTestResult(null); // 清除测试结果
      } else {
        message.error('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('Failed to save AI config:', error);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTestResult(null);
    
    try {
      const values = await aiForm.validateFields();
      
      // 先保存配置
      await window.electronAPI.ai.configure(
        values.ai_provider,
        values.ai_api_key || '',
        values.ai_api_endpoint || ''
      );
      
      // 测试连接
      const result = await window.electronAPI.ai.testConnection();
      setConnectionTestResult(result);
      
      if (result.success) {
        message.success('连接成功！');
      } else {
        message.error('连接失败: ' + result.message);
      }
    } catch (error: any) {
      setConnectionTestResult({
        success: false,
        message: error.message || '测试失败'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleBatchGenerateKeywords = async () => {
    console.log('[SettingsModal] 开始批量生成关键词...');
    setGeneratingKeywords(true);
    try {
      console.log('[SettingsModal] 调用 electronAPI.keywords.batchGenerate...');
      const result = await window.electronAPI.keywords.batchGenerate();
      console.log('[SettingsModal] 收到结果:', result);
      
      if (result.success) {
        message.success(`关键词生成完成！处理了 ${result.processed}/${result.total} 个待办`);
        if (onReload) {
          console.log('[SettingsModal] 重新加载数据...');
          await onReload();
        }
      } else {
        console.error('[SettingsModal] 生成失败:', result.error);
        message.error('生成失败: ' + result.error);
      }
    } catch (error: any) {
      console.error('[SettingsModal] 捕获到错误:', error);
      message.error('生成失败: ' + error.message);
    } finally {
      console.log('[SettingsModal] 完成，设置 loading 为 false');
      setGeneratingKeywords(false);
    }
  };

  const tabItems = [
    {
      key: 'general',
      label: (
        <span>
          <BulbOutlined />
          通用设置
        </span>
      ),
      children: (
        <Form form={form} layout="vertical">
        <Form.Item
          name="theme"
          label={
            <span>
              <BulbOutlined style={{ marginRight: 8 }} />
              主题外观
            </span>
          }
          tooltip="选择您喜欢的主题风格"
        >
          <Select
            options={[
              { label: '☀️ 浅色', value: 'light' },
              { label: '🌙 纯黑', value: 'dark' },
            ]}
            placeholder="选择主题"
          />
        </Form.Item>
        
        <Form.Item
          name="calendarViewSize"
          label="📅 日历视图大小"
          tooltip="调整日历单元格的显示尺寸"
        >
          <Select
            options={[
              { label: '紧凑（推荐）', value: 'compact' },
              { label: '标准', value: 'standard' },
              { label: '舒适', value: 'comfortable' },
            ]}
            placeholder="选择日历视图大小"
          />
        </Form.Item>
        
        <Form.Item
          label={
            <span>
              <DatabaseOutlined style={{ marginRight: 8 }} />
              数据存储位置
            </span>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text
              copyable={{ text: dbPath, tooltips: ['复制路径', '已复制'] }}
              style={{ 
                fontSize: 12, 
                wordBreak: 'break-all',
                display: 'block',
                padding: '8px 12px',
                backgroundColor: 'var(--ant-color-fill-tertiary)',
                borderRadius: 4
              }}
            >
              {dbPath}
            </Text>
            <Space>
              <Button
                size="small"
                icon={<FolderOpenOutlined />}
                onClick={handleOpenDataFolder}
              >
                打开数据文件夹
              </Button>
              <Button
                size="small"
                onClick={handleCopyPath}
              >
                复制路径
              </Button>
            </Space>
            <Text type="secondary" style={{ fontSize: 11 }}>
              💡 您的所有待办数据都存储在此位置，卸载应用时可选择是否保留
            </Text>
          </Space>
        </Form.Item>
        
          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            borderRadius: 4,
            fontSize: 12,
            opacity: 0.8
          }}>
            💡 提示：纯黑主题更适合夜间使用，并且在AMOLED屏幕上更省电。紧凑模式可在一屏内显示完整月历。
          </div>
        </Form>
      ),
    },
    {
      key: 'tags',
      label: (
        <span>
          <TagOutlined />
          标签管理
        </span>
      ),
      children: (
        <TagManagement 
          todos={todos} 
          onReload={onReload || (async () => {})} 
        />
      ),
    },
    {
      key: 'shortcuts',
      label: (
        <span>
          <ThunderboltOutlined />
          快捷键
        </span>
      ),
      children: (
        <div>
          <Card title="🚀 全局快捷键" variant="borderless" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>快速创建待办：</Text>
                </div>
                <Tag color="blue" style={{ fontSize: '14px', padding: '6px 12px' }}>
                  {navigator.platform.includes('Mac') ? 'Cmd + Shift + T' : 'Ctrl + Shift + T'}
                </Tag>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    在任何应用中选中文字或复制图片后，按此快捷键即可快速创建待办
                  </Text>
                </div>
              </div>
              
              <Divider style={{ margin: '12px 0' }} />
              
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>使用方法：</Text>
                <ol style={{ margin: 0, paddingLeft: 20, color: 'rgba(0, 0, 0, 0.65)' }}>
                  <li style={{ marginBottom: 4 }}>在任何应用中选中文字或复制图片到剪贴板</li>
                  <li style={{ marginBottom: 4 }}>按下快捷键 {navigator.platform.includes('Mac') ? 'Cmd + Shift + T' : 'Ctrl + Shift + T'}</li>
                  <li style={{ marginBottom: 4 }}>MultiTodo 会自动显示并打开创建表单</li>
                  <li>剪贴板内容会自动填充到待办内容中</li>
                </ol>
              </div>
            </Space>
          </Card>
          
          <Card title="💡 系统托盘" variant="borderless">
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Text>
                • <Text strong>关闭窗口</Text>：应用会最小化到系统托盘，不会退出
              </Text>
              <Text>
                • <Text strong>单击托盘图标</Text>：快速显示/隐藏窗口
              </Text>
              <Text>
                • <Text strong>右键托盘图标</Text>：查看菜单选项
              </Text>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
                💡 提示：应用会在后台保持运行，随时响应全局快捷键
              </Text>
            </Space>
          </Card>
        </div>
      ),
    },
    {
      key: 'ai',
      label: (
        <span>
          <RobotOutlined />
          AI 助手
        </span>
      ),
      children: (
        <div>
          <Alert
            message="智能推荐与AI增强"
            description="配置AI服务后，未来可享受智能待办分析、自动摘要等功能。当前已支持基于关键词的智能推荐。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Form form={aiForm} layout="vertical">
            <Form.Item
              name="ai_provider"
              label="AI 服务提供商"
              tooltip="选择您使用的AI服务商"
            >
              <Select
                options={[
                  { label: '🚫 禁用', value: 'disabled' },
                  ...aiProviders.map(p => ({ label: p.label, value: p.value }))
                ]}
                onChange={() => setConnectionTestResult(null)}
              />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.ai_provider !== currentValues.ai_provider}
            >
              {({ getFieldValue }) => {
                const provider = getFieldValue('ai_provider');
                if (provider === 'disabled') {
                  return null;
                }
                
                return (
                  <>
                    <Form.Item
                      name="ai_api_key"
                      label="API Key"
                      rules={[{ required: provider !== 'disabled', message: '请输入API Key' }]}
                    >
                      <Input.Password
                        placeholder="输入您的API Key"
                        onChange={() => setConnectionTestResult(null)}
                      />
                    </Form.Item>

                    <Form.Item
                      name="ai_api_endpoint"
                      label="API 端点（可选）"
                      tooltip="如需使用自定义端点，请填写完整URL"
                    >
                      <Input
                        placeholder={aiProviders.find(p => p.value === provider)?.endpoint || '默认端点'}
                        onChange={() => setConnectionTestResult(null)}
                      />
                    </Form.Item>

                    <Form.Item>
                      <Space>
                        <Button
                          type="primary"
                          onClick={handleAIConfigSave}
                        >
                          保存配置
                        </Button>
                        <Button
                          onClick={handleTestConnection}
                          loading={testingConnection}
                        >
                          测试连接
                        </Button>
                      </Space>
                    </Form.Item>

                    {connectionTestResult && (
                      <Alert
                        message={connectionTestResult.success ? '连接成功' : '连接失败'}
                        description={connectionTestResult.message}
                        type={connectionTestResult.success ? 'success' : 'error'}
                        showIcon
                        icon={connectionTestResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        closable
                        onClose={() => setConnectionTestResult(null)}
                      />
                    )}
                  </>
                );
              }}
            </Form.Item>
          </Form>

          <Divider />

          <Card title="🔑 关键词管理" variant="borderless" size="small">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                系统会自动为新建和编辑的待办提取关键词，用于智能推荐相关待办。
              </Text>
              <Button
                type="default"
                loading={generatingKeywords}
                onClick={handleBatchGenerateKeywords}
                block
              >
                {generatingKeywords ? '生成中...' : '为所有待办生成关键词'}
              </Button>
              <Text type="secondary" style={{ fontSize: 11 }}>
                💡 首次使用或导入数据后，建议点击此按钮为现有待办生成关键词
              </Text>
            </Space>
          </Card>
        </div>
      ),
    },
    {
      key: 'customTabs',
      label: (
        <span>
          <TagOutlined />
          自定义Tab
        </span>
      ),
      children: (
        <CustomTabManager
          visible={visible && activeTab === 'customTabs'}
          onClose={() => {}}
          customTabs={customTabs}
          onSave={(tabs) => {
            onSaveCustomTabs?.(tabs);
          }}
          existingTags={existingTags}
          embedded={true}
        />
      ),
    },
    {
      key: 'backup',
      label: (
        <span>
          <DatabaseOutlined />
          数据备份
        </span>
      ),
      children: <BackupSettings />,
    },
    {
      key: 'flowchart-migration',
      label: (
        <span>
          <ExportOutlined />
          流程图迁移
        </span>
      ),
      children: (
        <FlowchartMigrationPanel
          visible={visible && activeTab === 'flowchart-migration'}
          onClose={() => {}}
        />
      ),
    },
  ];

  return (
    <Modal
      title="应用设置"
      open={visible}
      onOk={activeTab === 'general' ? handleSubmit : onCancel}
      onCancel={onCancel}
      okText={activeTab === 'general' || activeTab === 'ai' ? '保存' : '关闭'}
      cancelText={(activeTab === 'general' || activeTab === 'ai') ? '取消' : undefined}
      width={800}
      styles={{ body: { padding: '16px 24px' } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </Modal>
  );
};

export default SettingsModal;

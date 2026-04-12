import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, Typography, Space, Tabs, Card, Tag, Divider, Input, Switch, Alert, Tooltip } from 'antd';
import { BulbOutlined, FolderOpenOutlined, DatabaseOutlined, TagOutlined, ThunderboltOutlined, RobotOutlined, CheckCircleOutlined, CloseCircleOutlined, ExportOutlined, LinkOutlined, BgColorsOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { Todo, CustomTab } from '../../shared/types';
import { ColorTheme } from '../theme/themes';
import TagManagement from './TagManagement';
import BackupSettings from './BackupSettings';
import CustomTabManager from './CustomTabManager';
import URLAuthorizationManager from './URLAuthorizationManager';
import PromptTemplateManager from './PromptTemplateManager';

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
  colorTheme = 'purple',
  onColorThemeChange,
  promptTemplates = [],
  onTemplatesChange,
  onAIConfigUpdate
}) => {
  const [form] = Form.useForm();
  const [aiForm] = Form.useForm();
  const { message } = App.useApp();
  const [dbPath, setDbPath] = useState<string>('加载中...');
  const [activeTab, setActiveTab] = useState('general');
  const [aiProviders, setAiProviders] = useState<Array<{value: string; label: string; endpoint: string}>>([]);
  const [aiModels, setAiModels] = useState<Array<{id: string; name: string; description?: string}>>([]);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchModelsError, setFetchModelsError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{success: boolean; message: string} | null>(null);
  const [generatingKeywords, setGeneratingKeywords] = useState(false);
  const [localColorTheme, setLocalColorTheme] = useState<ColorTheme>(colorTheme);
  const [localPromptTemplates, setLocalPromptTemplates] = useState(promptTemplates);

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        theme: settings.theme || 'light',
        calendarViewSize: settings.calendarViewSize || 'compact',
        colorTheme: settings.colorTheme || 'purple',
      });
      setLocalColorTheme((settings.colorTheme as ColorTheme) || 'purple');

      // 加载AI配置
      const aiConfigToLoad = {
        ai_provider: settings.ai_provider || 'disabled',
        ai_api_key: settings.ai_api_key || '',
        ai_api_endpoint: settings.ai_api_endpoint || '',
        ai_model: settings.ai_model || '', // ✅ 修复：添加ai_model字段加载
        ai_enabled: settings.ai_enabled === 'true',
      };

      console.log('[SettingsModal] 加载AI配置到表单:', {
        ...aiConfigToLoad,
        ai_api_key: aiConfigToLoad.ai_api_key ? '***' : '(empty)'
      });

      aiForm.setFieldsValue(aiConfigToLoad);

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

      // 主动加载 Prompt 模板（作为后备）
      window.electronAPI.promptTemplates.getAll().then((templates) => {
        setLocalPromptTemplates(templates);
      }).catch(() => {
        console.error('Failed to load prompt templates in SettingsModal');
      });
    }
  }, [visible, settings, form, aiForm]);

  // 同步外部 promptTemplates 的变化到本地状态
  useEffect(() => {
    if (promptTemplates && promptTemplates.length > 0) {
      setLocalPromptTemplates(promptTemplates);
    }
  }, [promptTemplates]);

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

      console.log('[SettingsModal] 保存AI配置，验证后的表单值:', {
        ...values,
        ai_api_key: values.ai_api_key ? '***' : '(empty)',
        ai_api_key_length: values.ai_api_key?.length || 0,
        ai_model_length: values.ai_model?.length || 0
      });

      const result = await window.electronAPI.ai.configure(
        values.ai_provider,
        values.ai_api_key || '',
        values.ai_api_endpoint || '',
        values.ai_model || ''
      );

      if (result.success) {
        // ✅ 验证保存后的AI服务状态
        const aiConfigAfterSave = await window.electronAPI.ai.getConfig();
        console.log('[SettingsModal] 保存后的AI服务状态:', {
          ...aiConfigAfterSave,
          apiKey: aiConfigAfterSave.enabled ? '***' : '(empty)'
        });

        if (!aiConfigAfterSave.enabled) {
          console.error('[SettingsModal] ⚠️  警告：配置保存后AI服务仍未启用！');
          message.warning('AI配置已保存，但服务可能未正确启用，请检查配置');
        }

        // 更新父组件的settings状态，保持UI同步
        if (onAIConfigUpdate) {
          const settingsToUpdate = {
            ai_provider: values.ai_provider,
            ai_api_key: values.ai_api_key || '',
            ai_api_endpoint: values.ai_api_endpoint || '',
            ai_model: values.ai_model || '',
            ai_enabled: values.ai_provider !== 'disabled' && values.ai_api_key ? 'true' : 'false'
          };
          console.log('[SettingsModal] 更新父组件settings状态:', {
            ...settingsToUpdate,
            ai_api_key: settingsToUpdate.ai_api_key ? '***' : '(empty)'
          });
          await onAIConfigUpdate(settingsToUpdate);
        }

        message.success('AI配置已保存');
        setConnectionTestResult(null); // 清除测试结果
      } else {
        message.error('保存失败: ' + result.error);
      }
    } catch (error) {
      console.error('[SettingsModal] 保存AI配置失败:', error);
      message.error('保存失败: ' + (error as Error).message);
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
        values.ai_api_endpoint || '',
        values.ai_model || ''
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

  const handleProviderChange = async (provider: string) => {
    setConnectionTestResult(null);
    setFetchModelsError(null);

    if (provider === 'disabled') {
      setAiModels([]);
      aiForm.setFieldsValue({ ai_model: '' });
      return;
    }

    try {
      const models = await window.electronAPI.ai.getAvailableModels(provider);
      setAiModels(models);

      // 自动选择第一个模型作为默认值
      if (models.length > 0) {
        aiForm.setFieldsValue({ ai_model: models[0].id });
      } else {
        aiForm.setFieldsValue({ ai_model: '' });
      }
    } catch (error) {
      console.error('Failed to load models for provider:', error);
      setAiModels([]);
      aiForm.setFieldsValue({ ai_model: '' });
    }
  };

  const handleFetchModels = async () => {
    const provider = aiForm.getFieldValue('ai_provider');
    const apiKey = aiForm.getFieldValue('ai_api_key');
    const endpoint = aiForm.getFieldValue('ai_api_endpoint');

    if (!provider || provider === 'disabled') {
      message.warning('请先选择AI服务提供商');
      return;
    }

    if (!apiKey) {
      message.warning('请先输入API Key');
      return;
    }

    setFetchingModels(true);
    setFetchModelsError(null);

    try {
      const result = await window.electronAPI.ai.fetchModels(provider, apiKey, endpoint);

      if (result.success) {
        // 转换为UI需要的格式（添加description字段）
        const modelsWithDescription = result.models.map(m => ({
          id: m.id,
          name: m.name,
          description: undefined // API返回的可能没有description
        }));

        setAiModels(modelsWithDescription);

        // 自动选择第一个模型
        if (modelsWithDescription.length > 0) {
          aiForm.setFieldsValue({ ai_model: modelsWithDescription[0].id });
          message.success(`成功获取 ${modelsWithDescription.length} 个可用模型`);
        } else {
          message.warning('未获取到任何模型，请检查API Key是否正确');
        }

        // 如果有警告信息（使用了fallback），显示出来
        if (result.error) {
          setFetchModelsError(result.error);
        }
      } else {
        message.error('获取模型失败: ' + (result.error || '未知错误'));
        if (result.error) {
          setFetchModelsError(result.error);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch models:', error);
      message.error('获取模型失败: ' + error.message);
      setFetchModelsError(error.message);
    } finally {
      setFetchingModels(false);
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
          name="colorTheme"
          label={
            <span>
              <BgColorsOutlined style={{ marginRight: 8 }} />
              主题颜色
            </span>
          }
          tooltip="选择您喜欢的主题颜色"
        >
          <ColorThemeSelector value={localColorTheme} onChange={(theme) => {
            setLocalColorTheme(theme);
            onColorThemeChange?.(theme);
          }} />
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
                onChange={(value) => {
                  setConnectionTestResult(null);
                  handleProviderChange(value);
                }}
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
                      label={
                        <Space>
                          <span>API Key</span>
                          <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
                            输入后点击"获取模型"按钮
                          </Text>
                        </Space>
                      }
                      rules={[{ required: provider !== 'disabled', message: '请输入API Key' }]}
                    >
                      <Space.Compact style={{ width: '100%' }}>
                        <Input.Password
                          placeholder="输入您的API Key"
                          onChange={() => {
                            setConnectionTestResult(null);
                            setFetchModelsError(null);
                          }}
                        />
                        <Button
                          onClick={handleFetchModels}
                          loading={fetchingModels}
                          disabled={!aiForm.getFieldValue('ai_api_key')}
                        >
                          获取模型
                        </Button>
                      </Space.Compact>
                    </Form.Item>

                    {fetchModelsError && (
                      <Alert
                        message={fetchModelsError.includes('使用默认列表') ? '提示' : '警告'}
                        description={fetchModelsError}
                        type={fetchModelsError.includes('使用默认列表') ? 'info' : 'warning'}
                        closable
                        onClose={() => setFetchModelsError(null)}
                        style={{ marginBottom: 16 }}
                      />
                    )}

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

                    <Form.Item
                      name="ai_model"
                      label="AI 模型"
                      tooltip={
                        aiModels.length === 0
                          ? '请先输入API Key并点击"获取模型"按钮'
                          : '选择要使用的AI模型'
                      }
                      rules={[{ required: true, message: '请选择AI模型' }]}
                    >
                      <Select
                        placeholder={aiModels.length === 0 ? '请先获取模型列表' : '选择AI模型'}
                        options={aiModels.map(m => ({
                          label: m.name,
                          value: m.id,
                          title: m.description
                        }))}
                        onChange={() => setConnectionTestResult(null)}
                        notFoundContent={
                          <span>
                            {fetchingModels ? '正在获取模型...' : '请先输入API Key并点击"获取模型"按钮'}
                          </span>
                        }
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
      key: 'promptTemplates',
      label: (
        <span>
          <BulbOutlined />
          Prompt 模板
        </span>
      ),
      children: (
        <PromptTemplateManager
          visible={visible && activeTab === 'promptTemplates'}
          onClose={() => {}}
          templates={localPromptTemplates}
          embedded={true}
          onReload={async () => {
            try {
              const templates = await window.electronAPI.promptTemplates.getAll();
              setLocalPromptTemplates(templates);
              // 通知 App 重新加载模板列表
              if (onTemplatesChange) {
                await onTemplatesChange();
              }
            } catch (error) {
              message.error('加载模板失败');
            }
          }}
        />
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
      key: 'urlAuthorization',
      label: (
        <span>
          <LinkOutlined />
          URL授权管理
        </span>
      ),
      children: <URLAuthorizationManager />,
    },
  ];

  return (
    <Modal
      title="应用设置"
      open={visible}
      onOk={activeTab === 'general' ? handleSubmit : onCancel}
      onCancel={onCancel}
      okText={activeTab === 'general' || activeTab === 'ai' ? '保存' : '关闭'}
      cancelText={(activeTab === 'general' || activeTab === 'ai' || activeTab === 'urlAuthorization') ? '取消' : undefined}
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

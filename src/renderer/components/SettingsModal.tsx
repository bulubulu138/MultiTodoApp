import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, Typography, Space, Tabs, Card, Tag, Divider } from 'antd';
import { BulbOutlined, FolderOpenOutlined, DatabaseOutlined, TagOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { Todo } from '../../shared/types';
import TagManagement from './TagManagement';

const { Text } = Typography;

interface SettingsModalProps {
  visible: boolean;
  settings: Record<string, string>;
  todos?: Todo[];
  onSave: (settings: Record<string, string>) => void;
  onCancel: () => void;
  onReload?: () => Promise<void>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  settings,
  todos = [],
  onSave,
  onCancel,
  onReload
}) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [dbPath, setDbPath] = useState<string>('加载中...');
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (visible) {
      form.setFieldsValue({
        theme: settings.theme || 'light',
        calendarViewSize: settings.calendarViewSize || 'compact',
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
    }
  }, [visible, settings, form]);

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
          <Card title="🚀 全局快捷键" bordered={false} style={{ marginBottom: 16 }}>
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
          
          <Card title="💡 系统托盘" bordered={false}>
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
  ];

  return (
    <Modal
      title="应用设置"
      open={visible}
      onOk={activeTab === 'general' ? handleSubmit : onCancel}
      onCancel={onCancel}
      okText={activeTab === 'general' ? '保存' : '关闭'}
      cancelText={activeTab === 'general' ? '取消' : undefined}
      width={800}
      bodyStyle={{ padding: '16px 24px' }}
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

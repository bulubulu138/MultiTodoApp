import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, Button, Typography, Space, Tabs } from 'antd';
import { BulbOutlined, FolderOpenOutlined, DatabaseOutlined, TagOutlined } from '@ant-design/icons';
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

import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, List, Space, Popconfirm, Select, App, Empty, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, DragOutlined, TagsOutlined } from '@ant-design/icons';
import { CustomTab } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';

const { Option } = Select;

interface CustomTabManagerProps {
  visible: boolean;
  onClose: () => void;
  customTabs: CustomTab[];
  onSave: (tabs: CustomTab[]) => void;
  existingTags: string[]; // 所有现有标签
}

const CustomTabManager: React.FC<CustomTabManagerProps> = ({
  visible,
  onClose,
  customTabs,
  onSave,
  existingTags
}) => {
  const { message } = App.useApp();
  const colors = useThemeColors();
  const [form] = Form.useForm();
  const [tabs, setTabs] = useState<CustomTab[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTabs([...customTabs]);
    }
  }, [visible, customTabs]);

  const handleAdd = () => {
    form.validateFields().then(values => {
      // 检查标签是否已存在
      if (tabs.some(t => t.tag === values.tag)) {
        message.warning(`标签"${values.tag}"已存在`);
        return;
      }

      const newTab: CustomTab = {
        id: `tab_${Date.now()}`,
        label: values.label,
        tag: values.tag,
        color: values.color,
        order: tabs.length
      };

      setTabs([...tabs, newTab]);
      form.resetFields();
      message.success('添加成功');
    });
  };

  const handleDelete = (id: string) => {
    setTabs(tabs.filter(t => t.id !== id));
    message.success('删除成功');
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newTabs = [...tabs];
    [newTabs[index - 1], newTabs[index]] = [newTabs[index], newTabs[index - 1]];
    // 更新order
    newTabs.forEach((tab, idx) => {
      tab.order = idx;
    });
    setTabs(newTabs);
  };

  const handleMoveDown = (index: number) => {
    if (index === tabs.length - 1) return;
    const newTabs = [...tabs];
    [newTabs[index], newTabs[index + 1]] = [newTabs[index + 1], newTabs[index]];
    // 更新order
    newTabs.forEach((tab, idx) => {
      tab.order = idx;
    });
    setTabs(newTabs);
  };

  const handleSave = () => {
    onSave(tabs);
    message.success('保存成功');
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <TagsOutlined />
          管理自定义标签Tab
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          保存
        </Button>
      ]}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 12, color: colors.textSecondary, fontSize: 13 }}>
          💡 提示：创建自定义Tab后，所有包含对应标签的待办都会显示在该Tab中
        </div>
        
        <Form form={form} layout="inline" style={{ marginBottom: 16 }}>
          <Form.Item
            name="label"
            rules={[{ required: true, message: '请输入Tab名称' }]}
            style={{ flex: 1, minWidth: 150 }}
          >
            <Input placeholder="Tab名称（如：Bug修复）" prefix={<TagsOutlined />} />
          </Form.Item>
          
          <Form.Item
            name="tag"
            rules={[{ required: true, message: '请选择或输入标签' }]}
            style={{ flex: 1, minWidth: 150 }}
          >
            <Select
              placeholder="选择或输入标签"
              showSearch
              allowClear
              mode="tags"
              maxCount={1}
              options={existingTags.map(tag => ({ label: tag, value: tag }))}
            />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              添加
            </Button>
          </Form.Item>
        </Form>

        {tabs.length === 0 ? (
          <Empty 
            description="还没有自定义Tab，添加一个吧！" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            size="small"
            dataSource={tabs}
            renderItem={(tab, index) => (
              <List.Item
                style={{
                  padding: '12px',
                  background: colors.cardBg,
                  marginBottom: 8,
                  borderRadius: 6,
                  border: `1px solid ${colors.borderColor}`
                }}
              >
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <DragOutlined style={{ color: colors.textSecondary, cursor: 'move' }} />
                    <Tag color="blue">{tab.label}</Tag>
                    <Tag color="orange">{tab.tag}</Tag>
                  </Space>
                  
                  <Space size={4}>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === tabs.length - 1}
                    >
                      ↓
                    </Button>
                    <Popconfirm
                      title="确定删除此Tab吗？"
                      onConfirm={() => handleDelete(tab.id)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button 
                        type="text" 
                        size="small" 
                        danger 
                        icon={<DeleteOutlined />}
                      />
                    </Popconfirm>
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        )}
      </div>
    </Modal>
  );
};

export default CustomTabManager;


import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Table, Space, Popconfirm, message, Card, Tag, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BulbOutlined } from '@ant-design/icons';
import { PromptTemplate } from '../../shared/types';

const { TextArea } = Input;
const { Text } = Typography;

interface PromptTemplateManagerProps {
  visible: boolean;
  onClose: () => void;
  templates: PromptTemplate[];
  onReload: () => Promise<void>;
  embedded?: boolean; // 是否嵌入在其他Modal中（如SettingsModal）
}

const PromptTemplateManager: React.FC<PromptTemplateManagerProps> = ({
  visible,
  onClose,
  templates,
  onReload,
  embedded = false
}) => {
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // 重置表单
  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      form.resetFields();
    }
  }, [visible, form]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      await window.electronAPI.promptTemplates.create({
        name: values.name,
        content: values.content,
        category: values.category || 'general'
      });

      message.success('创建成功');
      form.resetFields();
      await onReload();
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误，不显示消息
        return;
      }
      message.error('创建失败: ' + (error.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;

    try {
      const values = await form.validateFields();
      setSaving(true);

      await window.electronAPI.promptTemplates.update(editingId, {
        name: values.name,
        content: values.content,
        category: values.category
      });

      message.success('更新成功');
      setEditingId(null);
      form.resetFields();
      await onReload();
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误，不显示消息
        return;
      }
      message.error('更新失败: ' + (error.message || '未知错误'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await window.electronAPI.promptTemplates.delete(id);
      message.success('删除成功');
      await onReload();
    } catch (error: any) {
      message.error('删除失败: ' + (error.message || '未知错误'));
    }
  };

  const handleEdit = (record: PromptTemplate) => {
    setEditingId(record.id!);
    form.setFieldsValue(record);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    form.resetFields();
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (category: string) => {
        const colors: Record<string, string> = {
          general: 'blue',
          planning: 'green',
          analysis: 'orange',
          improvement: 'red',
          custom: 'purple'
        };
        const labels: Record<string, string> = {
          general: '通用',
          planning: '规划',
          analysis: '分析',
          improvement: '改进',
          custom: '自定义'
        };
        return <Tag color={colors[category]}>{labels[category] || category}</Tag>;
      }
    },
    {
      title: '内容预览',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Text ellipsis={{ tooltip: content }} style={{ maxWidth: 300 }}>
          {content}
        </Text>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: PromptTemplate) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除此模板吗？"
            onConfirm={() => handleDelete(record.id!)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 准备内容
  const content = (
    <>
      <Card title={editingId ? "编辑模板" : "创建新模板"} size="small" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={editingId ? handleUpdate : handleCreate}
        >
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：任务规划建议" />
          </Form.Item>

          <Form.Item
            name="category"
            label="分类"
            initialValue="general"
          >
            <Select>
              <Select.Option value="general">通用</Select.Option>
              <Select.Option value="planning">规划</Select.Option>
              <Select.Option value="analysis">分析</Select.Option>
              <Select.Option value="improvement">改进</Select.Option>
              <Select.Option value="custom">自定义</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="content"
            label="Prompt内容"
            rules={[{ required: true, message: '请输入Prompt内容' }]}
            extra="可使用 {title} 和 {content} 作为待办标题和内容的占位符"
          >
            <TextArea
              rows={6}
              placeholder="请输入Prompt模板内容...&#10;例如：你是一个专业的任务助手。请为以下待办事项提供详细的解决方案建议：&#10;标题：{title}&#10;内容：{content}"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                {editingId ? '更新' : '创建'}
              </Button>
              {editingId && (
                <Button onClick={handleCancelEdit}>
                  取消
                </Button>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Table
        dataSource={templates}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 个模板`
        }}
      />
    </>
  );

  // 嵌入模式：直接返回内容，不包装Modal
  if (embedded) {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <BulbOutlined />
            <span style={{ fontSize: 16, fontWeight: 500 }}>Prompt 模板管理</span>
          </Space>
        </div>
        {content}
      </div>
    );
  }

  // 独立模式：使用Modal包装
  return (
    <Modal
      title="Prompt 模板管理"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
      destroyOnClose
    >
      {content}
    </Modal>
  );
};

export default PromptTemplateManager;

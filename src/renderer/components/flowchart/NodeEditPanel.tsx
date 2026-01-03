import React, { useState, useEffect } from 'react';
import { Drawer, Form, Input, ColorPicker, Select, InputNumber, Button, Space, Divider, Tag, Switch } from 'antd';
import { Color } from 'antd/es/color-picker';
import { RuntimeNodeData, Todo } from '../../../shared/types';

interface NodeEditPanelProps {
  visible: boolean;
  nodeData: RuntimeNodeData | null;
  todos: Todo[];
  onClose: () => void;
  onSave: (updates: Partial<RuntimeNodeData>) => void;
}

/**
 * NodeEditPanel - 节点编辑面板
 * 
 * 提供节点属性编辑功能（文本、样式）
 */
export const NodeEditPanel: React.FC<NodeEditPanelProps> = ({
  visible,
  nodeData,
  todos,
  onClose,
  onSave
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (nodeData) {
      const style = nodeData.computedStyle || nodeData.style || {};
      form.setFieldsValue({
        label: nodeData.label,
        todoId: nodeData.todoId || undefined,
        isLocked: nodeData.isLocked || false,
        backgroundColor: style.backgroundColor || '#ffffff',
        borderColor: style.borderColor || '#d9d9d9',
        borderWidth: style.borderWidth || 2,
        borderStyle: style.borderStyle || 'solid',
        fontSize: style.fontSize || 14
      });
    }
  }, [nodeData, form]);

  const handleSave = () => {
    const values = form.getFieldsValue();
    
    // 调试日志：记录保存的 todoId
    console.log('[NodeEditPanel] Saving node with todoId:', values.todoId, 'type:', typeof values.todoId);
    
    const updates: Partial<RuntimeNodeData> = {
      label: values.label,
      todoId: values.todoId || undefined,
      isLocked: values.isLocked || false,
      computedStyle: {
        backgroundColor: typeof values.backgroundColor === 'string' 
          ? values.backgroundColor 
          : (values.backgroundColor as Color).toHexString(),
        borderColor: typeof values.borderColor === 'string'
          ? values.borderColor
          : (values.borderColor as Color).toHexString(),
        borderWidth: values.borderWidth,
        borderStyle: values.borderStyle,
        fontSize: values.fontSize
      }
    };

    console.log('[NodeEditPanel] Final updates object:', updates);
    onSave(updates);
    onClose();
  };

  // 获取待办任务的状态标签
  const getStatusTag = (status: Todo['status']) => {
    const statusMap = {
      pending: { color: 'default', text: '待办' },
      in_progress: { color: 'processing', text: '进行中' },
      completed: { color: 'success', text: '已完成' },
      paused: { color: 'warning', text: '已暂停' }
    };
    const config = statusMap[status];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  // 获取优先级标签
  const getPriorityTag = (priority: Todo['priority']) => {
    const priorityMap = {
      low: { color: 'blue', text: '低' },
      medium: { color: 'orange', text: '中' },
      high: { color: 'red', text: '高' }
    };
    const config = priorityMap[priority];
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <Drawer
      title="编辑节点"
      placement="right"
      width={360}
      open={visible}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            保存
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Form.Item
          label="节点文本"
          name="label"
          rules={[{ required: true, message: '请输入节点文本' }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="输入节点文本"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </Form.Item>

        <Divider>关联待办</Divider>

        <Form.Item
          label="选择待办任务"
          name="todoId"
          help="关联待办任务后，节点将显示任务信息并自动同步状态"
        >
          <Select
            placeholder="选择待办任务（可选）"
            allowClear
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={todos.map(todo => ({
              value: String(todo.id),
              label: todo.title,
              todo: todo
            }))}
            optionRender={(option) => {
              const todo = (option.data as any).todo as Todo;
              return (
                <div>
                  <div>{todo.title}</div>
                  <Space size={4} style={{ marginTop: 4 }}>
                    {getStatusTag(todo.status)}
                    {getPriorityTag(todo.priority)}
                  </Space>
                </div>
              );
            }}
          />
        </Form.Item>

        <Divider>样式设置</Divider>

        <Form.Item
          label="锁定位置"
          name="isLocked"
          valuePropName="checked"
          help="锁定后节点无法移动，但可以编辑内容"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          label="背景颜色"
          name="backgroundColor"
        >
          <ColorPicker
            showText
            format="hex"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label="边框颜色"
          name="borderColor"
        >
          <ColorPicker
            showText
            format="hex"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label="边框宽度"
          name="borderWidth"
        >
          <InputNumber
            min={1}
            max={10}
            style={{ width: '100%' }}
            addonAfter="px"
          />
        </Form.Item>

        <Form.Item
          label="边框样式"
          name="borderStyle"
        >
          <Select>
            <Select.Option value="solid">实线</Select.Option>
            <Select.Option value="dashed">虚线</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          label="字体大小"
          name="fontSize"
        >
          <InputNumber
            min={10}
            max={32}
            style={{ width: '100%' }}
            addonAfter="px"
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

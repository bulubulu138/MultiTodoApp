import React, { useState } from 'react';
import { Button, Space, Dropdown, message, Typography, Input, Select } from 'antd';
import {
  SaveOutlined,
  DownloadOutlined,
  PictureOutlined,
  UndoOutlined,
  RedoOutlined,
  PlusOutlined,
  ShareAltOutlined,
  EditOutlined,
  CheckOutlined,
  CloseOutlined,
  LinkOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Todo } from '../../../shared/types';

const { Title } = Typography;
const { Option } = Select;

interface FlowchartToolbarProps {
  flowchartName?: string;
  flowchartId?: string;
  todos?: Todo[];
  onNameChange?: (newName: string) => void;
  onSave: () => void;
  onExport: (format: 'json' | 'mermaid' | 'text' | 'png') => void;
  onShare: (action: 'link' | 'image') => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewFlowchart: () => void;
  canUndo: boolean;
  canRedo: boolean;
  isSaving?: boolean;
}

/**
 * FlowchartToolbar - 流程图工具栏
 * 
 * 提供保存、导出、自动布局等功能按钮
 */
export const FlowchartToolbar: React.FC<FlowchartToolbarProps> = ({
  flowchartName,
  flowchartId,
  todos = [],
  onNameChange,
  onSave,
  onExport,
  onShare,
  onUndo,
  onRedo,
  onNewFlowchart,
  canUndo,
  canRedo,
  isSaving = false
}) => {
  // 获取当前主题
  const [theme, setTheme] = React.useState(document.documentElement.dataset.theme || 'light');
  
  // 编辑名称状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  
  // 待办关联状态
  const [associatedTodoIds, setAssociatedTodoIds] = useState<number[]>([]);
  const [loadingAssociations, setLoadingAssociations] = useState(false);
  
  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      const newTheme = document.documentElement.dataset.theme || 'light';
      setTheme(newTheme);
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    
    return () => observer.disconnect();
  }, []);

  // 加载已关联的待办
  React.useEffect(() => {
    if (flowchartId) {
      loadAssociatedTodos();
    }
  }, [flowchartId]);

  const loadAssociatedTodos = async () => {
    if (!flowchartId) return;
    
    try {
      setLoadingAssociations(true);
      const todoIds = await window.electronAPI.flowchartTodoAssociation.queryByFlowchart(flowchartId);
      setAssociatedTodoIds(todoIds);
    } catch (error) {
      console.error('加载关联待办失败:', error);
    } finally {
      setLoadingAssociations(false);
    }
  };

  // 处理待办关联
  const handleTodoAssociation = async (todoId: number, checked: boolean) => {
    if (!flowchartId) return;
    
    try {
      if (checked) {
        await window.electronAPI.flowchartTodoAssociation.create(flowchartId, todoId);
        setAssociatedTodoIds(prev => [...prev, todoId]);
        message.success('已关联待办');
      } else {
        await window.electronAPI.flowchartTodoAssociation.delete(flowchartId, todoId);
        setAssociatedTodoIds(prev => prev.filter(id => id !== todoId));
        message.success('已取消关联');
      }
    } catch (error) {
      console.error('关联操作失败:', error);
      message.error('操作失败，请重试');
    }
  };

  // 开始编辑名称
  const handleStartEdit = () => {
    setEditingName(flowchartName || '');
    setIsEditingName(true);
  };

  // 确认编辑
  const handleConfirmEdit = () => {
    const trimmedName = editingName.trim();
    if (trimmedName && trimmedName !== flowchartName) {
      onNameChange?.(trimmedName);
      message.success('流程图名称已更新');
    }
    setIsEditingName(false);
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setIsEditingName(false);
    setEditingName('');
  };

  // 处理回车键
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirmEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  // 导出菜单
  const exportMenuItems: MenuProps['items'] = [
    {
      key: 'json',
      label: 'JSON 格式',
      icon: <DownloadOutlined />,
      onClick: () => onExport('json')
    },
    {
      key: 'mermaid',
      label: 'Mermaid 格式',
      icon: <DownloadOutlined />,
      onClick: () => onExport('mermaid')
    },
    {
      key: 'text',
      label: '纯文本格式',
      icon: <DownloadOutlined />,
      onClick: () => onExport('text')
    },
    {
      type: 'divider'
    },
    {
      key: 'png',
      label: '导出为图片',
      icon: <PictureOutlined />,
      onClick: () => onExport('png')
    }
  ];

  // 分享菜单
  const shareMenuItems: MenuProps['items'] = [
    {
      key: 'link',
      label: '生成分享链接',
      icon: <ShareAltOutlined />,
      onClick: () => onShare('link')
    },
    {
      key: 'image',
      label: '导出为图片',
      icon: <PictureOutlined />,
      onClick: () => onShare('image')
    }
  ];

  return (
    <div
      style={{
        padding: '8px 16px',
        borderBottom: `1px solid ${theme === 'dark' ? '#404040' : '#f0f0f0'}`,
        backgroundColor: theme === 'dark' ? '#1f1f1f' : '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <Space>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onNewFlowchart}
        >
          新建流程图
        </Button>

        {/* 流程图名称编辑 */}
        {flowchartName && (
          <Space>
            {isEditingName ? (
              <>
                <Input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onPressEnter={handleConfirmEdit}
                  style={{ width: 200 }}
                  autoFocus
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={handleConfirmEdit}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleCancelEdit}
                />
              </>
            ) : (
              <>
                <Title level={5} style={{ 
                  margin: 0, 
                  display: 'inline-block',
                  color: theme === 'dark' ? '#e8e8e8' : undefined
                }}>
                  {flowchartName}
                </Title>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={handleStartEdit}
                  title="编辑名称"
                />
              </>
            )}
          </Space>
        )}

        {/* 待办关联选择器 */}
        {flowchartId && todos.length > 0 && (
          <Select
            mode="multiple"
            placeholder="关联待办事项"
            style={{ minWidth: 200, maxWidth: 400 }}
            value={associatedTodoIds}
            onChange={(selectedIds) => {
              // 找出新增和删除的ID
              const added = selectedIds.filter(id => !associatedTodoIds.includes(id));
              const removed = associatedTodoIds.filter(id => !selectedIds.includes(id));
              
              // 处理新增
              added.forEach(id => handleTodoAssociation(id, true));
              // 处理删除
              removed.forEach(id => handleTodoAssociation(id, false));
            }}
            loading={loadingAssociations}
            maxTagCount={2}
            suffixIcon={<LinkOutlined />}
            filterOption={(input, option) => {
              const todo = todos.find(t => t.id === option?.value);
              if (!todo) return false;
              const searchText = input.toLowerCase();
              return (
                todo.title.toLowerCase().includes(searchText) ||
                (todo.content?.toLowerCase().includes(searchText) || false)
              );
            }}
          >
            {todos.map(todo => (
              <Option key={todo.id} value={todo.id!}>
                <Space>
                  <span>{todo.title}</span>
                  {todo.status === 'completed' && (
                    <span style={{ color: '#52c41a', fontSize: 12 }}>✓</span>
                  )}
                </Space>
              </Option>
            ))}
          </Select>
        )}

        <Button
          icon={<SaveOutlined />}
          onClick={onSave}
          loading={isSaving}
        >
          保存
        </Button>

        <Dropdown menu={{ items: exportMenuItems }} placement="bottomLeft">
          <Button icon={<DownloadOutlined />}>
            导出
          </Button>
        </Dropdown>

        <Dropdown menu={{ items: shareMenuItems }} placement="bottomLeft">
          <Button icon={<ShareAltOutlined />}>
            分享
          </Button>
        </Dropdown>
      </Space>

      <Space>
        <Button
          icon={<UndoOutlined />}
          onClick={onUndo}
          disabled={!canUndo}
          title="撤销 (Ctrl+Z)"
        />

        <Button
          icon={<RedoOutlined />}
          onClick={onRedo}
          disabled={!canRedo}
          title="重做 (Ctrl+Y)"
        />
      </Space>
    </div>
  );
};

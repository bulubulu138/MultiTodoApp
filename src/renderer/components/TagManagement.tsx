import React, { useState, useMemo } from 'react';
import { Table, Tag, Button, Space, Input, Card, Statistic, Popconfirm, Modal, Form, App, Empty } from 'antd';
import { TagOutlined, EditOutlined, DeleteOutlined, MergeCellsOutlined } from '@ant-design/icons';
import { Todo } from '../../shared/types';

interface TagInfo {
  name: string;
  count: number;
  todoIds: number[];
}

interface TagManagementProps {
  todos: Todo[];
  onReload: () => Promise<void>;
}

const TagManagement: React.FC<TagManagementProps> = ({ todos, onReload }) => {
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [currentTag, setCurrentTag] = useState<TagInfo | null>(null);
  const [renameForm] = Form.useForm();
  const [mergeForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 提取标签统计信息
  const tagStats = useMemo((): TagInfo[] => {
    const tagMap: Record<string, number[]> = {};
    
    todos.forEach(todo => {
      if (todo.tags && todo.id !== undefined) {
        todo.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed && todo.id !== undefined) {
            if (!tagMap[trimmed]) {
              tagMap[trimmed] = [];
            }
            tagMap[trimmed].push(todo.id!);
          }
        });
      }
    });
    
    return Object.entries(tagMap)
      .map(([name, todoIds]) => ({
        name,
        count: todoIds.length,
        todoIds,
      }))
      .sort((a, b) => b.count - a.count); // 按使用频率排序
  }, [todos]);

  // 搜索过滤
  const filteredTags = useMemo(() => {
    if (!searchText) return tagStats;
    return tagStats.filter(tag => 
      tag.name.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [tagStats, searchText]);

  // 重命名标签
  const handleRename = (tag: TagInfo) => {
    setCurrentTag(tag);
    renameForm.setFieldsValue({ newName: tag.name });
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async () => {
    try {
      const values = await renameForm.validateFields();
      const newName = values.newName.trim();
      
      if (!newName) {
        message.error('标签名称不能为空');
        return;
      }
      
      if (newName === currentTag?.name) {
        message.info('标签名称未改变');
        setShowRenameModal(false);
        return;
      }
      
      // 检查新名称是否已存在
      if (tagStats.some(t => t.name === newName && t.name !== currentTag?.name)) {
        message.error(`标签"${newName}"已存在，请选择其他名称或使用合并功能`);
        return;
      }
      
      setLoading(true);
      
      // 更新所有相关待办
      const affectedTodos = todos.filter(todo => 
        currentTag?.todoIds.includes(todo.id!)
      );
      
      for (const todo of affectedTodos) {
        const tags = todo.tags.split(',').map(t => t.trim());
        const updatedTags = tags.map(t => t === currentTag?.name ? newName : t);
        
        await window.electronAPI.todo.update(todo.id!, {
          tags: updatedTags.join(',')
        });
      }
      
      await onReload();
      message.success(`标签"${currentTag?.name}"已重命名为"${newName}"`);
      setShowRenameModal(false);
      setCurrentTag(null);
    } catch (error) {
      message.error('重命名失败');
      console.error('Rename error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 删除标签
  const handleDelete = async (tagName: string) => {
    try {
      setLoading(true);
      
      const tagInfo = tagStats.find(t => t.name === tagName);
      if (!tagInfo) return;
      
      const affectedTodos = todos.filter(todo => tagInfo.todoIds.includes(todo.id!));
      
      for (const todo of affectedTodos) {
        const tags = todo.tags.split(',').map(t => t.trim());
        const updatedTags = tags.filter(t => t !== tagName);
        
        await window.electronAPI.todo.update(todo.id!, {
          tags: updatedTags.join(',')
        });
      }
      
      await onReload();
      message.success(`标签"${tagName}"已删除`);
      
      // 清除选中状态
      setSelectedRowKeys(prev => prev.filter(key => key !== tagName));
    } catch (error) {
      message.error('删除失败');
      console.error('Delete error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 批量删除
  const handleBatchDelete = () => {
    Modal.confirm({
      title: '批量删除标签',
      content: `确定要删除选中的 ${selectedRowKeys.length} 个标签吗？这将从所有相关待办中移除这些标签。`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setLoading(true);
          
          for (const tagName of selectedRowKeys) {
            const tagInfo = tagStats.find(t => t.name === tagName);
            if (!tagInfo) continue;
            
            const affectedTodos = todos.filter(todo => tagInfo.todoIds.includes(todo.id!));
            
            for (const todo of affectedTodos) {
              const tags = todo.tags.split(',').map(t => t.trim());
              const updatedTags = tags.filter(t => t !== tagName);
              
              await window.electronAPI.todo.update(todo.id!, {
                tags: updatedTags.join(',')
              });
            }
          }
          
          await onReload();
          message.success(`已删除 ${selectedRowKeys.length} 个标签`);
          setSelectedRowKeys([]);
        } catch (error) {
          message.error('批量删除失败');
          console.error('Batch delete error:', error);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 合并标签
  const handleMerge = () => {
    if (selectedRowKeys.length < 2) {
      message.warning('请至少选择2个标签进行合并');
      return;
    }
    
    mergeForm.setFieldsValue({ mergedName: selectedRowKeys[0] });
    setShowMergeModal(true);
  };

  const handleMergeSubmit = async () => {
    try {
      const values = await mergeForm.validateFields();
      const mergedName = values.mergedName.trim();
      
      if (!mergedName) {
        message.error('合并后的标签名称不能为空');
        return;
      }
      
      setLoading(true);
      
      // 收集所有受影响的待办
      const affectedTodoIds = new Set<number>();
      selectedRowKeys.forEach(tagName => {
        const tagInfo = tagStats.find(t => t.name === tagName);
        if (tagInfo) {
          tagInfo.todoIds.forEach(id => affectedTodoIds.add(id));
        }
      });
      
      const affectedTodos = todos.filter(todo => affectedTodoIds.has(todo.id!));
      
      for (const todo of affectedTodos) {
        const tags = todo.tags.split(',').map(t => t.trim());
        const updatedTags = tags.map(t => 
          selectedRowKeys.includes(t) ? mergedName : t
        );
        // 去重
        const uniqueTags = Array.from(new Set(updatedTags));
        
        await window.electronAPI.todo.update(todo.id!, {
          tags: uniqueTags.join(',')
        });
      }
      
      await onReload();
      message.success(`已将 ${selectedRowKeys.length} 个标签合并为"${mergedName}"`);
      setShowMergeModal(false);
      setSelectedRowKeys([]);
    } catch (error) {
      message.error('合并失败');
      console.error('Merge error:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '标签名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Tag color="blue">{name}</Tag>,
    },
    {
      title: '使用次数',
      dataIndex: 'count',
      key: 'count',
      sorter: (a: TagInfo, b: TagInfo) => a.count - b.count,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: TagInfo) => (
        <Space size="small">
          <Button 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleRename(record)}
          >
            重命名
          </Button>
          <Popconfirm
            title="确定删除此标签吗？"
            description={`这将从 ${record.count} 个待办中移除此标签`}
            onConfirm={() => handleDelete(record.name)}
            okText="确定"
            cancelText="取消"
          >
            <Button 
              size="small" 
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 统计信息 */}
      <Card style={{ marginBottom: 16 }}>
        <Statistic
          title="标签总数"
          value={tagStats.length}
          prefix={<TagOutlined />}
        />
      </Card>

      {/* 搜索和批量操作 */}
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索标签..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          style={{ width: 300 }}
          allowClear
        />
        <Space>
          <Button
            icon={<MergeCellsOutlined />}
            onClick={handleMerge}
            disabled={selectedRowKeys.length < 2}
          >
            批量合并 ({selectedRowKeys.length})
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            批量删除 ({selectedRowKeys.length})
          </Button>
        </Space>
      </Space>

      {/* 标签列表 */}
      <Table
        columns={columns}
        dataSource={filteredTags}
        rowKey="name"
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个标签`,
        }}
        locale={{
          emptyText: <Empty description="暂无标签" />
        }}
      />

      {/* 重命名对话框 */}
      <Modal
        title="重命名标签"
        open={showRenameModal}
        onOk={handleRenameSubmit}
        onCancel={() => {
          setShowRenameModal(false);
          setCurrentTag(null);
        }}
        okText="确定"
        cancelText="取消"
        confirmLoading={loading}
      >
        <Form form={renameForm} layout="vertical">
          <Form.Item label="当前标签">
            <Tag color="blue">{currentTag?.name}</Tag>
            <span style={{ marginLeft: 8, color: '#666' }}>
              (使用于 {currentTag?.count} 个待办)
            </span>
          </Form.Item>
          <Form.Item
            name="newName"
            label="新名称"
            rules={[{ required: true, message: '请输入新的标签名称' }]}
          >
            <Input placeholder="输入新的标签名称" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 合并对话框 */}
      <Modal
        title="合并标签"
        open={showMergeModal}
        onOk={handleMergeSubmit}
        onCancel={() => setShowMergeModal(false)}
        okText="确定"
        cancelText="取消"
        confirmLoading={loading}
        width={600}
      >
        <Form form={mergeForm} layout="vertical">
          <Form.Item label="选择要合并的标签">
            <div style={{ marginBottom: 8 }}>
              {selectedRowKeys.map(tagName => {
                const tagInfo = tagStats.find(t => t.name === tagName);
                return (
                  <Tag key={tagName} color="blue" style={{ marginBottom: 4 }}>
                    {tagName} ({tagInfo?.count})
                  </Tag>
                );
              })}
            </div>
            <div style={{ color: '#666', fontSize: 12 }}>
              影响范围：{Array.from(new Set(
                selectedRowKeys.flatMap(tagName => 
                  tagStats.find(t => t.name === tagName)?.todoIds || []
                )
              )).length} 个待办事项
            </div>
          </Form.Item>
          <Form.Item
            name="mergedName"
            label="合并为"
            rules={[{ required: true, message: '请输入合并后的标签名称' }]}
          >
            <Input placeholder="输入合并后的标签名称" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TagManagement;


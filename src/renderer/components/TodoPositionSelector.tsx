import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Tree, Input, Button, Space, Tag, message, Spin, Radio } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { Todo, TodoTreeNode, TreeRelationData } from '../../shared/types';

interface TodoPositionSelectorProps {
  visible: boolean;
  todos: Todo[];
  onClose: () => void;
  onConfirm: (selection: PositionSelection) => void;
}

export interface PositionSelection {
  mode: 'root' | 'child' | 'extends' | 'parallel';
  targetTodoId?: number;
  relationType?: 'extends' | 'background' | 'parallel';
}

interface TreeDataNode {
  title: React.ReactNode;
  key: string;
  children?: TreeDataNode[];
  todo: Todo;
}

const TodoPositionSelector: React.FC<TodoPositionSelectorProps> = ({
  visible,
  todos,
  onClose,
  onConfirm
}) => {
  const [searchValue, setSearchValue] = useState('');
  const [treeData, setTreeData] = useState<TreeDataNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'root' | 'relative'>('root');
  const [selectedTodoId, setSelectedTodoId] = useState<number | null>(null);
  const [selectedRelationType, setSelectedRelationType] = useState<'extends' | 'parallel'>('extends');
  const [treeRelationData, setTreeRelationData] = useState<TreeRelationData | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  // 加载树形数据
  useEffect(() => {
    if (visible) {
      loadTreeData();
    }
  }, [visible]);

  const loadTreeData = async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.relations.buildTree();
      setTreeRelationData(data);
      buildTreeDataFromData(data);
    } catch (error) {
      console.error('Error loading tree data:', error);
      message.error('加载树形数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 从后端数据构建树形数据
  const buildTreeDataFromData = (data: TreeRelationData) => {
    const convertNode = (node: TodoTreeNode): TreeDataNode => {
      return {
        key: node.key,
        title: (
          <Space>
            <span>{node.title}</span>
            <Tag color={getStatusColor(node.todo.status)}>{getStatusLabel(node.todo.status)}</Tag>
          </Space>
        ),
        todo: node.todo,
        children: node.children ? node.children.map(convertNode) : undefined
      };
    };

    const nodes = data.roots.map(convertNode);
    setTreeData(nodes);

    // 默认展开所有节点
    const getAllKeys = (nodes: TreeDataNode[]): React.Key[] => {
      const keys: React.Key[] = [];
      nodes.forEach(node => {
        keys.push(node.key);
        if (node.children) {
          keys.push(...getAllKeys(node.children));
        }
      });
      return keys;
    };

    setExpandedKeys(getAllKeys(nodes));
  };

  // 过滤树形数据（基于搜索值）
  const filteredTreeData = useMemo(() => {
    if (!searchValue) {
      return treeData;
    }

    const filterTree = (nodes: TreeDataNode[]): TreeDataNode[] => {
      return nodes.reduce<TreeDataNode[]>((acc, node) => {
      const matchesSearch = node.todo.title.toLowerCase().includes(searchValue.toLowerCase());
      const hasMatchingChildren = node.children ? filterTree(node.children).length > 0 : false;

        if (matchesSearch || hasMatchingChildren) {
        acc.push({
            ...node,
            children: node.children ? filterTree(node.children) : undefined
          });
        }

        return acc;
      }, []);
    };

    return filterTree(treeData);
  }, [treeData, searchValue]);

  const handleConfirm = () => {
    if (selectedMode === 'root') {
      onConfirm({ mode: 'root' });
    } else if (selectedTodoId) {
      if (selectedRelationType === 'extends') {
        onConfirm({
          mode: 'extends',
          targetTodoId: selectedTodoId,
          relationType: 'extends'
        });
      } else if (selectedRelationType === 'parallel') {
        onConfirm({
          mode: 'parallel',
          targetTodoId: selectedTodoId,
          relationType: 'parallel'
        });
      }
    } else {
      message.warning('请选择一个待办');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      default: return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '待办';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      default: return status;
    }
  };

  const handleTreeSelect = (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length > 0) {
      setSelectedTodoId(Number(selectedKeys[0]));
    }
  };

  const handleExpand = (expandedKeys: React.Key[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  return (
    <Modal
      title="选择新待办的位置"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>取消</Button>,
        <Button key="confirm" type="primary" onClick={handleConfirm}>
          下一步
        </Button>
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 搜索栏 */}
        <Input
          placeholder="搜索待办..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          allowClear
        />

        {/* 模式选择 */}
        <Radio.Group value={selectedMode} onChange={e => setSelectedMode(e.target.value)}>
          <Radio value="root">作为根待办</Radio>
          <Radio value="relative">关联到现有待办</Radio>
        </Radio.Group>

        {/* 树形选择器 */}
        {selectedMode === 'relative' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin />
              </div>
            ) : (
              <>
                <Tree
                  showLine
                  treeData={filteredTreeData}
                  onSelect={handleTreeSelect}
                  onExpand={handleExpand}
                  expandedKeys={expandedKeys}
                  autoExpandParent={autoExpandParent}
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.02)', padding: '16px', borderRadius: '4px', maxHeight: '400px', overflow: 'auto' }}
                />

                {selectedTodoId && (
                  <div>
                    <Space>
                      <span>关系类型：</span>
                      <Radio.Group
                        value={selectedRelationType}
                        onChange={e => setSelectedRelationType(e.target.value)}
                      >
                        <Radio value="extends">作为子待办（延伸）</Radio>
                        <Radio value="parallel">作为并列待办</Radio>
                      </Radio.Group>
                    </Space>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 提示信息 */}
        <div style={{ padding: '12px', backgroundColor: 'rgba(0, 0, 0, 0.06)', borderRadius: '4px' }}>
          <div>💡 提示：</div>
          <div>• 作为根待办：新建一个独立的待办树</div>
          <div>• 作为子待办（延伸）：对选中的待办进行扩展</div>
          <div>• 作为并列待办：与选中的待办并行处理</div>
        </div>
      </Space>
    </Modal>
  );
};

export default TodoPositionSelector;

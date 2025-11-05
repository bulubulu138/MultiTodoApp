import { Todo } from '../../shared/types';
import React, { useState, useEffect, useMemo } from 'react';
import { Input, List, Card, Tag, Typography, Space, Button, Checkbox, Divider } from 'antd';
import { SearchOutlined, LinkOutlined, ClearOutlined } from '@ant-design/icons';
import AnimatedModal from './AnimatedModal';

const { Search } = Input;
const { Text } = Typography;

interface SearchModalProps {
  visible: boolean;
  todos: Todo[];
  onClose: () => void;
  onSelectTodo: (todo: Todo) => void;
  onViewTodo?: (todo: Todo) => void;
}

const SearchModal: React.FC<SearchModalProps> = ({
  visible,
  todos,
  onClose,
  onSelectTodo,
  onViewTodo
}) => {
  const [searchText, setSearchText] = useState('');
  const [debouncedSearchText, setDebouncedSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([]);

  // Extract all unique tags from todos - 仅在visible时计算
  const allTags = useMemo(() => {
    if (!visible) return [];
    const tagSet = new Set<string>();
    todos.forEach(todo => {
      // 添加空值检查
      if (todo && todo.tags) {
        todo.tags.split(',').forEach(tag => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [todos, visible]);

  // 搜索防抖 - 避免频繁触发过滤计算
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchText(searchText);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Apply all filters - 仅在visible时执行
  useEffect(() => {
    // 关闭时清空状态，下次打开重新计算
    if (!visible) {
      setSearchText('');
      setDebouncedSearchText('');
      setStatusFilter([]);
      setPriorityFilter([]);
      setTagFilter([]);
      setFilteredTodos([]);
      return;
    }

    // 添加空值过滤
    let filtered = todos.filter(todo => todo && todo.id);

    // 1. Text search (title and content) - 使用防抖后的搜索文本
    if (debouncedSearchText.trim()) {
      filtered = filtered.filter(todo =>
        todo.title?.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
        todo.content?.toLowerCase().includes(debouncedSearchText.toLowerCase())
      );
    }

    // 2. Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(todo => statusFilter.includes(todo.status));
    }

    // 3. Priority filter
    if (priorityFilter.length > 0) {
      filtered = filtered.filter(todo => priorityFilter.includes(todo.priority));
    }

    // 4. Tag filter (any match)
    if (tagFilter.length > 0) {
      filtered = filtered.filter(todo => {
        if (!todo.tags) return false;
        const todoTags = todo.tags.split(',').map(t => t.trim()).filter(Boolean);
        return tagFilter.some(filterTag => todoTags.includes(filterTag));
      });
    }

    setFilteredTodos(filtered);
  }, [visible, debouncedSearchText, statusFilter, priorityFilter, tagFilter, todos]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      case 'paused': return 'default';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待办';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      case 'paused': return '暂停';
      default: return status;
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高';
      case 'medium': return '中';
      case 'low': return '低';
      default: return priority;
    }
  };

  const hasActiveFilters = statusFilter.length > 0 || 
                           priorityFilter.length > 0 || 
                           tagFilter.length > 0 || 
                           searchText.trim() !== '';

  const clearAllFilters = () => {
    setSearchText('');
    setStatusFilter([]);
    setPriorityFilter([]);
    setTagFilter([]);
  };

  const renderTags = (tagsString: string) => {
    if (!tagsString) return null;
    
    const tags = tagsString.split(',').filter(tag => tag.trim());
    if (tags.length === 0) return null;

    return (
      <Space wrap>
        {tags.slice(0, 3).map((tag, index) => (
          <Tag key={index}>
            {tag.trim()}
          </Tag>
        ))}
        {tags.length > 3 && <Text type="secondary">+{tags.length - 3}</Text>}
      </Space>
    );
  };

  return (
    <AnimatedModal
      title={
        <Space>
          <SearchOutlined />
          <span>搜索待办事项</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      style={{ top: 50 }}
    >
      <Search
        placeholder="搜索标题或内容..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 16 }}
        size="large"
      />

      {/* Filter Section */}
      <div style={{ 
        padding: '12px 16px', 
        borderRadius: 8, 
        marginBottom: 16,
        border: '1px solid rgba(128, 128, 128, 0.2)'
      }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* Status Filter */}
          <div>
            <Text strong style={{ marginRight: 12, fontSize: '13px' }}>状态:</Text>
            <Checkbox.Group
              options={[
                { label: '待办', value: 'pending' },
                { label: '进行中', value: 'in_progress' },
                { label: '已完成', value: 'completed' },
                { label: '暂停', value: 'paused' }
              ]}
              value={statusFilter}
              onChange={(values) => setStatusFilter(values as string[])}
            />
          </div>

          {/* Priority Filter */}
          <div>
            <Text strong style={{ marginRight: 12, fontSize: '13px' }}>优先级:</Text>
            <Checkbox.Group
              options={[
                { label: '高', value: 'high' },
                { label: '中', value: 'medium' },
                { label: '低', value: 'low' }
              ]}
              value={priorityFilter}
              onChange={(values) => setPriorityFilter(values as string[])}
            />
          </div>

          {/* Tag Filter */}
          {allTags.length > 0 && (
            <div>
              <Text strong style={{ marginRight: 12, fontSize: '13px' }}>标签:</Text>
              <Space wrap size="small">
                {allTags.map(tag => (
                  <Tag.CheckableTag
                    key={tag}
                    checked={tagFilter.includes(tag)}
                    onChange={(checked) => {
                      if (checked) {
                        setTagFilter([...tagFilter, tag]);
                      } else {
                        setTagFilter(tagFilter.filter(t => t !== tag));
                      }
                    }}
                  >
                    {tag}
                  </Tag.CheckableTag>
                ))}
              </Space>
            </div>
          )}

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div style={{ textAlign: 'right' }}>
              <Button
                size="small"
                icon={<ClearOutlined />}
                onClick={clearAllFilters}
              >
                清除所有筛选
              </Button>
            </div>
          )}
        </Space>
      </div>

      {/* Results Count */}
      <div style={{ 
        marginBottom: 12, 
        padding: '8px 12px', 
        borderRadius: 4,
        opacity: 0.7
      }}>
        <Text type="secondary">
          找到 {filteredTodos.length} 个匹配项
          {hasActiveFilters && ' (已应用筛选条件)'}
        </Text>
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        <List
          dataSource={filteredTodos}
          renderItem={(todo) => (
            <List.Item key={todo.id}>
              <Card
                size="small"
                style={{ width: '100%' }}
                bodyStyle={{ padding: 12 }}
                actions={[
                  <Button
                    type="link"
                    icon={<LinkOutlined />}
                    onClick={() => onSelectTodo(todo)}
                  >
                    选择
                  </Button>
                ]}
              >
                <Card.Meta
                  title={
                    <Space>
                      <Text 
                        strong 
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          if (onViewTodo) {
                            onViewTodo(todo);
                            onClose();
                          }
                        }}
                      >
                        {todo.title}
                      </Text>
                      <Tag color={getStatusColor(todo.status)}>
                        {getStatusText(todo.status)}
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      {todo.content && (
                        <Text 
                          type="secondary" 
                          ellipsis={{ tooltip: todo.content }}
                          style={{ display: 'block', marginBottom: 8 }}
                        >
                          {todo.content}
                        </Text>
                      )}
                      {renderTags(todo.tags)}
                      <div style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
                        创建于: {new Date(todo.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  }
                />
              </Card>
            </List.Item>
          )}
          locale={{ emptyText: searchText ? '没有找到匹配的待办事项' : '暂无待办事项' }}
        />
      </div>
    </AnimatedModal>
  );
};

export default SearchModal;

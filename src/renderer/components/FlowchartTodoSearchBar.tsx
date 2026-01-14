import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Input, List, Tag, Empty, Spin, message } from 'antd';
import { SearchOutlined, CheckCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { Todo } from '../../shared/types';

interface FlowchartTodoSearchBarProps {
  flowchartId: string;
  todos: Todo[];
  associatedTodoIds: number[];
  onAssociate: (todoId: number) => Promise<void>;
  onDisassociate: (todoId: number) => Promise<void>;
}

/**
 * FlowchartTodoSearchBar 组件
 * 
 * 位于流程图画布顶部的待办搜索栏组件
 * 支持实时搜索、关联状态显示、关联/取消关联操作
 */
export const FlowchartTodoSearchBar: React.FC<FlowchartTodoSearchBarProps> = ({
  flowchartId,
  todos,
  associatedTodoIds,
  onAssociate,
  onDisassociate
}) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖效果：300ms延迟
  useEffect(() => {
    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 设置新的定时器
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedKeyword(searchKeyword);
    }, 300);

    // 清理函数
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchKeyword]);

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return '待办';
      case 'in_progress': return '进行中';
      case 'completed': return '已完成';
      case 'paused': return '暂停';
      default: return status;
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'in_progress': return 'blue';
      case 'completed': return 'green';
      case 'paused': return 'default';
      default: return 'default';
    }
  };

  // 搜索结果过滤和排序（使用防抖后的关键词）
  const searchResults = useMemo(() => {
    if (!debouncedKeyword.trim()) {
      return [];
    }

    const keyword = debouncedKeyword.toLowerCase().trim();
    
    // 过滤匹配的待办，并计算匹配度分数
    const filtered = todos
      .map(todo => {
        const titleMatch = todo.title.toLowerCase().includes(keyword);
        const contentMatch = todo.content.toLowerCase().includes(keyword);
        
        if (!titleMatch && !contentMatch) {
          return null;
        }

        // 计算匹配度分数（标题匹配权重更高）
        let score = 0;
        if (titleMatch) {
          // 标题完全匹配得分最高
          if (todo.title.toLowerCase() === keyword) {
            score += 100;
          } else if (todo.title.toLowerCase().startsWith(keyword)) {
            score += 50;
          } else {
            score += 30;
          }
        }
        if (contentMatch) {
          score += 10;
        }

        return {
          todo,
          score
        };
      })
      .filter((item): item is { todo: Todo; score: number } => item !== null)
      // 按匹配度分数降序排序
      .sort((a, b) => b.score - a.score)
      // 提取待办对象
      .map(item => item.todo);

    // 限制最多50条
    return filtered.slice(0, 50);
  }, [debouncedKeyword, todos]);

  // 处理搜索输入变化
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchKeyword(value);
    setShowResults(value.trim().length > 0);
  }, []);

  // 处理点击待办项
  const handleTodoClick = useCallback(async (todo: Todo) => {
    if (!todo.id) return;

    const isAssociated = associatedTodoIds.includes(todo.id);
    setLoading(true);

    try {
      if (isAssociated) {
        // 取消关联
        await onDisassociate(todo.id);
        message.success('已取消关联');
      } else {
        // 创建关联
        await onAssociate(todo.id);
        message.success('关联成功');
      }
    } catch (error) {
      console.error('关联操作失败:', error);
      message.error(isAssociated ? '取消关联失败' : '关联失败');
    } finally {
      setLoading(false);
    }
  }, [associatedTodoIds, onAssociate, onDisassociate]);

  // 处理输入框失焦
  const handleBlur = useCallback(() => {
    // 延迟隐藏，以便点击事件能够触发
    setTimeout(() => {
      setShowResults(false);
    }, 200);
  }, []);

  // 处理输入框聚焦
  const handleFocus = useCallback(() => {
    if (searchKeyword.trim().length > 0) {
      setShowResults(true);
    }
  }, [searchKeyword]);

  // 清空搜索
  const handleClear = useCallback(() => {
    setSearchKeyword('');
    setShowResults(false);
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      maxWidth: 600,
      margin: '0 auto',
      padding: '12px 16px',
      zIndex: 10
    }}>
      {/* 搜索输入框 */}
      <Input
        placeholder="搜索待办任务..."
        prefix={<SearchOutlined />}
        value={searchKeyword}
        onChange={handleSearchChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        allowClear
        onClear={handleClear}
        size="large"
        style={{
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        }}
      />

      {/* 搜索结果下拉列表 */}
      {showResults && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 16,
          right: 16,
          marginTop: 4,
          backgroundColor: 'var(--color-bg-container)',
          borderRadius: 8,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
          maxHeight: 400,
          overflowY: 'auto',
          zIndex: 1000
        }}>
          <Spin spinning={loading}>
            {searchResults.length === 0 ? (
              <Empty
                description="无匹配结果"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '24px 0' }}
              />
            ) : (
              <List
                dataSource={searchResults}
                renderItem={(todo) => {
                  const isAssociated = todo.id ? associatedTodoIds.includes(todo.id) : false;
                  
                  return (
                    <List.Item
                      key={todo.id}
                      onClick={() => handleTodoClick(todo)}
                      style={{
                        padding: '12px 16px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                        borderBottom: '1px solid var(--color-border)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--color-fill-tertiary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ width: '100%' }}>
                        {/* 标题行 */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 4
                        }}>
                          {/* 关联状态图标 */}
                          {isAssociated ? (
                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                          ) : (
                            <PlusCircleOutlined style={{ color: '#1890ff', fontSize: 16 }} />
                          )}
                          
                          {/* 标题 */}
                          <span style={{
                            flex: 1,
                            fontWeight: 500,
                            fontSize: 14
                          }}>
                            {todo.title}
                          </span>

                          {/* 已关联标识 */}
                          {isAssociated && (
                            <Tag color="success" style={{ margin: 0 }}>
                              已关联
                            </Tag>
                          )}

                          {/* 状态标签 */}
                          <Tag color={getStatusColor(todo.status)} style={{ margin: 0 }}>
                            {getStatusText(todo.status)}
                          </Tag>
                        </div>

                        {/* 内容预览 */}
                        {todo.content && (
                          <div style={{
                            fontSize: 12,
                            color: 'var(--color-text-secondary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginLeft: 24
                          }}>
                            {todo.content.replace(/<[^>]*>/g, '').substring(0, 100)}
                          </div>
                        )}
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </Spin>
        </div>
      )}
    </div>
  );
};

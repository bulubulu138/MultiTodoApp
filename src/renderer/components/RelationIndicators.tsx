import React from 'react';
import { Space, Tooltip } from 'antd';
import { ArrowRightOutlined, FileTextOutlined, BranchesOutlined } from '@ant-design/icons';
import { TodoRelation, Todo } from '../../shared/types';
import { getRelationCounts, getRelatedTodos } from '../utils/relationUtils';

interface RelationIndicatorsProps {
  todoId: number;
  relations: TodoRelation[];
  allTodos: Todo[];
  size?: 'small' | 'default';
  showLabels?: boolean;
  onViewRelations?: () => void;
}

/**
 * 关联关系指示器组件
 * 显示待办的关联关系图标和数量
 */
const RelationIndicators: React.FC<RelationIndicatorsProps> = ({
  todoId,
  relations,
  allTodos,
  size = 'small',
  showLabels = false,
  onViewRelations
}) => {
  // 计算各类型关联数量
  const counts = getRelationCounts(todoId, relations);
  
  // 获取关联的待办（用于Tooltip显示）
  const relatedTodos = getRelatedTodos(todoId, relations, allTodos);
  
  // 检查是否有任何关联
  const hasRelations = counts.extends > 0 || counts.background > 0 || counts.parallel > 0;
  
  if (!hasRelations) {
    return null;
  }
  
  const iconSize = size === 'small' ? 12 : 14;
  const fontSize = size === 'small' ? 12 : 14;
  
  // 渲染单个关联指示器
  const renderIndicator = (
    type: 'extends' | 'background' | 'parallel',
    icon: React.ReactNode,
    color: string,
    label: string
  ) => {
    const count = counts[type];
    if (count === 0) return null;
    
    const titles = relatedTodos[type].map(t => t.title);
    const tooltipContent = (
      <div>
        <div style={{ marginBottom: 4, fontWeight: 'bold' }}>{label}关系 ({count}个)</div>
        {titles.slice(0, 5).map((title, idx) => (
          <div key={idx}>• {title}</div>
        ))}
        {titles.length > 5 && <div>...还有{titles.length - 5}个</div>}
      </div>
    );
    
    return (
      <Tooltip title={tooltipContent} key={type}>
        <span 
          style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            color: color,
            fontSize: fontSize,
            cursor: onViewRelations ? 'pointer' : 'default',
            padding: '0 4px'
          }}
          onClick={(e) => {
            e.stopPropagation();
            onViewRelations?.();
          }}
        >
          {React.cloneElement(icon as React.ReactElement, { 
            style: { fontSize: iconSize } 
          })}
          {showLabels && <span style={{ fontSize: 11 }}>{label}</span>}
          <span style={{ fontSize: 11, fontWeight: 500 }}>×{count}</span>
        </span>
      </Tooltip>
    );
  };
  
  return (
    <Space size={0} style={{ fontSize: fontSize }}>
      {renderIndicator('extends', <ArrowRightOutlined />, '#1890ff', '子待办')}
      {renderIndicator('background', <FileTextOutlined />, '#52c41a', '父待办')}
      {renderIndicator('parallel', <BranchesOutlined />, '#fa8c16', '并列')}
    </Space>
  );
};

export default RelationIndicators;


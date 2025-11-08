import React from 'react';
import { Button, Space, Select, Tooltip, Segmented, Input } from 'antd';
import { PlusOutlined, SettingOutlined, ExportOutlined, BulbOutlined, CalendarOutlined, SortAscendingOutlined, TagsOutlined, UnorderedListOutlined, AlignLeftOutlined, SearchOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';

const { Option } = Select;
const { Search } = Input;

export type SortOption = 
  | 'createdAt-desc' 
  | 'createdAt-asc' 
  | 'startTime-desc' 
  | 'startTime-asc' 
  | 'deadline-desc' 
  | 'deadline-asc'
  | 'updatedAt-desc'
  | 'updatedAt-asc'
  | 'manual';

export type ViewMode = 'card' | 'content-focus';

interface ToolbarProps {
  onAddTodo: () => void;
  onShowSettings: () => void;
  onShowExport: () => void;
  onShowNotes: () => void;
  onShowCalendar: () => void;
  onShowCustomTabManager: () => void;
  sortOption?: SortOption;
  onSortChange?: (option: SortOption) => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  searchText?: string;
  onSearchChange?: (value: string) => void;
}

// 性能优化：使用 React.memo 避免不必要的重渲染
const Toolbar: React.FC<ToolbarProps> = React.memo(({
  onAddTodo,
  onShowSettings,
  onShowExport,
  onShowCustomTabManager,
  onShowNotes,
  onShowCalendar,
  sortOption = 'createdAt-desc',
  onSortChange,
  viewMode = 'card',
  onViewModeChange,
  searchText = '',
  onSearchChange
}) => {
  return (
    <div className="toolbar">
      <div>
        <Search
          placeholder="搜索标题或内容..."
          value={searchText}
          onChange={(e) => onSearchChange?.(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />
      </div>
      
      <Space size="middle">
        <Select
          value={sortOption}
          onChange={onSortChange}
          style={{ width: 180 }}
          suffixIcon={<SortAscendingOutlined />}
        >
          <Option value="manual">手动排序</Option>
          <Option value="createdAt-desc">创建时间 ↓ 新→旧</Option>
          <Option value="createdAt-asc">创建时间 ↑ 旧→新</Option>
          <Option value="updatedAt-desc">更新时间 ↓ 新→旧</Option>
          <Option value="updatedAt-asc">更新时间 ↑ 旧→新</Option>
          <Option value="startTime-desc">开始时间 ↓ 晚→早</Option>
          <Option value="startTime-asc">开始时间 ↑ 早→晚</Option>
          <Option value="deadline-desc">截止时间 ↓ 晚→早</Option>
          <Option value="deadline-asc">截止时间 ↑ 早→晚</Option>
        </Select>
        
        <Tooltip title="切换视图模式">
          <Segmented
            value={viewMode}
            onChange={(value) => onViewModeChange?.(value as ViewMode)}
            options={[
              {
                label: '卡片',
                value: 'card',
                icon: <UnorderedListOutlined />,
              },
              {
                label: '专注',
                value: 'content-focus',
                icon: <AlignLeftOutlined />,
              },
            ]}
          />
        </Tooltip>
        
        <Button
          icon={<ExportOutlined />}
          onClick={onShowExport}
        >
          导出
        </Button>
        
        <Button
          icon={<BulbOutlined />}
          onClick={onShowNotes}
        >
          心得
        </Button>
        
        <Button
          icon={<CalendarOutlined />}
          onClick={onShowCalendar}
        >
          日历
        </Button>
        
        <Button
          icon={<TagsOutlined />}
          onClick={onShowCustomTabManager}
        >
          管理Tab
        </Button>
        
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onAddTodo}
        >
          新建待办
        </Button>
        
        <Button
          icon={<SettingOutlined />}
          onClick={onShowSettings}
        >
          设置
        </Button>
      </Space>
    </div>
  );
});

Toolbar.displayName = 'Toolbar';

export default Toolbar;

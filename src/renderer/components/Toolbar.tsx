import React from 'react';
import { Button, Space } from 'antd';
import { PlusOutlined, SettingOutlined, ExportOutlined, SearchOutlined, BulbOutlined, CalendarOutlined } from '@ant-design/icons';

interface ToolbarProps {
  onAddTodo: () => void;
  onShowSettings: () => void;
  onShowExport: () => void;
  onShowSearch: () => void;
  onShowNotes: () => void;
  onShowCalendar: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onAddTodo,
  onShowSettings,
  onShowExport,
  onShowSearch,
  onShowNotes,
  onShowCalendar
}) => {
  return (
    <div className="toolbar">
      <div>
        <h2 style={{ margin: 0, color: '#1890ff' }}>多功能待办工具</h2>
      </div>
      
      <Space size="middle">
        <Button
          icon={<SearchOutlined />}
          onClick={onShowSearch}
        >
          搜索
        </Button>
        
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
};

export default Toolbar;

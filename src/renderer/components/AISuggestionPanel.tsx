import React, { useState } from 'react';
import { Card, Button, Space, Spin, Empty, Divider, Select, Alert, Tooltip, Modal, message } from 'antd';
import { BulbOutlined, LoadingOutlined, CompressOutlined, ExpandOutlined } from '@ant-design/icons';
import ReadOnlyMarkdown from './ReadOnlyMarkdown';
import { Todo, PromptTemplate } from '../../shared/types';
import { useThemeColors } from '../hooks/useThemeColors';

interface AISuggestionPanelProps {
  todo: Todo | null;
  templates: PromptTemplate[];
  onGenerate: (todoId: number, templateId?: number) => Promise<{ success: boolean; suggestion?: string; error?: string }>;
  onDelete: (todoId: number) => Promise<{ success: boolean; error?: string }>;
  onSave?: (todoId: number, suggestion: string) => Promise<{ success: boolean; error?: string }>;
  width: number;
  onWidthChange: (width: number) => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const AISuggestionPanel: React.FC<AISuggestionPanelProps> = ({
  todo,
  templates,
  onGenerate,
  onDelete,
  onSave,
  width,
  onWidthChange,
  collapsed = false,
  onToggleCollapse
}) => {
  const [generating, setGenerating] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | undefined>();
  const themeColors = useThemeColors();

  // 拖拽调整宽度
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = React.useRef(0);
  const resizeStartWidth = React.useRef(width);

  const handleGenerate = async () => {
    if (!todo?.id) return;

    // 检查是否已有AI建议
    if (todo.aiSuggestion && !generating) {
      // 使用 Modal.confirm 替代 window.confirm
      Modal.confirm({
        title: '确认重新生成',
        content: '该待办已有AI建议，是否要重新生成？这将覆盖现有的建议内容。',
        okText: '确定',
        cancelText: '取消',
        onOk: async () => {
          setGenerating(true);
          try {
            const result = await onGenerate(todo.id!, selectedTemplateId);
            if (result.success && result.suggestion) {
              message.success('AI建议生成成功');
            } else {
              message.error('生成失败: ' + (result.error || '未知错误'));
            }
          } finally {
            setGenerating(false);
          }
        }
      });
      return;
    }

    setGenerating(true);
    try {
      const result = await onGenerate(todo.id!, selectedTemplateId);
      if (result.success && result.suggestion) {
        message.success('AI建议生成成功');
      } else {
        message.error('生成失败: ' + (result.error || '未知错误'));
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!todo?.id) return;

    try {
      const result = await onDelete(todo.id);
      if (result.success) {
        message.success('已删除建议');
      } else {
        message.error('删除失败: ' + result.error);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = width;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartX.current;
      const newWidth = Math.max(250, Math.min(800, resizeStartWidth.current - deltaX));
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  if (collapsed) {
    return (
      <div
        style={{
          width: 40,
          borderLeft: `1px solid ${themeColors.borderColor}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: themeColors.panelHeaderBg
        }}
        onClick={onToggleCollapse}
        title="展开AI建议面板"
      >
        <ExpandOutlined style={{ fontSize: 16, color: themeColors.textColor }} />
      </div>
    );
  }

  return (
    <div
      style={{
        width: `${width}px`,
        borderLeft: `1px solid ${themeColors.borderColor}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        backgroundColor: themeColors.contentBg,
        height: '100%'
      }}
    >
      {/* 拖拽调整宽度的手柄 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '5px',
          cursor: 'col-resize',
          zIndex: 10,
          backgroundColor: isResizing ? '#1890ff' : 'transparent'
        }}
        onMouseDown={handleResizeStart}
        title="拖拽调整宽度"
      />

      {/* 头部 */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${themeColors.borderColor}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          backgroundColor: themeColors.panelHeaderBg
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <BulbOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontWeight: 600, color: themeColors.textPrimary }}>AI 建议</span>
          </Space>
          <Tooltip title="收起面板">
            <Button
              type="text"
              size="small"
              icon={<CompressOutlined />}
              onClick={onToggleCollapse}
            />
          </Tooltip>
        </div>

        {/* 显示当前选中的代办标题 */}
        {todo && todo.title && (
          <div
            style={{
              fontSize: '12px',
              color: themeColors.textColor,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
            title={todo.title}
          >
            待办: {todo.title}
          </div>
        )}
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
        {!todo ? (
          <Empty description="选择待办以查看AI建议" style={{ marginTop: 'auto', marginBottom: 'auto' }} />
        ) : !todo.aiSuggestion && !generating ? (
          <Empty description="暂无AI建议" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select
                style={{ width: '100%' }}
                placeholder="选择Prompt模板（可选）"
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                allowClear
                size="large"
              >
                {templates.map(t => (
                  <Select.Option key={t.id} value={t.id}>
                    {t.name}
                  </Select.Option>
                ))}
              </Select>
              <Button
                type="primary"
                icon={<BulbOutlined />}
                onClick={handleGenerate}
                block
                size="large"
                loading={generating}
              >
                生成AI建议
              </Button>
            </Space>
          </Empty>
        ) : (
          <>
            {generating && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin indicator={<LoadingOutlined spin />} size="large" />
                <div style={{ marginTop: 16, color: themeColors.textColor }}>AI正在思考中...</div>
              </div>
            )}

            {!generating && todo?.aiSuggestion && (
              <ReadOnlyMarkdown
                content={todo.aiSuggestion}
                showCopyButton={true}
              />
            )}
          </>
        )}
      </div>

      {/* 底部操作栏 */}
      {todo?.aiSuggestion && !generating && (
        <>
          <Divider style={{ margin: 0 }} />
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${themeColors.borderColor}` }}>
            <Space>
              <Button
                size="small"
                icon={<BulbOutlined />}
                onClick={handleGenerate}
              >
                重新生成
              </Button>
              <Button
                size="small"
                danger
                onClick={handleDelete}
              >
                删除
              </Button>
            </Space>
          </div>
        </>
      )}
    </div>
  );
};

export default AISuggestionPanel;

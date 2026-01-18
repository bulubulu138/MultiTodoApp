import React, { useEffect } from 'react';
import { Drawer, Form, Select, Button, Space, Divider, Typography, message } from 'antd';
import { EdgeStyle, EdgeType, LINE_WIDTH_OPTIONS, LineWidth } from '../../../shared/types';

const { Text } = Typography;

interface EdgeStylePanelProps {
  visible: boolean;
  edgeId: string | null;
  currentStyle: EdgeStyle;
  currentType: EdgeType;
  currentLabel?: string; // 新增：当前标签文本
  onClose: () => void;
  onStyleChange: (style: Partial<EdgeStyle>) => void;
  onTypeChange: (type: EdgeType) => void;
  onEditLabel?: () => void; // 新增：编辑标签回调
}

/**
 * EdgeStylePanel - 连接线样式编辑面板
 * 
 * 提供连接线样式编辑功能：
 * - 线宽调整（thin/medium/thick）
 * - 曲线类型切换（curved/straight）
 * - 显示当前样式值
 */
export const EdgeStylePanel: React.FC<EdgeStylePanelProps> = ({
  visible,
  edgeId,
  currentStyle,
  currentType,
  currentLabel,
  onClose,
  onStyleChange,
  onTypeChange,
  onEditLabel
}) => {
  const [form] = Form.useForm();

  // 当前线宽（从 strokeWidth 推断）
  // 错误处理：无效线宽时使用默认值
  const getCurrentLineWidth = (): LineWidth => {
    const width = currentStyle.strokeWidth;
    
    // 验证线宽值是否有效
    if (typeof width !== 'number' || !isFinite(width) || width < 0 || width > 10) {
      console.warn(`[EdgeStylePanel] Invalid line width: ${width}, using default 'medium'`);
      return 'medium'; // 使用 medium 作为默认值（符合设计文档）
    }
    
    // 根据数值推断线宽类型
    if (width <= LINE_WIDTH_OPTIONS.thin) return 'thin';
    if (width <= LINE_WIDTH_OPTIONS.medium) return 'medium';
    return 'thick';
  };

  // 当前曲线类型（简化为 curved/straight）
  // 错误处理：无效边类型时使用默认值
  const getCurrentCurveType = (): 'curved' | 'straight' => {
    const validEdgeTypes: EdgeType[] = ['default', 'smoothstep', 'step', 'straight', 'bezier'];
    
    // 验证边类型是否有效
    if (!currentType || !validEdgeTypes.includes(currentType)) {
      console.warn(`[EdgeStylePanel] Invalid edge type: ${currentType}, using default 'curved'`);
      return 'curved';
    }
    
    return currentType === 'straight' ? 'straight' : 'curved';
  };

  useEffect(() => {
    if (visible && edgeId) {
      form.setFieldsValue({
        lineWidth: getCurrentLineWidth(),
        curveType: getCurrentCurveType()
      });
    }
  }, [visible, edgeId, currentStyle, currentType, form]);

  const handleSave = () => {
    try {
      const values = form.getFieldsValue();
      
      // 验证线宽值
      const lineWidth = values.lineWidth as LineWidth;
      if (!LINE_WIDTH_OPTIONS[lineWidth]) {
        message.error('无效的线宽值');
        return;
      }
      
      // 更新线宽
      const newStrokeWidth = LINE_WIDTH_OPTIONS[lineWidth];
      onStyleChange({
        strokeWidth: newStrokeWidth
      });

      // 验证并更新曲线类型
      const curveType = values.curveType;
      if (curveType !== 'straight' && curveType !== 'curved') {
        message.error('无效的曲线类型');
        return;
      }
      
      const newEdgeType: EdgeType = curveType === 'straight' ? 'straight' : 'default';
      onTypeChange(newEdgeType);

      onClose();
    } catch (error) {
      console.error('Failed to apply edge style:', error);
      message.error('应用样式失败，请重试');
    }
  };

  const handleLineWidthChange = (value: LineWidth) => {
    try {
      // 验证线宽值
      if (!LINE_WIDTH_OPTIONS[value]) {
        console.warn(`Invalid line width: ${value}, ignoring change`);
        message.warning('无效的线宽值');
        return;
      }
      
      // 实时预览：立即应用线宽变化
      const newStrokeWidth = LINE_WIDTH_OPTIONS[value];
      onStyleChange({
        strokeWidth: newStrokeWidth
      });
    } catch (error) {
      console.error('Failed to change line width:', error);
      message.error('更改线宽失败');
    }
  };

  const handleCurveTypeChange = (value: 'curved' | 'straight') => {
    try {
      // 验证曲线类型
      if (value !== 'straight' && value !== 'curved') {
        console.warn(`Invalid curve type: ${value}, ignoring change`);
        message.warning('无效的曲线类型');
        return;
      }
      
      // 实时预览：立即应用曲线类型变化
      const newEdgeType: EdgeType = value === 'straight' ? 'straight' : 'default';
      onTypeChange(newEdgeType);
    } catch (error) {
      console.error('Failed to change curve type:', error);
      message.error('更改曲线类型失败');
    }
  };

  return (
    <Drawer
      title="编辑连接线样式"
      placement="right"
      width={360}
      open={visible}
      onClose={onClose}
      footer={
        <Space style={{ float: 'right' }}>
          <Button onClick={onClose}>关闭</Button>
          <Button type="primary" onClick={handleSave}>
            应用
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
      >
        <Divider>标签</Divider>

        <Form.Item
          label="连接线标签"
          help="点击按钮编辑标签文本"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text type="secondary">当前标签：</Text>
              <Text>{currentLabel || '(无标签)'}</Text>
            </div>
            {onEditLabel && (
              <Button 
                type="default" 
                onClick={onEditLabel}
                style={{ width: '100%' }}
              >
                编辑标签
              </Button>
            )}
          </Space>
        </Form.Item>

        <Divider>线条样式</Divider>

        <Form.Item
          label="线宽"
          name="lineWidth"
          help="选择连接线的粗细"
        >
          <Select
            onChange={handleLineWidthChange}
            options={[
              { value: 'thin', label: '细线 (1px)' },
              { value: 'medium', label: '中等 (2px)' },
              { value: 'thick', label: '粗线 (4px)' }
            ]}
          />
        </Form.Item>

        <Form.Item
          label="曲线类型"
          name="curveType"
          help="选择连接线的形状"
        >
          <Select
            onChange={handleCurveTypeChange}
            options={[
              { value: 'curved', label: '曲线' },
              { value: 'straight', label: '直线' }
            ]}
          />
        </Form.Item>

        <Divider>当前样式</Divider>

        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">线宽：</Text>
            <Text strong>{currentStyle.strokeWidth || LINE_WIDTH_OPTIONS.thin}px</Text>
          </div>
          <div>
            <Text type="secondary">类型：</Text>
            <Text strong>{getCurrentCurveType() === 'curved' ? '曲线' : '直线'}</Text>
          </div>
          <div>
            <Text type="secondary">边ID：</Text>
            <Text code>{edgeId}</Text>
          </div>
        </Space>
      </Form>
    </Drawer>
  );
};

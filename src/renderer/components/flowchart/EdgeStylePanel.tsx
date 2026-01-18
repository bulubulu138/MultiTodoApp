import React, { useEffect } from 'react';
import { Drawer, Form, Select, Button, Space, Divider, Typography, message, ColorPicker, InputNumber, Switch } from 'antd';
import { EdgeStyle, EdgeType, LINE_WIDTH_OPTIONS, LineWidth, EdgeMarkerType, EdgeLabelStyle } from '../../../shared/types';
import type { Color } from 'antd/es/color-picker';

const { Text } = Typography;

interface EdgeStylePanelProps {
  visible: boolean;
  edgeId: string | null;
  currentStyle: EdgeStyle;
  currentType: EdgeType;
  currentLabel?: string;
  currentLabelStyle?: EdgeLabelStyle; // 新增：当前标签样式
  currentMarkerStart?: EdgeMarkerType; // 新增：起点箭头
  currentMarkerEnd?: EdgeMarkerType; // 新增：终点箭头
  currentAnimated?: boolean; // 新增：动画状态
  onClose: () => void;
  onStyleChange: (style: Partial<EdgeStyle>) => void;
  onTypeChange: (type: EdgeType) => void;
  onEditLabel?: () => void;
  onLabelStyleChange?: (labelStyle: Partial<EdgeLabelStyle>) => void; // 新增：标签样式变更
  onMarkerChange?: (markers: { start?: EdgeMarkerType; end?: EdgeMarkerType }) => void; // 新增：箭头变更
  onAnimatedChange?: (animated: boolean) => void; // 新增：动画变更
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
  currentLabelStyle,
  currentMarkerStart,
  currentMarkerEnd,
  currentAnimated,
  onClose,
  onStyleChange,
  onTypeChange,
  onEditLabel,
  onLabelStyleChange,
  onMarkerChange,
  onAnimatedChange
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
        curveType: getCurrentCurveType(),
        lineColor: currentStyle.stroke || '#b1b1b7',
        lineStyle: currentStyle.strokeDasharray || '',
        markerStart: currentMarkerStart || 'none',
        markerEnd: currentMarkerEnd || 'arrowclosed',
        animated: currentAnimated || false,
        labelFontSize: currentLabelStyle?.fontSize || 12,
        labelColor: currentLabelStyle?.color || '#000',
        labelBackgroundColor: currentLabelStyle?.backgroundColor || '#fff'
      });
    }
  }, [visible, edgeId, currentStyle, currentType, currentLabelStyle, currentMarkerStart, currentMarkerEnd, currentAnimated, form]);

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

  // 5.1 处理线条颜色变化
  const handleLineColorChange = (color: Color) => {
    try {
      const hexColor = typeof color === 'string' ? color : color.toHexString();
      onStyleChange({
        stroke: hexColor
      });
    } catch (error) {
      console.error('Failed to change line color:', error);
      message.error('更改线条颜色失败');
    }
  };

  // 5.2 处理线条样式变化（实线/虚线/点线）
  const handleLineStyleChange = (value: string) => {
    try {
      onStyleChange({
        strokeDasharray: value || undefined
      });
    } catch (error) {
      console.error('Failed to change line style:', error);
      message.error('更改线条样式失败');
    }
  };

  // 5.3 处理箭头标记变化
  const handleMarkerStartChange = (value: EdgeMarkerType) => {
    try {
      if (onMarkerChange) {
        onMarkerChange({ start: value });
      }
    } catch (error) {
      console.error('Failed to change marker start:', error);
      message.error('更改起点箭头失败');
    }
  };

  const handleMarkerEndChange = (value: EdgeMarkerType) => {
    try {
      if (onMarkerChange) {
        onMarkerChange({ end: value });
      }
    } catch (error) {
      console.error('Failed to change marker end:', error);
      message.error('更改终点箭头失败');
    }
  };

  // 5.4 处理标签样式变化
  const handleLabelFontSizeChange = (value: number | null) => {
    try {
      if (value && onLabelStyleChange) {
        onLabelStyleChange({ fontSize: value });
      }
    } catch (error) {
      console.error('Failed to change label font size:', error);
      message.error('更改标签字号失败');
    }
  };

  const handleLabelColorChange = (color: Color) => {
    try {
      if (onLabelStyleChange) {
        const hexColor = typeof color === 'string' ? color : color.toHexString();
        onLabelStyleChange({ color: hexColor });
      }
    } catch (error) {
      console.error('Failed to change label color:', error);
      message.error('更改标签颜色失败');
    }
  };

  const handleLabelBackgroundColorChange = (color: Color) => {
    try {
      if (onLabelStyleChange) {
        const hexColor = typeof color === 'string' ? color : color.toHexString();
        onLabelStyleChange({ backgroundColor: hexColor });
      }
    } catch (error) {
      console.error('Failed to change label background color:', error);
      message.error('更改标签背景色失败');
    }
  };

  // 5.5 处理动画切换
  const handleAnimatedChange = (checked: boolean) => {
    try {
      if (onAnimatedChange) {
        onAnimatedChange(checked);
      }
    } catch (error) {
      console.error('Failed to change animated:', error);
      message.error('更改动画状态失败');
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

        {/* 5.4 标签样式控制 */}
        {onLabelStyleChange && (
          <>
            <Form.Item
              label="标签字号"
              name="labelFontSize"
              help="设置标签文字大小"
            >
              <InputNumber
                min={8}
                max={24}
                step={1}
                style={{ width: '100%' }}
                onChange={handleLabelFontSizeChange}
              />
            </Form.Item>

            <Form.Item
              label="标签文字颜色"
              name="labelColor"
              help="设置标签文字颜色"
            >
              <ColorPicker
                showText
                style={{ width: '100%' }}
                onChange={handleLabelColorChange}
              />
            </Form.Item>

            <Form.Item
              label="标签背景颜色"
              name="labelBackgroundColor"
              help="设置标签背景颜色"
            >
              <ColorPicker
                showText
                style={{ width: '100%' }}
                onChange={handleLabelBackgroundColorChange}
              />
            </Form.Item>
          </>
        )}

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

        {/* 5.1 线条颜色控制 */}
        <Form.Item
          label="线条颜色"
          name="lineColor"
          help="设置连接线的颜色"
        >
          <ColorPicker
            showText
            style={{ width: '100%' }}
            onChange={handleLineColorChange}
          />
        </Form.Item>

        {/* 5.2 线条样式控制 */}
        <Form.Item
          label="线条样式"
          name="lineStyle"
          help="选择实线、虚线或点线"
        >
          <Select
            onChange={handleLineStyleChange}
            options={[
              { value: '', label: '实线' },
              { value: '5,5', label: '虚线' },
              { value: '2,2', label: '点线' }
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

        {/* 5.3 箭头标记控制 */}
        {onMarkerChange && (
          <>
            <Form.Item
              label="起点箭头"
              name="markerStart"
              help="设置连接线起点的箭头样式"
            >
              <Select
                onChange={handleMarkerStartChange}
                options={[
                  { value: 'none', label: '无箭头' },
                  { value: 'arrow', label: '开放箭头' },
                  { value: 'arrowclosed', label: '闭合箭头' }
                ]}
              />
            </Form.Item>

            <Form.Item
              label="终点箭头"
              name="markerEnd"
              help="设置连接线终点的箭头样式"
            >
              <Select
                onChange={handleMarkerEndChange}
                options={[
                  { value: 'none', label: '无箭头' },
                  { value: 'arrow', label: '开放箭头' },
                  { value: 'arrowclosed', label: '闭合箭头' }
                ]}
              />
            </Form.Item>
          </>
        )}

        {/* 5.5 动画切换控制 */}
        {onAnimatedChange && (
          <Form.Item
            label="动画效果"
            name="animated"
            help="启用连接线流动动画"
            valuePropName="checked"
          >
            <Switch onChange={handleAnimatedChange} />
          </Form.Item>
        )}

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

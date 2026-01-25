import { Node, Edge, MarkerType } from 'reactflow';
import { DomainNode, DomainEdge, RuntimeNode, RuntimeEdge } from '../../shared/types';

// 最大标签显示长度（字符数）
const MAX_LABEL_DISPLAY_LENGTH = 30;

/**
 * 截断过长的标签文本
 * 错误处理：标签溢出时使用省略号
 */
function truncateLabel(label: string | undefined): string | undefined {
  if (!label) return label;
  
  if (label.length > MAX_LABEL_DISPLAY_LENGTH) {
    return label.substring(0, MAX_LABEL_DISPLAY_LENGTH) + '...';
  }
  
  return label;
}

/**
 * 将业务领域层节点转换为 React Flow 运行时节点
 */
export function toRuntimeNode(domainNode: DomainNode): Node {
  return {
    id: domainNode.id,
    type: domainNode.type,
    position: domainNode.position,
    data: {
      ...domainNode.data,
      isHovered: false,
      isDragging: false
    },
    draggable: !domainNode.data.isLocked
  };
}

/**
 * 将业务领域层边转换为 React Flow 运行时边
 * 支持自定义箭头类型和方向
 * 支持标签样式配置
 * 性能优化：禁用动画，简化样式
 * 错误处理：标签溢出截断，无效样式回退到默认值
 */
export function toRuntimeEdge(domainEdge: DomainEdge): Edge {
  // 获取箭头标记配置
  const getMarkerConfig = (markerType?: string) => {
    if (!markerType || markerType === 'none') {
      return undefined;
    }
    
    // 使用自定义的 SVG 标记
    return {
      type: MarkerType.Arrow,
      markerUnits: 'strokeWidth',
      orient: 'auto',
      width: 12,
      height: 12
    };
  };

  // 性能优化：简化边的样式
  const optimizedStyle = {
    ...domainEdge.style,
    strokeWidth: domainEdge.style?.strokeWidth || 1, // 使用较细的线条
  };

  // 错误处理：验证并应用标签样式，使用安全的默认值
  const labelStyle = domainEdge.labelStyle ? {
    fontSize: typeof domainEdge.labelStyle.fontSize === 'number' && 
              domainEdge.labelStyle.fontSize > 0 && 
              domainEdge.labelStyle.fontSize < 100
      ? domainEdge.labelStyle.fontSize 
      : 12, // 默认字体大小
    fill: domainEdge.labelStyle.color || '#000',
  } : undefined;

  const labelBgStyle = domainEdge.labelStyle ? {
    fill: domainEdge.labelStyle.backgroundColor || '#fff',
    fillOpacity: domainEdge.labelStyle.backgroundColor ? 1 : 0,
  } : undefined;

  // 错误处理：验证 padding 值
  const padding = domainEdge.labelStyle?.padding;
  const labelBgPadding = (typeof padding === 'number' && padding >= 0 && padding < 50)
    ? [padding, padding] as [number, number]
    : undefined;

  // 错误处理：验证 borderRadius 值
  const borderRadius = domainEdge.labelStyle?.borderRadius;
  const labelBgBorderRadius = (typeof borderRadius === 'number' && borderRadius >= 0 && borderRadius < 50)
    ? borderRadius
    : undefined;

  // 错误处理：截断过长的标签
  const displayLabel = truncateLabel(domainEdge.label);

  const edge: Edge = {
    id: domainEdge.id,
    source: domainEdge.source,
    target: domainEdge.target,
    sourceHandle: domainEdge.sourceHandle || undefined,
    targetHandle: domainEdge.targetHandle || undefined,
    type: domainEdge.type || 'default',
    label: displayLabel,
    labelStyle,
    labelBgStyle,
    labelBgPadding,
    labelBgBorderRadius,
    style: optimizedStyle,
    animated: domainEdge.animated || false, // 使用类型安全的访问
    // 支持自定义箭头类型（使用类型安全的访问，移除 as any）
    markerEnd: getMarkerConfig(domainEdge.markerEnd || 'arrowclosed'),
    markerStart: getMarkerConfig(domainEdge.markerStart),
    // 添加 data 属性以存储完整标签（用于悬停显示）
    data: {
      fullLabel: domainEdge.label // 保存完整标签文本
    }
  };

  return edge;
}

/**
 * 批量转换节点
 */
export function toRuntimeNodes(domainNodes: DomainNode[]): Node[] {
  return domainNodes.map(toRuntimeNode);
}

/**
 * 批量转换边
 */
export function toRuntimeEdges(domainEdges: DomainEdge[]): Edge[] {
  return domainEdges.map(toRuntimeEdge);
}

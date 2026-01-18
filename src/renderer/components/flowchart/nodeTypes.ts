import { NodeTypes } from 'reactflow';
import { TodoNode } from './TodoNode';
import { RectangleNode } from './RectangleNode';
import { DiamondNode } from './DiamondNode';
import { CircleNode } from './CircleNode';
import { TextNode } from './TextNode';

/**
 * 注册所有自定义节点类型
 */
export const nodeTypes: NodeTypes = {
  todo: TodoNode,
  rectangle: RectangleNode,
  'rounded-rectangle': RectangleNode, // 使用相同的矩形组件，只是圆角不同
  diamond: DiamondNode,
  circle: CircleNode,
  text: TextNode
};

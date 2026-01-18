# Design Document

## Overview

本设计文档描述了在待办详情中直接展示流程图预览的实现方案。该功能允许用户在不打开流程图编辑器的情况下，直接在待办详情页面查看关联流程图的完整内容。

核心设计理念：
- **即时可见性**：用户无需额外操作即可看到流程图内容
- **只读预览**：预览模式下禁用所有编辑功能，避免意外修改
- **性能优先**：使用缓存和懒加载优化性能
- **渐进增强**：预览失败时提供降级方案

## Architecture

### 组件架构

```
TodoViewDrawer (待办详情抽屉)
├── FlowchartAssociationSection (流程图关联区域)
│   ├── FlowchartPreviewCard (流程图预览卡片) [新增]
│   │   ├── FlowchartPreviewCanvas (流程图预览画布) [新增]
│   │   ├── PreviewHeader (预览头部：名称、描述)
│   │   ├── PreviewFooter (预览底部：操作按钮)
│   │   └── PreviewErrorBoundary (错误边界)
│   └── AssociationList (关联列表 - 降级方案)
```

### 数据流

```
1. 用户打开待办详情
   ↓
2. TodoViewDrawer 加载关联数据
   ↓
3. FlowchartPreviewCard 请求流程图数据
   ↓
4. 从缓存或数据库加载流程图
   ↓
5. FlowchartPreviewCanvas 渲染只读预览
   ↓
6. 用户点击预览 → 打开流程图编辑器
```

## Components and Interfaces

### 1. FlowchartPreviewCard 组件

流程图预览卡片，包含预览画布和交互控制。

```typescript
interface FlowchartPreviewCardProps {
  // 流程图 ID
  flowchartId: string;
  // 流程图名称
  flowchartName: string;
  // 流程图描述（可选）
  flowchartDescription?: string;
  // 需要高亮的节点 ID（节点级别关联）
  highlightedNodeId?: string;
  // 点击预览时的回调
  onPreviewClick: (flowchartId: string, nodeId?: string) => void;
  // 预览高度（可选，默认 300px）
  previewHeight?: number;
  // 是否显示操作按钮
  showActions?: boolean;
}

const FlowchartPreviewCard: React.FC<FlowchartPreviewCardProps> = ({
  flowchartId,
  flowchartName,
  flowchartDescription,
  highlightedNodeId,
  onPreviewClick,
  previewHeight = 300,
  showActions = true
}) => {
  // 加载流程图数据
  const { flowchartData, loading, error } = useFlowchartData(flowchartId);
  
  // 处理点击事件
  const handleClick = () => {
    onPreviewClick(flowchartId, highlightedNodeId);
  };
  
  return (
    <Card hoverable onClick={handleClick}>
      <PreviewHeader name={flowchartName} description={flowchartDescription} />
      {loading && <PreviewSkeleton />}
      {error && <PreviewError error={error} onRetry={refetch} />}
      {flowchartData && (
        <FlowchartPreviewCanvas
          data={flowchartData}
          height={previewHeight}
          highlightedNodeId={highlightedNodeId}
          readOnly={true}
        />
      )}
      {showActions && <PreviewFooter onEdit={handleClick} />}
    </Card>
  );
};
```

### 2. FlowchartPreviewCanvas 组件

只读模式的流程图画布，复用现有的 ReactFlow 组件。

```typescript
interface FlowchartPreviewCanvasProps {
  // 流程图数据
  data: FlowchartData;
  // 预览高度
  height: number;
  // 需要高亮的节点 ID
  highlightedNodeId?: string;
  // 只读模式（始终为 true）
  readOnly: boolean;
}

const FlowchartPreviewCanvas: React.FC<FlowchartPreviewCanvasProps> = ({
  data,
  height,
  highlightedNodeId,
  readOnly
}) => {
  // 转换数据格式为 ReactFlow 格式
  const { nodes, edges } = useMemo(() => {
    return convertToReactFlowFormat(data, highlightedNodeId);
  }, [data, highlightedNodeId]);
  
  return (
    <div style={{ height, width: '100%', border: '1px solid #d9d9d9' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        fitView={true}
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
};
```

### 3. useFlowchartData Hook

管理流程图数据的加载和缓存。

```typescript
interface UseFlowchartDataResult {
  flowchartData: FlowchartData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const useFlowchartData = (flowchartId: string): UseFlowchartDataResult => {
  const [flowchartData, setFlowchartData] = useState<FlowchartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // 缓存管理
  const cacheRef = useRef<Map<string, FlowchartData>>(new Map());
  
  const fetchFlowchart = useCallback(async () => {
    // 检查缓存
    if (cacheRef.current.has(flowchartId)) {
      setFlowchartData(cacheRef.current.get(flowchartId)!);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await window.electronAPI.flowchart.load(flowchartId);
      
      if (!data) {
        throw new Error('流程图不存在');
      }
      
      // 存入缓存
      cacheRef.current.set(flowchartId, data);
      setFlowchartData(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('加载失败'));
    } finally {
      setLoading(false);
    }
  }, [flowchartId]);
  
  useEffect(() => {
    fetchFlowchart();
  }, [fetchFlowchart]);
  
  return {
    flowchartData,
    loading,
    error,
    refetch: fetchFlowchart
  };
};
```

## Data Models

### FlowchartData 接口

```typescript
interface FlowchartData {
  id: string;
  name: string;
  description?: string;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface FlowchartNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    [key: string]: any;
  };
}

interface FlowchartEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  label?: string;
}
```

### 节点高亮样式

```typescript
const getNodeStyle = (nodeId: string, highlightedNodeId?: string) => {
  if (highlightedNodeId && nodeId === highlightedNodeId) {
    return {
      border: '3px solid #1890ff',
      boxShadow: '0 0 10px rgba(24, 144, 255, 0.5)',
      backgroundColor: '#e6f7ff'
    };
  }
  return {};
};
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 预览数据一致性

*For any* 流程图 ID，预览中显示的流程图数据应该与数据库中存储的数据完全一致

**Validates: Requirements 1.2**

### Property 2: 只读模式不可编辑

*For any* 预览模式下的用户操作（拖拽、点击节点、编辑连线），系统都不应该修改流程图数据

**Validates: Requirements 3.1, 3.2**

### Property 3: 缓存一致性

*For any* 流程图数据，如果缓存中存在该数据，则缓存的数据应该与数据库中的数据一致（或在合理的时间窗口内一致）

**Validates: Requirements 5.1**

### Property 4: 高亮节点正确性

*For any* 节点级别关联，预览中高亮的节点 ID 应该与关联记录中的节点 ID 完全匹配

**Validates: Requirements 7.1, 7.2**

### Property 5: 错误处理完整性

*For any* 加载或渲染错误，系统应该捕获错误并显示友好的错误提示，不应该导致整个待办详情页面崩溃

**Validates: Requirements 8.1, 8.5**

### Property 6: 点击跳转正确性

*For any* 预览卡片的点击事件，系统应该打开对应的流程图编辑器，并且如果有高亮节点，应该自动定位到该节点

**Validates: Requirements 2.1, 7.4**

## Error Handling

### 1. 数据加载错误

```typescript
// 流程图不存在
if (!flowchartData) {
  return (
    <Alert
      type="warning"
      message="流程图不存在"
      description="该流程图可能已被删除"
      action={
        <Button size="small" onClick={onRemoveAssociation}>
          移除关联
        </Button>
      }
    />
  );
}

// 加载超时
if (loadingTimeout) {
  return (
    <Alert
      type="error"
      message="加载超时"
      description="流程图加载时间过长，请检查网络连接"
      action={
        <Button size="small" onClick={refetch}>
          重试
        </Button>
      }
    />
  );
}
```

### 2. 渲染错误

```typescript
// 使用错误边界捕获渲染错误
class PreviewErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Preview render error:', error, errorInfo);
    this.setState({ hasError: true, error });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <Alert
          type="error"
          message="预览渲染失败"
          description="流程图预览出现问题，请尝试打开编辑器查看"
          action={
            <Button size="small" onClick={this.props.onOpenEditor}>
              打开编辑器
            </Button>
          }
        />
      );
    }
    
    return this.props.children;
  }
}
```

### 3. 降级方案

当预览功能完全不可用时，回退到原有的卡片列表模式：

```typescript
const FlowchartAssociationSection = () => {
  const [previewEnabled, setPreviewEnabled] = useState(true);
  
  // 检测预览功能是否可用
  useEffect(() => {
    const checkPreviewSupport = async () => {
      try {
        // 测试加载一个简单的流程图
        await testPreviewRendering();
      } catch (error) {
        console.error('Preview not supported:', error);
        setPreviewEnabled(false);
      }
    };
    
    checkPreviewSupport();
  }, []);
  
  if (!previewEnabled) {
    // 降级到原有的卡片列表模式
    return <AssociationCardList associations={associations} />;
  }
  
  return <FlowchartPreviewList associations={associations} />;
};
```

## Testing Strategy

### Unit Tests

1. **FlowchartPreviewCard 组件测试**
   - 测试正常渲染流程图预览
   - 测试加载状态显示
   - 测试错误状态显示
   - 测试点击事件触发

2. **FlowchartPreviewCanvas 组件测试**
   - 测试只读模式下禁用编辑功能
   - 测试节点高亮显示
   - 测试缩放和平移功能

3. **useFlowchartData Hook 测试**
   - 测试数据加载流程
   - 测试缓存机制
   - 测试错误处理
   - 测试重试功能

### Property-Based Tests

1. **Property 1: 预览数据一致性测试**
   - 生成随机流程图数据
   - 保存到数据库
   - 加载预览
   - 验证预览数据与原始数据一致

2. **Property 2: 只读模式测试**
   - 生成随机的用户操作序列
   - 在预览模式下执行操作
   - 验证流程图数据未被修改

3. **Property 4: 高亮节点测试**
   - 生成随机的节点关联
   - 渲染预览
   - 验证高亮的节点 ID 正确

### Integration Tests

1. **完整流程测试**
   - 创建待办并关联流程图
   - 打开待办详情
   - 验证预览正确显示
   - 点击预览跳转到编辑器
   - 验证编辑器正确打开

2. **多流程图预览测试**
   - 创建待办并关联多个流程图
   - 打开待办详情
   - 验证所有预览都正确显示
   - 验证每个预览都可以独立点击

3. **性能测试**
   - 创建包含大量节点的流程图
   - 测试预览加载时间
   - 验证不超过 5 秒超时限制

## Performance Considerations

### 1. 缓存策略

```typescript
// 使用 LRU 缓存限制内存使用
class FlowchartCache {
  private cache = new Map<string, FlowchartData>();
  private maxSize = 20; // 最多缓存 20 个流程图
  
  get(id: string): FlowchartData | undefined {
    const data = this.cache.get(id);
    if (data) {
      // LRU: 移到最后
      this.cache.delete(id);
      this.cache.set(id, data);
    }
    return data;
  }
  
  set(id: string, data: FlowchartData): void {
    // 如果已存在，先删除
    if (this.cache.has(id)) {
      this.cache.delete(id);
    }
    
    // 如果超过最大容量，删除最旧的
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(id, data);
  }
}
```

### 2. 懒加载

```typescript
// 使用 Intersection Observer 实现懒加载
const FlowchartPreviewCard = ({ flowchartId, ...props }) => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={cardRef}>
      {shouldLoad ? (
        <FlowchartPreview flowchartId={flowchartId} {...props} />
      ) : (
        <PreviewPlaceholder />
      )}
    </div>
  );
};
```

### 3. 虚拟化渲染

对于包含大量节点的流程图，使用虚拟化技术只渲染可见区域：

```typescript
// ReactFlow 已经内置了虚拟化支持
<ReactFlow
  nodes={nodes}
  edges={edges}
  // 启用虚拟化（默认启用）
  nodeExtent={[
    [0, 0],
    [10000, 10000]
  ]}
/>
```

## UI/UX Design

### 预览卡片布局

```
┌─────────────────────────────────────────┐
│ 📊 流程图名称                            │
│ 流程图描述（可选）                        │
├─────────────────────────────────────────┤
│                                         │
│         [流程图预览画布]                  │
│                                         │
│         (300px 高度)                     │
│                                         │
├─────────────────────────────────────────┤
│ [🔍 查看详情] [✏️ 编辑]                  │
└─────────────────────────────────────────┘
```

### 交互状态

1. **默认状态**：边框 1px 灰色，无阴影
2. **悬停状态**：边框 2px 蓝色，添加阴影
3. **加载状态**：显示骨架屏动画
4. **错误状态**：显示错误图标和提示信息

### 响应式设计

- **大屏（>1200px）**：2 列布局，每个预览 400px 宽
- **中屏（768-1200px）**：1 列布局，预览占满宽度
- **小屏（<768px）**：1 列布局，预览高度减少到 200px

## Implementation Notes

### 1. 复用现有组件

尽可能复用 `FlowchartDrawer` 中的渲染逻辑：

```typescript
// 提取共享的渲染逻辑到独立的 hook
const useFlowchartRenderer = (data: FlowchartData, options: RenderOptions) => {
  // 转换数据格式
  const { nodes, edges } = useMemo(() => {
    return convertToReactFlowFormat(data);
  }, [data]);
  
  // 应用样式
  const styledNodes = useMemo(() => {
    return applyNodeStyles(nodes, options);
  }, [nodes, options]);
  
  return { nodes: styledNodes, edges };
};

// 在预览和编辑器中都使用这个 hook
```

### 2. 性能监控

添加性能监控以便优化：

```typescript
const FlowchartPreviewCanvas = ({ data, ...props }) => {
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      if (renderTime > 1000) {
        console.warn(`Slow preview render: ${renderTime}ms for ${data.nodes.length} nodes`);
      }
    };
  }, [data]);
  
  // ... 渲染逻辑
};
```

### 3. 渐进式加载

先显示简化版本，再加载完整版本：

```typescript
const FlowchartPreviewCanvas = ({ data, ...props }) => {
  const [detailLevel, setDetailLevel] = useState<'low' | 'high'>('low');
  
  useEffect(() => {
    // 先渲染低细节版本
    setDetailLevel('low');
    
    // 延迟加载高细节版本
    const timer = setTimeout(() => {
      setDetailLevel('high');
    }, 100);
    
    return () => clearTimeout(timer);
  }, [data]);
  
  const simplifiedData = useMemo(() => {
    if (detailLevel === 'low') {
      // 简化节点标签，移除复杂样式
      return simplifyFlowchartData(data);
    }
    return data;
  }, [data, detailLevel]);
  
  // ... 渲染逻辑
};
```

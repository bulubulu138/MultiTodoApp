import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Modal } from 'antd';
import { ReactFlowProvider } from 'reactflow';
import type {
  EmbeddedFlowchartV1,
  FlowchartPatch,
  PersistedEdge,
  PersistedNode,
  ViewportSchema,
} from '../../shared/types';
import { FlowchartCanvas } from './FlowchartCanvas';
import { NodeLibrary } from './flowchart/NodeLibrary';
import { ErrorBoundary } from './flowchart/ErrorBoundary';
import {
  createEmptyEmbeddedFlowchart,
  normalizeEmbeddedFlowchart,
} from '../utils/embeddedFlowchart';

interface FlowchartModalProps {
  open: boolean;
  initialValue: EmbeddedFlowchartV1 | null;
  todoTitle?: string;
  onCancel: () => void;
  onSave: (value: EmbeddedFlowchartV1) => void;
}

const EMBEDDED_NODE_TYPES: PersistedNode['type'][] = ['rectangle', 'diamond', 'circle', 'text'];

function sanitizeNodes(nodes: PersistedNode[]): PersistedNode[] {
  return nodes.map((node) => {
    if (EMBEDDED_NODE_TYPES.includes(node.type)) {
      return node;
    }

    return {
      ...node,
      type: 'rectangle',
      data: {
        ...node.data,
        todoId: undefined,
      },
    };
  });
}

export const FlowchartModal: React.FC<FlowchartModalProps> = ({
  open,
  initialValue,
  todoTitle,
  onCancel,
  onSave,
}) => {
  const [flowchartId, setFlowchartId] = useState(createEmptyEmbeddedFlowchart().id);
  const [nodes, setNodes] = useState<PersistedNode[]>([]);
  const [edges, setEdges] = useState<PersistedEdge[]>([]);
  const [viewport, setViewport] = useState<ViewportSchema>({ x: 0, y: 0, zoom: 1 });

  useEffect(() => {
    if (!open) {
      return;
    }

    const normalized = normalizeEmbeddedFlowchart(initialValue ?? createEmptyEmbeddedFlowchart());
    setFlowchartId(normalized.id);
    setNodes(sanitizeNodes(normalized.nodes));
    setEdges(normalized.edges);
    setViewport(normalized.viewport);
  }, [open, initialValue]);

  const handleNodesEdgesChange = useCallback((newNodes: PersistedNode[], newEdges: PersistedEdge[]) => {
    setNodes(sanitizeNodes(newNodes));
    setEdges(newEdges);
  }, []);

  const handlePatchesApplied = useCallback((patches: FlowchartPatch[]) => {
    const viewportPatch = [...patches].reverse().find(
      (patch): patch is Extract<FlowchartPatch, { type: 'updateViewport' }> => patch.type === 'updateViewport'
    );

    if (viewportPatch) {
      setViewport(viewportPatch.viewport);
    }
  }, []);

  const handleSave = useCallback(() => {
    onSave(
      normalizeEmbeddedFlowchart({
        ...(initialValue ?? createEmptyEmbeddedFlowchart()),
        id: flowchartId,
        nodes,
        edges,
        viewport,
        updatedAt: Date.now(),
      })
    );
  }, [edges, flowchartId, initialValue, nodes, onSave, viewport]);

  const title = useMemo(() => {
    if (!todoTitle) {
      return '编辑流程图';
    }

    return `编辑流程图 - ${todoTitle}`;
  }, [todoTitle]);

  return (
    <Modal
      title={title}
      open={open}
      width="100vw"
      style={{ top: 0, paddingBottom: 0 }}
      styles={{ body: { height: 'calc(100vh - 120px)', padding: 0 } }}
      onCancel={onCancel}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          保存流程图
        </Button>,
      ]}
    >
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ width: 220, borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
          <NodeLibrary onDragStart={() => {}} allowedNodeTypes={EMBEDDED_NODE_TYPES} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <ErrorBoundary>
            <ReactFlowProvider>
              <FlowchartCanvas
                flowchartId={flowchartId}
                persistedNodes={nodes}
                persistedEdges={edges}
                todos={[]}
                onPatchesApplied={handlePatchesApplied}
                onNodesEdgesChange={handleNodesEdgesChange}
                initialViewport={viewport}
              />
            </ReactFlowProvider>
          </ErrorBoundary>
        </div>
      </div>
    </Modal>
  );
};

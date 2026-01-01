import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Drawer, message as antdMessage, Spin, Modal, Input, List, Button, Space } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';
import { ReactFlowProvider } from 'reactflow';
import { FlowchartCanvas } from '../FlowchartCanvas';
import { FlowchartToolbar } from './FlowchartToolbar';
import { NodeLibrary } from './NodeLibrary';
import { ErrorBoundary } from './ErrorBoundary';
import {
  FlowchartSchema,
  PersistedNode,
  PersistedEdge,
  FlowchartPatch,
  Todo
} from '../../../shared/types';
import { ExportService } from '../../services/ExportService';
import { MermaidExporter } from '../../services/MermaidExporter';
import { TextExporter } from '../../services/TextExporter';
import { ImageExporter } from '../../services/ImageExporter';
import { ShareService } from '../../services/ShareService';
import { LayoutService } from '../../services/LayoutService';
import { TemplateService, FlowchartTemplate } from '../../services/TemplateService';
import { PerformanceMonitor } from '../../utils/performanceMonitor';

interface FlowchartDrawerProps {
  visible: boolean;
  todos: Todo[];
  onClose: () => void;
  message: MessageInstance;
}

/**
 * FlowchartDrawer - 流程图抽屉容器
 * 
 * 管理流程图的创建、编辑、保存和导出
 */
export const FlowchartDrawer: React.FC<FlowchartDrawerProps> = ({
  visible,
  todos,
  onClose,
  message
}) => {
  // 当前流程图状态
  const [currentFlowchart, setCurrentFlowchart] = useState<FlowchartSchema | null>(null);
  const [nodes, setNodes] = useState<PersistedNode[]>([]);
  const [edges, setEdges] = useState<PersistedEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Patch 队列（用于防抖保存）
  const patchQueueRef = useRef<FlowchartPatch[]>([]);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 模板选择对话框
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates] = useState<FlowchartTemplate[]>(TemplateService.getAllTemplates());

  // 名称输入对话框
  const [showNameInputModal, setShowNameInputModal] = useState(false);
  const [nameInputValue, setNameInputValue] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<FlowchartTemplate | null>(null);

  // 初始化：显示模板选择
  useEffect(() => {
    if (visible && !currentFlowchart) {
      setShowTemplateModal(true);
    }
  }, [visible, currentFlowchart]);

  // 从模板创建流程图 - 第一步：显示名称输入框
  const handleCreateFromTemplate = useCallback((template: FlowchartTemplate) => {
    setSelectedTemplate(template);
    setNameInputValue(template.name);
    setShowTemplateModal(false);
    setShowNameInputModal(true);
  }, []);

  // 从模板创建流程图 - 第二步：确认名称并创建
  const handleConfirmName = useCallback(() => {
    if (!selectedTemplate || !nameInputValue.trim()) return;

    try {
      const { schema, nodes: templateNodes, edges: templateEdges } = 
        TemplateService.createFromTemplate(selectedTemplate, nameInputValue.trim());

      setCurrentFlowchart(schema);
      setNodes(templateNodes);
      setEdges(templateEdges);
      setShowNameInputModal(false);
      setSelectedTemplate(null);
      setNameInputValue('');

      // 性能监控：检查流程图规模
      PerformanceMonitor.warnLargeFlowchart(templateNodes.length, templateEdges.length);

      message.success('流程图创建成功');
    } catch (error) {
      console.error('Failed to create flowchart from template:', error);
      message.error('创建流程图失败');
    }
  }, [selectedTemplate, nameInputValue]);

  // 取消名称输入
  const handleCancelNameInput = useCallback(() => {
    setShowNameInputModal(false);
    setSelectedTemplate(null);
    setNameInputValue('');
    setShowTemplateModal(true);
  }, []);

  // 处理 Patches（防抖保存）
  const handlePatchesApplied = useCallback((patches: FlowchartPatch[]) => {
    // 添加到队列
    patchQueueRef.current.push(...patches);

    // 清除之前的定时器
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // 500ms 后批量保存
    saveTimerRef.current = setTimeout(() => {
      if (patchQueueRef.current.length > 0 && currentFlowchart) {
        savePatchesToLocalStorage(currentFlowchart.id, patchQueueRef.current);
        patchQueueRef.current = [];
      }
    }, 500);
  }, [currentFlowchart]);

  // 保存到 LocalStorage（临时方案，后续可以改为 IPC）
  const savePatchesToLocalStorage = (flowchartId: string, patches: FlowchartPatch[]) => {
    try {
      PerformanceMonitor.start('flowchart-save');
      
      const key = `flowchart_${flowchartId}`;
      const data = {
        schema: currentFlowchart,
        nodes,
        edges,
        updatedAt: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(data));
      
      const duration = PerformanceMonitor.end('flowchart-save');
      if (duration > 500) {
        console.warn(`Slow save operation: ${duration.toFixed(0)}ms`);
      }
    } catch (error) {
      console.error('Save failed:', error);
      message.error('保存失败，请检查存储空间');
    }
  };

  // 手动保存
  const handleSave = useCallback(async () => {
    if (!currentFlowchart) return;

    setIsSaving(true);
    try {
      // 立即保存所有待处理的 patches
      if (patchQueueRef.current.length > 0) {
        savePatchesToLocalStorage(currentFlowchart.id, patchQueueRef.current);
        patchQueueRef.current = [];
      }

      // 显示性能建议
      const suggestions = PerformanceMonitor.getPerformanceSuggestions(nodes.length, edges.length);
      if (suggestions.length > 0) {
        console.info('Performance suggestions:', suggestions);
      }

      message.success('保存成功');
    } catch (error) {
      message.error('保存失败');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  }, [currentFlowchart, nodes, edges]);

  // 导出
  const handleExport = useCallback(async (format: 'json' | 'mermaid' | 'text' | 'png') => {
    if (!currentFlowchart) return;

    try {
      PerformanceMonitor.start(`export-${format}`);
      
      switch (format) {
        case 'json': {
          const result = ExportService.toJSON(currentFlowchart, nodes, edges);
          ExportService.downloadFile(result.content, result.filename);
          message.success('导出成功');
          break;
        }
        case 'mermaid': {
          const result = MermaidExporter.export(currentFlowchart, nodes, edges);
          ExportService.downloadFile(result.content, result.filename, 'text/plain');
          message.success('导出成功');
          break;
        }
        case 'text': {
          const result = TextExporter.export(currentFlowchart, nodes, edges);
          ExportService.downloadFile(result.content, result.filename, 'text/plain');
          message.success('导出成功');
          break;
        }
        case 'png': {
          const element = document.querySelector('.react-flow') as HTMLElement;
          if (!element) {
            throw new Error('Canvas element not found');
          }
          await ImageExporter.exportToPng(element, `${currentFlowchart.name}.png`);
          message.success('导出成功');
          break;
        }
      }
      
      const duration = PerformanceMonitor.end(`export-${format}`);
      if (duration > 2000) {
        console.warn(`Slow export operation (${format}): ${duration.toFixed(0)}ms`);
      }
    } catch (error) {
      message.error(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('Export error:', error);
    }
  }, [currentFlowchart, nodes, edges]);

  // 分享
  const handleShare = useCallback(async (action: 'link' | 'image') => {
    if (!currentFlowchart) return;

    try {
      if (action === 'link') {
        // 生成分享链接
        const url = ShareService.encodeToURL(currentFlowchart, nodes, edges);
        
        // 检查 URL 长度
        const warning = ShareService.getURLLengthWarning(url);
        if (warning) {
          message.warning(warning);
        }

        // 复制到剪贴板
        await ShareService.copyShareLink(url);
        message.success('分享链接已复制到剪贴板');
      } else if (action === 'image') {
        // 导出为图片
        const element = document.querySelector('.react-flow') as HTMLElement;
        if (!element) {
          throw new Error('Canvas element not found');
        }
        await ImageExporter.exportToPng(element, `${currentFlowchart.name}.png`);
        message.success('图片已导出');
      }
    } catch (error) {
      message.error(`分享失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('Share error:', error);
    }
  }, [currentFlowchart, nodes, edges]);

  // 自动布局
  const handleAutoLayout = useCallback(() => {
    if (!currentFlowchart) return;

    try {
      PerformanceMonitor.start('auto-layout');
      
      const patches = LayoutService.hierarchical(nodes, edges);
      if (patches.length > 0) {
        handlePatchesApplied(patches);
        message.success('布局已应用');
      } else {
        message.info('无需调整布局');
      }
      
      const duration = PerformanceMonitor.end('auto-layout');
      if (duration > 1500) {
        console.warn(`Slow layout operation: ${duration.toFixed(0)}ms`);
      }
    } catch (error) {
      message.error(`自动布局失败: ${error instanceof Error ? error.message : '未知错误'}`);
      console.error('Layout error:', error);
    }
  }, [nodes, edges, handlePatchesApplied, currentFlowchart]);

  // 新建流程图
  const handleNewFlowchart = useCallback(() => {
    setShowTemplateModal(true);
  }, []);

  // 撤销/重做（占位符）
  const handleUndo = useCallback(() => {
    message.info('撤销功能已在画布中实现（Ctrl+Z）');
  }, []);

  const handleRedo = useCallback(() => {
    message.info('重做功能已在画布中实现（Ctrl+Y）');
  }, []);

  return (
    <>
      <Drawer
        title="流程图"
        placement="right"
        width="90%"
        open={visible}
        onClose={onClose}
        bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column' }}
      >
        {currentFlowchart ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <FlowchartToolbar
              onSave={handleSave}
              onExport={handleExport}
              onShare={handleShare}
              onAutoLayout={handleAutoLayout}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onNewFlowchart={handleNewFlowchart}
              canUndo={false}
              canRedo={false}
              isSaving={isSaving}
            />

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div style={{ width: '200px', borderRight: '1px solid #f0f0f0', overflow: 'auto' }}>
                <NodeLibrary onDragStart={() => {}} />
              </div>

              <div style={{ flex: 1 }}>
                <ErrorBoundary>
                  <ReactFlowProvider>
                    <FlowchartCanvas
                      flowchartId={currentFlowchart.id}
                      persistedNodes={nodes}
                      persistedEdges={edges}
                      todos={todos}
                      onPatchesApplied={handlePatchesApplied}
                    />
                  </ReactFlowProvider>
                </ErrorBoundary>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Spin />
            <div style={{ marginTop: 8 }}>加载中...</div>
          </div>
        )}
      </Drawer>

      {/* 模板选择对话框 */}
      <Modal
        title="选择流程图模板"
        open={showTemplateModal}
        onCancel={() => {
          setShowTemplateModal(false);
          if (!currentFlowchart) {
            onClose();
          }
        }}
        footer={null}
        width={600}
      >
        <List
          dataSource={templates}
          renderItem={(template) => (
            <List.Item
              actions={[
                <Button
                  type="primary"
                  onClick={() => handleCreateFromTemplate(template)}
                >
                  使用此模板
                </Button>
              ]}
            >
              <List.Item.Meta
                title={template.name}
                description={template.description}
              />
            </List.Item>
          )}
        />
      </Modal>

      {/* 名称输入对话框 */}
      <Modal
        title="输入流程图名称"
        open={showNameInputModal}
        onOk={handleConfirmName}
        onCancel={handleCancelNameInput}
        okText="创建"
        cancelText="返回"
        okButtonProps={{ disabled: !nameInputValue.trim() }}
      >
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <Input
            placeholder="请输入流程图名称"
            value={nameInputValue}
            onChange={(e) => setNameInputValue(e.target.value)}
            onPressEnter={handleConfirmName}
            autoFocus
            maxLength={50}
          />
          {!nameInputValue.trim() && nameInputValue.length > 0 && (
            <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>
              请输入流程图名称
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

/**
 * FlowchartCanvas Migration Integration Tests
 * 
 * Tests that the FlowchartCanvas component correctly applies migrations
 * when loading flowchart data.
 * 
 * Validates Requirements: 5.4, 5.5
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from 'reactflow';
import { FlowchartCanvas } from './FlowchartCanvas';
import { PersistedNode, PersistedEdge, Todo } from '../../shared/types';

// Mock the electron API
const mockElectronAPI = {
  flowchartTodoAssociation: {
    queryByFlowchart: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ success: true }),
    delete: jest.fn().mockResolvedValue({ success: true })
  }
};

(global as any).window = {
  ...global.window,
  electronAPI: mockElectronAPI
};

describe('FlowchartCanvas Migration Integration', () => {
  const mockTodos: Todo[] = [];
  const mockOnPatchesApplied = jest.fn();
  const mockOnNodesEdgesChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console logs during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Edge Migration', () => {
    it('should apply basic migration for edges without markerEnd', async () => {
      // Legacy edge without markerEnd, type, or animated
      const legacyEdges: PersistedEdge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2'
        } as PersistedEdge
      ];

      const nodes: PersistedNode[] = [
        {
          id: 'n1',
          type: 'rectangle',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1' }
        },
        {
          id: 'n2',
          type: 'rectangle',
          position: { x: 200, y: 0 },
          data: { label: 'Node 2' }
        }
      ];

      const { rerender } = render(
        <ReactFlowProvider>
          <FlowchartCanvas
            flowchartId="test-flowchart"
            persistedNodes={nodes}
            persistedEdges={legacyEdges}
            todos={mockTodos}
            onPatchesApplied={mockOnPatchesApplied}
            onNodesEdgesChange={mockOnNodesEdgesChange}
          />
        </ReactFlowProvider>
      );

      // Wait for migration to be applied
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Applying basic edge migration')
        );
      });

      // Verify migration was logged
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Migration] Migrated edge:')
      );
    });

    it('should apply enhancements migration for edges without style', async () => {
      // Edge with basic properties but no style or labelStyle
      const edgesWithoutStyle: PersistedEdge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          markerEnd: 'arrowclosed',
          type: 'default',
          animated: false,
          label: 'Connection'
          // Missing: style, labelStyle
        }
      ];

      const nodes: PersistedNode[] = [
        {
          id: 'n1',
          type: 'rectangle',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1' }
        },
        {
          id: 'n2',
          type: 'rectangle',
          position: { x: 200, y: 0 },
          data: { label: 'Node 2' }
        }
      ];

      render(
        <ReactFlowProvider>
          <FlowchartCanvas
            flowchartId="test-flowchart"
            persistedNodes={nodes}
            persistedEdges={edgesWithoutStyle}
            todos={mockTodos}
            onPatchesApplied={mockOnPatchesApplied}
            onNodesEdgesChange={mockOnNodesEdgesChange}
          />
        </ReactFlowProvider>
      );

      // Wait for migration to be applied
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Applying enhancements edge migration')
        );
      });

      // Verify enhancements migration was logged
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[EnhancementsMigration] Migrated edge:')
      );
    });

    it('should apply both migrations in sequence', async () => {
      // Legacy edge missing both basic and enhancement properties
      const fullyLegacyEdges: PersistedEdge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2'
          // Missing: markerEnd, type, animated, style, labelStyle
        } as PersistedEdge
      ];

      const nodes: PersistedNode[] = [
        {
          id: 'n1',
          type: 'rectangle',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1' }
        },
        {
          id: 'n2',
          type: 'rectangle',
          position: { x: 200, y: 0 },
          data: { label: 'Node 2' }
        }
      ];

      render(
        <ReactFlowProvider>
          <FlowchartCanvas
            flowchartId="test-flowchart"
            persistedNodes={nodes}
            persistedEdges={fullyLegacyEdges}
            todos={mockTodos}
            onPatchesApplied={mockOnPatchesApplied}
            onNodesEdgesChange={mockOnNodesEdgesChange}
          />
        </ReactFlowProvider>
      );

      // Wait for both migrations to be applied
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Applying basic edge migration')
        );
      });

      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Applying enhancements edge migration')
        );
      });

      // Verify both migrations were logged
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Migration] Migrated edge:')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[EnhancementsMigration] Migrated edge:')
      );
    });

    it('should not migrate edges that already have all properties', async () => {
      // Modern edge with all properties
      const modernEdges: PersistedEdge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          markerEnd: 'arrowclosed',
          type: 'default',
          animated: false,
          style: {
            strokeWidth: 2,
            stroke: '#b1b1b7'
          },
          labelStyle: {
            fontSize: 12,
            color: '#000',
            backgroundColor: '#fff',
            padding: 4,
            borderRadius: 4
          }
        }
      ];

      const nodes: PersistedNode[] = [
        {
          id: 'n1',
          type: 'rectangle',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1' }
        },
        {
          id: 'n2',
          type: 'rectangle',
          position: { x: 200, y: 0 },
          data: { label: 'Node 2' }
        }
      ];

      render(
        <ReactFlowProvider>
          <FlowchartCanvas
            flowchartId="test-flowchart"
            persistedNodes={nodes}
            persistedEdges={modernEdges}
            todos={mockTodos}
            onPatchesApplied={mockOnPatchesApplied}
            onNodesEdgesChange={mockOnNodesEdgesChange}
          />
        </ReactFlowProvider>
      );

      // Wait a bit to ensure no migration is triggered
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Props changed, updating persisted data')
        );
      }, { timeout: 1000 });

      // Verify no migration was applied
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Applying basic edge migration')
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Applying enhancements edge migration')
      );
    });
  });

  describe('Node Migration', () => {
    it('should handle nodes without migration (currently no-op)', async () => {
      const nodes: PersistedNode[] = [
        {
          id: 'n1',
          type: 'rectangle',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1' }
        }
      ];

      const edges: PersistedEdge[] = [];

      render(
        <ReactFlowProvider>
          <FlowchartCanvas
            flowchartId="test-flowchart"
            persistedNodes={nodes}
            persistedEdges={edges}
            todos={mockTodos}
            onPatchesApplied={mockOnPatchesApplied}
            onNodesEdgesChange={mockOnNodesEdgesChange}
          />
        </ReactFlowProvider>
      );

      // Wait for component to render
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Props changed, updating persisted data')
        );
      });

      // Node migration should not be triggered (currently returns false)
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Applying node migration')
      );
    });
  });

  describe('Migration Logging', () => {
    it('should log migration actions for debugging', async () => {
      const legacyEdges: PersistedEdge[] = [
        {
          id: 'e1',
          source: 'n1',
          target: 'n2',
          label: 'Test Label'
        } as PersistedEdge
      ];

      const nodes: PersistedNode[] = [
        {
          id: 'n1',
          type: 'rectangle',
          position: { x: 0, y: 0 },
          data: { label: 'Node 1' }
        },
        {
          id: 'n2',
          type: 'rectangle',
          position: { x: 200, y: 0 },
          data: { label: 'Node 2' }
        }
      ];

      render(
        <ReactFlowProvider>
          <FlowchartCanvas
            flowchartId="test-flowchart"
            persistedNodes={nodes}
            persistedEdges={legacyEdges}
            todos={mockTodos}
            onPatchesApplied={mockOnPatchesApplied}
            onNodesEdgesChange={mockOnNodesEdgesChange}
          />
        </ReactFlowProvider>
      );

      // Wait for migrations
      await waitFor(() => {
        expect(console.log).toHaveBeenCalledWith(
          expect.stringContaining('Applying basic edge migration')
        );
      });

      // Verify detailed migration logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[Migration] Migrated edge:')
      );
      
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[EnhancementsMigration] Migrated edge:')
      );
    });
  });
});

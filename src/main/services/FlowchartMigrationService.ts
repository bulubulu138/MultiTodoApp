import Database from 'better-sqlite3';
import type { PersistedEdge, PersistedNode, ViewportSchema, EmbeddedFlowchartV1 } from '../../shared/types';

export interface MigrationFlowchart {
  id: string;
  name: string;
  description: string | null;
  viewport: ViewportSchema | null;
  nodes: PersistedNode[];
  edges: PersistedEdge[];
  created_at: number;
  updated_at: number;
}

// Helper function to create an empty embedded flowchart (main process version)
function createEmptyEmbeddedFlowchart(): EmbeddedFlowchartV1 {
  return {
    version: 1,
    id: `embedded-flowchart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    thumbnail: '',
    updatedAt: Date.now(),
  };
}

export interface MigrationOptions {
  createNewTodos?: boolean;  // Create new todos for each flowchart
  targetTodoId?: number;     // Migrate all to a specific todo
}

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errors: string[];
  details: Array<{
    flowchartId: string;
    flowchartName: string;
    success: boolean;
    todoId?: number;
    error?: string;
  }>;
}

export interface MigrationStatus {
  hasLegacyFlowcharts: boolean;
  flowchartCount: number;
  totalNodes: number;
  totalEdges: number;
  canMigrate: boolean;
}

export interface MigrationReport {
  success: boolean;
  message: string;
  remainingFlowcharts: number;
}

export class FlowchartMigrationService {
  constructor(private dbManager: any) {}

  /**
   * Get migration status - check if there are any flowcharts to migrate
   */
  async getStatus(): Promise<MigrationStatus> {
    const db = this.dbManager.getDb();
    if (!db) {
      return {
        hasLegacyFlowcharts: false,
        flowchartCount: 0,
        totalNodes: 0,
        totalEdges: 0,
        canMigrate: false
      };
    }

    try {
      // Check if flowcharts table exists
      const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='flowcharts'").get();
      if (!tableInfo) {
        return {
          hasLegacyFlowcharts: false,
          flowchartCount: 0,
          totalNodes: 0,
          totalEdges: 0,
          canMigrate: false
        };
      }

      // Count flowcharts
      const flowchartCount = db.prepare('SELECT COUNT(*) as count FROM flowcharts').get() as { count: number };

      // Count nodes and edges
      const nodeCount = db.prepare('SELECT COUNT(*) as count FROM flowchart_nodes').get() as { count: number };
      const edgeCount = db.prepare('SELECT COUNT(*) as count FROM flowchart_edges').get() as { count: number };

      return {
        hasLegacyFlowcharts: flowchartCount.count > 0,
        flowchartCount: flowchartCount.count,
        totalNodes: nodeCount.count,
        totalEdges: edgeCount.count,
        canMigrate: flowchartCount.count > 0
      };
    } catch (error) {
      console.error('[FlowchartMigration] Error getting status:', error);
      return {
        hasLegacyFlowcharts: false,
        flowchartCount: 0,
        totalNodes: 0,
        totalEdges: 0,
        canMigrate: false
      };
    }
  }

  /**
   * Get all flowcharts that need migration
   */
  async getFlowchartsForMigration(): Promise<MigrationFlowchart[]> {
    const db = this.dbManager.getDb();
    if (!db) {
      return [];
    }

    try {
      // Get all flowcharts
      const flowcharts = db.prepare('SELECT * FROM flowcharts ORDER BY created_at DESC').all() as any[];

      const result: MigrationFlowchart[] = [];

      for (const flowchart of flowcharts) {
        // Get nodes
        const nodes = db.prepare('SELECT * FROM flowchart_nodes WHERE flowchart_id = ?').all(flowchart.id) as any[];
        const parsedNodes: PersistedNode[] = nodes.map(node => ({
          id: node.id,
          type: node.type,
          position: JSON.parse(node.position),
          data: JSON.parse(node.data),
        }));

        // Get edges
        const edges = db.prepare('SELECT * FROM flowchart_edges WHERE flowchart_id = ?').all(flowchart.id) as any[];
        const parsedEdges: PersistedEdge[] = edges.map(edge => {
          const parsedEdge: PersistedEdge = {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type || 'default',
          };

          if (edge.source_handle) parsedEdge.sourceHandle = edge.source_handle;
          if (edge.target_handle) parsedEdge.targetHandle = edge.target_handle;
          if (edge.label) parsedEdge.label = edge.label;
          if (edge.style) parsedEdge.style = JSON.parse(edge.style);

          return parsedEdge;
        });

        // Parse viewport
        let viewport: ViewportSchema | null = null;
        if (flowchart.viewport) {
          try {
            viewport = JSON.parse(flowchart.viewport);
          } catch {
            viewport = { x: 0, y: 0, zoom: 1 };
          }
        }

        result.push({
          id: flowchart.id,
          name: flowchart.name,
          description: flowchart.description,
          viewport,
          nodes: parsedNodes,
          edges: parsedEdges,
          created_at: flowchart.created_at,
          updated_at: flowchart.updated_at,
        });
      }

      return result;
    } catch (error) {
      console.error('[FlowchartMigration] Error getting flowcharts:', error);
      return [];
    }
  }

  /**
   * Convert flowchart to embedded format
   */
  convertToEmbeddedFlowchart(flowchart: MigrationFlowchart): EmbeddedFlowchartV1 {
    return {
      ...createEmptyEmbeddedFlowchart(),
      nodes: flowchart.nodes,
      edges: flowchart.edges,
      viewport: flowchart.viewport || { x: 0, y: 0, zoom: 1 },
      updatedAt: flowchart.updated_at,
    };
  }

  /**
   * Generate HTML content for embedded flowchart
   */
  private generateFlowchartHTML(flowchart: EmbeddedFlowchartV1): string {
    // Serialize the flowchart data
    const serialized = JSON.stringify(flowchart);
    return `<flowchart-preview class="flowchart-embedded" contenteditable="false" data-flowchart="${serialized.replace(/"/g, '&quot;')}"></flowchart-preview>`;
  }

  /**
   * Execute migration
   */
  async migrate(options: MigrationOptions = {}): Promise<MigrationResult> {
    const db = this.dbManager.getDb();
    if (!db) {
      return {
        success: false,
        migratedCount: 0,
        skippedCount: 0,
        errors: ['Database not available'],
        details: []
      };
    }

    const flowcharts = await this.getFlowchartsForMigration();
    const errors: string[] = [];
    const details: MigrationResult['details'] = [];
    let migratedCount = 0;
    let skippedCount = 0;

    for (const flowchart of flowcharts) {
      try {
        const embeddedFlowchart = this.convertToEmbeddedFlowchart(flowchart);
        const flowchartHTML = this.generateFlowchartHTML(embeddedFlowchart);

        if (options.targetTodoId) {
          // Append to existing todo
          const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(options.targetTodoId);
          if (todo) {
            const currentContent = (todo as any).content || '';
            const newContent = currentContent +
              (currentContent ? '<br><br>' : '') +
              `<h3>${flowchart.name}</h3>` +
              flowchartHTML;

            db.prepare('UPDATE todos SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(newContent, options.targetTodoId);

            migratedCount++;
            details.push({
              flowchartId: flowchart.id,
              flowchartName: flowchart.name,
              success: true,
              todoId: options.targetTodoId
            });
          } else {
            skippedCount++;
            details.push({
              flowchartId: flowchart.id,
              flowchartName: flowchart.name,
              success: false,
              error: 'Target todo not found'
            });
          }
        } else if (options.createNewTodos) {
          // Create new todo for each flowchart
          const title = flowchart.name;
          const description = flowchart.description || '';
          const content = description +
            (description ? '<br><br>' : '') +
            flowchartHTML;

          const result = db.prepare(`
            INSERT INTO todos (title, content, status, priority, created_at, updated_at)
            VALUES (?, ?, 'pending', 'medium', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(title, content);

          migratedCount++;
          details.push({
            flowchartId: flowchart.id,
            flowchartName: flowchart.name,
            success: true,
            todoId: result.lastInsertRowid as number
          });
        } else {
          skippedCount++;
          details.push({
            flowchartId: flowchart.id,
            flowchartName: flowchart.name,
            success: false,
            error: 'No migration option specified'
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push(`Failed to migrate ${flowchart.name}: ${errorMsg}`);
        details.push({
          flowchartId: flowchart.id,
          flowchartName: flowchart.name,
          success: false,
          error: errorMsg
        });
      }
    }

    return {
      success: errors.length === 0,
      migratedCount,
      skippedCount,
      errors,
      details
    };
  }

  /**
   * Cleanup legacy flowchart tables
   */
  async cleanupLegacyFlowcharts(): Promise<{ success: boolean; error?: string }> {
    const db = this.dbManager.getDb();
    if (!db) {
      return { success: false, error: 'Database not available' };
    }

    try {
      // Delete associations first (foreign key dependencies)
      db.prepare('DROP TABLE IF EXISTS flowchart_todo_associations').run();

      // Delete edges
      db.prepare('DROP TABLE IF EXISTS flowchart_edges').run();

      // Delete nodes
      db.prepare('DROP TABLE IF EXISTS flowchart_nodes').run();

      // Delete flowcharts
      db.prepare('DROP TABLE IF EXISTS flowcharts').run();

      console.log('[FlowchartMigration] Legacy flowchart tables dropped successfully');
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[FlowchartMigration] Error dropping tables:', error);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Verify migration result
   */
  async verifyMigration(): Promise<MigrationReport> {
    const status = await this.getStatus();

    if (status.flowchartCount === 0) {
      return {
        success: true,
        message: '所有流程图已成功迁移',
        remainingFlowcharts: 0
      };
    }

    return {
      success: false,
      message: `仍有 ${status.flowchartCount} 个流程图未迁移`,
      remainingFlowcharts: status.flowchartCount
    };
  }
}

import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import {
  FlowchartSchema,
  PersistedNode,
  PersistedEdge,
  FlowchartPatch
} from '../../shared/types';

/**
 * FlowchartRepository
 * 
 * 流程图数据访问层，负责数据库 CRUD 操作
 * 使用增量 Patch 模型进行高效保存
 */
export class FlowchartRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 创建新流程图
   */
  create(flowchart: Omit<FlowchartSchema, 'createdAt' | 'updatedAt'>): FlowchartSchema {
    const now = Date.now();
    const schema: FlowchartSchema = {
      ...flowchart,
      createdAt: now,
      updatedAt: now
    };

    this.db.prepare(`
      INSERT INTO flowcharts (id, name, description, viewport, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      schema.id,
      schema.name,
      schema.description || null,
      JSON.stringify(schema.viewport),
      schema.createdAt,
      schema.updatedAt
    );

    return schema;
  }

  /**
   * 加载流程图（只加载持久化数据，不加载 Todo）
   */
  load(id: string): { schema: FlowchartSchema; nodes: PersistedNode[]; edges: PersistedEdge[] } | null {
    // 加载流程图元数据
    const schemaRow = this.db.prepare('SELECT * FROM flowcharts WHERE id = ?').get(id) as any;
    if (!schemaRow) {
      return null;
    }

    const schema: FlowchartSchema = {
      id: schemaRow.id,
      name: schemaRow.name,
      description: schemaRow.description,
      viewport: JSON.parse(schemaRow.viewport),
      createdAt: schemaRow.created_at,
      updatedAt: schemaRow.updated_at
    };

    // 加载节点（只加载 PersistedNode，不加载 Todo 数据）
    const nodeRows = this.db.prepare('SELECT * FROM flowchart_nodes WHERE flowchart_id = ?').all(id) as any[];
    const nodes: PersistedNode[] = nodeRows.map(row => ({
      id: row.id,
      type: row.type,
      position: JSON.parse(row.position),
      data: JSON.parse(row.data)
    }));

    // 加载边
    const edgeRows = this.db.prepare('SELECT * FROM flowchart_edges WHERE flowchart_id = ?').all(id) as any[];
    const edges: PersistedEdge[] = edgeRows.map(row => ({
      id: row.id,
      source: row.source,
      target: row.target,
      sourceHandle: row.source_handle,
      targetHandle: row.target_handle,
      type: row.type,
      label: row.label,
      style: row.style ? JSON.parse(row.style) : undefined
    }));

    return { schema, nodes, edges };
  }

  /**
   * 获取流程图列表
   */
  list(): FlowchartSchema[] {
    const rows = this.db.prepare('SELECT * FROM flowcharts ORDER BY updated_at DESC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      viewport: JSON.parse(row.viewport),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * 删除流程图
   */
  delete(id: string): void {
    // 由于设置了 ON DELETE CASCADE，删除流程图会自动删除相关的节点和边
    this.db.prepare('DELETE FROM flowcharts WHERE id = ?').run(id);
  }

  /**
   * 使用增量 Patch 保存流程图
   * 只保存变化的部分，而不是全量删除再插入
   */
  savePatches(flowchartId: string, patches: FlowchartPatch[]): void {
    const now = Date.now();

    // 使用事务确保原子性
    const transaction = this.db.transaction(() => {
      for (const patch of patches) {
        switch (patch.type) {
          case 'addNode':
            this.db.prepare(`
              INSERT INTO flowchart_nodes (id, flowchart_id, type, position, data, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
              patch.node.id,
              flowchartId,
              patch.node.type,
              JSON.stringify(patch.node.position),
              JSON.stringify(patch.node.data),
              now,
              now
            );
            break;

          case 'updateNode': {
            const updates: string[] = [];
            const values: any[] = [];

            if (patch.changes.position) {
              updates.push('position = ?');
              values.push(JSON.stringify(patch.changes.position));
            }
            if (patch.changes.data) {
              updates.push('data = ?');
              values.push(JSON.stringify(patch.changes.data));
            }
            if (patch.changes.type) {
              updates.push('type = ?');
              values.push(patch.changes.type);
            }

            if (updates.length > 0) {
              updates.push('updated_at = ?');
              values.push(now);
              values.push(patch.id);

              this.db.prepare(`
                UPDATE flowchart_nodes
                SET ${updates.join(', ')}
                WHERE id = ?
              `).run(...values);
            }
            break;
          }

          case 'removeNode':
            this.db.prepare('DELETE FROM flowchart_nodes WHERE id = ?').run(patch.id);
            // 删除相关的边
            this.db.prepare('DELETE FROM flowchart_edges WHERE source = ? OR target = ?').run(patch.id, patch.id);
            break;

          case 'addEdge': {
            const connectionHash = this.getConnectionHash(patch.edge);
            this.db.prepare(`
              INSERT INTO flowchart_edges 
              (id, flowchart_id, source, target, source_handle, target_handle, type, label, style, connection_hash, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              patch.edge.id,
              flowchartId,
              patch.edge.source,
              patch.edge.target,
              patch.edge.sourceHandle || null,
              patch.edge.targetHandle || null,
              patch.edge.type || 'default',
              patch.edge.label || null,
              patch.edge.style ? JSON.stringify(patch.edge.style) : null,
              connectionHash,
              now,
              now
            );
            break;
          }

          case 'updateEdge': {
            const updates: string[] = [];
            const values: any[] = [];

            if (patch.changes.label !== undefined) {
              updates.push('label = ?');
              values.push(patch.changes.label);
            }
            if (patch.changes.style) {
              updates.push('style = ?');
              values.push(JSON.stringify(patch.changes.style));
            }
            if (patch.changes.type) {
              updates.push('type = ?');
              values.push(patch.changes.type);
            }

            if (updates.length > 0) {
              updates.push('updated_at = ?');
              values.push(now);
              values.push(patch.id);

              this.db.prepare(`
                UPDATE flowchart_edges
                SET ${updates.join(', ')}
                WHERE id = ?
              `).run(...values);
            }
            break;
          }

          case 'removeEdge':
            this.db.prepare('DELETE FROM flowchart_edges WHERE id = ?').run(patch.id);
            break;

          case 'updateViewport':
            this.db.prepare(`
              UPDATE flowcharts
              SET viewport = ?, updated_at = ?
              WHERE id = ?
            `).run(JSON.stringify(patch.viewport), now, flowchartId);
            break;

          case 'updateMetadata': {
            const updates: string[] = [];
            const values: any[] = [];

            if (patch.changes.name) {
              updates.push('name = ?');
              values.push(patch.changes.name);
            }
            if (patch.changes.description !== undefined) {
              updates.push('description = ?');
              values.push(patch.changes.description);
            }

            if (updates.length > 0) {
              updates.push('updated_at = ?');
              values.push(now);
              values.push(flowchartId);

              this.db.prepare(`
                UPDATE flowcharts
                SET ${updates.join(', ')}
                WHERE id = ?
              `).run(...values);
            }
            break;
          }
        }
      }

      // 更新流程图的 updated_at
      this.db.prepare('UPDATE flowcharts SET updated_at = ? WHERE id = ?').run(now, flowchartId);
    });

    transaction();
  }

  /**
   * 计算连接哈希（用于快速对比边）
   */
  private getConnectionHash(edge: PersistedEdge): string {
    const data = `${edge.source}-${edge.target}-${edge.type || 'default'}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * 更新流程图元数据
   */
  updateMetadata(id: string, updates: Partial<Omit<FlowchartSchema, 'id' | 'createdAt' | 'updatedAt'>>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.viewport) {
      fields.push('viewport = ?');
      values.push(JSON.stringify(updates.viewport));
    }

    if (fields.length > 0) {
      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);

      this.db.prepare(`
        UPDATE flowcharts
        SET ${fields.join(', ')}
        WHERE id = ?
      `).run(...values);
    }
  }
}

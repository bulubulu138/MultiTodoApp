import Database from 'better-sqlite3';
import * as crypto from 'crypto';
import {
  FlowchartSchema,
  PersistedNode,
  PersistedEdge,
  FlowchartPatch
} from '../../shared/types';

/**
 * 为节点查找一个安全的、不重叠的位置
 * 使用网格布局策略，确保节点不会重叠
 */
function findSafePosition(nodeId: string, existingNodes: PersistedNode[]): { x: number; y: number } {
  const gridSize = 250; // 节点间距
  const cols = 5; // 每行节点数

  // 找到第一个空闲的网格位置
  for (let i = 0; i < 100; i++) {
    const x = (i % cols) * gridSize;
    const y = Math.floor(i / cols) * gridSize;

    // 检查这个位置是否已被占用
    const isOccupied = existingNodes.some(node => {
      if (!node.position) return false;
      try {
        return Math.abs(node.position.x - x) < 200 && Math.abs(node.position.y - y) < 100;
      } catch {
        return false;
      }
    });

    if (!isOccupied) {
      return { x, y };
    }
  }

  // 如果所有网格位置都被占用，返回一个随机位置
  return {
    x: Math.random() * 1000,
    y: Math.random() * 1000
  };
}

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
    const nodes: PersistedNode[] = [];

    for (const row of nodeRows) {
      let position: { x: number; y: number };

      try {
        position = JSON.parse(row.position);

        // 增强的位置验证
        if (!position || typeof position.x !== 'number' || typeof position.y !== 'number' ||
            !Number.isFinite(position.x) || !Number.isFinite(position.y) ||
            Math.abs(position.x) > 100000 || Math.abs(position.y) > 100000) {
          console.error(`[FlowchartRepository] Node ${row.id} has invalid position data:`, row.position);

          // 尝试修复：使用安全位置计算不重叠的位置
          const safePosition = findSafePosition(row.id, nodes);
          position = safePosition;
          console.warn(`[FlowchartRepository] Using safe position for node ${row.id}:`, safePosition);
        } else {
          console.log(`[FlowchartRepository] Loaded position for node ${row.id}:`, position);
        }
      } catch (error) {
        console.error(`[FlowchartRepository] Failed to parse position for node ${row.id}:`, error);
        // 使用安全位置而不是固定的 (0, 0)
        const safePosition = findSafePosition(row.id, nodes);
        position = safePosition;
        console.warn(`[FlowchartRepository] Using safe position for node ${row.id}:`, safePosition);
      }

      nodes.push({
        id: row.id,
        type: row.type,
        position,
        data: JSON.parse(row.data)
      });
    }

    // 加载边
    const edgeRows = this.db.prepare('SELECT * FROM flowchart_edges WHERE flowchart_id = ?').all(id) as any[];
    const edges: PersistedEdge[] = edgeRows.map(row => {
      // 解析 JSON 字段
      let labelStyle, style;
      try {
        labelStyle = row.label_style ? JSON.parse(row.label_style) : undefined;
        style = row.style ? JSON.parse(row.style) : undefined;
      } catch (error) {
        console.warn(`[FlowchartRepository] Failed to parse style for edge ${row.id}:`, error);
        labelStyle = undefined;
        style = undefined;
      }

      // 解析 animated（存储为 INTEGER 0/1）
      const animated = row.animated === 1;

      return {
        id: row.id,
        source: row.source,
        target: row.target,
        // 修复：将空字符串转换为 undefined，确保 ReactFlow 能正确连接
        sourceHandle: row.source_handle || undefined,
        targetHandle: row.target_handle || undefined,
        type: row.type,
        label: row.label,
        labelStyle,
        style,
        markerEnd: row.marker_end || undefined,
        markerStart: row.marker_start || undefined,
        animated
      };
    });

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
   *
   * 使用显式级联删除，确保所有关联数据被正确清理：
   * 1. 删除流程图与待办的关联
   * 2. 删除流程图的边
   * 3. 删除流程图的节点
   * 4. 删除流程图本身
   *
   * 使用事务确保删除操作的原子性
   */
  delete(id: string): void {
    // 使用事务确保删除操作的原子性
    const transaction = this.db.transaction(() => {
      // 1. 删除流程图与待办的关联
      this.db.prepare('DELETE FROM flowchart_todo_associations WHERE flowchart_id = ?').run(id);

      // 2. 删除流程图的边
      this.db.prepare('DELETE FROM flowchart_edges WHERE flowchart_id = ?').run(id);

      // 3. 删除流程图的节点
      this.db.prepare('DELETE FROM flowchart_nodes WHERE flowchart_id = ?').run(id);

      // 4. 最后删除流程图本身
      const result = this.db.prepare('DELETE FROM flowcharts WHERE id = ?').run(id);

      if (result.changes === 0) {
        throw new Error(`Flowchart ${id} not found`);
      }
    });

    transaction();
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
              // 验证位置数据的有效性
              const pos = patch.changes.position;
              if (pos && typeof pos.x === 'number' && typeof pos.y === 'number' &&
                  Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
                updates.push('position = ?');
                const positionJson = JSON.stringify(pos);
                values.push(positionJson);
                console.log(`[FlowchartRepository] Saving position for node ${patch.id}:`, pos, '→', positionJson);
              } else {
                console.error(`[FlowchartRepository] Invalid position data for node ${patch.id}:`, pos);
                // 不保存无效的位置数据
              }
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
              console.log(`[FlowchartRepository] Updated node ${patch.id} with ${updates.length - 1} changes`);
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
              (id, flowchart_id, source, target, source_handle, target_handle, type, label, label_style, style, marker_end, marker_start, animated, connection_hash, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              patch.edge.id,
              flowchartId,
              patch.edge.source,
              patch.edge.target,
              patch.edge.sourceHandle || null,
              patch.edge.targetHandle || null,
              patch.edge.type || 'default',
              patch.edge.label || null,
              patch.edge.labelStyle ? JSON.stringify(patch.edge.labelStyle) : null,
              patch.edge.style ? JSON.stringify(patch.edge.style) : null,
              patch.edge.markerEnd || null,
              patch.edge.markerStart || null,
              patch.edge.animated ? 1 : 0,
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
            if (patch.changes.labelStyle !== undefined) {
              updates.push('label_style = ?');
              values.push(patch.changes.labelStyle ? JSON.stringify(patch.changes.labelStyle) : null);
            }
            if (patch.changes.style) {
              updates.push('style = ?');
              values.push(JSON.stringify(patch.changes.style));
            }
            if (patch.changes.type) {
              updates.push('type = ?');
              values.push(patch.changes.type);
            }
            // 支持更新 markerEnd, markerStart, animated
            if (patch.changes.markerEnd !== undefined) {
              updates.push('marker_end = ?');
              values.push(patch.changes.markerEnd);
            }
            if (patch.changes.markerStart !== undefined) {
              updates.push('marker_start = ?');
              values.push(patch.changes.markerStart);
            }
            if (patch.changes.animated !== undefined) {
              updates.push('animated = ?');
              values.push(patch.changes.animated ? 1 : 0);
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

  /**
   * 查询单个待办关联的流程图节点
   * @param todoId 待办任务 ID（字符串格式）
   * @returns 关联的流程图节点信息数组
   */
  queryNodesByTodoId(todoId: string): Array<{
    flowchartId: string;
    flowchartName: string;
    nodeId: string;
    nodeLabel: string;
  }> {
    try {
      const rows = this.db.prepare(`
        SELECT 
          f.id as flowchartId,
          f.name as flowchartName,
          n.id as nodeId,
          json_extract(n.data, '$.label') as nodeLabel
        FROM flowchart_nodes n
        INNER JOIN flowcharts f ON n.flowchart_id = f.id
        WHERE json_extract(n.data, '$.todoId') = ?
        ORDER BY f.updated_at DESC
      `).all(todoId) as any[];

      return rows.map(row => ({
        flowchartId: row.flowchartId,
        flowchartName: row.flowchartName,
        nodeId: row.nodeId,
        nodeLabel: row.nodeLabel || 'Untitled Node'
      }));
    } catch (error) {
      console.error('Error querying nodes by todoId:', error);
      return [];
    }
  }

  /**
   * 批量查询多个待办关联的流程图节点
   * @param todoIds 待办任务 ID 数组（字符串格式）
   * @returns Map<todoId, associations[]>
   */
  queryNodesByTodoIds(todoIds: string[]): Map<string, Array<{
    flowchartId: string;
    flowchartName: string;
    nodeId: string;
    nodeLabel: string;
  }>> {
    const result = new Map<string, Array<{
      flowchartId: string;
      flowchartName: string;
      nodeId: string;
      nodeLabel: string;
    }>>();

    // 如果没有待办 ID，直接返回空 Map
    if (!todoIds || todoIds.length === 0) {
      return result;
    }

    try {
      // 调试日志：记录查询参数
      console.log('[FlowchartRepository] Querying nodes by todoIds:', todoIds);
      
      // 构建 IN 子句的占位符
      const placeholders = todoIds.map(() => '?').join(', ');
      
      const rows = this.db.prepare(`
        SELECT 
          json_extract(n.data, '$.todoId') as todoId,
          f.id as flowchartId,
          f.name as flowchartName,
          n.id as nodeId,
          json_extract(n.data, '$.label') as nodeLabel
        FROM flowchart_nodes n
        INNER JOIN flowcharts f ON n.flowchart_id = f.id
        WHERE json_extract(n.data, '$.todoId') IN (${placeholders})
        ORDER BY f.updated_at DESC
      `).all(...todoIds) as any[];

      // 调试日志：记录查询结果
      console.log('[FlowchartRepository] Query returned', rows.length, 'rows');
      rows.forEach(row => {
        console.log('[FlowchartRepository] Row:', {
          todoId: row.todoId,
          todoIdType: typeof row.todoId,
          flowchartName: row.flowchartName,
          nodeLabel: row.nodeLabel
        });
      });

      // 按 todoId 分组
      rows.forEach(row => {
        const todoId = row.todoId;
        if (!result.has(todoId)) {
          result.set(todoId, []);
        }
        result.get(todoId)!.push({
          flowchartId: row.flowchartId,
          flowchartName: row.flowchartName,
          nodeId: row.nodeId,
          nodeLabel: row.nodeLabel || 'Untitled Node'
        });
      });

      console.log('[FlowchartRepository] Result Map keys:', Array.from(result.keys()));
      return result;
    } catch (error) {
      console.error('Error querying nodes by todoIds:', error);
      return result;
    }
  }

  /**
   * 清理无效的 todoId 引用
   * 当待办被删除时调用，将节点中的 todoId 设置为 null
   * @param todoId 待办任务 ID（字符串格式）
   */
  cleanupInvalidTodoReferences(todoId: string): void {
    try {
      // 查找所有引用该待办的节点
      const nodes = this.db.prepare(`
        SELECT id, flowchart_id, data 
        FROM flowchart_nodes 
        WHERE json_extract(data, '$.todoId') = ?
      `).all(todoId) as any[];

      if (nodes.length === 0) {
        return;
      }

      console.log(`Cleaning up ${nodes.length} node(s) referencing deleted todo ${todoId}`);

      // 使用事务确保原子性
      const transaction = this.db.transaction(() => {
        const now = Date.now();
        
        nodes.forEach(node => {
          const data = JSON.parse(node.data);
          // 移除 todoId 引用
          delete data.todoId;
          
          // 更新节点数据
          this.db.prepare(`
            UPDATE flowchart_nodes 
            SET data = ?, updated_at = ? 
            WHERE id = ?
          `).run(JSON.stringify(data), now, node.id);
        });
      });

      transaction();
    } catch (error) {
      console.error('Error cleaning up invalid todo references:', error);
      throw error;
    }
  }

  /**
   * 创建数据库索引以优化查询性能
   * 应该在数据库初始化时调用
   */
  createIndexes(): void {
    try {
      // 为 todoId 创建索引（使用 JSON 提取）
      // 注意：SQLite 的 JSON 索引需要使用表达式索引
      this.db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_flowchart_nodes_todo_id 
        ON flowchart_nodes(json_extract(data, '$.todoId'))
      `).run();

      console.log('Flowchart indexes created successfully');
    } catch (error) {
      console.error('Error creating flowchart indexes:', error);
      // 不抛出错误，因为索引可能已存在
    }
  }
}

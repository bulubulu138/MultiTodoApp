import Database from 'better-sqlite3';

/**
 * 流程图关联信息
 */
export interface FlowchartAssociationInfo {
  flowchartId: string;
  flowchartName: string;
  flowchartDescription?: string;
  createdAt: number;
}

/**
 * FlowchartTodoAssociationRepository
 *
 * 流程图与待办关联数据访问层
 * 负责管理流程图级别的待办关联关系
 */
export class FlowchartTodoAssociationRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * 创建流程图与待办的关联
   * @param flowchartId 流程图ID
   * @param todoId 待办ID
   */
  create(flowchartId: string, todoId: number): void {
    // 检查是否已存在
    if (this.exists(flowchartId, todoId)) {
      return;
    }

    this.db.prepare(`
      INSERT INTO flowchart_todo_associations (flowchart_id, todo_id, created_at)
      VALUES (?, ?, ?)
    `).run(flowchartId, todoId, Date.now());
  }

  /**
   * 删除流程图与待办的关联
   * @param flowchartId 流程图ID
   * @param todoId 待办ID
   */
  delete(flowchartId: string, todoId: number): void {
    this.db.prepare(`
      DELETE FROM flowchart_todo_associations
      WHERE flowchart_id = ? AND todo_id = ?
    `).run(flowchartId, todoId);
  }

  /**
   * 查询流程图关联的所有待办ID
   * @param flowchartId 流程图ID
   * @returns 待办ID数组
   */
  queryByFlowchartId(flowchartId: string): number[] {
    const rows = this.db.prepare(`
      SELECT todo_id
      FROM flowchart_todo_associations
      WHERE flowchart_id = ?
      ORDER BY created_at DESC
    `).all(flowchartId) as Array<{ todo_id: number }>;

    return rows.map(row => row.todo_id);
  }

  /**
   * 查询待办关联的所有流程图信息
   * @param todoId 待办ID
   * @returns 流程图关联信息数组
   */
  queryByTodoId(todoId: number): FlowchartAssociationInfo[] {
    const rows = this.db.prepare(`
      SELECT
        f.id as flowchart_id,
        f.name as flowchart_name,
        f.description as flowchart_description,
        fta.created_at
      FROM flowchart_todo_associations fta
      INNER JOIN flowcharts f ON fta.flowchart_id = f.id
      WHERE fta.todo_id = ?
      ORDER BY fta.created_at DESC
    `).all(todoId) as Array<{
      flowchart_id: string;
      flowchart_name: string;
      flowchart_description: string | null;
      created_at: number;
    }>;

    return rows.map(row => ({
      flowchartId: row.flowchart_id,
      flowchartName: row.flowchart_name,
      flowchartDescription: row.flowchart_description || undefined,
      createdAt: row.created_at
    }));
  }

  /**
   * 批量查询多个待办关联的流程图信息
   * @param todoIds 待办ID数组
   * @returns Map<todoId, FlowchartAssociationInfo[]>
   */
  queryByTodoIds(todoIds: number[]): Map<number, FlowchartAssociationInfo[]> {
    const result = new Map<number, FlowchartAssociationInfo[]>();

    if (todoIds.length === 0) {
      return result;
    }

    const placeholders = todoIds.map(() => '?').join(',');
    const rows = this.db.prepare(`
      SELECT
        fta.todo_id,
        f.id as flowchart_id,
        f.name as flowchart_name,
        f.description as flowchart_description,
        fta.created_at
      FROM flowchart_todo_associations fta
      INNER JOIN flowcharts f ON fta.flowchart_id = f.id
      WHERE fta.todo_id IN (${placeholders})
      ORDER BY fta.todo_id, fta.created_at DESC
    `).all(...todoIds) as Array<{
      todo_id: number;
      flowchart_id: string;
      flowchart_name: string;
      flowchart_description: string | null;
      created_at: number;
    }>;

    for (const row of rows) {
      const info: FlowchartAssociationInfo = {
        flowchartId: row.flowchart_id,
        flowchartName: row.flowchart_name,
        flowchartDescription: row.flowchart_description || undefined,
        createdAt: row.created_at
      };

      if (!result.has(row.todo_id)) {
        result.set(row.todo_id, []);
      }
      result.get(row.todo_id)!.push(info);
    }

    return result;
  }

  /**
   * 检查关联是否存在
   * @param flowchartId 流程图ID
   * @param todoId 待办ID
   * @returns 是否存在
   */
  exists(flowchartId: string, todoId: number): boolean {
    const row = this.db.prepare(`
      SELECT 1 FROM flowchart_todo_associations
      WHERE flowchart_id = ? AND todo_id = ?
      LIMIT 1
    `).get(flowchartId, todoId);

    return !!row;
  }
}

import Database from 'better-sqlite3';

/**
 * FlowchartTodoAssociationRepository
 * 
 * 流程图与待办关联数据访问层
 * 负责管理流程图级别的待办关联关系
 */

export interface FlowchartAssociationInfo {
  flowchartId: string;
  flowchartName: string;
  flowchartDescription?: string;
  createdAt: number;
}

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
    const now = Date.now();
    
    try {
      this.db.prepare(`
        INSERT INTO flowchart_todo_associations (flowchart_id, todo_id, created_at)
        VALUES (?, ?, ?)
      `).run(flowchartId, todoId, now);
      
      console.log(`[FlowchartTodoAssociation] Created association: flowchart=${flowchartId}, todo=${todoId}`);
    } catch (error: any) {
      // 如果是唯一约束冲突（已存在），忽略错误
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE constraint failed')) {
        console.log(`[FlowchartTodoAssociation] Association already exists: flowchart=${flowchartId}, todo=${todoId}`);
        return;
      }
      throw error;
    }
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
    
    console.log(`[FlowchartTodoAssociation] Deleted association: flowchart=${flowchartId}, todo=${todoId}`);
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
    `).all(flowchartId) as any[];
    
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
        f.id as flowchartId,
        f.name as flowchartName,
        f.description as flowchartDescription,
        a.created_at as createdAt
      FROM flowchart_todo_associations a
      INNER JOIN flowcharts f ON a.flowchart_id = f.id
      WHERE a.todo_id = ?
      ORDER BY a.created_at DESC
    `).all(todoId) as any[];
    
    return rows.map(row => ({
      flowchartId: row.flowchartId,
      flowchartName: row.flowchartName,
      flowchartDescription: row.flowchartDescription || undefined,
      createdAt: row.createdAt
    }));
  }

  /**
   * 批量查询多个待办关联的流程图信息
   * @param todoIds 待办ID数组
   * @returns Map<todoId, FlowchartAssociationInfo[]>
   */
  queryByTodoIds(todoIds: number[]): Map<number, FlowchartAssociationInfo[]> {
    const result = new Map<number, FlowchartAssociationInfo[]>();
    
    if (!todoIds || todoIds.length === 0) {
      return result;
    }
    
    try {
      // 构建 IN 子句的占位符
      const placeholders = todoIds.map(() => '?').join(', ');
      
      const rows = this.db.prepare(`
        SELECT 
          a.todo_id as todoId,
          f.id as flowchartId,
          f.name as flowchartName,
          f.description as flowchartDescription,
          a.created_at as createdAt
        FROM flowchart_todo_associations a
        INNER JOIN flowcharts f ON a.flowchart_id = f.id
        WHERE a.todo_id IN (${placeholders})
        ORDER BY a.created_at DESC
      `).all(...todoIds) as any[];
      
      // 按 todoId 分组
      rows.forEach(row => {
        const todoId = row.todoId;
        if (!result.has(todoId)) {
          result.set(todoId, []);
        }
        result.get(todoId)!.push({
          flowchartId: row.flowchartId,
          flowchartName: row.flowchartName,
          flowchartDescription: row.flowchartDescription || undefined,
          createdAt: row.createdAt
        });
      });
      
      return result;
    } catch (error) {
      console.error('[FlowchartTodoAssociation] Error querying by todoIds:', error);
      return result;
    }
  }

  /**
   * 检查关联是否存在
   * @param flowchartId 流程图ID
   * @param todoId 待办ID
   * @returns 是否存在
   */
  exists(flowchartId: string, todoId: number): boolean {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM flowchart_todo_associations
      WHERE flowchart_id = ? AND todo_id = ?
    `).get(flowchartId, todoId) as any;
    
    return row.count > 0;
  }
}

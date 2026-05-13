import Database from 'better-sqlite3';

export interface FlowchartTodoAssociation {
  id: string;
  flowchart_id: string;
  todo_id: string;
  created_at: string;
}

export class FlowchartTodoAssociationRepository {
  constructor(private db: Database.Database) {}

  async createAssociation(association: Omit<FlowchartTodoAssociation, 'id' | 'created_at'>): Promise<FlowchartTodoAssociation> {
    const id = `assoc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newAssociation: FlowchartTodoAssociation = {
      id,
      ...association,
      created_at: now
    };

    this.db.prepare(`
      INSERT INTO flowchart_todo_associations (id, flowchart_id, todo_id, created_at)
      VALUES (?, ?, ?, ?)
    `).run(
      newAssociation.id,
      newAssociation.flowchart_id,
      newAssociation.todo_id,
      newAssociation.created_at
    );

    return newAssociation;
  }

  async getAssociationsByFlowchart(flowchartId: string): Promise<FlowchartTodoAssociation[]> {
    return this.db.prepare('SELECT * FROM flowchart_todo_associations WHERE flowchart_id = ?').all(flowchartId) as any[];
  }

  async getAssociationsByTodo(todoId: string): Promise<FlowchartTodoAssociation[]> {
    return this.db.prepare('SELECT * FROM flowchart_todo_associations WHERE todo_id = ?').all(todoId) as any[];
  }

  async deleteAssociation(id: string): Promise<void> {
    this.db.prepare('DELETE FROM flowchart_todo_associations WHERE id = ?').run(id);
  }

  async deleteAssociationsByFlowchart(flowchartId: string): Promise<void> {
    this.db.prepare('DELETE FROM flowchart_todo_associations WHERE flowchart_id = ?').run(flowchartId);
  }

  async deleteAssociationsByTodo(todoId: string): Promise<void> {
    this.db.prepare('DELETE FROM flowchart_todo_associations WHERE todo_id = ?').run(todoId);
  }
}

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

export interface FlowchartTodoAssociation {
  id: string;
  flowchart_id: string;
  todo_id: string;
  created_at: string;
}

/**
 * 基于文件的流程图待办关联管理器
 * 替代 FlowchartTodoAssociationRepository
 */
export class FlowchartTodoAssociationManager {
  private associationsPath: string;
  private associations: Map<string, FlowchartTodoAssociation[]> = new Map();

  constructor() {
    const userDataPath = app.getPath('userData');
    this.associationsPath = path.join(userDataPath, '.multitodo-metadata', 'associations.json');
    this.loadAssociations();
  }

  /**
   * 加载关联数据
   */
  private loadAssociations(): void {
    try {
      if (fs.existsSync(this.associationsPath)) {
        const data = fs.readFileSync(this.associationsPath, 'utf-8');
        const associations: FlowchartTodoAssociation[] = JSON.parse(data);

        // 按流程图ID分组
        for (const assoc of associations) {
          if (!this.associations.has(assoc.flowchart_id)) {
            this.associations.set(assoc.flowchart_id, []);
          }
          this.associations.get(assoc.flowchart_id)!.push(assoc);
        }
      }
    } catch (error) {
      console.error('Failed to load associations:', error);
    }
  }

  /**
   * 保存关联数据
   */
  private saveAssociations(): void {
    try {
      const allAssociations: FlowchartTodoAssociation[] = [];
      for (const associations of this.associations.values()) {
        allAssociations.push(...associations);
      }

      const dir = path.dirname(this.associationsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.associationsPath, JSON.stringify(allAssociations, null, 2));
    } catch (error) {
      console.error('Failed to save associations:', error);
      throw error;
    }
  }

  /**
   * 获取流程图的所有关联
   */
  public getAssociationsByFlowchart(flowchartId: string): FlowchartTodoAssociation[] {
    return this.associations.get(flowchartId) || [];
  }

  /**
   * 获取待办的所有关联
   */
  public getAssociationsByTodo(todoId: string): FlowchartTodoAssociation[] {
    const results: FlowchartTodoAssociation[] = [];
    for (const associations of this.associations.values()) {
      for (const assoc of associations) {
        if (assoc.todo_id === todoId) {
          results.push(assoc);
        }
      }
    }
    return results;
  }

  /**
   * 创建关联
   */
  public createAssociation(association: Omit<FlowchartTodoAssociation, 'id' | 'created_at'>): FlowchartTodoAssociation {
    const newAssociation: FlowchartTodoAssociation = {
      ...association,
      id: uuidv4(),
      created_at: new Date().toISOString()
    };

    if (!this.associations.has(association.flowchart_id)) {
      this.associations.set(association.flowchart_id, []);
    }

    this.associations.get(association.flowchart_id)!.push(newAssociation);
    this.saveAssociations();

    return newAssociation;
  }

  /**
   * 删除关联
   */
  public deleteAssociation(associationId: string): void {
    for (const [flowchartId, associations] of this.associations.entries()) {
      const index = associations.findIndex(a => a.id === associationId);
      if (index !== -1) {
        associations.splice(index, 1);
        this.saveAssociations();
        return;
      }
    }

    throw new Error(`Association not found: ${associationId}`);
  }

  /**
   * 删除流程图的所有关联
   */
  public deleteAssociationsByFlowchart(flowchartId: string): void {
    this.associations.delete(flowchartId);
    this.saveAssociations();
  }

  /**
   * 删除待办的所有关联
   */
  public deleteAssociationsByTodo(todoId: string): void {
    for (const [flowchartId, associations] of this.associations.entries()) {
      const filtered = associations.filter(a => a.todo_id !== todoId);
      if (filtered.length !== associations.length) {
        this.associations.set(flowchartId, filtered);
      }
    }
    this.saveAssociations();
  }

  /**
   * 获取数据库实例 (用于兼容旧代码，返回 null)
   */
  public getDb(): any {
    return null;
  }
}
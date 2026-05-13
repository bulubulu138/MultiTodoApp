import Database from 'better-sqlite3';

export interface FlowchartSchema {
  id: string;
  name: string;
  description?: string;
  viewport?: any;
  created_at: string;
  updated_at: string;
}

export interface PersistedNode {
  id: string;
  flowchart_id: string;
  type: string;
  position?: any;
  data?: any;
  created_at: string;
  updated_at: string;
}

export interface PersistedEdge {
  id: string;
  flowchart_id: string;
  source: string;
  target: string;
  source_handle?: string;
  target_handle?: string;
  type?: string;
  label?: string;
  style?: any;
  created_at: string;
  updated_at: string;
}

export class FlowchartRepository {
  constructor(private db: Database.Database) {}

  async createFlowchart(flowchart: Omit<FlowchartSchema, 'id' | 'created_at' | 'updated_at'>): Promise<FlowchartSchema> {
    const id = `fc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const newFlowchart: FlowchartSchema = {
      id,
      ...flowchart,
      created_at: now,
      updated_at: now
    };

    this.db.prepare(`
      INSERT INTO flowcharts (id, name, description, viewport, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      newFlowchart.id,
      newFlowchart.name,
      newFlowchart.description || '',
      JSON.stringify(newFlowchart.viewport || {}),
      newFlowchart.created_at,
      newFlowchart.updated_at
    );

    return newFlowchart;
  }

  async getFlowchart(id: string): Promise<FlowchartSchema | null> {
    const row = this.db.prepare('SELECT * FROM flowcharts WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      viewport: row.viewport ? JSON.parse(row.viewport) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }

  async getAllFlowcharts(): Promise<FlowchartSchema[]> {
    const rows = this.db.prepare('SELECT * FROM flowcharts ORDER BY updated_at DESC').all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      viewport: row.viewport ? JSON.parse(row.viewport) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async updateFlowchart(id: string, updates: Partial<FlowchartSchema>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.viewport !== undefined) {
      fields.push('viewport = ?');
      values.push(JSON.stringify(updates.viewport));
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(`
      UPDATE flowcharts SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);
  }

  async deleteFlowchart(id: string): Promise<void> {
    this.db.prepare('DELETE FROM flowchart_nodes WHERE flowchart_id = ?').run(id);
    this.db.prepare('DELETE FROM flowchart_edges WHERE flowchart_id = ?').run(id);
    this.db.prepare('DELETE FROM flowcharts WHERE id = ?').run(id);
  }

  // 节点操作
  async createNode(node: Omit<PersistedNode, 'created_at' | 'updated_at'>): Promise<PersistedNode> {
    const now = new Date().toISOString();
    const newNode: PersistedNode = {
      ...node,
      created_at: now,
      updated_at: now
    };

    this.db.prepare(`
      INSERT INTO flowchart_nodes (id, flowchart_id, type, position, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      newNode.id,
      newNode.flowchart_id,
      newNode.type,
      JSON.stringify(newNode.position || {}),
      JSON.stringify(newNode.data || {}),
      newNode.created_at,
      newNode.updated_at
    );

    return newNode;
  }

  async getNodes(flowchartId: string): Promise<PersistedNode[]> {
    const rows = this.db.prepare('SELECT * FROM flowchart_nodes WHERE flowchart_id = ?').all(flowchartId) as any[];
    return rows.map(row => ({
      id: row.id,
      flowchart_id: row.flowchart_id,
      type: row.type,
      position: row.position ? JSON.parse(row.position) : undefined,
      data: row.data ? JSON.parse(row.data) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async updateNode(id: string, updates: Partial<PersistedNode>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.type !== undefined) {
      fields.push('type = ?');
      values.push(updates.type);
    }
    if (updates.position !== undefined) {
      fields.push('position = ?');
      values.push(JSON.stringify(updates.position));
    }
    if (updates.data !== undefined) {
      fields.push('data = ?');
      values.push(JSON.stringify(updates.data));
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(`
      UPDATE flowchart_nodes SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);
  }

  async deleteNode(id: string): Promise<void> {
    this.db.prepare('DELETE FROM flowchart_nodes WHERE id = ?').run(id);
  }

  // 边操作
  async createEdge(edge: Omit<PersistedEdge, 'created_at' | 'updated_at'>): Promise<PersistedEdge> {
    const now = new Date().toISOString();
    const newEdge: PersistedEdge = {
      ...edge,
      created_at: now,
      updated_at: now
    };

    this.db.prepare(`
      INSERT INTO flowchart_edges (id, flowchart_id, source, target, source_handle, target_handle, type, label, style, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newEdge.id,
      newEdge.flowchart_id,
      newEdge.source,
      newEdge.target,
      newEdge.source_handle || '',
      newEdge.target_handle || '',
      newEdge.type || '',
      newEdge.label || '',
      JSON.stringify(newEdge.style || {}),
      newEdge.created_at,
      newEdge.updated_at
    );

    return newEdge;
  }

  async getEdges(flowchartId: string): Promise<PersistedEdge[]> {
    const rows = this.db.prepare('SELECT * FROM flowchart_edges WHERE flowchart_id = ?').all(flowchartId) as any[];
    return rows.map(row => ({
      id: row.id,
      flowchart_id: row.flowchart_id,
      source: row.source,
      target: row.target,
      source_handle: row.source_handle || undefined,
      target_handle: row.target_handle || undefined,
      type: row.type || undefined,
      label: row.label || undefined,
      style: row.style ? JSON.parse(row.style) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
  }

  async updateEdge(id: string, updates: Partial<PersistedEdge>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.source_handle !== undefined) {
      fields.push('source_handle = ?');
      values.push(updates.source_handle);
    }
    if (updates.target_handle !== undefined) {
      fields.push('target_handle = ?');
      values.push(updates.target_handle);
    }
    if (updates.type !== undefined) {
      fields.push('type = ?');
      values.push(updates.type);
    }
    if (updates.label !== undefined) {
      fields.push('label = ?');
      values.push(updates.label);
    }
    if (updates.style !== undefined) {
      fields.push('style = ?');
      values.push(JSON.stringify(updates.style));
    }

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(`
      UPDATE flowchart_edges SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);
  }

  async deleteEdge(id: string): Promise<void> {
    this.db.prepare('DELETE FROM flowchart_edges WHERE id = ?').run(id);
  }
}

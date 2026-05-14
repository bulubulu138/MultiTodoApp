import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';

export interface FlowchartSchema {
  id: string;
  name: string;
  description: string;
  viewport: { x: number; y: number; zoom: number };
  created_at: string;
  updated_at: string;
}

export interface FlowchartNode {
  id: string;
  flowchart_id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface FlowchartEdge {
  id: string;
  flowchart_id: string;
  source: string;
  target: string;
  source_handle: string | null;
  target_handle: string | null;
  type: string;
  label: string;
  style: Record<string, any>;
  connection_hash: string;
  created_at: string;
  updated_at: string;
}

export interface FlowchartData {
  schema: FlowchartSchema;
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
}

/**
 * 基于文件的流程图管理器
 * 替代 FlowchartRepository
 */
export class FlowchartFileManager {
  private storagePath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.storagePath = path.join(userDataPath, '.multitodo-metadata', 'flowcharts');
    this.initializeStorage();
  }

  private initializeStorage(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private getFlowchartPath(flowchartId: string): string {
    return path.join(this.storagePath, `${flowchartId}.json`);
  }

  /**
   * 获取流程图
   */
  public getFlowchart(flowchartId: string): FlowchartSchema | null {
    const filePath = this.getFlowchartPath(flowchartId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data.schema;
    } catch (error) {
      console.error(`Failed to load flowchart ${flowchartId}:`, error);
      return null;
    }
  }

  /**
   * 获取流程图数据（包含节点和边）
   */
  public getFlowchartData(flowchartId: string): FlowchartData | null {
    const filePath = this.getFlowchartPath(flowchartId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return data;
    } catch (error) {
      console.error(`Failed to load flowchart data ${flowchartId}:`, error);
      return null;
    }
  }

  /**
   * 获取所有流程图
   */
  public getAllFlowcharts(): FlowchartSchema[] {
    const flowcharts: FlowchartSchema[] = [];

    if (!fs.existsSync(this.storagePath)) {
      return flowcharts;
    }

    const files = fs.readdirSync(this.storagePath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(this.storagePath, file);
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          flowcharts.push(data.schema);
        } catch (error) {
          console.error(`Failed to load flowchart file ${file}:`, error);
        }
      }
    }

    return flowcharts;
  }

  /**
   * 创建流程图
   */
  public createFlowchart(schema: Omit<FlowchartSchema, 'id' | 'created_at' | 'updated_at'>): FlowchartSchema {
    const newSchema: FlowchartSchema = {
      ...schema,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const data: FlowchartData = {
      schema: newSchema,
      nodes: [],
      edges: []
    };

    this.saveFlowchartData(newSchema.id, data);
    return newSchema;
  }

  /**
   * 保存流程图数据
   */
  public saveFlowchartData(flowchartId: string, data: FlowchartData): void {
    const filePath = this.getFlowchartPath(flowchartId);

    // 更新时间戳
    data.schema.updated_at = new Date().toISOString();

    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`Failed to save flowchart ${flowchartId}:`, error);
      throw error;
    }
  }

  /**
   * 获取节点
   */
  public getNodes(flowchartId: string): FlowchartNode[] {
    const data = this.getFlowchartData(flowchartId);
    return data ? data.nodes : [];
  }

  /**
   * 获取边
   */
  public getEdges(flowchartId: string): FlowchartEdge[] {
    const data = this.getFlowchartData(flowchartId);
    return data ? data.edges : [];
  }

  /**
   * 创建节点
   */
  public createNode(node: Omit<FlowchartNode, 'id' | 'created_at' | 'updated_at'>): FlowchartNode {
    const data = this.getFlowchartData(node.flowchart_id);
    if (!data) {
      throw new Error(`Flowchart not found: ${node.flowchart_id}`);
    }

    const newNode: FlowchartNode = {
      ...node,
      id: uuidv4(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    data.nodes.push(newNode);
    this.saveFlowchartData(node.flowchart_id, data);

    return newNode;
  }

  /**
   * 创建边
   */
  public createEdge(edge: Omit<FlowchartEdge, 'id' | 'connection_hash' | 'created_at' | 'updated_at'>): FlowchartEdge {
    const data = this.getFlowchartData(edge.flowchart_id);
    if (!data) {
      throw new Error(`Flowchart not found: ${edge.flowchart_id}`);
    }

    // 生成连接哈希
    const connectionHash = this.generateConnectionHash(
      edge.source,
      edge.target,
      edge.source_handle,
      edge.target_handle
    );

    const newEdge: FlowchartEdge = {
      ...edge,
      id: uuidv4(),
      connection_hash: connectionHash,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    data.edges.push(newEdge);
    this.saveFlowchartData(edge.flowchart_id, data);

    return newEdge;
  }

  /**
   * 更新节点
   */
  public updateNode(nodeId: string, updates: Partial<FlowchartNode>): void {
    const flowcharts = this.getAllFlowcharts();

    for (const flowchart of flowcharts) {
      const data = this.getFlowchartData(flowchart.id);
      if (!data) continue;

      const nodeIndex = data.nodes.findIndex(n => n.id === nodeId);
      if (nodeIndex !== -1) {
        data.nodes[nodeIndex] = {
          ...data.nodes[nodeIndex],
          ...updates,
          updated_at: new Date().toISOString()
        };
        this.saveFlowchartData(flowchart.id, data);
        return;
      }
    }

    throw new Error(`Node not found: ${nodeId}`);
  }

  /**
   * 更新边
   */
  public updateEdge(edgeId: string, updates: Partial<FlowchartEdge>): void {
    const flowcharts = this.getAllFlowcharts();

    for (const flowchart of flowcharts) {
      const data = this.getFlowchartData(flowchart.id);
      if (!data) continue;

      const edgeIndex = data.edges.findIndex(e => e.id === edgeId);
      if (edgeIndex !== -1) {
        data.edges[edgeIndex] = {
          ...data.edges[edgeIndex],
          ...updates,
          updated_at: new Date().toISOString()
        };
        this.saveFlowchartData(flowchart.id, data);
        return;
      }
    }

    throw new Error(`Edge not found: ${edgeId}`);
  }

  /**
   * 删除节点
   */
  public deleteNode(nodeId: string): void {
    const flowcharts = this.getAllFlowcharts();

    for (const flowchart of flowcharts) {
      const data = this.getFlowchartData(flowchart.id);
      if (!data) continue;

      const nodeIndex = data.nodes.findIndex(n => n.id === nodeId);
      if (nodeIndex !== -1) {
        data.nodes.splice(nodeIndex, 1);
        this.saveFlowchartData(flowchart.id, data);
        return;
      }
    }

    throw new Error(`Node not found: ${nodeId}`);
  }

  /**
   * 删除边
   */
  public deleteEdge(edgeId: string): void {
    const flowcharts = this.getAllFlowcharts();

    for (const flowchart of flowcharts) {
      const data = this.getFlowchartData(flowchart.id);
      if (!data) continue;

      const edgeIndex = data.edges.findIndex(e => e.id === edgeId);
      if (edgeIndex !== -1) {
        data.edges.splice(edgeIndex, 1);
        this.saveFlowchartData(flowchart.id, data);
        return;
      }
    }

    throw new Error(`Edge not found: ${edgeId}`);
  }

  /**
   * 删除流程图
   */
  public deleteFlowchart(flowchartId: string): void {
    const filePath = this.getFlowchartPath(flowchartId);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * 生成连接哈希
   */
  private generateConnectionHash(
    source: string,
    target: string,
    sourceHandle: string | null,
    targetHandle: string | null
  ): string {
    const data = `${source}-${target}-${sourceHandle || ''}-${targetHandle || ''}`;
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  }

  /**
   * 获取数据库实例 (用于兼容旧代码，返回 null)
   */
  public getDb(): any {
    return null;
  }
}
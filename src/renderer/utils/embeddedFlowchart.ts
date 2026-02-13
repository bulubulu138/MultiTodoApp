import {
  EmbeddedFlowchartV1,
  PersistedEdge,
  PersistedNode,
  ViewportSchema,
} from '../../shared/types';

const DEFAULT_VIEWPORT: ViewportSchema = { x: 0, y: 0, zoom: 1 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeViewport(value: unknown): ViewportSchema {
  if (!isRecord(value)) {
    return DEFAULT_VIEWPORT;
  }

  const x = typeof value.x === 'number' && Number.isFinite(value.x) ? value.x : 0;
  const y = typeof value.y === 'number' && Number.isFinite(value.y) ? value.y : 0;
  const zoom = typeof value.zoom === 'number' && Number.isFinite(value.zoom) ? value.zoom : 1;

  return { x, y, zoom };
}

function normalizePosition(value: unknown): PersistedNode['position'] {
  const viewport = normalizeViewport(value);
  return { x: viewport.x, y: viewport.y };
}

function normalizeNode(value: unknown, index: number): PersistedNode {
  const safe = isRecord(value) ? value : {};
  const rawData = isRecord(safe.data) ? safe.data : {};

  const type = typeof safe.type === 'string' ? safe.type : 'rectangle';
  const normalizedType = type === 'todo' ? 'rectangle' : type;

  const data: PersistedNode['data'] = {
    label: typeof rawData.label === 'string' && rawData.label ? rawData.label : '新节点',
  };

  if (typeof rawData.style === 'object' && rawData.style !== null) {
    data.style = rawData.style as PersistedNode['data']['style'];
  }

  if (typeof rawData.isLocked === 'boolean') {
    data.isLocked = rawData.isLocked;
  }

  return {
    id: typeof safe.id === 'string' && safe.id ? safe.id : `node-${Date.now()}-${index}`,
    type: normalizedType as PersistedNode['type'],
    position: normalizePosition(safe.position),
    data,
  };
}

function normalizeEdge(value: unknown, index: number): PersistedEdge {
  const safe = isRecord(value) ? value : {};

  return {
    id: typeof safe.id === 'string' && safe.id ? safe.id : `edge-${Date.now()}-${index}`,
    source: typeof safe.source === 'string' ? safe.source : '',
    target: typeof safe.target === 'string' ? safe.target : '',
    sourceHandle: typeof safe.sourceHandle === 'string' ? safe.sourceHandle : undefined,
    targetHandle: typeof safe.targetHandle === 'string' ? safe.targetHandle : undefined,
    type: typeof safe.type === 'string' ? safe.type as PersistedEdge['type'] : 'smoothstep',
    label: typeof safe.label === 'string' ? safe.label : undefined,
    labelStyle: isRecord(safe.labelStyle) ? (safe.labelStyle as PersistedEdge['labelStyle']) : undefined,
    style: isRecord(safe.style) ? (safe.style as PersistedEdge['style']) : undefined,
    markerEnd: typeof safe.markerEnd === 'string' ? safe.markerEnd as PersistedEdge['markerEnd'] : undefined,
    markerStart: typeof safe.markerStart === 'string' ? safe.markerStart as PersistedEdge['markerStart'] : undefined,
    animated: typeof safe.animated === 'boolean' ? safe.animated : undefined,
  };
}

function normalizeNodes(value: unknown): PersistedNode[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((node, index) => normalizeNode(node, index));
}

function normalizeEdges(value: unknown): PersistedEdge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((edge, index) => normalizeEdge(edge, index))
    .filter((edge) => edge.source && edge.target);
}

export function createEmbeddedFlowchartId(): string {
  return `embedded-flowchart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyEmbeddedFlowchart(): EmbeddedFlowchartV1 {
  return {
    version: 1,
    id: createEmbeddedFlowchartId(),
    nodes: [],
    edges: [],
    viewport: DEFAULT_VIEWPORT,
    thumbnail: '',
    updatedAt: Date.now(),
  };
}

export function normalizeEmbeddedFlowchart(value: unknown): EmbeddedFlowchartV1 {
  if (!isRecord(value)) {
    return createEmptyEmbeddedFlowchart();
  }

  return {
    version: 1,
    id: typeof value.id === 'string' && value.id ? value.id : createEmbeddedFlowchartId(),
    nodes: normalizeNodes(value.nodes),
    edges: normalizeEdges(value.edges),
    viewport: normalizeViewport(value.viewport),
    thumbnail: typeof value.thumbnail === 'string' ? value.thumbnail : '',
    updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : Date.now(),
  };
}

export function serializeEmbeddedFlowchart(value: unknown): string {
  return JSON.stringify(normalizeEmbeddedFlowchart(value));
}

export function parseEmbeddedFlowchart(value: unknown): EmbeddedFlowchartV1 {
  if (typeof value === 'string') {
    try {
      return normalizeEmbeddedFlowchart(JSON.parse(value));
    } catch {
      return createEmptyEmbeddedFlowchart();
    }
  }

  return normalizeEmbeddedFlowchart(value);
}

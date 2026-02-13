import Quill from 'quill';
import type {
  EmbeddedFlowchartV1,
  PersistedEdge,
  PersistedNode,
  ViewportSchema,
} from '../../../shared/types';
import {
  createEmptyEmbeddedFlowchart,
  normalizeEmbeddedFlowchart,
  parseEmbeddedFlowchart,
  serializeEmbeddedFlowchart,
} from '../../utils/embeddedFlowchart';

const BlockEmbed = Quill.import('blots/block/embed') as any;

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readLegacyFlowchart(node: HTMLElement): EmbeddedFlowchartV1 {
  const nodesRaw = node.getAttribute('data-nodes') ?? node.dataset.nodes ?? '[]';
  const edgesRaw = node.getAttribute('data-edges') ?? node.dataset.edges ?? '[]';
  const viewportRaw = node.getAttribute('data-viewport') ?? node.dataset.viewport ?? '{"x":0,"y":0,"zoom":1}';
  const thumbnail = node.getAttribute('data-thumbnail') ?? node.dataset.thumbnail ?? '';

  return normalizeEmbeddedFlowchart({
    ...createEmptyEmbeddedFlowchart(),
    nodes: parseJson<PersistedNode[]>(nodesRaw, []),
    edges: parseJson<PersistedEdge[]>(edgesRaw, []),
    viewport: parseJson<ViewportSchema>(viewportRaw, { x: 0, y: 0, zoom: 1 }),
    thumbnail,
  });
}

function renderPreview(node: HTMLElement, thumbnail: string): void {
  node.innerHTML = '';

  const img = document.createElement('img');
  img.src = thumbnail ||
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="%23f5f5f5"/><text x="50%" y="50%" text-anchor="middle" fill="%23999" font-size="20" dy=".3em">Flowchart</text></svg>';
  img.alt = 'Flowchart';
  img.style.width = '100%';
  img.style.height = 'auto';
  img.style.display = 'block';

  node.appendChild(img);
}

export class FlowchartBlot extends (BlockEmbed as any) {
  static blotName = 'flowchart';
  static tagName = 'flowchart-preview';
  static className = 'flowchart-embedded';

  static create(value: unknown): HTMLElement {
    const node = super.create() as HTMLElement;
    const normalized = normalizeEmbeddedFlowchart(value);

    node.setAttribute('contenteditable', 'false');
    node.setAttribute('data-flowchart', serializeEmbeddedFlowchart(normalized));

    renderPreview(node, normalized.thumbnail);

    return node;
  }

  static value(node: HTMLElement): EmbeddedFlowchartV1 {
    const raw = node.getAttribute('data-flowchart') ?? node.dataset.flowchart;

    if (!raw) {
      return readLegacyFlowchart(node);
    }

    return parseEmbeddedFlowchart(raw);
  }
}

let hasRegistered = false;

export function registerFlowchartBlot(): void {
  if (hasRegistered) {
    console.log('[FlowchartBlot] Already registered, skipping');
    return;
  }

  try {
    // Check if already registered (prevent duplicate registration)
    const existingFormats = (Quill as any).imports?.['formats'] || {};
    if (existingFormats['flowchart']) {
      console.log('[FlowchartBlot] Found existing flowchart format');
      hasRegistered = true;
      return;
    }

    Quill.register({ 'formats/flowchart': FlowchartBlot }, true);
    hasRegistered = true;
    console.log('[FlowchartBlot] Successfully registered');
  } catch (error) {
    console.error('[FlowchartBlot] Registration failed:', error);
    throw error;
  }
}

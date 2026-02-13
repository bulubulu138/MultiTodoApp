import React from 'react';
import { createRoot } from 'react-dom/client';
import { toPng } from 'html-to-image';
import { ReactFlowProvider } from 'reactflow';
import type { PersistedEdge, PersistedNode, ViewportSchema } from '../../shared/types';
import { FlowchartPreviewCanvas } from '../components/flowchart/FlowchartPreviewCanvas';

export interface FlowchartThumbnailOptions {
  width?: number;
  height?: number;
  pixelRatio?: number;
}

function createFallbackThumbnail(width: number, height: number): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#f5f5f5" />
  <text x="50%" y="50%" text-anchor="middle" fill="#999" font-size="18" dy=".3em">Flowchart</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function waitForPaint(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function generateFlowchartThumbnail(
  nodes: PersistedNode[],
  edges: PersistedEdge[],
  viewport?: ViewportSchema,
  options: FlowchartThumbnailOptions = {}
): Promise<string> {
  const width = options.width ?? 600;
  const height = options.height ?? 400;
  const pixelRatio = options.pixelRatio ?? 2;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.pointerEvents = 'none';
  container.style.background = '#fff';
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    root.render(
      <ReactFlowProvider>
        <FlowchartPreviewCanvas
          data={{
            id: 'embedded-preview',
            name: 'Embedded Flowchart',
            nodes,
            edges,
            viewport,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }}
          height={height}
          readOnly={true}
        />
      </ReactFlowProvider>
    );

    await waitForPaint();

    const target = container.firstElementChild as HTMLElement | null;
    if (!target) {
      return createFallbackThumbnail(width, height);
    }

    return await toPng(target, {
      cacheBust: true,
      backgroundColor: '#ffffff',
      pixelRatio,
      width,
      height,
    });
  } catch (error) {
    console.warn('Flowchart thumbnail generation failed, fallback is used:', error);
    return createFallbackThumbnail(width, height);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}

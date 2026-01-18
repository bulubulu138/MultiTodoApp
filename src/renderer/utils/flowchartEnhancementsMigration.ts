import { PersistedEdge, PersistedNode, EdgeStyle, EdgeLabelStyle, LINE_WIDTH_OPTIONS } from '../../shared/types';

/**
 * Flowchart Enhancements Migration Utility
 * 
 * Provides migration functions to ensure backward compatibility with existing flowcharts
 * that don't have the new enhancement properties (text nodes, edge labels, edge styles).
 * 
 * This utility handles:
 * - Default edge style values (line width, stroke)
 * - Default edge label styles (font size, colors, padding)
 * - Text node compatibility
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

/**
 * Default edge style for legacy edges without style properties
 */
const DEFAULT_EDGE_STYLE: EdgeStyle = {
  strokeWidth: LINE_WIDTH_OPTIONS.thin,
  stroke: '#b1b1b7'
};

/**
 * Default edge label style for legacy edges with labels but no label styling
 */
const DEFAULT_LABEL_STYLE: EdgeLabelStyle = {
  fontSize: 12,
  color: '#000',
  backgroundColor: '#fff',
  padding: 4,
  borderRadius: 4
};

/**
 * Migrate edge data to include default values for new enhancement properties
 * 
 * Ensures that edges without the new style and label properties get appropriate defaults:
 * - Adds default strokeWidth if missing
 * - Adds default stroke color if missing
 * - Adds default labelStyle if edge has a label but no labelStyle
 * 
 * @param edge - The persisted edge to migrate
 * @returns Migrated edge with default values applied
 * 
 * @example
 * const legacyEdge = { id: 'e1', source: 'n1', target: 'n2', label: 'Yes' };
 * const migratedEdge = migrateEdgeData(legacyEdge);
 * // migratedEdge now has default style and labelStyle properties
 */
export function migrateEdgeData(edge: PersistedEdge): PersistedEdge {
  const needsStyleMigration = !edge.style || 
                               edge.style.strokeWidth === undefined || 
                               edge.style.stroke === undefined;
  
  const needsLabelStyleMigration = edge.label && !edge.labelStyle;

  // If no migration needed, return original edge
  if (!needsStyleMigration && !needsLabelStyleMigration) {
    return edge;
  }

  const migratedEdge: PersistedEdge = {
    ...edge,
    // Merge default style with existing style
    style: {
      ...DEFAULT_EDGE_STYLE,
      ...edge.style
    }
  };

  // Add default label style if edge has a label but no labelStyle
  if (needsLabelStyleMigration) {
    migratedEdge.labelStyle = DEFAULT_LABEL_STYLE;
  }

  console.log('[EnhancementsMigration] Migrated edge:', {
    id: edge.id,
    before: { 
      style: edge.style, 
      labelStyle: edge.labelStyle,
      hasLabel: !!edge.label 
    },
    after: { 
      style: migratedEdge.style, 
      labelStyle: migratedEdge.labelStyle,
      hasLabel: !!migratedEdge.label 
    }
  });

  return migratedEdge;
}

/**
 * Migrate node data to ensure compatibility with text nodes
 * 
 * Text nodes are a new node type that may not exist in legacy flowcharts.
 * This function ensures that all nodes have valid data structures.
 * Currently, no migration is needed for nodes as text nodes are additive,
 * but this function is provided for consistency and future extensibility.
 * 
 * @param node - The persisted node to migrate
 * @returns Migrated node (currently returns unchanged node)
 * 
 * @example
 * const legacyNode = { id: 'n1', type: 'rectangle', position: {x: 0, y: 0}, data: {label: 'Start'} };
 * const migratedNode = migrateNodeData(legacyNode);
 * // Node is returned unchanged as text nodes are additive
 */
export function migrateNodeData(node: PersistedNode): PersistedNode {
  // Text nodes are a new type, so legacy nodes don't need migration
  // This function is provided for consistency and future extensibility
  
  // If we need to add default styles or other properties in the future,
  // we can do so here
  
  return node;
}

/**
 * Check if an edge needs migration
 * 
 * An edge needs migration if:
 * - It has no style property
 * - It has a style but missing strokeWidth or stroke
 * - It has a label but no labelStyle
 * 
 * @param edge - The edge to check
 * @returns True if the edge needs migration, false otherwise
 */
export function needsEdgeMigration(edge: PersistedEdge): boolean {
  const needsStyleMigration = !edge.style || 
                               edge.style.strokeWidth === undefined || 
                               edge.style.stroke === undefined;
  
  const needsLabelStyleMigration = Boolean(edge.label && !edge.labelStyle);

  return needsStyleMigration || needsLabelStyleMigration;
}

/**
 * Check if a node needs migration
 * 
 * Currently, nodes don't require migration as text nodes are additive.
 * This function is provided for consistency and future extensibility.
 * 
 * @param node - The node to check
 * @returns True if the node needs migration, false otherwise
 */
export function needsNodeMigration(node: PersistedNode): boolean {
  // Text nodes are additive, so no migration needed for existing nodes
  // This function is provided for consistency and future extensibility
  return false;
}

/**
 * Batch migrate multiple edges
 * 
 * @param edges - Array of edges to migrate
 * @returns Array of migrated edges
 */
export function migrateEdges(edges: PersistedEdge[]): PersistedEdge[] {
  const edgesToMigrate = edges.filter(needsEdgeMigration);
  
  if (edgesToMigrate.length > 0) {
    console.log(`[EnhancementsMigration] Migrating ${edgesToMigrate.length} of ${edges.length} edges...`);
  }
  
  return edges.map(migrateEdgeData);
}

/**
 * Batch migrate multiple nodes
 * 
 * @param nodes - Array of nodes to migrate
 * @returns Array of migrated nodes
 */
export function migrateNodes(nodes: PersistedNode[]): PersistedNode[] {
  const nodesToMigrate = nodes.filter(needsNodeMigration);
  
  if (nodesToMigrate.length > 0) {
    console.log(`[EnhancementsMigration] Migrating ${nodesToMigrate.length} of ${nodes.length} nodes...`);
  }
  
  return nodes.map(migrateNodeData);
}

/**
 * Check if an array of edges needs migration
 * 
 * @param edges - Array of edges to check
 * @returns True if any edge needs migration, false otherwise
 */
export function needsEdgesMigration(edges: PersistedEdge[]): boolean {
  return edges.some(needsEdgeMigration);
}

/**
 * Check if an array of nodes needs migration
 * 
 * @param nodes - Array of nodes to check
 * @returns True if any node needs migration, false otherwise
 */
export function needsNodesMigration(nodes: PersistedNode[]): boolean {
  return nodes.some(needsNodeMigration);
}

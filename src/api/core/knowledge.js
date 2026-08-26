/**
 * RAIOC OS - Enterprise Knowledge Graph API Gateway (Phase 2)
 * Manages institutional Dubai real estate laws, statutory structures, property assets,
 * and multi-agent relational graph synthesis.
 * 
 * Endpoints:
 * - GET /api/core/knowledge/graph: Retrieve subgraph nodes and edges for contextual synthesis
 * - POST /api/core/knowledge/node: Upsert entity node
 * - GET /api/core/knowledge/node/:id: Retrieve single entity node
 * - POST /api/core/knowledge/edge: Connect two entities with a relational edge
 * - DELETE /api/core/knowledge/node/:id: Delete entity node and cascade edges
 */

import { supabase } from '../../db/supabase-client.js';
import { authMiddleware } from '../../security/auth-middleware.js';
import { logger } from '../../logging/audit-logger.js';

export async function handleKnowledgeRequest(url, method = 'GET', body = {}, query = {}, headers = {}) {
  const cleanUrl = url.split('?')[0].replace(/\/$/, '');

  // 1. Knowledge Graph Traversal & Subgraph Retrieval (/api/core/knowledge/graph)
  if (cleanUrl === '/api/core/knowledge/graph' || cleanUrl === '/api/core/knowledge') {
    if (method !== 'GET') {
      return { status: 405, body: { success: false, error: `Method ${method} not allowed on knowledge graph` } };
    }

    const options = {
      entity_type: query.entity_type || query.type || null,
      nodeId: query.nodeId || query.node_id || query.id || null,
      relationship_type: query.relationship_type || query.rel || null,
    };

    const graph = await supabase.fetchKnowledgeGraph(options);
    return {
      status: 200,
      body: {
        success: true,
        graph,
        stats: graph.stats,
      },
    };
  }

  // 2. Knowledge Node CRUD (/api/core/knowledge/node, /api/core/knowledge/node/:id, /api/core/knowledge/nodes)
  if (cleanUrl === '/api/core/knowledge/node' || cleanUrl === '/api/core/knowledge/nodes' || cleanUrl.startsWith('/api/core/knowledge/node/')) {
    const nodeId = cleanUrl.replace(/^\/api\/core\/knowledge\/nodes?\/?/, '').split('/')[0];

    if (method === 'GET') {
      if (!nodeId) {
        const graph = await supabase.fetchKnowledgeGraph(query);
        return { status: 200, body: { success: true, nodes: graph.nodes } };
      }
      const node = await supabase.getKnowledgeNode(nodeId);
      if (!node) {
        return { status: 404, body: { success: false, error: `Knowledge node ${nodeId} not found` } };
      }
      return { status: 200, body: { success: true, node } };
    }

    if (method === 'POST' || method === 'PUT') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        return { status: 401, body: { success: false, error: auth.error || 'Unauthorized' } };
      }

      if (!body.entity_type && !body.entityType) {
        return { status: 400, body: { success: false, error: 'entity_type is required' } };
      }
      if (!body.label) {
        return { status: 400, body: { success: false, error: 'label is required' } };
      }

      const node = await supabase.upsertKnowledgeNode(body);
      logger.info('KNOWLEDGE_GRAPH', `Knowledge node upserted: ${node.id} [${node.entity_type}]`);
      return { status: 200, body: { success: true, node } };
    }

    if (method === 'DELETE') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        return { status: 401, body: { success: false, error: auth.error || 'Unauthorized' } };
      }
      if (!nodeId) {
        return { status: 400, body: { success: false, error: 'node ID required for deletion' } };
      }
      const deleted = await supabase.deleteKnowledgeNode(nodeId);
      return { status: 200, body: { success: deleted, deletedId: nodeId } };
    }
  }

  // 3. Knowledge Edge CRUD (/api/core/knowledge/edge, /api/core/knowledge/edge/:id, /api/core/knowledge/edges)
  if (cleanUrl === '/api/core/knowledge/edge' || cleanUrl === '/api/core/knowledge/edges' || cleanUrl.startsWith('/api/core/knowledge/edge/')) {
    const edgeId = cleanUrl.replace(/^\/api\/core\/knowledge\/edges?\/?/, '').split('/')[0];

    if (method === 'GET') {
      if (!edgeId) {
        const graph = await supabase.fetchKnowledgeGraph(query);
        return { status: 200, body: { success: true, edges: graph.edges } };
      }
      const edge = await supabase.getKnowledgeEdge(edgeId);
      if (!edge) {
        return { status: 404, body: { success: false, error: `Knowledge edge ${edgeId} not found` } };
      }
      return { status: 200, body: { success: true, edge } };
    }

    if (method === 'POST' || method === 'PUT') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        return { status: 401, body: { success: false, error: auth.error || 'Unauthorized' } };
      }

      const sourceId = body.source_node_id || body.sourceNodeId;
      const targetId = body.target_node_id || body.targetNodeId;
      const relType = body.relationship_type || body.relationshipType;

      if (!sourceId || !targetId || !relType) {
        return { status: 400, body: { success: false, error: 'source_node_id, target_node_id, and relationship_type are required' } };
      }

      const edge = await supabase.upsertKnowledgeEdge(body);
      logger.info('KNOWLEDGE_GRAPH', `Knowledge edge created: ${edge.id} (${sourceId} -[${relType}]-> ${targetId})`);
      return { status: 200, body: { success: true, edge } };
    }

    if (method === 'DELETE') {
      const auth = authMiddleware.authenticateRequest(headers);
      if (!auth.authenticated) {
        return { status: 401, body: { success: false, error: auth.error || 'Unauthorized' } };
      }
      if (!edgeId) {
        return { status: 400, body: { success: false, error: 'edge ID required for deletion' } };
      }
      const deleted = await supabase.deleteKnowledgeEdge(edgeId);
      return { status: 200, body: { success: deleted, deletedId: edgeId } };
    }
  }

  return {
    status: 404,
    body: {
      success: false,
      error: `Unknown knowledge endpoint: ${url}`,
      availableEndpoints: [
        '/api/core/knowledge/graph',
        '/api/core/knowledge/node',
        '/api/core/knowledge/edge',
      ],
    },
  };
}

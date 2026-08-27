/**
 * RAIOC Event Bus & Inter-Agent Messaging Protocol
 * Provides decoupled pub/sub event distribution, event chaining, and point-to-point agent mailboxes.
 */

import { EventEmitter } from 'node:events';
import { logger } from '../logging/audit-logger.js';
import { sharedMemory } from '../memory/shared-memory.js';

import { createHash, randomUUID } from 'node:crypto';

export const AgentEvents = {
  GOAL_RECEIVED: 'goal:received',
  GOAL_COMPLETED: 'goal:completed',
  TASK_ASSIGNED: 'task:assigned',
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  TASK_RECOVERED: 'task:recovered',
  DECISION_LOGGED: 'decision:logged',
  ALERT_RAISED: 'alert:raised',
  AGENT_HEARTBEAT: 'agent:heartbeat',
  // Domain Chaining Events
  LEAD_INGESTED: 'lead:ingested',
  LEAD_QUALIFIED: 'lead:qualified',
  MARKET_ANALYZED: 'market:analyzed',
  COMPLIANCE_VERIFIED: 'compliance:verified',
  BRIEF_READY: 'brief:ready',
  BRIEF_DISPATCHED: 'brief:dispatched',
  CRM_SYNCED: 'crm:synced',
  MEETING_SCHEDULED: 'meeting:scheduled',
  CYCLE_AUDITED: 'cycle:audited',
  TELEGRAM_MESSAGE_SENT: 'telegram:message:sent',
};

export class AgentEventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    this.mailboxes = new Map(); // AgentId -> Array of messages
    this.eventLog = [];
  }

  static computeSha256(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return createHash('sha256').update(raw).digest('hex');
  }

  static generateTraceparent() {
    const traceId = randomUUID().replace(/-/g, '');
    const parentId = randomUUID().replace(/-/g, '').substring(0, 16);
    return `00-${traceId}-${parentId}-01`;
  }

  // --- Pub/Sub Event Distribution (CloudEvents v1.1 Unified) ---

  publish(eventTopic, payload = {}, metadata = {}) {
    const id = metadata.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const correlationId = metadata.correlationId || metadata.correlation_id || 'system';
    const causationId = metadata.causationId || metadata.causation_id || id;
    const traceparent = metadata.traceparent || AgentEventBus.generateTraceparent();
    const payloadSha256 = AgentEventBus.computeSha256(payload);

    const event = {
      specversion: '1.1',
      id,
      type: eventTopic,
      topic: eventTopic,
      source: metadata.sourceAgent ? `raioc://agent/${metadata.sourceAgent}` : 'raioc://agent/mesh',
      time: new Date().toISOString(),
      datacontenttype: 'application/json',
      correlation_id: correlationId,
      causation_id: causationId,
      traceparent,
      data: payload,
      payload,
      metadata: {
        timestamp: new Date().toISOString(),
        correlationId,
        sourceAgent: metadata.sourceAgent || 'core',
        ...metadata,
      },
      payload_sha256: payloadSha256,
      status: metadata.status || 'EMITTED',
      retry_count: metadata.retry_count !== undefined ? Number(metadata.retry_count) : 0,
    };

    this.eventLog.push(event);
    if (this.eventLog.length > 1000) this.eventLog.shift();

    logger.info('EVENT_BUS', `CloudEvents v1.1 published [${eventTopic}] from ${event.metadata.sourceAgent}`, {
      id: event.id,
      correlationId: event.metadata.correlationId,
      payloadSha256: payloadSha256.substring(0, 12) + '...',
    });

    this.emitter.emit(eventTopic, event);
    this.emitter.emit('*', event);

    return event;
  }

  subscribe(eventTopic, handler) {
    this.emitter.on(eventTopic, handler);
    return () => this.emitter.off(eventTopic, handler);
  }

  // --- Point-to-Point Inter-Agent Messaging ---

  sendDirectMessage(senderId, recipientId, message, correlationId = null) {
    if (!this.mailboxes.has(recipientId)) {
      this.mailboxes.set(recipientId, []);
    }

    const msgEntry = {
      id: `dir_msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: senderId,
      recipient: recipientId,
      message,
      correlationId: correlationId || 'direct',
      deliveredAt: new Date().toISOString(),
      read: false,
    };

    this.mailboxes.get(recipientId).push(msgEntry);
    sharedMemory.recordMessage(senderId, recipientId, message, correlationId);

    logger.info('INTER_AGENT_BUS', `Direct message dispatched: ${senderId} -> ${recipientId}`, {
      correlationId,
    });

    this.publish(`message:${recipientId}`, msgEntry, { sourceAgent: senderId, correlationId });
    return msgEntry;
  }

  getMailbox(agentId, unreadOnly = false) {
    const box = this.mailboxes.get(agentId) || [];
    if (unreadOnly) {
      return box.filter((m) => !m.read);
    }
    return [...box];
  }

  markMessagesRead(agentId) {
    const box = this.mailboxes.get(agentId) || [];
    for (const msg of box) {
      msg.read = true;
    }
    return true;
  }

  getRecentEvents(topic = null, limit = 50) {
    let list = this.eventLog;
    if (topic) {
      list = list.filter((e) => e.topic === topic);
    }
    return list.slice(-limit);
  }

  clear() {
    this.mailboxes.clear();
    this.eventLog = [];
    this.emitter.removeAllListeners();
  }
}

export const agentEventBus = new AgentEventBus();

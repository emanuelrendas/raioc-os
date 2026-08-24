/**
 * RAIOC OS - Supabase Database Client & Adapter Layer (Sprint 3)
 * Handles leads, assessments, queue operations, briefs, and operational tables for monitoring & Realtime.
 */

import { config } from '../config/env.js';
import { logger } from '../logging/audit-logger.js';

export class SupabaseClient {
  constructor(options = {}) {
    this.url = options.url || config.supabase.url;
    this.key = options.key || config.supabase.serviceKey || config.supabase.anonKey;
    this.isMock = !this.url || !this.key || options.useMock === true;

    // In-memory mock storage for hermetic tests and local fallback
    this.mockStore = {
      leads: [],
      assessments: [],
      executive_briefs: [],
      dispatch_queue: [],
      audit_logs: [],
      telemetry: [],
      agent_status: new Map(),
      system_health: [],
      system_metrics: [],
      connector_health: new Map(),
      scheduler_jobs: new Map(),
      agent_logs: [],
      agent_heartbeats: [],
      executions: new Map(),
      workflow_runs: new Map(),
      notifications: [],
    };
  }

  // --- Lead & Assessment Operations ---

  async fetchPendingLeads(limit = 50) {
    if (this.isMock) {
      return this.mockStore.leads
        .filter((l) => l.status === 'pending' || !l.status)
        .slice(0, limit);
    }

    try {
      const res = await fetch(
        `${this.url}/rest/v1/leads?status=in.(pending,new)&order=created_at.asc&limit=${limit}`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) throw new Error(`Supabase fetchPendingLeads error: ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch pending leads', { error: err.message });
      return [];
    }
  }

  async fetchPendingAssessments(limit = 50) {
    if (this.isMock) {
      return this.mockStore.assessments
        .filter((a) => a.status === 'pending' || !a.status)
        .slice(0, limit);
    }

    try {
      const res = await fetch(
        `${this.url}/rest/v1/assessment_submissions?status=in.(pending,new)&order=created_at.asc&limit=${limit}`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) throw new Error(`Supabase fetchPendingAssessments error: ${res.status} ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch pending assessments', { error: err.message });
      return [];
    }
  }

  async updateLeadStatus(id, status, metadata = {}) {
    if (this.isMock) {
      const lead = this.mockStore.leads.find((l) => l.id === id);
      if (lead) {
        lead.status = status;
        lead.updated_at = new Date().toISOString();
        lead.metadata = { ...(lead.metadata || {}), ...metadata };
      }
      return lead;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/leads?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          status,
          updated_at: new Date().toISOString(),
          metadata,
        }),
      });
      if (!res.ok) throw new Error(`Supabase updateLeadStatus error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', `Failed to update lead ${id} status to ${status}`, { error: err.message });
      return null;
    }
  }

  async updateAssessmentStatus(id, status, riisScore = null, diraEvaluation = null) {
    if (this.isMock) {
      const assessment = this.mockStore.assessments.find((a) => a.id === id);
      if (assessment) {
        assessment.status = status;
        assessment.riis_score = riisScore;
        assessment.dira_evaluation = diraEvaluation;
        assessment.updated_at = new Date().toISOString();
      }
      return assessment;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/assessment_submissions?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          status,
          riis_score: riisScore,
          dira_evaluation: diraEvaluation,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`Supabase updateAssessmentStatus error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', `Failed to update assessment ${id}`, { error: err.message });
      return null;
    }
  }

  async saveExecutiveBrief(brief) {
    const record = {
      id: brief.id || `brief_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      lead_id: brief.leadId,
      assessment_id: brief.assessmentId || null,
      company_name: brief.companyName,
      executive_summary: brief.executiveSummary,
      dira_tier: brief.diraTier,
      riis_score: brief.riisScore,
      action_plan: brief.actionPlan,
      raw_payload: brief,
      created_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.executive_briefs.push(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/executive_briefs`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase saveExecutiveBrief error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to save executive brief', { error: err.message });
      return record;
    }
  }

  async enqueueDispatch(task) {
    const record = {
      id: task.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: task.type, // 'whatsapp', 'email', 'crm'
      recipient: task.recipient,
      payload: task.payload,
      priority: task.priority || 1,
      status: 'pending',
      retry_count: 0,
      next_retry_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.dispatch_queue.push(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/dispatch_queue`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      if (!res.ok) throw new Error(`Supabase enqueueDispatch error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || record;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to enqueue dispatch task', { error: err.message });
      return record;
    }
  }

  async fetchPendingDispatches(limit = 50) {
    const now = new Date().toISOString();
    if (this.isMock) {
      return this.mockStore.dispatch_queue
        .filter((t) => (t.status === 'pending' || t.status === 'retrying') && t.next_retry_at <= now)
        .sort((a, b) => (b.priority || 1) - (a.priority || 1))
        .slice(0, limit);
    }

    try {
      const res = await fetch(
        `${this.url}/rest/v1/dispatch_queue?status=in.(pending,retrying)&next_retry_at=lte.${now}&order=priority.desc,created_at.asc&limit=${limit}`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) throw new Error(`Supabase fetchPendingDispatches error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch pending dispatches', { error: err.message });
      return [];
    }
  }

  async updateDispatchTask(id, updateData) {
    if (this.isMock) {
      const item = this.mockStore.dispatch_queue.find((t) => t.id === id);
      if (item) {
        Object.assign(item, updateData, { updated_at: new Date().toISOString() });
      }
      return item;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/dispatch_queue?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          ...updateData,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`Supabase updateDispatchTask error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', `Failed to update dispatch task ${id}`, { error: err.message });
      return null;
    }
  }

  // --- Sprint 3: Operational Monitoring & Realtime State ---

  async syncAgentStatus(agentData) {
    const record = {
      agent_id: agentData.id,
      name: agentData.name,
      role: agentData.role,
      status: agentData.status || 'IDLE',
      current_task: agentData.currentTask || null,
      is_autonomous: Boolean(agentData.isAutonomous),
      capabilities: agentData.capabilities || [],
      tasks_completed: agentData.tasksCompleted || 0,
      tasks_failed: agentData.tasksFailed || 0,
      last_heartbeat: agentData.lastHeartbeat || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.agent_status.set(record.agent_id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/agent_status`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async recordConnectorHealth(connectorId, healthData) {
    const record = {
      connector_id: connectorId,
      name: healthData.name || connectorId,
      status: healthData.status || 'UNKNOWN',
      latency_ms: healthData.latencyMs || 0,
      authenticated: Boolean(healthData.authenticated),
      endpoint_url: healthData.endpointUrl || null,
      last_execution: healthData.lastExecution || new Date().toISOString(),
      failure_reason: healthData.failureReason || null,
      retry_state: healthData.retryState || { retries: 0, max: 5 },
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.connector_health.set(connectorId, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/connector_health`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async recordExecution(task) {
    const record = {
      id: task.id,
      owner_agent: task.ownerAgent,
      objective: task.objective,
      priority: task.priority,
      status: task.status,
      priority_score: task.priorityScore || 75,
      business_value_aed: task.businessValue || 0,
      duration_ms: task.executionDuration || 0,
      dependencies: task.dependencies || [],
      parent_task: task.parentTask || null,
      child_tasks: task.childTasks || [],
      retries: task.retries || { attempt: 0, max: 3 },
      execution_history: task.executionHistory || [],
      result: task.result || {},
      error: task.error || null,
      created_at: task.createdAt || new Date().toISOString(),
      completed_at: task.completedAt || null,
    };

    if (this.isMock) {
      this.mockStore.executions.set(record.id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/executions`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async recordWorkflowRun(workflow) {
    const record = {
      id: workflow.id,
      name: workflow.name || 'run_cycle_pipeline',
      correlation_id: workflow.correlationId,
      status: workflow.status || 'RUNNING',
      total_steps: workflow.totalSteps || 15,
      completed_steps: workflow.completedSteps || 0,
      duration_ms: workflow.durationMs || 0,
      lead_id: workflow.leadId || null,
      revenue_impact_aed: workflow.revenueImpactAed || 0,
      step_results: workflow.stepResults || [],
      created_at: workflow.createdAt || new Date().toISOString(),
      completed_at: workflow.completedAt || null,
    };

    if (this.isMock) {
      this.mockStore.workflow_runs.set(record.id, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/workflow_runs`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  getOperationalStoreSnapshot() {
    return {
      agents: Array.from(this.mockStore.agent_status.values()),
      connectors: Array.from(this.mockStore.connector_health.values()),
      executions: Array.from(this.mockStore.executions.values()),
      workflows: Array.from(this.mockStore.workflow_runs.values()),
      notifications: this.mockStore.notifications,
    };
  }
}

export const supabase = new SupabaseClient();

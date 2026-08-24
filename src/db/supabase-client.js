/**
 * RAIOC OS - Supabase Database Client & Adapter Layer
 * Handles fetching unprocessed leads, assessments, queue operations, and brief persistence.
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
    };
  }

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
}

export const supabase = new SupabaseClient();

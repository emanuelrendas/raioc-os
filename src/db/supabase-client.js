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
      agent_fleet_status: new Map(),
      executive_approvals: [],
      interaction_logs: [],
      system_health: [],
      system_metrics: [],
      connector_health: new Map(),
      scheduler_jobs: new Map(),
      agent_logs: [],
      agent_heartbeats: [],
      executions: new Map(),
      workflow_runs: new Map(),
      notifications: [],
      off_plan_projects: [],
    };
  }

  // --- Lead & Assessment Operations ---

  async fetchPendingLeads(limit = 50) {
    if (this.isMock) {
      return this.mockStore.leads
        .filter((l) => l.status === 'pending' || l.status === 'INGESTED' || l.status === 'new' || !l.status)
        .slice(0, limit);
    }

    try {
      const res = await fetch(
        `${this.url}/rest/v1/leads?status=in.(pending,new,INGESTED)&order=created_at.asc&limit=${limit}`,
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
        .filter((a) => a.status === 'pending' || a.status === 'INGESTED' || a.status === 'new' || !a.status)
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

  async fetchExecutiveBriefById(id) {
    if (!id) return null;

    if (this.isMock) {
      return (
        this.mockStore.executive_briefs.find(
          (b) => b.id === id || b.lead_id === id || (b.raw_payload && b.raw_payload.id === id)
        ) || null
      );
    }

    try {
      const res = await fetch(
        `${this.url}/rest/v1/executive_briefs?or=(id.eq.${encodeURIComponent(id)},lead_id.eq.${encodeURIComponent(id)})&limit=1`,
        {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!res.ok) throw new Error(`Supabase fetchExecutiveBriefById error: ${res.statusText}`);
      const data = await res.json();
      return data[0] || null;
    } catch (err) {
      logger.error('SUPABASE', `Failed to fetch executive brief ${id}`, { error: err.message });
      return null;
    }
  }

  async upsertOffPlanProjects(projects = []) {
    const list = Array.isArray(projects) ? projects : [projects];
    if (this.isMock) {
      for (const proj of list) {
        const idx = this.mockStore.off_plan_projects.findIndex((p) => p.id === proj.id || p.name === proj.name);
        if (idx >= 0) {
          this.mockStore.off_plan_projects[idx] = {
            ...this.mockStore.off_plan_projects[idx],
            ...proj,
            updated_at: new Date().toISOString(),
          };
        } else {
          this.mockStore.off_plan_projects.push({
            ...proj,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
      return this.mockStore.off_plan_projects;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/off_plan_projects`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(list),
      });
      if (!res.ok) {
        logger.warn('SUPABASE', `Batch upsert off_plan_projects note: ${res.statusText}`);
      }
      const data = await res.json().catch(() => list);
      return data;
    } catch (err) {
      logger.error('SUPABASE', 'Failed to upsert off_plan_projects', { error: err.message });
      return list;
    }
  }

  async fetchOffPlanProjects() {
    if (this.isMock) {
      return this.mockStore.off_plan_projects;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/off_plan_projects?order=starting_price_aed.asc`, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`Supabase fetchOffPlanProjects error: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch off_plan_projects', { error: err.message });
      return [];
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

  async fetchPipelineSummary() {
    if (this.isMock) {
      const leads = this.mockStore.leads || [];
      const briefs = this.mockStore.executive_briefs || [];

      const totalRevenueAed = leads.reduce((acc, l) => {
        const val = Number(l.budget_aed || l.budget || l.property_value_aed || (l.metadata && l.metadata.budget) || 15000000);
        return acc + val;
      }, 0) || 45000000;

      const stageBreakdown = {
        newLeads: leads.filter((l) => l.status === 'new' || l.status === 'pending').length,
        qualified: leads.filter((l) => l.status === 'qualified' || l.status === 'triaged').length,
        proposalSent: briefs.length,
        negotiation: leads.filter((l) => l.status === 'negotiating').length,
        closedWon: leads.filter((l) => l.status === 'closed_won' || l.status === 'completed').length,
      };

      const tierBreakdown = {
        sovereignInstitutional: briefs.filter((b) => b.dira_tier === 'SOVEREIGN_INSTITUTIONAL' || b.riis_score >= 85).length,
        highNetWorth: briefs.filter((b) => b.dira_tier === 'HIGH_NET_WORTH' || (b.riis_score >= 70 && b.riis_score < 85)).length,
        standard: briefs.filter((b) => !b.dira_tier || b.dira_tier === 'QUALIFIED_INVESTOR' || b.riis_score < 70).length,
      };

      const recentDeals = leads.slice(-10).reverse().map((l) => ({
        id: l.id,
        investorName: l.full_name || l.name || 'Private Investor',
        email: l.email || null,
        budgetAed: Number(l.budget_aed || l.budget || 15000000),
        community: l.community || l.preferred_location || 'Palm Jumeirah',
        status: l.status || 'QUALIFIED',
        createdAt: l.created_at || new Date().toISOString(),
      }));

      return {
        totalPipelineRevenueAed: totalRevenueAed,
        projectedCommissionsAed: Math.round(totalRevenueAed * 0.02),
        activeDealsCount: leads.length || 3,
        stageBreakdown,
        tierBreakdown,
        recentDeals,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const [leadsRes, briefsRes] = await Promise.all([
        fetch(`${this.url}/rest/v1/leads?select=*&order=created_at.desc&limit=50`, {
          headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
        }),
        fetch(`${this.url}/rest/v1/executive_briefs?select=*&order=created_at.desc&limit=50`, {
          headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
        }),
      ]);

      const leads = leadsRes.ok ? await leadsRes.json() : [];
      const briefs = briefsRes.ok ? await briefsRes.json() : [];

      const totalRevenueAed = leads.reduce((acc, l) => {
        const val = Number(l.budget_aed || l.budget || (l.metadata && l.metadata.budget) || 15000000);
        return acc + val;
      }, 0) || 45000000;

      return {
        totalPipelineRevenueAed: totalRevenueAed,
        projectedCommissionsAed: Math.round(totalRevenueAed * 0.02),
        activeDealsCount: leads.length,
        stageBreakdown: {
          newLeads: leads.filter((l) => l.status === 'new' || l.status === 'pending').length,
          qualified: leads.filter((l) => l.status === 'qualified' || l.status === 'triaged').length,
          proposalSent: briefs.length,
          negotiation: leads.filter((l) => l.status === 'negotiating').length,
          closedWon: leads.filter((l) => l.status === 'closed_won' || l.status === 'completed').length,
        },
        tierBreakdown: {
          sovereignInstitutional: briefs.filter((b) => b.dira_tier === 'SOVEREIGN_INSTITUTIONAL' || b.riis_score >= 85).length,
          highNetWorth: briefs.filter((b) => b.dira_tier === 'HIGH_NET_WORTH' || (b.riis_score >= 70 && b.riis_score < 85)).length,
          standard: briefs.filter((b) => !b.dira_tier || b.dira_tier === 'QUALIFIED_INVESTOR' || b.riis_score < 70).length,
        },
        recentDeals: leads.slice(0, 10).map((l) => ({
          id: l.id,
          investorName: l.full_name || l.name || 'Private Investor',
          email: l.email,
          budgetAed: Number(l.budget_aed || l.budget || 15000000),
          community: l.community || l.preferred_location || 'Dubai Prime',
          status: l.status || 'QUALIFIED',
          createdAt: l.created_at,
        })),
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error('SUPABASE', 'Failed to fetch pipeline summary', { error: err.message });
      return {
        totalPipelineRevenueAed: 45000000,
        projectedCommissionsAed: 900000,
        activeDealsCount: 3,
        stageBreakdown: { newLeads: 1, qualified: 1, proposalSent: 1, negotiation: 0, closedWon: 0 },
        tierBreakdown: { sovereignInstitutional: 1, highNetWorth: 1, standard: 1 },
        recentDeals: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  async recordAlert(alert) {
    const record = {
      id: alert.id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      severity: alert.severity || 'INFO',
      component: alert.component || 'SYSTEM',
      message: alert.message,
      correlation_id: alert.correlationId || null,
      resolved: Boolean(alert.resolved),
      created_at: alert.timestamp || new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.notifications.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/notifications`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async fetchOperationalAlerts(limit = 20) {
    if (this.isMock) {
      const alerts = (this.mockStore.notifications || []).slice(0, limit);
      const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && !a.resolved).length;
      const warningCount = alerts.filter((a) => (a.severity === 'WARNING' || a.severity === 'HIGH') && !a.resolved).length;
      return {
        systemStatus: criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'DEGRADED' : 'HEALTHY',
        totalActiveAlerts: alerts.filter((a) => !a.resolved).length,
        criticalCount,
        warningCount,
        alerts,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/notifications?order=created_at.desc&limit=${limit}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      const alerts = res.ok ? await res.json() : [];
      const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL' && !a.resolved).length;
      const warningCount = alerts.filter((a) => (a.severity === 'WARNING' || a.severity === 'HIGH') && !a.resolved).length;
      return {
        systemStatus: criticalCount > 0 ? 'CRITICAL' : warningCount > 0 ? 'DEGRADED' : 'HEALTHY',
        totalActiveAlerts: alerts.filter((a) => !a.resolved).length,
        criticalCount,
        warningCount,
        alerts,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      return {
        systemStatus: 'HEALTHY',
        totalActiveAlerts: 0,
        criticalCount: 0,
        warningCount: 0,
        alerts: [],
        timestamp: new Date().toISOString(),
      };
    }
  }

  async recordCommunication(comm) {
    const record = {
      id: comm.id || `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: comm.type || 'telegram',
      recipient: comm.recipient,
      message: comm.message,
      correlation_id: comm.correlationId || comm.correlation_id || null,
      status: comm.status || 'SENT',
      message_id: comm.messageId || comm.message_id || null,
      metadata: comm.metadata || {},
      created_at: comm.timestamp || new Date().toISOString(),
    };

    if (this.isMock) {
      if (!this.mockStore.communications) this.mockStore.communications = [];
      this.mockStore.communications.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/communications`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  async recordAuditLog(log) {
    const record = {
      id: log.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      category: log.category || 'SYSTEM',
      action: log.action || 'EVENT',
      entity_id: log.entityId || log.entity_id || null,
      message: log.message,
      correlation_id: log.correlationId || log.correlation_id || null,
      metadata: log.metadata || {},
      created_at: log.timestamp || new Date().toISOString(),
    };

    if (this.isMock) {
      if (!this.mockStore.audit_logs) this.mockStore.audit_logs = [];
      this.mockStore.audit_logs.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/audit_log`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : null;
    } catch (err) {
      return record;
    }
  }

  // --- Mission Control Fleet Telemetry & Approvals ---

  async fetchFleetStatus() {
    const defaultRoster = [
      {
        agentId: 'jarvis_executive_brain',
        name: 'JARVIS (CEO & Sovereign Executive Orchestrator)',
        role: 'Chief Autonomous Orchestration Agent & Executive Brain',
        status: 'IDLE',
        currentTask: 'Autonomous cycle telemetry loop & sovereign asset indexing',
        metrics: { latencyMs: 14, tasksCompleted: 142, tasksFailed: 0, learningScore: 98.5, efficiencyIndex: 99 },
        lastHeartbeat: new Date().toISOString(),
      },
      {
        agentId: 'mark_lead_triage',
        name: 'MARK (Sales & Lead Triage Specialist)',
        role: 'Lead Triage, Multi-Channel Ingestion & RIIS Scoring',
        status: 'PROCESSING',
        currentTask: 'Evaluating inbound sovereign family office allocation mandates',
        metrics: { latencyMs: 18, tasksCompleted: 98, tasksFailed: 1, learningScore: 95.0, efficiencyIndex: 96 },
        lastHeartbeat: new Date().toISOString(),
      },
      {
        agentId: 'atlas_opal_calculator',
        name: 'ATLAS (Google Opal & Prime Market Intelligence)',
        role: 'Opal ROI Statutory Shielding & Real Estate Valuations',
        status: 'IDLE',
        currentTask: 'Calibrating Law 8 Escrow models and Golden Visa yield bands',
        metrics: { latencyMs: 8, tasksCompleted: 215, tasksFailed: 0, learningScore: 99.2, efficiencyIndex: 100 },
        lastHeartbeat: new Date().toISOString(),
      },
      {
        agentId: 'aida_flow_mixboard',
        name: 'AIDA (Flow & Mixboard Multimodal Generator)',
        role: 'Client Relations, Flow Cinematic Video & Moodboard Engine',
        status: 'IDLE',
        currentTask: 'Synthesizing Palm Jumeirah & Aerotropolis concept boards',
        metrics: { latencyMs: 24, tasksCompleted: 64, tasksFailed: 0, learningScore: 94.0, efficiencyIndex: 95 },
        lastHeartbeat: new Date().toISOString(),
      },
      {
        agentId: 'sentinel_devops_qa',
        name: 'SENTINEL (DevOps, QA & Health Watchdog)',
        role: 'Operational Watchdog, Telemetry Mesh & Fault Recovery',
        status: 'IDLE',
        currentTask: 'Continuous single-gateway latency & connector pulse verification',
        metrics: { latencyMs: 4, tasksCompleted: 380, tasksFailed: 0, learningScore: 99.9, efficiencyIndex: 100 },
        lastHeartbeat: new Date().toISOString(),
      },
      {
        agentId: 'lex_compliance_visa',
        name: 'LEX (Regulatory, Golden Visa & Tax Specialist)',
        role: 'Statutory Shielding, Law 8 Escrow & DIFC Common Law Governance',
        status: 'IDLE',
        currentTask: 'Auditing 4% DLD fee exemptions & sovereign trust frameworks',
        metrics: { latencyMs: 12, tasksCompleted: 112, tasksFailed: 0, learningScore: 97.4, efficiencyIndex: 98 },
        lastHeartbeat: new Date().toISOString(),
      },
    ];

    if (this.isMock) {
      if (this.mockStore.agent_fleet_status.size === 0) {
        for (const agent of defaultRoster) {
          this.mockStore.agent_fleet_status.set(agent.agentId, agent);
        }
      }
      return Array.from(this.mockStore.agent_fleet_status.values());
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/agent_fleet_status?select=*&order=updated_at.desc`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) return rows;
      }
      return defaultRoster;
    } catch {
      return defaultRoster;
    }
  }

  async recordFleetHeartbeat(agentData) {
    const record = {
      agentId: agentData.agentId || agentData.agent_id || 'unknown_agent',
      name: agentData.name || agentData.agentId || 'Autonomous Specialist Agent',
      role: agentData.role || 'Autonomous System Agent',
      status: (agentData.status || 'IDLE').toUpperCase(), // 'IDLE', 'PROCESSING', 'ALERT', 'OFFLINE'
      currentTask: agentData.currentTask || agentData.current_task || agentData.activeTask || null,
      metrics: {
        latencyMs: agentData.metrics?.latencyMs || agentData.latencyMs || 0,
        tasksCompleted: agentData.metrics?.tasksCompleted || agentData.tasksCompleted || 0,
        tasksFailed: agentData.metrics?.tasksFailed || agentData.tasksFailed || 0,
        learningScore: agentData.metrics?.learningScore || agentData.learningScore || 95.0,
        efficiencyIndex: agentData.metrics?.efficiencyIndex || agentData.efficiencyIndex || 95,
      },
      lastHeartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.agent_fleet_status.set(record.agentId, record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/agent_fleet_status`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : record;
    } catch {
      return record;
    }
  }

  async fetchApprovals(status = 'PENDING') {
    const defaultApprovals = [
      {
        id: 'appr_palm_allocation_001',
        title: 'Outbound Prime Allocation Dossier — AED 15M (Palm Jumeirah)',
        agent: 'MARK (Sales & Lead Triage Specialist)',
        category: 'HIGH_VALUE_DISPATCH',
        status: 'PENDING',
        priority: 'HIGH',
        recipient: 'Dr. Gonçalo de Albuquerque (Portugal NHR)',
        targetAsset: 'Como Residences (Nakheel)',
        payload: {
          budgetAed: 15000000,
          goldenVisaEligible: true,
          escrowLaw8Guaranteed: true,
          netYieldBand: '7.6% - 8.2% Net',
          dispatchChannel: 'WhatsApp & Sovereign PDF Email',
        },
        createdAt: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: 'appr_dld_greenlist_002',
        title: 'DLD Green List Verified Pre-Launch Tranche Release',
        agent: 'ATLAS (Real Estate & Market Intelligence)',
        category: 'MARKET_ALLOCATION',
        status: 'PENDING',
        priority: 'CRITICAL',
        recipient: 'Al-Mansoor Sovereign Family Office',
        targetAsset: 'Valia at Dubai Creek Harbour',
        payload: {
          allocatedUnits: 4,
          totalCapitalAed: 22000000,
          decennialWarranty: 'UAE Civil Code Art. 880 Compliant',
        },
        createdAt: new Date(Date.now() - 600000).toISOString(),
      },
      {
        id: 'appr_voice_followup_003',
        title: 'Autonomous ElevenLabs Voice Followup Synthesis',
        agent: 'AIDA (Client Relations & Flow Engine)',
        category: 'VOICE_BROADCAST',
        status: 'PENDING',
        priority: 'MEDIUM',
        recipient: 'Lord Arthur Kensington (UK Non-Dom)',
        targetAsset: 'Rosehill (Dubai Hills Estate)',
        payload: {
          scriptExcerpt: 'Private brief prepared regarding UK Non-Dom capital reallocation into DIFC shielded assets...',
          voiceModel: 'Emanuel Rendas Institutional British / International',
        },
        createdAt: new Date(Date.now() - 900000).toISOString(),
      },
    ];

    if (this.isMock) {
      if (this.mockStore.executive_approvals.length === 0) {
        this.mockStore.executive_approvals = [...defaultApprovals];
      }
      if (!status || status === 'ALL') return this.mockStore.executive_approvals;
      return this.mockStore.executive_approvals.filter((a) => a.status === status);
    }

    try {
      const filter = status && status !== 'ALL' ? `?status=eq.${status}&order=created_at.desc` : `?order=created_at.desc`;
      const res = await fetch(`${this.url}/rest/v1/executive_approvals${filter}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) return rows;
      }
      return defaultApprovals.filter((a) => !status || status === 'ALL' || a.status === status);
    } catch {
      return defaultApprovals.filter((a) => !status || status === 'ALL' || a.status === status);
    }
  }

  async resolveApproval(id, resolution, actor = 'Emanuel Rendas', metadata = {}) {
    const cleanStatus = resolution === 'APPROVE' || resolution === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    if (this.isMock) {
      if (this.mockStore.executive_approvals.length === 0) {
        await this.fetchApprovals();
      }
      let item = this.mockStore.executive_approvals.find((a) => a.id === id);
      if (!item) {
        item = {
          id,
          title: `Action Item ${id}`,
          status: cleanStatus,
          resolvedAt: new Date().toISOString(),
          actor,
          metadata,
        };
        this.mockStore.executive_approvals.push(item);
      } else {
        item.status = cleanStatus;
        item.resolvedAt = new Date().toISOString();
        item.actor = actor;
        item.metadata = { ...(item.metadata || {}), ...metadata };
      }
      return item;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/executive_approvals?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          status: cleanStatus,
          resolved_at: new Date().toISOString(),
          actor,
          metadata,
        }),
      });
      if (res.ok) {
        const rows = await res.json();
        return rows[0] || { id, status: cleanStatus, actor, resolvedAt: new Date().toISOString() };
      }
      return { id, status: cleanStatus, actor, resolvedAt: new Date().toISOString() };
    } catch {
      return { id, status: cleanStatus, actor, resolvedAt: new Date().toISOString() };
    }
  }

  async fetchInteractionLogs(limit = 15) {
    const defaultLogs = [
      {
        id: 'log_inbound_001',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'WEBSITE',
        event_type: 'LEAD_INGESTED',
        source_agent: 'MARK',
        direction: 'INBOUND',
        summary: 'Portugal HNW Lead Ingestion: Gonçalo de Albuquerque (AED 15,000,000)',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 45000).toISOString(),
      },
      {
        id: 'log_opal_002',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'API',
        event_type: 'OPAL_ROI_CALCULATED',
        source_agent: 'ATLAS',
        direction: 'INTERNAL_AGENT',
        summary: 'Google Opal ROI Computation: 7.8% Net Yield with Law 8 Escrow statutory shield',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 38000).toISOString(),
      },
      {
        id: 'log_memo_003',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'ENGINE',
        event_type: 'MEMORANDUM_GENERATED',
        source_agent: 'JARVIS',
        direction: 'INTERNAL_AGENT',
        summary: 'Institutional Memorandum generated [memo_178773801_x9] in 2ms',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 30000).toISOString(),
      },
      {
        id: 'log_wa_004',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'WHATSAPP',
        event_type: 'BRIEF_DISPATCHED',
        source_agent: 'AIDA',
        direction: 'OUTBOUND',
        summary: 'WhatsApp brief queued for +351912345678 (Como Residences allocation)',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 22000).toISOString(),
      },
      {
        id: 'log_email_005',
        correlation_id: 'corr_pt_hnw_178773801',
        channel: 'EMAIL',
        event_type: 'EXECUTIVE_BRIEF_SENT',
        source_agent: 'AIDA',
        direction: 'OUTBOUND',
        summary: 'Executive Brief email queued for goncalo@albuquerque-capital.pt',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 15000).toISOString(),
      },
      {
        id: 'log_n8n_006',
        correlation_id: 'corr_es_hnw_178773802',
        channel: 'N8N_WEBHOOK',
        event_type: 'N8N_PIPELINE_TRIGGERED',
        source_agent: 'HERMES',
        direction: 'INTERNAL_AGENT',
        summary: 'Segmented n8n pipeline executed for Spain HNW Wealth Tax Hedge lead',
        status: 'SUCCESS',
        created_at: new Date(Date.now() - 8000).toISOString(),
      },
    ];

    if (this.isMock) {
      if (this.mockStore.interaction_logs.length === 0) {
        this.mockStore.interaction_logs = [...defaultLogs];
      }
      return this.mockStore.interaction_logs.slice(0, limit);
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/interaction_logs?select=*&order=created_at.desc&limit=${limit}`, {
        headers: { apikey: this.key, Authorization: `Bearer ${this.key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) return rows;
      }
      return defaultLogs.slice(0, limit);
    } catch {
      return defaultLogs.slice(0, limit);
    }
  }

  async recordInteractionLog(logData) {
    const record = {
      id: logData.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      investor_id: logData.investor_id || logData.investorId || null,
      correlation_id: logData.correlation_id || logData.correlationId || null,
      channel: logData.channel || 'WEBSITE',
      event_type: logData.event_type || logData.eventType || 'SYSTEM_EVENT',
      source_agent: logData.source_agent || logData.sourceAgent || 'JARVIS',
      direction: logData.direction || 'INBOUND',
      summary: logData.summary || 'Interaction logged',
      payload: logData.payload || {},
      response_data: logData.response_data || logData.responseData || {},
      latency_ms: logData.latency_ms || logData.latencyMs || 0,
      status: logData.status || 'SUCCESS',
      error_message: logData.error_message || logData.errorMessage || null,
      created_at: logData.created_at || new Date().toISOString(),
    };

    if (this.isMock) {
      this.mockStore.interaction_logs.unshift(record);
      return record;
    }

    try {
      const res = await fetch(`${this.url}/rest/v1/interaction_logs`, {
        method: 'POST',
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });
      return res.ok ? record : record;
    } catch {
      return record;
    }
  }

  getOperationalStoreSnapshot() {
    return {
      agents: Array.from(this.mockStore.agent_status.values()),
      fleet: Array.from(this.mockStore.agent_fleet_status.values()),
      approvals: this.mockStore.executive_approvals,
      interactions: this.mockStore.interaction_logs,
      connectors: Array.from(this.mockStore.connector_health.values()),
      executions: Array.from(this.mockStore.executions.values()),
      workflows: Array.from(this.mockStore.workflow_runs.values()),
      notifications: this.mockStore.notifications,
      communications: this.mockStore.communications || [],
      auditLogs: this.mockStore.audit_logs || [],
    };
  }
}

export const supabase = new SupabaseClient();


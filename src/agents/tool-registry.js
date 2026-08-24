/**
 * RAIOC Agents - Shared Tool Registry
 * Exposes standardized, callable tools across Gmail, Calendar, WhatsApp, CRM, IKL, and Supabase.
 */

import { gmailClient } from '../integrations/google/gmail-client.js';
import { googleCalendarClient } from '../integrations/google/calendar-client.js';
import { whatsAppBusinessClient } from '../integrations/whatsapp/whatsapp-business-client.js';
import { crmSyncClient } from '../integrations/crm/crm-sync-client.js';
import { ikl } from '../core/ikl/index.js';
import { diraRiisEngine } from '../engines/dira-riis-engine.js';
import { run_cycle } from '../core/run-cycle.js';
import { logger } from '../logging/audit-logger.js';

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this._registerCoreTools();
  }

  registerTool(name, toolDefinition) {
    this.tools.set(name, {
      name,
      description: toolDefinition.description || '',
      parametersSchema: toolDefinition.parametersSchema || {},
      execute: toolDefinition.execute,
    });
    logger.info('TOOL_REGISTRY', `Registered agent tool: ${name}`);
  }

  getTool(name) {
    return this.tools.get(name) || null;
  }

  listTools() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parametersSchema: t.parametersSchema,
    }));
  }

  _registerCoreTools() {
    // 1. Gmail Tool
    this.registerTool('send_email_brief', {
      description: 'Sends an Executive Brief or email notification via Gmail API',
      parametersSchema: { to: 'string', subject: 'string', body: 'string', isHtml: 'boolean?' },
      execute: async (params) => await gmailClient.sendEmail(params),
    });

    // 2. Google Calendar Tool
    this.registerTool('schedule_calendar_advisory', {
      description: 'Schedules a private real estate advisory session on Google Calendar',
      parametersSchema: { attendeeEmail: 'string', summary: 'string?', startIso: 'string?' },
      execute: async (params) => await googleCalendarClient.createEvent(params),
    });

    // 3. WhatsApp Cloud Tool
    this.registerTool('send_whatsapp_message', {
      description: 'Sends a formatted WhatsApp message or template via Meta Cloud API',
      parametersSchema: { to: 'string', message: 'string?', templateName: 'string?' },
      execute: async (params) => {
        if (params.templateName) return await whatsAppBusinessClient.sendTemplateMessage(params);
        return await whatsAppBusinessClient.sendTextMessage(params);
      },
    });

    // 4. CRM Lead Sync Tool
    this.registerTool('sync_crm_lead', {
      description: 'Synchronizes a qualified lead, RIIS score, and deal to HubSpot CRM',
      parametersSchema: { email: 'string', companyName: 'string', riisScore: 'number' },
      execute: async (params) => await crmSyncClient.syncLead(params),
    });

    // 5. IKL Knowledge Query Tool
    this.registerTool('query_ikl_knowledge', {
      description: 'Queries statutory regulations, tax rates, developers, and community yields from IKL',
      parametersSchema: { domain: 'string', queryId: 'string?' },
      execute: async (params) => {
        const { domain, queryId } = params;
        if (domain === 'communities') return queryId ? ikl.getCommunity(queryId) : ikl.getCommunities();
        if (domain === 'tax') return queryId ? ikl.getTaxRule(queryId) : ikl.getTaxRules();
        if (domain === 'regulations') return queryId ? ikl.getRegulation(queryId) : ikl.getRegulations();
        if (domain === 'developers') return queryId ? ikl.getDeveloper(queryId) : ikl.getDevelopers();
        return { version: ikl.getVersion() };
      },
    });

    // 6. DIRA & RIIS Analysis Tool
    this.registerTool('evaluate_dira_riis', {
      description: 'Performs full DIRA risk vector evaluation and RIIS scoring for an inbound profile',
      parametersSchema: { company_size: 'string', ai_maturity: 'string', timeline: 'string' },
      execute: async (params) => diraRiisEngine.analyze(params),
    });

    // 7. Run Cycle Trigger Tool
    this.registerTool('run_cycle_pipeline', {
      description: 'Triggers an autonomous execution cycle in the backend operating center',
      parametersSchema: { batchSize: 'number?' },
      execute: async (params) => await run_cycle(params),
    });
  }
}

export const toolRegistry = new ToolRegistry();

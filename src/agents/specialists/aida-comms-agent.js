/**
 * RAIOC Specialist Agent: AIDA (Client Relations & Multi-Channel Communications)
 * Coordinates executive brief delivery, WhatsApp Cloud dispatch, and Gmail outreach.
 */

import { BaseSpecialistAgent } from './base-agent.js';
import { executiveBriefGenerator } from '../../engines/executive-brief.js';
import { diraRiisEngine } from '../../engines/dira-riis-engine.js';

export class AidaCommsAgent extends BaseSpecialistAgent {
  constructor() {
    super({
      id: 'aida',
      name: 'AIDA',
      role: 'Client Relations & Communications Specialist',
      capabilities: ['executive_brief_generation', 'email_dispatch', 'whatsapp_dispatch', 'client_outreach'],
      systemPrompt: 'You specialize in high-touch, institutional-grade investor communications, formatting bespoke executive briefs, and omnichannel client engagement.',
    });
  }

  async processTask(task, context = {}) {
    const { leadData, channel = 'all' } = task;
    if (!leadData) {
      throw new Error('AIDA task failed: Missing leadData');
    }

    const intelligence = diraRiisEngine.analyze(leadData);

    // 1. Generate Executive Brief
    const brief = executiveBriefGenerator.generateBrief(leadData, intelligence);

    const dispatchResults = { brief, dispatches: [] };

    // 2. Dispatch via Gmail if requested and recipient present
    if ((channel === 'all' || channel === 'email') && leadData.email) {
      const emailRes = await this.invokeTool('send_email_brief', {
        to: leadData.email,
        subject: brief.email_subject || 'RAIOC Executive Intelligence Brief',
        body: brief.executive_summary,
        isHtml: false,
      });
      dispatchResults.dispatches.push({ channel: 'gmail', status: emailRes.status, to: leadData.email });
    }

    // 3. Dispatch via WhatsApp if requested and recipient present
    if ((channel === 'all' || channel === 'whatsapp') && leadData.phone) {
      const waRes = await this.invokeTool('send_whatsapp_message', {
        to: leadData.phone,
        message: brief.whatsapp_payload.text,
      });
      dispatchResults.dispatches.push({ channel: 'whatsapp', status: waRes.status, to: leadData.phone });
    }

    this.logDecision(
      `Dispatched bespoke Executive Brief to ${leadData.company_name || leadData.email} via channels: ${channel}`,
      'DELIVER_EXECUTIVE_BRIEF',
      {
        objectiveId: context.correlationId,
        confidenceScore: 0.97,
        impactLevel: 'MEDIUM',
        metadata: { dispatches: dispatchResults.dispatches },
      }
    );

    this.storeMemory(`brief_dispatch_${leadData.id || Date.now()}`, dispatchResults, {
      tags: ['communication', 'brief', 'dispatch', leadData.email || ''],
    });

    return dispatchResults;
  }
}

export const aidaCommsAgent = new AidaCommsAgent();

/**
 * RAIOC Central Agent Registry
 * Exports and aggregates all specialist agents in the RAIOC multi-agent operating system.
 */

import { markTriageAgent } from './specialists/mark-triage-agent.js';
import { aidaCommsAgent } from './specialists/aida-comms-agent.js';
import { atlasMarketAgent } from './specialists/atlas-market-agent.js';
import { lexComplianceAgent } from './specialists/lex-compliance-agent.js';
import { heliosCalendarAgent } from './specialists/helios-calendar-agent.js';
import { hermesCrmAgent } from './specialists/hermes-crm-agent.js';
import { sentinelHealthAgent } from './specialists/sentinel-health-agent.js';
import { jarvis } from './specialists/jarvis-orchestrator.js';
import { brandContentAgent } from './agent-brand.js';
import { commentWatchdogAgent } from './agent-engage.js';
import { dmConversionAgent } from './agent-dm.js';
import { socialAnalyticsAgent } from './agent-analytics.js';

export const AgentRegistry = {
  // Core Pipeline Specialists
  mark: markTriageAgent,
  aida: aidaCommsAgent,
  atlas: atlasMarketAgent,
  lex: lexComplianceAgent,
  helios: heliosCalendarAgent,
  hermes: hermesCrmAgent,
  sentinel: sentinelHealthAgent,
  jarvis: jarvis,

  // Social & Automated Content Specialists
  brand: brandContentAgent,
  engage: commentWatchdogAgent,
  dm: dmConversionAgent,
  analytics: socialAnalyticsAgent,
};

export {
  markTriageAgent,
  aidaCommsAgent,
  atlasMarketAgent,
  lexComplianceAgent,
  heliosCalendarAgent,
  hermesCrmAgent,
  sentinelHealthAgent,
  jarvis,
  brandContentAgent,
  commentWatchdogAgent,
  dmConversionAgent,
  socialAnalyticsAgent,
};

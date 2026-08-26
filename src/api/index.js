/**
 * RAIOC OS - Web API Module
 */

export { routeApiRequest, startApiServer } from './server.js';
export { propertyCalculators, PropertyCalculators } from './calculators/property-calculators.js';
export { handleIklRequest } from './routes/ikl-routes.js';
export { handleCalculatorRequest } from './routes/calculator-routes.js';
export { handleAssessmentSubmission } from './routes/assessment-routes.js';
export { handleLeadSubmission } from './routes/lead-routes.js';
export { handleTelemetryRequest } from './routes/telemetry-routes.js';
export { handleWebhookRequest } from './routes/webhook-routes.js';
export { handleAgentRequest } from './routes/agent-routes.js';
export { handleCrmRequest } from './routes/crm-routes.js';
export { handleFleetRequest } from './mission-control/fleet.js';
export { handleApprovalsRequest } from './mission-control/approvals.js';
export { handleInteractionsRequest } from './mission-control/interactions.js';
export { handleRegistryRequest } from './core/registry.js';
export { handleKnowledgeRequest } from './core/knowledge.js';
export { handleRuntimeTelemetryRequest } from './runtime/telemetry.js';
export { handleEventsRequest } from './events/router.js';
export { handleMemoryAdrRequest } from './memory/adr.js';
export { handleTelegramWebhookRequest } from './v1/channels/telegram.js';
export { handleWhatsAppWebhookRequest } from './v1/channels/whatsapp.js';
export { handleDocumentIntakeRequest } from './v1/intake/document.js';
export { handleMissionControlV1State } from './mission-control/v1-state.js';

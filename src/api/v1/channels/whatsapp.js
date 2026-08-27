/**
 * RAIOC OS - WhatsApp Cloud API Ingestion Gateway (Phase 8 / v1.1)
 * Re-exports canonical implementation from src/api/routes/whatsapp-webhook-routes.js
 */

export {
  handleWhatsAppWebhookRequest,
  parseWhatsAppMessagePayload,
  parseWhatsAppMessagePayload as normalizeWhatsAppPayload,
  isWamidProcessed,
  markWamidProcessed,
  clearWamidCache,
} from '../../routes/whatsapp-webhook-routes.js';

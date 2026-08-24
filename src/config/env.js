/**
 * RAIOC OS - Environment & Runtime Configuration
 */

export const config = {
  env: process.env.NODE_ENV || 'production',
  supabase: {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  engine: {
    cycleIntervalMs: parseInt(process.env.CYCLE_INTERVAL_MS || '30000', 10),
    batchSize: parseInt(process.env.PROCESSING_BATCH_SIZE || '50', 10),
    maxRetries: parseInt(process.env.QUEUE_MAX_RETRIES || '5', 10),
    baseBackoffMs: parseInt(process.env.QUEUE_BASE_BACKOFF_MS || '1000', 10),
    maxBackoffMs: parseInt(process.env.QUEUE_MAX_BACKOFF_MS || '60000', 10),
  },
  adapters: {
    whatsapp: {
      enabled: process.env.WHATSAPP_ENABLED !== 'false',
      apiUrl: process.env.WHATSAPP_API_URL || '',
      apiKey: process.env.WHATSAPP_API_KEY || '',
      defaultSender: process.env.WHATSAPP_SENDER || 'RAIOC-Autonomous-Bot',
    },
    email: {
      enabled: process.env.EMAIL_ENABLED !== 'false',
      provider: process.env.EMAIL_PROVIDER || 'smtp',
      apiKey: process.env.EMAIL_API_KEY || '',
      from: process.env.EMAIL_FROM || 'intelligence@emanuelrendas.com',
    },
    crm: {
      enabled: process.env.CRM_ENABLED !== 'false',
      provider: process.env.CRM_PROVIDER || 'supabase_native',
      webhookUrl: process.env.CRM_WEBHOOK_URL || '',
    },
  },
  telemetry: {
    enabled: process.env.TELEMETRY_ENABLED !== 'false',
    flushIntervalMs: parseInt(process.env.TELEMETRY_FLUSH_INTERVAL_MS || '10000', 10),
  },
};

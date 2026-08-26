/**
 * RAIOC OS - ARGOS Market Intelligence & DLD Ingestion Agent (Phase 6)
 * 
 * Ingests official Dubai Land Department (DLD) and DXBInteract transactions,
 * normalizes asset classes, computes price-per-sqft metrics, and autonomously
 * detects and broadcasts Whale Alerts (transactions >= 20M AED) in prime corridors.
 */

import { enterpriseEventBus } from './event-bus.js';
import { supabase } from '../db/supabase-client.js';
import { logger } from '../logging/audit-logger.js';

export const ASSET_TYPES = {
  VILLA: 'VILLA',
  PENTHOUSE: 'PENTHOUSE',
  PLOT: 'PLOT',
  APARTMENT: 'APARTMENT',
  TOWNHOUSE: 'TOWNHOUSE',
  MANSION: 'MANSION',
};

export const PROJECT_STATUS = {
  OFF_PLAN: 'OFF_PLAN',
  READY: 'READY',
};

export const TARGET_SOVEREIGN_CORRIDORS = [
  'Palm Jebel Ali',
  'Dubai Islands',
  'Dubai Hills Estate',
  'Dubai Hills',
  'Palm Jumeirah',
  'Downtown Dubai',
  'DIFC',
];

export class ArgosMarketIntelligence {
  constructor() {
    this.agentName = 'ARGOS';
    this.role = 'Autonomous Market Intelligence & DLD Ingestion Specialist';
    this.whaleAlertThresholdAed = 20000000; // >= 20M AED
    this.transactionCache = [];
    this.whaleAlerts = [];
  }

  /**
   * Normalizes raw corridor strings into canonical corridor names
   * @param {string} rawCorridor 
   * @returns {string} Canonical corridor name
   */
  normalizeCorridor(rawCorridor = '') {
    const s = String(rawCorridor).toLowerCase().replace(/[_-]/g, ' ').trim();
    if (s.includes('jebel ali') || s === 'pja') return 'Palm Jebel Ali';
    if (s.includes('islands') || s.includes('deira island')) return 'Dubai Islands';
    if (s.includes('hills')) return 'Dubai Hills Estate';
    if (s.includes('palm') || s.includes('jumeirah')) return 'Palm Jumeirah';
    if (s.includes('downtown')) return 'Downtown Dubai';
    if (s.includes('difc')) return 'DIFC';
    if (s.includes('business bay')) return 'Business Bay';
    return rawCorridor || 'Dubai Prime Freehold';
  }

  /**
   * Normalizes asset types into canonical categories
   * @param {string} rawType 
   * @returns {string} Normalized asset type
   */
  normalizeAssetType(rawType = '') {
    const s = String(rawType).toLowerCase().trim();
    if (s.includes('mansion')) return ASSET_TYPES.MANSION;
    if (s.includes('penthouse') || s.includes('sky')) return ASSET_TYPES.PENTHOUSE;
    if (s.includes('townhouse')) return ASSET_TYPES.TOWNHOUSE;
    if (s.includes('villa') || s.includes('house')) return ASSET_TYPES.VILLA;
    if (s.includes('plot') || s.includes('land')) return ASSET_TYPES.PLOT;
    return ASSET_TYPES.APARTMENT;
  }

  /**
   * Normalizes project status (Off-Plan vs Ready)
   * @param {string} rawStatus 
   * @returns {string} Normalized status
   */
  normalizeStatus(rawStatus = '') {
    const s = String(rawStatus).toLowerCase().trim();
    if (s.includes('off') || s.includes('plan') || s.includes('construction') || s.includes('under')) {
      return PROJECT_STATUS.OFF_PLAN;
    }
    return PROJECT_STATUS.READY;
  }

  /**
   * Ingests, validates, and enriches a single DLD transaction
   * @param {Object} rawTx - Raw transaction payload from DLD/DXBInteract
   * @param {Object} options - Optional context
   * @returns {Promise<Object>} Processed and enriched transaction
   */
  async processTransaction(rawTx = {}, options = {}) {
    const txId = rawTx.transactionId || rawTx.id || rawTx.instance_id || `dld_tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const corridor = this.normalizeCorridor(rawTx.corridor || rawTx.community || rawTx.area_name_en || rawTx.project_name_en || 'Palm Jebel Ali');
    const assetType = this.normalizeAssetType(rawTx.assetType || rawTx.property_usage_en || rawTx.property_type_en || 'Villa');
    const projectStatus = this.normalizeStatus(rawTx.projectStatus || rawTx.reg_type_en || rawTx.status || 'Off-Plan');
    
    const priceAed = Number(rawTx.priceAed || rawTx.amount_aed || rawTx.actual_worth_aed || rawTx.price || 0);
    const areaSqft = Number(rawTx.areaSqft || rawTx.actual_area || rawTx.size_sqft || rawTx.procedure_area || 1000);
    const pricePerSqftAed = areaSqft > 0 ? Math.round(priceAed / areaSqft) : 0;

    const developer = rawTx.developer || rawTx.developer_name_en || rawTx.master_developer || 'Master Developer';
    const buyerCategory = rawTx.buyerCategory || (priceAed >= 20000000 ? 'SOVEREIGN_ENTITY' : 'PRIVATE_INVESTOR');
    const transactionDate = rawTx.transactionDate || rawTx.instance_date || new Date().toISOString();

    const enrichedTx = {
      transactionId: txId,
      corridor,
      assetType,
      projectStatus,
      priceAed,
      areaSqft,
      pricePerSqftAed,
      developer,
      buyerCategory,
      transactionDate,
      isWhaleTransaction: priceAed >= this.whaleAlertThresholdAed,
      source: 'DLD_DXB_INTERACT_OFFICIAL',
      ingestedAt: new Date().toISOString(),
    };

    // Store in internal cache
    this.transactionCache.unshift(enrichedTx);
    if (this.transactionCache.length > 200) this.transactionCache.pop();

    // Check Whale Alert Trigger (>= 20M AED in Target Corridors)
    if (enrichedTx.isWhaleTransaction) {
      await this.triggerWhaleAlert(enrichedTx, options);
    }

    return enrichedTx;
  }

  /**
   * Processes a batch of raw DLD transactions
   * @param {Array<Object>} transactions 
   * @param {Object} options 
   * @returns {Promise<Object>} Ingestion summary with processed transactions
   */
  async processBatch(transactions = [], options = {}) {
    const list = Array.isArray(transactions) ? transactions : [transactions];
    const processed = [];
    let whaleCount = 0;
    let totalVolumeAed = 0;

    for (const rawTx of list) {
      const tx = await this.processTransaction(rawTx, options);
      processed.push(tx);
      totalVolumeAed += tx.priceAed;
      if (tx.isWhaleTransaction) whaleCount += 1;
    }

    const avgPricePerSqft = processed.length > 0
      ? Math.round(processed.reduce((sum, t) => sum + t.pricePerSqftAed, 0) / processed.length)
      : 0;

    return {
      success: true,
      batchSize: processed.length,
      totalVolumeAed,
      whaleCount,
      avgPricePerSqft,
      transactions: processed,
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Broadcasts Whale Alert CloudEvent v1.1 to Event Bus v1.1
   * @param {Object} tx - Enriched high-value transaction
   * @param {Object} options 
   */
  async triggerWhaleAlert(tx, options = {}) {
    const whaleAlertId = `whale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const correlationId = options.correlationId || `corr_whale_${Date.now()}`;
    const traceparent = options.traceparent || null;

    const alertPayload = {
      whaleAlertId,
      transactionId: tx.transactionId,
      corridor: tx.corridor,
      priceAed: tx.priceAed,
      areaSqft: tx.areaSqft,
      pricePerSqftAed: tx.pricePerSqftAed,
      assetType: tx.assetType,
      projectStatus: tx.projectStatus,
      developer: tx.developer,
      buyerCategory: tx.buyerCategory,
      significance: 'HIGH_CONVICTION_INSTITUTIONAL_ENTRY',
      detectedAt: new Date().toISOString(),
    };

    this.whaleAlerts.unshift(alertPayload);
    if (this.whaleAlerts.length > 50) this.whaleAlerts.pop();

    logger.info(
      'ARGOS_WHALE_ALERT',
      `🚨 WHALE ALERT: AED ${(tx.priceAed / 1000000).toFixed(1)}M (${tx.pricePerSqftAed} AED/sqft) in ${tx.corridor} [${tx.assetType} - ${tx.projectStatus}]`,
      {
        whaleAlertId,
        priceAed: tx.priceAed,
        corridor: tx.corridor,
      }
    );

    // Publish CloudEvent v1.1
    try {
      await enterpriseEventBus.publishEvent(
        'raioc.market.whale_alert.v1',
        'raioc://argos/market-intelligence/dld-sync',
        alertPayload,
        {
          correlationId,
          traceparent,
          subject: `whale_alert_${tx.corridor.toLowerCase().replace(/\s+/g, '_')}`,
        }
      );
    } catch (err) {
      logger.error('ARGOS_WHALE_ALERT', 'Failed to broadcast whale alert event', { error: err.message });
    }

    // Persist to interaction logs
    try {
      await supabase.recordInteractionLog({
        channel: 'DLD_INGESTION',
        event_type: 'MARKET_WHALE_ALERT_DETECTED',
        source_agent: 'ARGOS',
        direction: 'INBOUND',
        summary: `Whale Alert detected: AED ${(tx.priceAed / 1000000).toFixed(1)}M in ${tx.corridor} (${tx.pricePerSqftAed} AED/sqft)`,
        payload: alertPayload,
        correlation_id: correlationId,
        traceparent,
        status: 'SUCCESS',
      });
    } catch {
      // Non-blocking
    }
  }

  /**
   * Retrieves active whale alerts
   * @param {number} limit 
   * @returns {Array<Object>} List of recent whale alerts
   */
  getWhaleAlerts(limit = 20) {
    return this.whaleAlerts.slice(0, limit);
  }

  /**
   * Retrieves recent ingested transactions
   * @param {number} limit 
   * @returns {Array<Object>} List of recent transactions
   */
  getRecentTransactions(limit = 50) {
    return this.transactionCache.slice(0, limit);
  }

  /**
   * Computes aggregate statistics for a specific corridor
   * @param {string} corridorName 
   * @returns {Object} Corridor transaction stats
   */
  getCorridorStats(corridorName) {
    const canonical = this.normalizeCorridor(corridorName);
    const corridorTxs = this.transactionCache.filter((t) => t.corridor.toLowerCase() === canonical.toLowerCase());

    if (corridorTxs.length === 0) {
      return {
        corridor: canonical,
        transactionCount: 0,
        totalVolumeAed: 0,
        avgPricePerSqftAed: 0,
        whaleTransactionCount: 0,
      };
    }

    const totalVolumeAed = corridorTxs.reduce((sum, t) => sum + t.priceAed, 0);
    const avgPricePerSqftAed = Math.round(corridorTxs.reduce((sum, t) => sum + t.pricePerSqftAed, 0) / corridorTxs.length);
    const whaleTransactionCount = corridorTxs.filter((t) => t.isWhaleTransaction).length;

    return {
      corridor: canonical,
      transactionCount: corridorTxs.length,
      totalVolumeAed,
      avgPricePerSqftAed,
      whaleTransactionCount,
    };
  }
}

export const argosMarketIntelligence = new ArgosMarketIntelligence();

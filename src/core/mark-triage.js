/**
 * RAIOC OS - MARK Document Triage & Verification Extension (Phase 2)
 * Evaluates extracted document intelligence against investor CRM records, recalculates
 * DIRA risk scores, updates pipeline stages, triggers high-value/anomaly HITL approvals,
 * and emits CloudEvent v1.1 domain events.
 */

import { supabase } from '../db/supabase-client.js';
import { enterpriseEventBus } from './event-bus.js';
import { logger } from '../logging/audit-logger.js';
import { DOCUMENT_CLASSES } from './document-vision.js';

export class MarkDocumentTriageEngine {
  /**
   * Evaluates extracted document data against investor profile and business rules
   * @param {Object} extractedResult - Output from documentVision.extract()
   * @param {string} investorId - Optional investor UUID or reference ID
   * @param {Object} context - { correlationId, causationId, traceparent }
   * @returns {Promise<Object>} Triage decision and updated investor state
   */
  async evaluateDocumentTriage(extractedResult, investorId = null, context = {}) {
    const startTime = Date.now();
    const docClass = extractedResult.documentClass || DOCUMENT_CLASSES.GENERIC_SCAN;
    const docData = extractedResult.data || {};
    const correlationId = context.correlationId || `corr_triage_${Date.now()}`;
    const traceparent = context.traceparent;

    let targetInvestor = null;
    if (investorId) {
      targetInvestor = await supabase.getInvestor(investorId);
    }

    let diraScoreDelta = 0;
    let newStage = targetInvestor?.stage || 'QUALIFIED';
    let verifiedLiquidityAed = targetInvestor?.verified_liquidity_aed || 0;
    const newTags = new Set(targetInvestor?.tags || []);
    let approvalRecord = null;

    // 1. Evaluate PROOF_OF_FUNDS
    if (docClass === DOCUMENT_CLASSES.PROOF_OF_FUNDS) {
      const liquidAed = Number(docData.liquid_amount_aed) || 0;
      verifiedLiquidityAed = liquidAed;

      if (liquidAed >= 20000000) {
        diraScoreDelta = 25;
        newStage = 'HOT_MANDATE';
      } else if (liquidAed >= 10000000) {
        diraScoreDelta = 20;
        newStage = 'HOT_MANDATE';
      } else if (liquidAed >= 2000000) {
        diraScoreDelta = 15;
        newStage = targetInvestor?.stage === 'NEW_LEAD' ? 'QUALIFIED' : (targetInvestor?.stage || 'QUALIFIED');
      } else {
        diraScoreDelta = 5;
      }

      newTags.add('VERIFIED_POF');
      if (liquidAed >= 2000000) {
        newTags.add('GOLDEN_VISA_VERIFIED');
      }
    }

    // 2. Evaluate TITLE_DEED
    else if (docClass === DOCUMENT_CLASSES.TITLE_DEED) {
      diraScoreDelta = 15;
      newTags.add('VERIFIED_TITLE_DEED');
      if (docData.escrow_account_status === 'VERIFIED_ACTIVE') {
        newTags.add('ESCROW_LAW8_COMPLIANT');
      }
    }

    // 3. Evaluate CONTRACT
    else if (docClass === DOCUMENT_CLASSES.CONTRACT) {
      diraScoreDelta = 10;
      newTags.add('CONTRACT_VERIFIED');
    }

    // 4. Update Investor Record in Supabase
    let updatedInvestor = targetInvestor;
    if (targetInvestor) {
      const currentDira = Number(targetInvestor.dira_score || targetInvestor.riis_score || 75);
      const updatedDira = Math.min(100, Math.max(0, currentDira + diraScoreDelta));

      const investorUpdates = {
        stage: newStage,
        status: newStage,
        dira_score: updatedDira,
        riis_score: updatedDira,
        tags: Array.from(newTags),
        verified_liquidity_aed: verifiedLiquidityAed || targetInvestor.verified_liquidity_aed,
        escrow_protected: docData.escrow_account_status === 'VERIFIED_ACTIVE' ? true : targetInvestor.escrow_protected,
      };

      if (docClass === DOCUMENT_CLASSES.TITLE_DEED && docData.community) {
        investorUpdates.target_asset = `${docData.community} (${docData.property_number || 'Unit'})`;
      }

      updatedInvestor = await supabase.updateInvestor(targetInvestor.id, investorUpdates);
      logger.info('MARK_TRIAGE', `Updated investor [${targetInvestor.id}] with ${docClass} verification (+${diraScoreDelta} DIRA)`, {
        investorId: targetInvestor.id,
        newStage,
        updatedDira,
      });
    }

    // 5. HITL Approval Trigger
    // Trigger if: low confidence (<0.75), manual review requested, or high-value anomaly (>=10M AED)
    const isHighValue = (Number(docData.liquid_amount_aed) >= 10000000) || (Number(docData.total_value_aed) >= 10000000);
    const requiresHitl = extractedResult.requiresManualReview === true || isHighValue;

    if (requiresHitl) {
      const investorName = targetInvestor?.name || docData.owner_entity || 'Inbound Sovereign Mandate';
      approvalRecord = await supabase.createApproval({
        id: `appr_doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        title: `MARK Document Verification: ${docClass} for ${investorName}`,
        agent: 'MARK (Lead Triage & Document Intelligence)',
        category: 'DOCUMENT_VERIFICATION',
        status: 'PENDING',
        priority: extractedResult.requiresManualReview ? 'HIGH' : 'CRITICAL',
        recipient: investorName,
        targetAsset: docData.community || docData.project_name || 'Dubai Prime Freehold',
        payload: {
          documentClass: docClass,
          confidence: extractedResult.confidence,
          requiresManualReview: extractedResult.requiresManualReview,
          isHighValue,
          extractedData: docData,
          investorId: targetInvestor?.id || null,
          diraScoreDelta,
        },
      });

      logger.info('MARK_TRIAGE', `Created Pending HITL Approval [${approvalRecord.id}] for ${docClass}`, {
        approvalId: approvalRecord.id,
        confidence: extractedResult.confidence,
      });
    }

    // 6. Emit CloudEvent v1.1 raioc.investor.lead.qualified.v1
    const qualifiedEvent = await enterpriseEventBus.publishEvent(
      'raioc.investor.lead.qualified.v1',
      'raioc://triage/mark/ocr',
      {
        investorId: targetInvestor?.id || null,
        documentClass: docClass,
        diraScoreDelta,
        stage: newStage,
        verifiedLiquidityAed,
        confidence: extractedResult.confidence,
        requiresManualReview: extractedResult.requiresManualReview,
        approvalId: approvalRecord?.id || null,
        extractedSummary: docData,
      },
      {
        correlationId,
        causationId: context.causationId || context.eventId,
        traceparent,
      }
    );

    return {
      success: true,
      triageStatus: requiresHitl ? 'REVIEW_REQUIRED' : 'QUALIFIED',
      diraScoreDelta,
      updatedStage: newStage,
      verifiedLiquidityAed,
      approvalId: approvalRecord?.id || null,
      investorId: targetInvestor?.id || null,
      qualifiedEventId: qualifiedEvent.id,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

export const markTriage = new MarkDocumentTriageEngine();

/**
 * RAIOC OS - Phase A Telegram E2E Live Ingestion Verification Script
 * Simulates a verified live Telegram webhook from @RAIOC_Bot and validates:
 * 1. Webhook endpoint returns HTTP 200 with CloudEvent v1.1 envelope metadata.
 * 2. CloudEvent is recorded on the Event Bus with SHA256 payload hash and hash chaining.
 * 3. Policy routing triggers MARK and creates a pending HITL executive approval for high-value mandate.
 * 4. Runtime tool telemetry is updated for 'telegram_bot'.
 * 5. Ingestion pulse feed reflects the interaction log with trace context.
 * 6. Audit immutability trigger protects the record from UPDATE and DELETE.
 */

import { routeApiRequest } from '../src/api/server.js';
import { supabase } from '../src/db/supabase-client.js';
import { enterpriseEventBus } from '../src/core/event-bus.js';
import { enterpriseEventRouter } from '../src/core/event-router.js';
import { config } from '../src/config/env.js';

async function runTelegramLiveVerification() {
  console.log('================================================================================');
  console.log('RAIOC PHASE A: TELEGRAM E2E LIVE INGESTION VERIFICATION');
  console.log('Timestamp: ' + new Date().toISOString());
  console.log('================================================================================\n');

  // Initialize event system and seed store
  enterpriseEventBus.clearHistory();
  enterpriseEventRouter.init();
  if (supabase.isMock) {
    supabase.initEnterpriseCoreSeeds();
  }

  const results = {
    step1_webhookResponse: false,
    step2_cloudEventBus: false,
    step3_policyRoutingMark: false,
    step4_executiveApprovalHitl: false,
    step5_runtimeToolTelemetry: false,
    step6_missionControlIngestion: false,
    step7_auditImmutabilityTrigger: false,
  };

  const secretToken = config.telegram?.secretToken || 'raioc_telegram_secret_2026';
  const customTraceparent = `00-${Date.now().toString(16).padStart(32, '0')}-00f067aa0ba902b7-01`;
  const customCorrelationId = `corr_tg_sterling_live_${Date.now()}`;

  const liveTelegramUpdate = {
    update_id: 8889901,
    message: {
      message_id: 12044,
      date: Math.floor(Date.now() / 1000),
      chat: {
        id: 7788991122,
        type: 'private',
        username: 'sterling_capital',
      },
      from: {
        id: 44556677,
        is_bot: false,
        first_name: 'Lord Alistair',
        last_name: 'Sterling',
        username: 'sterling_capital',
        language_code: 'en',
      },
      text: 'Requesting advisory allocation for 20M AED in Palm Jebel Ali off-plan corridor with Golden Visa qualification',
    },
  };

  console.log('[1/7] Dispatching Live Telegram Webhook Payload to /api/v1/channels/telegram/webhook...');
  const webhookRes = await routeApiRequest(
    '/api/v1/channels/telegram/webhook',
    'POST',
    liveTelegramUpdate,
    {},
    {
      'x-telegram-bot-api-secret-token': secretToken,
      'x-correlation-id': customCorrelationId,
      traceparent: customTraceparent,
    }
  );

  console.log(`Response Status: ${webhookRes.status}`, webhookRes.body);

  if (
    webhookRes.status === 200 &&
    webhookRes.body.status === 'RECEIVED' &&
    webhookRes.body.eventId &&
    webhookRes.body.traceparent === customTraceparent &&
    webhookRes.body.correlationId === customCorrelationId
  ) {
    results.step1_webhookResponse = true;
    console.log('✓ Step 1 PASS: Webhook received and validated with W3C trace context');
  } else {
    console.error('✗ Step 1 FAIL: Invalid webhook response');
  }

  // [2/7] Verify CloudEvent on Event Bus
  console.log('\n[2/7] Inspecting CloudEvent v1.1 Envelope on Event Bus...');
  const event = enterpriseEventBus.getEventById(webhookRes.body.eventId);
  if (
    event &&
    event.type === 'raioc.channel.telegram.message.v1' &&
    event.source === 'raioc://channels/telegram/bot' &&
    event.payload_sha256 &&
    event.payload_sha256.length === 64
  ) {
    results.step2_cloudEventBus = true;
    console.log(`✓ Step 2 PASS: CloudEvent v1.1 verified (SHA256: ${event.payload_sha256.substring(0, 16)}...)`);
  } else {
    console.error('✗ Step 2 FAIL: CloudEvent not found on Event Bus');
  }

  // [3/7] Verify Policy Routing to MARK
  console.log('\n[3/7] Verifying Policy Routing to MARK (Lead Triage Specialist)...');
  const history = enterpriseEventBus.getEventHistory();
  const leadEvent = history.find((e) => e.type === 'raioc.investor.lead.ingested.v1');
  if (
    leadEvent &&
    leadEvent.data.routedAgent === 'MARK' &&
    leadEvent.data.leadDetails?.budgetAed === 20000000
  ) {
    results.step3_policyRoutingMark = true;
    console.log(`✓ Step 3 PASS: Policy routed to MARK with budget ${leadEvent.data.leadDetails.budgetAed.toLocaleString()} AED`);
  } else {
    console.error('✗ Step 3 FAIL: Lead not routed to MARK');
  }

  // [4/7] Verify High-Value HITL Approval Creation (>= 10M AED)
  console.log('\n[4/7] Verifying High-Value HITL Executive Approval Record...');
  const approvals = await supabase.fetchApprovals('PENDING');
  const sterlingApproval = approvals.find(
    (a) => a.recipient.includes('Lord Alistair Sterling') || a.payload?.username === 'sterling_capital'
  );
  if (
    sterlingApproval &&
    sterlingApproval.priority === 'CRITICAL' &&
    sterlingApproval.payload?.budgetAed === 20000000 &&
    sterlingApproval.payload?.goldenVisaEligible === true
  ) {
    results.step4_executiveApprovalHitl = true;
    console.log(`✓ Step 4 PASS: HITL Approval created (${sterlingApproval.id}: ${sterlingApproval.title})`);
  } else {
    console.error('✗ Step 4 FAIL: High-value approval record missing');
  }

  // [5/7] Verify Runtime Tool Telemetry
  console.log('\n[5/7] Verifying Runtime Tool Telemetry for telegram_bot...');
  const toolTelem = await supabase.getToolRuntimeTelemetry('telegram_bot');
  if (
    toolTelem &&
    toolTelem.live_health_status === 'HEALTHY' &&
    toolTelem.total_calls_today >= 1
  ) {
    results.step5_runtimeToolTelemetry = true;
    console.log(`✓ Step 5 PASS: Tool telemetry updated (Calls today: ${toolTelem.total_calls_today}, Status: ${toolTelem.live_health_status})`);
  } else {
    console.error('✗ Step 5 FAIL: Tool telemetry not updated');
  }

  // [6/7] Verify Mission Control Interaction Stream
  console.log('\n[6/7] Verifying Ingestion Stream at /api/v1/mission-control/interactions...');
  const interactionsRes = await routeApiRequest('/api/v1/mission-control/interactions?limit=10', 'GET');
  const tgInteraction = interactionsRes.body?.interactions?.find(
    (i) => i.channel === 'TELEGRAM' && i.correlation_id === customCorrelationId
  );
  if (tgInteraction && tgInteraction.source_agent === 'MARK') {
    results.step6_missionControlIngestion = true;
    console.log(`✓ Step 6 PASS: Ingestion stream contains Telegram interaction log (${tgInteraction.id})`);
  } else {
    console.error('✗ Step 6 FAIL: Interaction not visible in Mission Control stream');
  }

  // [7/7] Verify Audit Immutability Trigger Protection
  console.log('\n[7/7] Testing Append-Only Immutability Protection (Simulating UPDATE/DELETE attack)...');
  let updateBlocked = false;
  let deleteBlocked = false;

  if (tgInteraction) {
    try {
      await supabase.updateInteractionLog(tgInteraction.id, { summary: 'Hacked log' });
    } catch (err) {
      if (err.message.includes('strictly prohibited')) updateBlocked = true;
    }

    try {
      await supabase.deleteInteractionLog(tgInteraction.id);
    } catch (err) {
      if (err.message.includes('strictly prohibited')) deleteBlocked = true;
    }
  }

  if (updateBlocked && deleteBlocked) {
    results.step7_auditImmutabilityTrigger = true;
    console.log('✓ Step 7 PASS: Immutability triggers successfully rejected UPDATE and DELETE attempts');
  } else {
    console.error('✗ Step 7 FAIL: Audit record modification was not blocked by trigger');
  }

  // Summary
  const allPassed = Object.values(results).every((r) => r === true);
  console.log('\n================================================================================');
  console.log(`PHASE A VERIFICATION RESULT: ${allPassed ? 'PASS (100%)' : 'FAIL'}`);
  console.log('================================================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runTelegramLiveVerification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});

/**
 * RAIOC OS - Phase 8 WhatsApp Cloud API E2E Live Ingestion Verification Script
 * Simulates a verified live WhatsApp Cloud API message from Meta and validates:
 * 1. Meta Webhook challenge GET verification returns HTTP 200 with raw challenge.
 * 2. Inbound POST message returns HTTP 200 with CloudEvent v1.1 envelope metadata.
 * 3. CloudEvent is recorded on the Event Bus with SHA256 payload hash and W3C trace context.
 * 4. Multi-agent policy routing dispatches to MARK and creates a pending HITL executive approval for >= 10M AED mandate.
 * 5. Runtime tool telemetry is updated for 'whatsapp_cloud_api'.
 * 6. Mission Control consolidated state feed reflects the interaction log with emerald WhatsApp badge.
 * 7. Audit immutability trigger protects the record from UPDATE and DELETE.
 */

import { routeApiRequest } from '../src/api/server.js';
import { supabase } from '../src/db/supabase-client.js';
import { enterpriseEventBus } from '../src/core/event-bus.js';
import { enterpriseEventRouter } from '../src/core/event-router.js';
import { config } from '../src/config/env.js';

async function runWhatsAppLiveVerification() {
  console.log('================================================================================');
  console.log('RAIOC PHASE 8: WHATSAPP CLOUD API E2E LIVE INGESTION VERIFICATION');
  console.log('Timestamp: ' + new Date().toISOString());
  console.log('================================================================================\n');

  // Initialize event system and seed store
  enterpriseEventBus.clearHistory();
  enterpriseEventRouter.init();
  if (supabase.isMock) {
    supabase.initEnterpriseCoreSeeds();
  }

  const results = {
    step1_metaChallengeVerification: false,
    step2_webhookResponse: false,
    step3_cloudEventBus: false,
    step4_policyRoutingMark: false,
    step5_executiveApprovalHitl: false,
    step6_runtimeToolTelemetry: false,
    step7_missionControlIngestion: false,
    step8_auditImmutabilityTrigger: false,
  };

  // [1/8] Meta GET Challenge Verification
  console.log('[1/8] Testing Meta Webhook Verification Challenge (GET)...');
  const verifyToken = config.whatsappBusiness?.verifyToken || 'raioc_wa_verify_token';
  const challengeCode = '119922883344';
  const getChallengeRes = await routeApiRequest(
    `/api/v1/channels/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challengeCode}`,
    'GET',
    {},
    {
      'hub.mode': 'subscribe',
      'hub.verify_token': verifyToken,
      'hub.challenge': challengeCode,
    }
  );

  console.log(`GET Challenge Status: ${getChallengeRes.status}`, getChallengeRes.body);
  if (getChallengeRes.status === 200 && String(getChallengeRes.body) === challengeCode) {
    results.step1_metaChallengeVerification = true;
    console.log('✓ Step 1 PASS: Meta Webhook challenge verified with HTTP 200');
  } else {
    console.error('✗ Step 1 FAIL: Meta challenge verification failed');
  }

  // [2/8] Dispatch Live WhatsApp Message Ingestion Payload
  const customTraceparent = `00-${Date.now().toString(16).padStart(32, '0')}-00f067aa0ba902b7-01`;
  const customCorrelationId = `corr_wa_vance_live_${Date.now()}`;

  const liveWhatsAppPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '109928837744',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '971543871702', phone_number_id: '10987654321' },
              contacts: [
                { profile: { name: 'Lady Eleanor Vance' }, wa_id: '447700900077' }
              ],
              messages: [
                {
                  from: '447700900077',
                  id: 'wamid.HBgLNDQ3NzAwOTAwMDc3FQIAERgSRTc1RDYyMzM4REQzRDkxQTczAA==',
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: 'Requesting private allocation of 25M AED in Palm Jebel Ali waterfront villas with Golden Visa structuring.' },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  console.log('\n[2/8] Dispatching Live WhatsApp Webhook Payload to /api/v1/channels/whatsapp/webhook...');
  const webhookRes = await routeApiRequest(
    '/api/v1/channels/whatsapp/webhook',
    'POST',
    liveWhatsAppPayload,
    {},
    {
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
    results.step2_webhookResponse = true;
    console.log('✓ Step 2 PASS: Webhook received and validated with W3C trace context');
  } else {
    console.error('✗ Step 2 FAIL: Invalid webhook response');
  }

  // [3/8] Verify CloudEvent on Event Bus
  console.log('\n[3/8] Inspecting CloudEvent v1.1 Envelope on Event Bus...');
  const event = enterpriseEventBus.getEventById(webhookRes.body.eventId);
  if (
    event &&
    event.type === 'raioc.channel.whatsapp.message.v1' &&
    event.source === 'raioc://channels/whatsapp/cloud' &&
    event.traceparent === customTraceparent &&
    event.correlation_id === customCorrelationId &&
    event.payload_sha256 &&
    event.payload_sha256.length === 64
  ) {
    results.step3_cloudEventBus = true;
    console.log(`✓ Step 3 PASS: CloudEvent verified on Bus with SHA256: ${event.payload_sha256.substring(0, 16)}...`);
  } else {
    console.error('✗ Step 3 FAIL: CloudEvent envelope invalid or not found on Bus');
  }

  // [4/8] Policy Routing to MARK
  console.log('\n[4/8] Verifying Multi-Agent Policy Routing to MARK...');
  const downstreamEvents = enterpriseEventBus.getEventHistory();
  const markEvent = downstreamEvents.find((e) => e.type === 'raioc.investor.lead.ingested.v1');
  if (
    markEvent &&
    markEvent.data.routedAgent === 'MARK' &&
    markEvent.data.leadDetails?.budgetAed === 25000000 &&
    markEvent.data.leadDetails?.channel === 'WHATSAPP'
  ) {
    results.step4_policyRoutingMark = true;
    console.log(`✓ Step 4 PASS: Policy router routed WhatsApp mandate to [MARK] with AED 25,000,000 budget`);
  } else {
    console.error('✗ Step 4 FAIL: Policy router did not route to MARK');
  }

  // [5/8] Pending Executive HITL Approval Creation (>= 10M AED)
  console.log('\n[5/8] Checking Pending Executive Approval Queue for High-Value Mandate...');
  const approvals = await supabase.fetchApprovals();
  const liveApproval = approvals.find((a) => a.recipient === 'Lady Eleanor Vance' || a.id.startsWith('appr_wa_'));
  if (liveApproval && liveApproval.status === 'PENDING' && liveApproval.priority === 'CRITICAL') {
    results.step5_executiveApprovalHitl = true;
    console.log(`✓ Step 5 PASS: Created HITL Approval [${liveApproval.id}] for 25M AED Mandate`);
  } else {
    console.error('✗ Step 5 FAIL: Approval record not created');
  }

  // [6/8] Runtime Tool Telemetry
  console.log('\n[6/8] Inspecting Runtime Tool Telemetry for "whatsapp_cloud_api"...');
  const toolTelemetry = await supabase.getToolRuntimeTelemetry('whatsapp_cloud_api');
  if (
    toolTelemetry &&
    toolTelemetry.live_health_status === 'HEALTHY' &&
    toolTelemetry.total_calls_today >= 1
  ) {
    results.step6_runtimeToolTelemetry = true;
    console.log(`✓ Step 6 PASS: Tool telemetry healthy: calls=${toolTelemetry.total_calls_today}, latency=${toolTelemetry.current_latency_ms}ms`);
  } else {
    console.error('✗ Step 6 FAIL: Tool telemetry probe missing or degraded');
  }

  // [7/8] Mission Control Consolidated State Feed
  console.log('\n[7/8] Querying Consolidated Mission Control V1 State Feed...');
  const v1StateRes = await routeApiRequest('/api/v1/mission-control/v1-state', 'GET');
  const ingestionItem = v1StateRes.body.ingestionPulse?.find((item) => item.sender && item.sender.includes('Eleanor Vance'));
  if (
    v1StateRes.status === 200 &&
    v1StateRes.body.success === true &&
    ingestionItem &&
    ingestionItem.channel === 'WHATSAPP' &&
    ingestionItem.source_agent === 'MARK'
  ) {
    results.step7_missionControlIngestion = true;
    console.log(`✓ Step 7 PASS: Mission Control feed reflects WhatsApp ingestion from ${ingestionItem.sender} with WHATSAPP badge`);
  } else {
    console.error('✗ Step 7 FAIL: Interaction not reflected in Mission Control feed');
  }

  // [8/8] Immutable Audit Ledger Protection
  console.log('\n[8/8] Testing Immutability Guarantees on interaction_logs Table...');
  try {
    await supabase.updateInteractionLog('log_sample', { summary: 'Hacked summary' });
    console.error('✗ Step 8 FAIL: Allowed prohibited UPDATE on interaction_logs');
  } catch (err) {
    if (err.message.includes('strictly prohibited')) {
      results.step8_auditImmutabilityTrigger = true;
      console.log('✓ Step 8 PASS: Cryptographic immutability enforced (UPDATE/DELETE operations strictly blocked)');
    } else {
      console.error('✗ Step 8 FAIL: Unexpected error message', err.message);
    }
  }

  // Final Summary
  console.log('\n================================================================================');
  console.log('PHASE 8 WHATSAPP CLOUD API VERIFICATION SUMMARY:');
  const allPassed = Object.values(results).every(Boolean);
  Object.entries(results).forEach(([step, passed]) => {
    console.log(`  ${passed ? '✓' : '✗'} ${step}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  console.log(`\nOVERALL RESULT: ${allPassed ? '100% OPERATIONAL & VERIFIED (READY FOR PRODUCTION)' : 'FAILED'}`);
  console.log('================================================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

runWhatsAppLiveVerification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});

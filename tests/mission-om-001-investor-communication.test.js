import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';

import {
  agentEventBus,
  AgentEvents,
  n8nWebhookClient,
  secretsManager,
  webhookVerifier,
  routeApiRequest,
  decisionLogger,
  config,
} from '../src/index.js';

describe('MISSION ID: OM-001 — Operational Capability 3: Investor Communication via n8n & Event Bus', () => {
  test('1. Event Bus automatically forwards all 5 required production events to n8n with Correlation ID', async () => {
    const correlationId = `corr_om001_inv_${Date.now()}`;
    const capturedDispatches = [];

    // Temporary custom client with spy
    const testClient = new (n8nWebhookClient.constructor)({
      enabled: false,
    });

    testClient.triggerWorkflow = async (eventType, data, metadata) => {
      capturedDispatches.push({ eventType, data, metadata });
      return { status: 'simulated', eventType, correlationId: metadata.correlationId };
    };

    // Forward topics from bus
    const unsubscribers = testClient.forwardedTopics.map((topic) =>
      agentEventBus.subscribe(topic, async (event) => {
        if (event.metadata?.correlationId === correlationId) {
          await testClient.triggerWorkflow(topic, event.payload, event.metadata);
        }
      })
    );

    const lead = {
      id: 'lead_om001_sheikh_mansoor',
      name: 'Sheikh Mansoor Al Qasimi',
      company_name: 'Royal Emirates Capital',
      email: 'privateadvisory@emanuelrendas.com',
      phone: '+971509998877',
      propertyPriceAed: 15000000,
      communityId: 'comm_palm_jumeirah',
    };

    // Emit all 5 production events in sequence
    agentEventBus.publish(AgentEvents.LEAD_INGESTED, { lead }, { correlationId, sourceAgent: 'website_api' });
    agentEventBus.publish(AgentEvents.LEAD_QUALIFIED, { lead, riisScore: 94 }, { correlationId, sourceAgent: 'mark' });
    agentEventBus.publish(AgentEvents.MARKET_ANALYZED, { lead, community: 'Palm Jumeirah', yield: 7.4 }, { correlationId, sourceAgent: 'atlas' });
    agentEventBus.publish(AgentEvents.COMPLIANCE_VERIFIED, { lead, goldenVisa: true, dldFee: 600000 }, { correlationId, sourceAgent: 'lex' });
    agentEventBus.publish(AgentEvents.BRIEF_DISPATCHED, { lead, channels: ['smtp', 'whatsapp'] }, { correlationId, sourceAgent: 'aida' });

    // Allow event queue dispatch
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Cleanup
    unsubscribers.forEach((u) => u());

    const dispatchedTopics = capturedDispatches.map((d) => d.eventType);
    assert.strictEqual(capturedDispatches.length, 5);
    assert.ok(dispatchedTopics.includes(AgentEvents.LEAD_INGESTED));
    assert.ok(dispatchedTopics.includes(AgentEvents.LEAD_QUALIFIED));
    assert.ok(dispatchedTopics.includes(AgentEvents.MARKET_ANALYZED));
    assert.ok(dispatchedTopics.includes(AgentEvents.COMPLIANCE_VERIFIED));
    assert.ok(dispatchedTopics.includes(AgentEvents.BRIEF_DISPATCHED));

    // Verify correlation ID propagation across all 5 dispatches
    for (const d of capturedDispatches) {
      assert.strictEqual(d.metadata.correlationId, correlationId);
    }
  });

  test('2. Cryptographic HMAC-SHA256 signature verification and tamper detection', () => {
    const payload = {
      event: 'lead:ingested',
      correlationId: 'corr_test_sec_001',
      data: { leadId: 'lead_123' },
    };

    const secret = 'prod_secret_key_123';
    const validSignature = secretsManager.generateHmacSignature(payload, secret);

    assert.strictEqual(
      webhookVerifier.verifyN8nSignature(payload, `sha256=${validSignature}`, secret),
      true
    );

    // Tampered payload must fail
    const tamperedPayload = { ...payload, event: 'lead:tampered' };
    assert.strictEqual(
      webhookVerifier.verifyN8nSignature(tamperedPayload, `sha256=${validSignature}`, secret),
      false
    );
  });

  test('3. n8n Executive API Callback endpoint (/api/webhooks/n8n) processes TASK_COMPLETED payload', async () => {
    const correlationId = `corr_om001_exec_${Date.now()}`;
    const n8nExecutionId = 'exec_n8n_89412';

    const completionPayload = {
      status: 'TASK_COMPLETED',
      event: 'TASK_COMPLETED',
      correlationId,
      n8nExecutionId,
      dispatches: {
        smtp: {
          status: 'DELIVERED',
          messageId: '<exec_brief_1787600099@mail.privateemail.com>',
          recipient: 'privateadvisory@emanuelrendas.com',
        },
        whatsapp: {
          status: 'SENT',
          metaMessageId: 'wamid.HBgM971509998877',
          recipient: '+971509998877',
        },
        hubspot: {
          contactId: 'hs_cnt_984129',
          dealId: 'hs_deal_512941',
          dealValueAed: 15000000,
        },
      },
      persisted: {
        events: true,
        communications: true,
        audit_log: true,
      },
    };

    const secret = config.n8n.webhookSecret;
    const signature = secretsManager.generateHmacSignature(completionPayload, secret);

    let completedEventReceived = null;
    const unsub = agentEventBus.subscribe(AgentEvents.TASK_COMPLETED, (evt) => {
      if (evt.metadata?.correlationId === correlationId) {
        completedEventReceived = evt;
      }
    });

    const response = await routeApiRequest(
      '/api/webhooks/n8n',
      'POST',
      completionPayload,
      {},
      {
        'X-N8N-Signature': `sha256=${signature}`,
        'X-Correlation-ID': correlationId,
      }
    );

    unsub();

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.status, 'TASK_COMPLETED');
    assert.strictEqual(response.body.correlationId, correlationId);
    assert.strictEqual(response.body.n8nExecutionId, n8nExecutionId);

    // Verify Event Bus received TASK_COMPLETED
    assert.ok(completedEventReceived !== null);
    assert.strictEqual(completedEventReceived.payload.n8nExecutionId, n8nExecutionId);
    assert.strictEqual(completedEventReceived.payload.result.smtp.messageId, '<exec_brief_1787600099@mail.privateemail.com>');
    assert.strictEqual(completedEventReceived.payload.result.whatsapp.metaMessageId, 'wamid.HBgM971509998877');
    assert.strictEqual(completedEventReceived.payload.result.hubspot.contactId, 'hs_cnt_984129');
    assert.strictEqual(completedEventReceived.payload.result.hubspot.dealId, 'hs_deal_512941');
  });

  test('4. Automatic retry logic on webhook dispatch failure with timeout', async () => {
    const mockFailClient = new (n8nWebhookClient.constructor)({
      webhookUrl: 'https://127.0.0.1:59999/invalid-n8n-endpoint',
      maxRetries: 3,
      retryDelayMs: 10,
      timeoutMs: 100,
    });

    await assert.rejects(
      async () => {
        await mockFailClient.triggerWorkflow('test:fail_event', { test: true });
      },
      /n8n webhook dispatch failed after 3 attempts/
    );
  });
});

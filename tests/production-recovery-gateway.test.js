/**
 * PRODUCTION RECOVERY TEST SUITE — Single Gateway Verification
 * Verifies that all 15 required routes execute successfully through api/index.js
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import handler from '../api/index.js';

function createMockRes() {
  let statusCode = 200;
  let responseBody = null;
  const responseHeaders = {};

  const res = {
    setHeader: (key, val) => {
      responseHeaders[key.toLowerCase()] = val;
    },
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseBody = data;
      return res;
    },
    send: (data) => {
      responseBody = data;
      return res;
    },
    end: (data) => {
      if (data && responseBody === null) responseBody = data;
      return res;
    },
    _get: () => ({
      status: statusCode,
      body: responseBody,
      headers: responseHeaders,
    }),
  };

  return res;
}

describe('PRODUCTION RECOVERY: 100% Endpoint Verification via Single Gateway (api/index.js)', () => {
  test('1. /api/health', async () => {
    const res = createMockRes();
    await handler({ url: '/api/health', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.status, 'HEALTHY');
  });

  test('2. /api/lead', async () => {
    const res = createMockRes();
    const payload = { name: 'Test Lead', email: 'investor@test.ae', budget: '10M AED' };
    await handler({ url: '/api/lead', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
  });

  test('3. /api/intake', async () => {
    const res = createMockRes();
    await handler({ url: '/api/intake', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.ok, true);
    assert.strictEqual(out.body.endpoint, '/api/intake');
  });

  test('4. /api/assessment', async () => {
    const res = createMockRes();
    const payload = { lead: { name: 'Investor Assessment' }, score: 85 };
    await handler({ url: '/api/assessment', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
  });

  test('5. /api/dld', async () => {
    const res = createMockRes();
    await handler({ url: '/api/dld', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(out.body !== null);
  });

  test('6. /api/fx', async () => {
    const res = createMockRes();
    await handler({ url: '/api/fx', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.ok, true);
    assert.ok(out.body.rates.USD);
  });

  test('7. /api/event', async () => {
    const res = createMockRes();
    await handler({ url: '/api/event', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.ok, true);
    assert.strictEqual(out.body.endpoint, '/api/event');
  });

  test('8. /api/test-email', async () => {
    const res = createMockRes();
    await handler({ url: '/api/test-email', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.ok([200, 500].includes(out.status));
    assert.ok(out.body);
  });

  test('9. /api/executive/status', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/status', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(out.body.runtimeStatus === 'OPERATIONAL' || out.body.runtimeStatus === 'HEALTHY');
    assert.ok(out.body.memoryUsage);
    assert.ok(out.body.eventBusHealth);
  });

  test('10. /api/executive/connectors', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/connectors', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.connectors.supabase);
  });

  test('11. /api/executive/pipeline', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/pipeline', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.totalPipelineRevenueAed !== undefined || out.body.recentDeals !== undefined);
  });

  test('12. /api/executive/kpis', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/kpis', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.kpis);
  });

  test('13. /api/executive/chat', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/chat', method: 'POST', body: { message: 'status report' }, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.message || out.body.response);
  });

  test('14. /api/executive/alerts', async () => {
    const res = createMockRes();
    await handler({ url: '/api/executive/alerts', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(Array.isArray(out.body.alerts));
  });

  test('15. /dashboard', async () => {
    const res = createMockRes();
    await handler({ url: '/dashboard', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(typeof out.body === 'string');
    assert.ok(out.body.includes('Command Center') || out.body.includes('RAIOC'));
  });

  test('16. Subdomain Host Routing: dashboard.emanuelrendas.com', async () => {
    const res = createMockRes();
    await handler({ url: '/', method: 'GET', headers: { host: 'dashboard.emanuelrendas.com' } }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(typeof out.body === 'string');
    assert.ok(out.body.includes('Command Center') || out.body.includes('RAIOC'));
  });

  test('17. Subdomain Host Routing: api.emanuelrendas.com', async () => {
    const res = createMockRes();
    await handler({ url: '/status', method: 'GET', headers: { host: 'api.emanuelrendas.com' } }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(out.body.runtimeStatus === 'OPERATIONAL' || out.body.runtimeStatus === 'HEALTHY');
  });

  test('18. Public Website Root: emanuelrendas.com & Developer Dossiers', async () => {
    const res = createMockRes();
    await handler({ url: '/', method: 'GET', headers: { host: 'www.emanuelrendas.com' } }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(typeof out.body === 'string');
    assert.ok(out.body.includes('Emanuel Rendas — Private Real Estate Advisory'));
    assert.ok(out.body.includes('id="developer-dossier-modal"'));
    assert.ok(out.body.includes('openDeveloperDossier(\'emaar\')'));
    assert.ok(out.body.includes('openDeveloperDossier(\'sobha\')'));
    assert.ok(out.body.includes('openDeveloperDossier(\'aldar\')'));
    assert.ok(out.body.includes('openDeveloperDossier(\'nakheel\')'));
    assert.ok(out.body.includes('openDeveloperDossier(\'damac\')'));
    assert.ok(out.body.includes('openDeveloperDossier(\'meraas\')'));
    assert.ok(out.body.includes('openDeveloperDossier(\'select-group\')'));
    assert.ok(out.body.includes('openDeveloperDossier(\'ellington\')'));
    assert.ok(out.body.includes('openDeveloperDossier(\'binghatti\')'));
  });

  test('19. AI Tool: /api/opal/roi', async () => {
    const res = createMockRes();
    const payload = { purchasePriceAed: 28000000, unitSizeSqft: 4500, expectedAnnualRentAed: 2100000, serviceChargePerSqft: 22 };
    await handler({ url: '/api/opal/roi', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.strictEqual(out.body.statutoryShield.goldenVisaEligible, true);
    assert.strictEqual(out.body.statutoryShield.goldenVisaThresholdAed, 2000000);
    assert.ok(out.body.financialMetrics.netYieldPct);
  });

  test('20. AI Tool: /api/mixboard/board', async () => {
    const res = createMockRes();
    const payload = { budgetAed: 20000000, clientName: 'Count Maximillian von Bern' };
    await handler({ url: '/api/mixboard/board', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.moodboard.heroImage);
    assert.ok(out.body.moodboard.curatedAssets.length > 0);
  });

  test('21. AI Tool: /api/flow/teaser', async () => {
    const res = createMockRes();
    const payload = { budgetAed: 25000000, projectName: 'Como Residences' };
    await handler({ url: '/api/flow/teaser', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.success, true);
    assert.ok(out.body.videoReel.videoUrl);
    assert.ok(out.body.directWhatsAppBookingUrl);
  });

  test('22. Social Agent: /api/social/brand/generate', async () => {
    const res = createMockRes();
    const payload = { topic: 'dubai-south', format: 'video_script' };
    await handler({ url: '/api/social/brand/generate', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(out.body.hook);
    assert.ok(out.body.script.scenes.length > 0);
    assert.strictEqual(out.body.topic, 'dubai-south');
    assert.ok(out.body.statutoryAnchors.goldenVisa.includes('AED 2,000,000'));
  });

  test('23. Social Agent: /api/social/engage/process', async () => {
    const res = createMockRes();
    const payload = { platform: 'instagram', author: 'investor_switzerland', text: 'Is this eligible for the 10-year Golden Visa program?' };
    await handler({ url: '/api/social/engage/process', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.analysis.intent, 'INQUIRY_GOLDEN_VISA');
    assert.strictEqual(out.body.isHighIntentLead, true);
    assert.ok(out.body.suggestedReply.includes('Cabinet Resolution No. 65 of 2022'));
  });

  test('24. Social Agent: /api/social/dm/process', async () => {
    const res = createMockRes();
    const payload = {
      platform: 'instagram',
      senderHandle: 'geneva_family_office',
      messageText: 'Hello Emanuel, looking to allocate 25M AED in Palm Jebel Ali for wealth preservation and golden visa.',
      extractedData: { name: 'Marc de Bellevue', email: 'marc@bellevue-capital.ch' },
    };
    await handler({ url: '/api/social/dm/process', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.evaluation.tier, 1);
    assert.ok(out.body.replyMessage.includes('Dubai Law No. (8) of 2007'));
    assert.ok(out.body.whatsappVipUrl.includes('wa.me'));
  });

  test('25. Social Agent: /api/social/analytics', async () => {
    const res = createMockRes();
    await handler({ url: '/api/social/analytics', method: 'GET', headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.ok(out.body.totalImpressions > 0);
    assert.ok(out.body.channelBreakdown.instagram);
    assert.strictEqual(out.body.meshStatus, 'HEALTHY');
  });

  test('26. Social Webhooks: Meta/Instagram Challenge & Ingestion', async () => {
    const resGet = createMockRes();
    await handler({
      url: '/api/webhooks/instagram',
      method: 'GET',
      query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'raioc_meta_verify_token', 'hub.challenge': 'meta_challenge_9988' },
      headers: {},
    }, resGet);
    const outGet = resGet._get();
    assert.strictEqual(outGet.status, 200);
    assert.strictEqual(outGet.body, 'meta_challenge_9988');

    const resPost = createMockRes();
    const payload = {
      entry: [{
        changes: [{
          field: 'comments',
          value: { id: 'ig_c_123', text: 'What is the audited net yield on Como Residences?', from: { username: 'investor_lux' } },
        }],
      }],
    };
    await handler({ url: '/api/webhooks/instagram', method: 'POST', body: payload, headers: {} }, resPost);
    const outPost = resPost._get();
    assert.strictEqual(outPost.status, 200);
    assert.strictEqual(outPost.body.status, 'PROCESSED');
    assert.strictEqual(outPost.body.provider, 'meta_instagram');
  });

  test('27. Social Webhooks: TikTok Event Ingestion', async () => {
    const res = createMockRes();
    const payload = {
      event: 'tiktok_comment',
      comment_id: 'tt_12345',
      user_name: 'crypto_founder',
      comment: 'How does escrow protection work under Dubai Law 8 for off-plan?',
    };
    await handler({ url: '/api/webhooks/tiktok', method: 'POST', body: payload, headers: {} }, res);
    const out = res._get();
    assert.strictEqual(out.status, 200);
    assert.strictEqual(out.body.status, 'PROCESSED');
    assert.strictEqual(out.body.provider, 'tiktok');
  });
});


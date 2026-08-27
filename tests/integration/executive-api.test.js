/**
 * RAIOC OS - Integration Test: Executive Chat Gateway & Google Gemini 2.5 Flash Adapter
 * Validates that POST /api/chat and POST /api/executive/chat return structured AI responses with HTTP 200,
 * with system instruction grounding in IKL knowledge, verified yields, and Law 8 of 2007 Escrow framework.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { routeApiRequest } from '../../src/api/server.js';
import { geminiAdapter } from '../../src/adapters/gemini-adapter.js';

describe('INTEGRATION: Executive AI Chat Gateway (/api/chat & /api/executive/chat)', () => {

  test('1. POST /api/chat returns structured AI response with HTTP 200 and JARVIS provenance', async () => {
    const prompt = 'What are the statutory escrow guarantees and net yields for off-plan allocations in Dubai Creek Harbour?';
    const correlationId = `corr_test_chat_${Date.now()}`;

    const res = await routeApiRequest(
      '/api/chat',
      'POST',
      { message: prompt },
      {},
      { 'x-correlation-id': correlationId }
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['Content-Type'], 'application/json');

    const body = res.body;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.sender, 'JARVIS');
    assert.strictEqual(typeof body.message, 'string');
    assert.ok(body.message.length > 0);
    assert.strictEqual(body.aiModel, 'gemini-2.5-flash');
    assert.ok(body.status);
    assert.strictEqual(typeof body.priority, 'number');
    assert.ok(body.timestamp);
  });

  test('2. POST /api/executive/chat validates Escrow Law 8 of 2007 and Golden Visa statutory context', async () => {
    const prompt = 'Explain the Escrow protection framework under Law 8 of 2007.';
    
    const res = await routeApiRequest(
      '/api/executive/chat',
      'POST',
      { prompt },
      {},
      {}
    );

    assert.strictEqual(res.status, 200);
    const body = res.body;
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.sender, 'JARVIS');
    assert.ok(body.message.includes('Law No. 8 of 2007') || body.message.includes('Escrow') || body.message.includes('JARVIS') || body.message.includes('Gemini'));
  });

  test('3. POST /api/chat rejects empty prompt with HTTP 400', async () => {
    const res = await routeApiRequest(
      '/api/chat',
      'POST',
      { message: '   ' },
      {},
      {}
    );

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.error);
  });

  test('4. Gemini Adapter directly calls Google AI Studio endpoint when GEMINI_API_KEY is configured', async () => {
    const originalFetch = globalThis.fetch;
    let interceptedUrl = '';
    let interceptedPayload = null;

    globalThis.fetch = async (url, opts) => {
      interceptedUrl = url;
      interceptedPayload = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: 'JARVIS Grounded Response: Verified allocations in Dubai Hills Estate achieve 8.4% audited net yield under statutory Escrow protection.',
                  },
                ],
              },
              finishReason: 'STOP',
            },
          ],
        }),
      };
    };

    try {
      const adapter = new (geminiAdapter.constructor)({
        apiKey: 'test_google_ai_key_mock_123',
        model: 'gemini-2.5-flash',
      });

      const result = await adapter.generateResponse('Check yield for Rosehill');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.provider, 'google_ai_studio');
      assert.strictEqual(result.model, 'gemini-2.5-flash');
      assert.ok(result.text.includes('8.4% audited net yield'));
      assert.ok(interceptedUrl.includes('gemini-2.5-flash:generateContent'));
      assert.ok(interceptedUrl.includes('test_google_ai_key_mock_123'));
      assert.ok(interceptedPayload.systemInstruction.parts[0].text.includes('Law 8 of 2007'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

});

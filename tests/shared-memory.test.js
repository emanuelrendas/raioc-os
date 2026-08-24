import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SharedMemory } from '../src/memory/shared-memory.js';

describe('Shared Memory & Long-Term Associative Storage Tests', () => {
  const memory = new SharedMemory();

  test('manages short-term working context with TTL expiration', async () => {
    memory.setWorkingContext('active_client_session', { leadId: 'lead_123', stage: 'TRIAGE' }, 50);
    assert.strictEqual(memory.getWorkingContext('active_client_session').leadId, 'lead_123');

    // Wait for TTL expiration
    await new Promise((resolve) => setTimeout(resolve, 60));
    assert.strictEqual(memory.getWorkingContext('active_client_session'), null);
  });

  test('stores and recalls long-term knowledge via associative query', () => {
    memory.storeKnowledge('dubai_tax_structure', {
      personalIncomeTaxPct: 0,
      corporateTaxPct: 9,
      vatPct: 5,
    }, { tags: ['tax', 'dubai', 'statutory'], importance: 1.5 });

    const recalled = memory.recallKnowledge('what is the tax structure in dubai');
    assert.ok(recalled.length > 0);
    assert.strictEqual(recalled[0].topic, 'dubai_tax_structure');
    assert.strictEqual(recalled[0].content.personalIncomeTaxPct, 0);
  });

  test('logs conversation messages between agents and provides query filters', () => {
    memory.recordMessage('jarvis', 'atlas', 'Requesting prime yield benchmarks for Downtown Dubai', 'corr_obj_1');
    memory.recordMessage('atlas', 'jarvis', 'Gross yield is 6.8% with average price AED 2,450/sqft', 'corr_obj_1');

    const history = memory.getConversationHistory({ correlationId: 'corr_obj_1' });
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].sender, 'jarvis');
    assert.strictEqual(history[1].sender, 'atlas');
  });

  test('provides memory footprint statistics', () => {
    const stats = memory.getStats();
    assert.ok(stats.longTermRecords >= 1);
    assert.ok(stats.totalMessagesLogged >= 2);
  });
});

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { toolRegistry } from '../src/agents/tool-registry.js';
import { agentRuntime } from '../src/agents/agent-runtime.js';
import { AgentAction, AgentContext } from '../src/agents/agent-action-interface.js';

describe('Shared Agent API & Tool Registry Tests', () => {
  test('discovers all registered core agent tools', () => {
    const tools = toolRegistry.listTools();
    assert.ok(tools.length >= 6);

    const toolNames = tools.map((t) => t.name);
    assert.ok(toolNames.includes('send_email_brief'));
    assert.ok(toolNames.includes('schedule_calendar_advisory'));
    assert.ok(toolNames.includes('send_whatsapp_message'));
    assert.ok(toolNames.includes('sync_crm_lead'));
    assert.ok(toolNames.includes('query_ikl_knowledge'));
    assert.ok(toolNames.includes('evaluate_dira_riis'));
  });

  test('AgentRuntime executes single tool action with execution metrics and audit tracking', async () => {
    const context = new AgentContext({ callerId: 'lead_triage_agent' });
    const action = new AgentAction('query_ikl_knowledge', {
      domain: 'communities',
      queryId: 'comm_downtown_dubai',
    });

    const result = await agentRuntime.executeAction(action, context);
    assert.strictEqual(result.status, 'SUCCESS');
    assert.strictEqual(result.toolName, 'query_ikl_knowledge');
    assert.strictEqual(result.output.name, 'Downtown Dubai');
    assert.ok(result.durationMs >= 0);
    assert.strictEqual(result.correlationId, context.correlationId);
  });

  test('AgentRuntime executes multi-tool plan and handles unknown tools gracefully', async () => {
    const context = new AgentContext({ callerId: 'executive_workflow_agent' });

    const plan = [
      new AgentAction('evaluate_dira_riis', {
        company_size: '500+',
        ai_maturity: 'in_production',
        timeline: 'immediate',
      }),
      new AgentAction('query_ikl_knowledge', {
        domain: 'tax',
        queryId: 'tax_personal_income',
      }),
    ];

    const planResult = await agentRuntime.executePlan(plan, context);
    assert.strictEqual(planResult.allSuccessful, true);
    assert.strictEqual(planResult.executedActions, 2);

    // Test unknown tool failure safety
    const failedAction = new AgentAction('non_existent_tool_xyz', {});
    const failResult = await agentRuntime.executeAction(failedAction, context);
    assert.strictEqual(failResult.status, 'FAILED');
    assert.ok(failResult.error.includes('not found'));
  });
});

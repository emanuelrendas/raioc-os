import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AutonomousPlanner } from '../src/operational/autonomous-planner.js';
import { TaskPriority } from '../src/operational/priority-task-dispatcher.js';

describe('Autonomous Planner Tests', () => {
  const planner = new AutonomousPlanner();

  test('decomposes full investor onboarding objective into multi-agent dependency graph', () => {
    const plan = planner.createPlan(
      'Onboard and qualify new investor lead with full DIRA/RIIS analysis, market asset recommendation, compliance audit, executive brief delivery, CRM sync, and advisory booking.',
      {
        companyName: 'Sovereign Capital UAE',
        contactName: 'His Excellency Tariq Al-Hashimi',
        email: 'tariq@sovereign.ae',
        phone: '+971509998877',
        budgetAed: 15000000,
      }
    );

    assert.ok(plan.planId.startsWith('plan_'));
    assert.strictEqual(plan.tasks.length, 7);

    const agentIds = plan.tasks.map((t) => t.agentId);
    assert.ok(agentIds.includes('mark'));
    assert.ok(agentIds.includes('atlas'));
    assert.ok(agentIds.includes('lex'));
    assert.ok(agentIds.includes('aida'));
    assert.ok(agentIds.includes('hermes'));
    assert.ok(agentIds.includes('helios'));
    assert.ok(agentIds.includes('sentinel'));

    // Check dependency structure: Brief task depends on triage, market, and compliance
    const briefTask = plan.tasks.find((t) => t.agentId === 'aida');
    assert.strictEqual(briefTask.dependencies.length, 3);
  });
});

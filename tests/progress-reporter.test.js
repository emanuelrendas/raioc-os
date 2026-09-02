import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUTHORIZED_AGENTS,
  EVENT_STATUS,
  buildProgressPayload,
  validateProgressInput,
} from '../src/integrations/n8n/progress-reporter.js';

const SECRET = 'test-progress-secret-never-print';

function validInput(overrides = {}) {
  return {
    mission: 'MISSION-API-TEST',
    agent: 'Codex',
    event: 'progress',
    progress: 55,
    task: 'Implementing execution fencing',
    ...overrides,
  };
}

test('v1 allowlist and event mapping are exact', () => {
  assert.deepEqual([...AUTHORIZED_AGENTS], ['Codex', 'Claude', 'Jules', 'Antigravity']);
  assert.deepEqual(EVENT_STATUS, {
    started: 'active',
    progress: 'active',
    blocked: 'blocked',
    completed: 'completed',
  });
});

test('buildProgressPayload maps the CLI event to the existing bridge payload', () => {
  assert.deepEqual(buildProgressPayload(validInput()), {
    mission: 'MISSION-API-TEST',
    agent: 'Codex',
    progress: 55,
    status: 'active',
    current_task: 'Implementing execution fencing',
  });
});

test('all four approved event types validate', () => {
  for (const [event, progress] of [
    ['started', 0],
    ['progress', 55],
    ['blocked', 55],
    ['completed', 100],
  ]) {
    const result = validateProgressInput(validInput({ event, progress }), SECRET);
    assert.equal(result.valid, true, `${event}: ${result.errors.join(', ')}`);
  }
});

test('validation rejects invalid mission, agent, event, progress, task, and completion semantics', () => {
  const cases = [
    [validInput({ mission: '' }), 'mission is required'],
    [validInput({ agent: '' }), 'agent is required'],
    [validInput({ agent: 'UnknownAgent' }), 'agent must be one of: Codex, Claude, Jules, Antigravity'],
    [validInput({ event: 'heartbeat' }), 'event must be one of: started, progress, blocked, completed'],
    [validInput({ progress: -1 }), 'progress must be an integer from 0 through 100'],
    [validInput({ progress: 101 }), 'progress must be an integer from 0 through 100'],
    [validInput({ progress: 50.5 }), 'progress must be an integer from 0 through 100'],
    [validInput({ task: '   ' }), 'task is required'],
    [validInput({ event: 'completed', progress: 99 }), 'completed requires progress = 100'],
  ];

  for (const [input, expectedError] of cases) {
    const result = validateProgressInput(input, SECRET);
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes(expectedError), JSON.stringify(result));
  }
});

test('missing secret is rejected without echoing any secret value', () => {
  const result = validateProgressInput(validInput(), '');
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('RAIOC_PROGRESS_SECRET is not configured'));
  assert.equal(JSON.stringify(result).includes(SECRET), false);
});

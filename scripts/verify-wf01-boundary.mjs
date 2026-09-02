/**
 * Static, zero-network guard for Mission 015E-C-R2's WF-01 boundary.
 * It intentionally validates only workflow JSON and does not load runtime
 * configuration, providers, or application modules.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WORKFLOW_URL = new URL('../workflows/n8n/wf_01_lead_triage_master.json', import.meta.url);

function nodeByName(workflow, name) {
  return workflow.nodes?.find((node) => node.name === name);
}

function outputNodes(workflow, name, outputIndex = 0) {
  return (workflow.connections?.[name]?.main?.[outputIndex] || []).map((edge) => edge.node);
}

function hasPath(workflow, starts, targetNames) {
  const pending = [...starts];
  const seen = new Set();
  while (pending.length > 0) {
    const name = pending.pop();
    if (targetNames.has(name)) return true;
    if (seen.has(name)) continue;
    seen.add(name);
    const outputs = workflow.connections?.[name]?.main || [];
    for (const output of outputs) {
      for (const edge of output || []) pending.push(edge.node);
    }
  }
  return false;
}

function hasBodyParameter(node, name, value) {
  return node?.parameters?.bodyParameters?.parameters?.some(
    (parameter) => parameter.name === name && parameter.value === value,
  );
}

export function verifyWf01Boundary(workflow) {
  const violations = [];
  const webhook = nodeByName(workflow, '1. Inbound Lead Webhook');
  const normalizer = nodeByName(workflow, '2. Verify & Normalize Signed Event');
  const modeGate = nodeByName(workflow, '3. Runtime Mode Gate');
  const scoreValidator = nodeByName(workflow, '5. Validate DIRA and RIIS Scores');
  const scoreGate = nodeByName(workflow, '6. Valid DIRA/RIIS Qualification Filter');
  const crm = nodeByName(workflow, '7. Sync to Sovereign CRM');
  const boundaryResponse = nodeByName(workflow, '10. Build Boundary Response');
  const respond = nodeByName(workflow, '11. Respond to Boundary');
  const activeResponse = nodeByName(workflow, '12. Complete Active Response');
  const serialized = JSON.stringify(workflow);
  const normalizerCode = normalizer?.parameters?.jsCode || '';
  const scoreCode = scoreValidator?.parameters?.jsCode || '';
  const fanoutNodes = new Set([
    '7. Sync to Sovereign CRM',
    '8. Telegram Executive Alert',
    '9. Publish to Event Bus v1.1',
  ]);

  if (webhook?.parameters?.responseMode === 'onReceived') {
    violations.push('WF-01 must not acknowledge on receipt');
  }
  if (webhook?.parameters?.responseMode !== 'responseNode' || !respond || respond.type !== 'n8n-nodes-base.respondToWebhook') {
    violations.push('WF-01 requires a Respond to Webhook terminal path');
  }
  if (!hasPath(workflow, outputNodes(workflow, '10. Build Boundary Response'), new Set(['11. Respond to Boundary'])) ||
      !hasPath(workflow, outputNodes(workflow, '12. Complete Active Response'), new Set(['11. Respond to Boundary']))) {
    violations.push('synchronous response is not reachable from both terminal paths');
  }

  if (/\+971501234567|privateadvisory@emanuelrendas\.com/i.test(serialized)) {
    violations.push('synthetic customer contact fallback detected');
  }
  if (/\|\|\s*(?:85|90|92)(?:\D|$)/.test(serialized)) {
    violations.push('qualification-authorizing fallback score detected');
  }
  if (!/Number\.isFinite\(diraScore\)/.test(scoreCode) || !/Number\.isFinite\(riisScore\)/.test(scoreCode)) {
    violations.push('DIRA and RIIS scores are not both validated before qualification');
  }
  if (scoreGate?.parameters?.conditions?.boolean?.[0]?.value1 !== '={{ $json.boundary.allowExternalFanout === true }}') {
    violations.push('qualification filter is not controlled by validated boundary authority');
  }

  if (!/timingSafeEqual/.test(normalizerCode) || !/signatureValid/.test(normalizerCode)) {
    violations.push('signed runtime context is not verified');
  }
  if (!/runtimeMode === 'canary'/.test(normalizerCode) || !/runtimeMode === 'active'/.test(normalizerCode) ||
      !/RUNTIME_MODE_INVALID/.test(normalizerCode) || !/allowExternalFanout: false/.test(normalizerCode)) {
    violations.push('missing, malformed, or unknown runtime mode is not fail-closed');
  }

  const restrictedStarts = outputNodes(workflow, '3. Runtime Mode Gate', 1);
  if (!modeGate || restrictedStarts.length === 0 || hasPath(workflow, restrictedStarts, fanoutNodes)) {
    violations.push('canary or invalid-mode path can reach provider fan-out');
  }
  if (!boundaryResponse || !activeResponse) {
    violations.push('canary-safe and active terminal paths must remain distinct');
  }

  if (!crm?.parameters?.url?.includes('/api/v1/crm/lead/ingest')) {
    violations.push('versioned CRM ingestion path is absent');
  }
  if (!hasBodyParameter(crm, 'origin', 'n8n-wf01') ||
      !hasBodyParameter(crm, 'triggerCycle', 'false') ||
      !hasBodyParameter(crm, 'forwardToN8n', 'false')) {
    violations.push('WF-01 CRM anti-reentry provenance contract is absent');
  }

  return { valid: violations.length === 0, violations };
}

export function verifyCanonicalWf01() {
  const workflow = JSON.parse(readFileSync(WORKFLOW_URL, 'utf8'));
  return verifyWf01Boundary(workflow);
}

const invokedPath = process.argv[1] && fileURLToPath(import.meta.url);
if (invokedPath && process.argv[1].replaceAll('\\', '/') === invokedPath.replaceAll('\\', '/')) {
  const result = verifyCanonicalWf01();
  if (!result.valid) {
    console.error(`WF-01 boundary verification failed:\n- ${result.violations.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('WF-01 boundary verification passed.');
  }
}

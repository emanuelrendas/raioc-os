export const AUTHORIZED_AGENTS = new Set(['Codex', 'Claude', 'Jules', 'Antigravity']);

export const EVENT_STATUS = Object.freeze({
  started: 'active',
  progress: 'active',
  blocked: 'blocked',
  completed: 'completed',
});

export const DEFAULT_PROGRESS_URL = 'https://privateadvisory.app.n8n.cloud/webhook/raioc-progress';

export function validateProgressInput(input = {}, secret = '') {
  const errors = [];
  const mission = typeof input.mission === 'string' ? input.mission.trim() : '';
  const agent = typeof input.agent === 'string' ? input.agent.trim() : '';
  const event = typeof input.event === 'string' ? input.event.trim() : '';
  const task = typeof input.task === 'string' ? input.task.trim() : '';

  if (!mission) errors.push('mission is required');
  if (!agent) {
    errors.push('agent is required');
  } else if (!AUTHORIZED_AGENTS.has(agent)) {
    errors.push('agent must be one of: Codex, Claude, Jules, Antigravity');
  }

  if (!Object.hasOwn(EVENT_STATUS, event)) {
    errors.push('event must be one of: started, progress, blocked, completed');
  }

  if (!Number.isInteger(input.progress) || input.progress < 0 || input.progress > 100) {
    errors.push('progress must be an integer from 0 through 100');
  }

  if (!task) errors.push('task is required');
  if (event === 'completed' && input.progress !== 100) {
    errors.push('completed requires progress = 100');
  }
  if (!secret) errors.push('RAIOC_PROGRESS_SECRET is not configured');

  return { valid: errors.length === 0, errors };
}

export function buildProgressPayload(input) {
  return {
    mission: input.mission.trim(),
    agent: input.agent.trim(),
    progress: input.progress,
    status: EVENT_STATUS[input.event.trim()],
    current_task: input.task.trim(),
  };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function reportProgress(input, options = {}) {
  const secret = options.secret ?? process.env.RAIOC_PROGRESS_SECRET ?? '';
  const url = options.url ?? process.env.RAIOC_PROGRESS_URL ?? DEFAULT_PROGRESS_URL;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;
  const maxAttempts = options.maxAttempts ?? 3;
  const retryDelaysMs = options.retryDelaysMs ?? [1000, 2000];

  const validation = validateProgressInput(input, secret);
  if (!validation.valid) {
    return {
      ok: false,
      non_blocking: true,
      reason: 'validation_failed',
      errors: validation.errors,
      attempts: 0,
    };
  }

  const payload = buildProgressPayload(input);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-raioc-signature': secret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`bridge_http_${response.status}`);
      }

      return {
        ok: true,
        mission: payload.mission,
        event: input.event.trim(),
        progress: payload.progress,
        bridge_status: response.status,
        attempts: attempt,
      };
    } catch {
      if (attempt < maxAttempts) {
        const delay = retryDelaysMs[attempt - 1] ?? retryDelaysMs.at(-1) ?? 0;
        await sleepImpl(delay);
      }
    }
  }

  return {
    ok: false,
    non_blocking: true,
    reason: 'progress_bridge_unavailable',
    mission: payload.mission,
    event: input.event.trim(),
    progress: payload.progress,
    attempts: maxAttempts,
  };
}

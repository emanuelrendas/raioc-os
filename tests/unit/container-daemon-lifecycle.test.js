/**
 * RAIOC OS - Unit Test Suite: Containerization & Persistent Daemon Lifecycle
 * 
 * Validates:
 * 1. Dockerfile and docker-compose.yml configuration integrity
 * 2. `isServerlessRuntime()` decoupling override under persistent daemon runtime mode
 * 3. Autonomous Always-On daemon initialization (JARVIS, SENTINEL, Distributed Scheduler)
 * 4. Graceful shutdown sequence and signal trapping cleanup
 * 5. NPM scripts definition for container and daemon modes
 */

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  startDaemon,
  stopDaemon,
  getDaemonStatus,
} from '../../src/workers/daemon-entrypoint.js';
import { isServerlessRuntime } from '../../src/config/env.js';
import { jarvis } from '../../src/agents/specialists/jarvis-orchestrator.js';
import { sentinelMeshMonitor } from '../../src/core/sentinel-mesh-monitor.js';
import { distributedScheduler } from '../../src/core/distributed-scheduler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('🐳 Containerization & Persistent Daemon Lifecycle Suite', () => {

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    await stopDaemon();
    process.env = { ...originalEnv };
  });

  test('1. Dockerfile & docker-compose.yml Configuration Integrity', async () => {
    const dockerfilePath = join(__dirname, '../../Dockerfile');
    const composePath = join(__dirname, '../../docker-compose.yml');
    const pkgPath = join(__dirname, '../../package.json');

    // 1a. Dockerfile verification
    assert.ok(existsSync(dockerfilePath), 'Dockerfile must exist in root directory');
    const dockerfile = readFileSync(dockerfilePath, 'utf-8');
    assert.match(dockerfile, /FROM node:20-alpine AS dependencies/i, 'Must use node:20-alpine multi-stage build');
    assert.match(dockerfile, /USER node/i, 'Must enforce non-root execution');
    assert.match(dockerfile, /dumb-init/i, 'Must include dumb-init for graceful signal handling');
    assert.match(dockerfile, /HEALTHCHECK/i, 'Must configure native healthcheck');
    assert.match(dockerfile, /daemon-entrypoint\.js/i, 'Must target daemon entrypoint');

    // 1b. docker-compose.yml verification
    assert.ok(existsSync(composePath), 'docker-compose.yml must exist in root directory');
    const compose = readFileSync(composePath, 'utf-8');
    assert.match(compose, /RUNTIME_MODE=persistent_daemon/i, 'Must configure persistent_daemon runtime mode');
    assert.match(compose, /restart:\s*unless-stopped/i, 'Must have unless-stopped restart policy');
    assert.match(compose, /cpus:\s*['"]?2\.0/i, 'Must specify CPU limits');
    assert.match(compose, /memory:\s*2048M/i, 'Must specify memory limits');
    assert.match(compose, /max-size:\s*['"]?10m/i, 'Must configure 10MB log rotation');

    // 1c. package.json scripts verification
    assert.ok(existsSync(pkgPath), 'package.json must exist');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    assert.strictEqual(pkg.scripts['start:daemon'], 'node src/workers/daemon-entrypoint.js');
    assert.strictEqual(pkg.scripts['start:container'], 'node src/server.js');
  });

  test('2. isServerlessRuntime() Decoupling Override in Persistent Mode', async () => {
    // 2a. Serverless simulation
    process.env.VERCEL = '1';
    process.env.RUNTIME_MODE = undefined;
    process.env.DAEMON_MODE = undefined;
    assert.strictEqual(isServerlessRuntime(), true, 'Should detect serverless when VERCEL=1 and not in daemon mode');

    // 2b. Persistent Daemon override
    process.env.RUNTIME_MODE = 'persistent_daemon';
    assert.strictEqual(isServerlessRuntime(), false, 'Must override serverless when RUNTIME_MODE=persistent_daemon');

    // 2c. Container runtime mode override
    process.env.RUNTIME_MODE = 'container';
    assert.strictEqual(isServerlessRuntime(), false, 'Must override serverless when RUNTIME_MODE=container');

    // 2d. DAEMON_MODE flag override
    process.env.RUNTIME_MODE = undefined;
    process.env.DAEMON_MODE = 'true';
    assert.strictEqual(isServerlessRuntime(), false, 'Must override serverless when DAEMON_MODE=true');
  });

  test('3. Persistent Daemon Boot & Always-On Autonomous Loops Activation', async () => {
    const status = await startDaemon({
      startHttp: false,
      jarvisIntervalMs: 60000,
      sentinelIntervalMs: 60000,
    });

    assert.strictEqual(status.isRunning, true);
    assert.strictEqual(status.runtimeMode, 'persistent_daemon');
    assert.strictEqual(status.isServerless, false);
    assert.ok(status.startedAt);

    // Verify individual service loops are active
    assert.ok(status.activeServices.includes('JARVIS_EXECUTIVE_LOOP'), 'JARVIS loop must be active');
    assert.ok(status.activeServices.includes('SENTINEL_MESH_MONITOR'), 'Sentinel prober must be active');
    assert.ok(status.activeServices.includes('DISTRIBUTED_SCHEDULER'), 'Scheduler must be active');

    assert.strictEqual(jarvis.isLoopRunning, true, 'jarvis.isLoopRunning must be true');
    assert.strictEqual(sentinelMeshMonitor.isProbingActive, true, 'sentinel.isProbingActive must be true');
    assert.strictEqual(distributedScheduler.isRunning, true, 'distributedScheduler.isRunning must be true');
  });

  test('4. Graceful Shutdown & Resource Cleanup Sequence', async () => {
    // Start daemon
    await startDaemon({
      startHttp: false,
      jarvisIntervalMs: 60000,
      sentinelIntervalMs: 60000,
    });

    // Execute graceful stop
    const stopStatus = await stopDaemon();

    assert.strictEqual(stopStatus.isRunning, false);
    assert.ok(stopStatus.stoppedAt);
    assert.strictEqual(stopStatus.activeServices.length, 0);

    // Verify all loops and timers were completely drained
    assert.strictEqual(jarvis.isLoopRunning, false, 'JARVIS loop must be stopped');
    assert.strictEqual(sentinelMeshMonitor.isProbingActive, false, 'Sentinel prober must be stopped');
    assert.strictEqual(distributedScheduler.isRunning, false, 'Distributed scheduler must be stopped');

    // Repeated stop should be a clean no-op
    const noopStop = await stopDaemon();
    assert.strictEqual(noopStop.isRunning, false);
  });

});

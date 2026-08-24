import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { EmailAdapter } from '../src/adapters/email-adapter.js';
import { config } from '../src/config/env.js';
import { queueEngine } from '../src/engines/queue-engine.js';

describe('Namecheap PrivateEmail & Nodemailer SMTP Adapter Tests', () => {
  test('1. Reads all standard SMTP environment variables and config defaults', () => {
    const adapter = new EmailAdapter({
      host: 'mail.privateemail.com',
      port: 465,
      secure: true,
      user: 'intelligence@emanuelrendas.com',
      password: 'test_password_123',
      from: 'Emanuel Rendas Private Advisory <intelligence@emanuelrendas.com>',
    });

    assert.strictEqual(adapter.host, 'mail.privateemail.com');
    assert.strictEqual(adapter.port, 465);
    assert.strictEqual(adapter.secure, true);
    assert.strictEqual(adapter.user, 'intelligence@emanuelrendas.com');
    assert.strictEqual(adapter.password, 'test_password_123');
    assert.strictEqual(adapter.from, 'Emanuel Rendas Private Advisory <intelligence@emanuelrendas.com>');
  });

  test('2. Formats and prepares Executive Brief email for dispatch via SMTP', async () => {
    const adapter = new EmailAdapter({
      host: 'mail.privateemail.com',
      port: 465,
      secure: true,
      from: 'intelligence@emanuelrendas.com',
    });

    const task = {
      id: 'task_email_001',
      recipient: 'investor@familyoffice.ae',
      payload: {
        subject: 'RAIOC Executive Intelligence Brief — Palm Jumeirah Asset',
        body: 'Executive Summary:\n\nInvestor: Al-Mansoor Family Office\nDIRA Rating: Tier-1 Explorer\nRIIS Score: 88/100',
      },
    };

    const res = await adapter.dispatch(task);
    assert.ok(['queued_for_mailer', 'simulated', 'sent_smtp', 'sent_native_smtp'].includes(res.status));
    assert.strictEqual(res.recipient, 'investor@familyoffice.ae');
    assert.strictEqual(res.host, 'mail.privateemail.com');
    assert.strictEqual(res.port, 465);
  });

  test('3. Rejects dispatch when recipient is missing', async () => {
    const adapter = new EmailAdapter();
    await assert.rejects(
      async () => {
        await adapter.dispatch({ payload: { subject: 'Test Subject', body: 'Test Content' } });
      },
      /Missing recipient email/
    );
  });

  test('4. Seamless integration with Queue Engine and retry mechanism', async () => {
    const adapter = new EmailAdapter();
    queueEngine.registerAdapter('email', adapter);

    const mockDb = {
      tasks: [],
      async updateDispatchTask(id, data) {
        this.tasks.push({ id, ...data });
        return { success: true };
      },
    };

    const task = {
      id: 'dispatch_email_99',
      type: 'email',
      recipient: 'director@investcorp.ae',
      payload: {
        subject: 'Bespoke Advisory Brief',
        body: 'Advisory brief content',
      },
    };

    const result = await queueEngine.processTask(task, mockDb);
    assert.strictEqual(result.success, true);
    assert.strictEqual(mockDb.tasks[0].status, 'processing');
    assert.strictEqual(mockDb.tasks[1].status, 'dispatched');
  });

  test('5. Health check probe correctly identifies missing vs configured credentials', async () => {
    const unconfiguredAdapter = new EmailAdapter({ user: '', password: '' });
    const unconfiguredHealth = await unconfiguredAdapter.checkHealth();
    assert.strictEqual(unconfiguredHealth.status, 'BLOCKED');
    assert.strictEqual(unconfiguredHealth.authenticated, false);

    const configuredAdapter = new EmailAdapter({
      user: 'intelligence@emanuelrendas.com',
      password: 'active_password',
      host: 'mail.privateemail.com',
      port: 465,
    });
    const configuredHealth = await configuredAdapter.checkHealth();
    assert.ok(['ACTIVE', 'AUTH_FAILED'].includes(configuredHealth.status));
    assert.strictEqual(configuredHealth.host, 'mail.privateemail.com');
  });
});

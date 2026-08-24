import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GmailClient } from '../src/integrations/google/gmail-client.js';
import { GoogleCalendarClient } from '../src/integrations/google/calendar-client.js';
import { GmailAdapter } from '../src/adapters/gmail-adapter.js';
import { CalendarAdapter } from '../src/adapters/calendar-adapter.js';

describe('Google Integrations Tests', () => {
  const gmail = new GmailClient({
    senderEmail: 'intelligence@emanuelrendas.com',
    senderName: 'Emanuel Rendas Private Advisory',
  });
  const calendar = new GoogleCalendarClient();

  test('compiles RFC 2822 MIME message with Base64 encoding', () => {
    const mime = gmail.buildMimeMessage({
      to: 'client@example.com',
      subject: 'RAIOC Executive Intelligence Brief',
      body: 'Your advisory brief has been computed.',
      isHtml: false,
    });

    assert.ok(mime.includes('From: Emanuel Rendas Private Advisory <intelligence@emanuelrendas.com>'));
    assert.ok(mime.includes('To: client@example.com'));
    assert.ok(mime.includes('MIME-Version: 1.0'));
    assert.ok(mime.includes('Content-Type: text/plain'));

    const rawBase64Url = gmail.encodeRawMessage(mime);
    assert.strictEqual(typeof rawBase64Url, 'string');
    assert.ok(!rawBase64Url.includes('+'));
    assert.ok(!rawBase64Url.includes('/'));
  });

  test('GmailClient and GmailAdapter send email with message metadata', async () => {
    const sendRes = await gmail.sendEmail({
      to: 'investor@familyoffice.ae',
      subject: 'Prime Dubai Portfolio Analysis',
      body: 'Executive brief summary details...',
    });

    assert.ok(sendRes.status === 'compiled_for_gmail_api' || sendRes.status === 'sent_live' || sendRes.status === 'simulated');
    assert.strictEqual(sendRes.to, 'investor@familyoffice.ae');

    // Test Queue Adapter
    const adapter = new GmailAdapter(gmail);
    const adaptRes = await adapter.dispatch({
      recipient: 'investor@familyoffice.ae',
      payload: { subject: 'Advisory Alert', body: 'Test content' },
    });
    assert.ok(adaptRes);
  });

  test('GoogleCalendarClient creates advisory meeting and booking link', async () => {
    const eventRes = await calendar.createEvent({
      attendeeEmail: 'director@investcorp.com',
      summary: 'Private UAE Real Estate Consultation',
      durationMinutes: 45,
    });

    assert.ok(eventRes.status === 'scheduled' || eventRes.status === 'simulated');
    assert.strictEqual(eventRes.attendeeEmail, 'director@investcorp.com');
    assert.ok(eventRes.bookingLink.includes('calendar.google.com'));
    assert.ok(eventRes.meetLink);

    // Test Calendar Queue Adapter
    const adapter = new CalendarAdapter(calendar);
    const adaptRes = await adapter.dispatch({
      recipient: 'director@investcorp.com',
      payload: { summary: 'Consultation', durationMinutes: 60 },
    });
    assert.ok(adaptRes);
  });
});

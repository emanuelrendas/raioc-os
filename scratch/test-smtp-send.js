/**
 * RAIOC OS - Diagnostic SMTP Test Script
 * Sends a test email to the specified recipient using the configured Namecheap PrivateEmail SMTP settings.
 * 
 * Usage:
 *   node scratch/test-smtp-send.js [recipient_email]
 */

import { emailAdapter } from '../src/adapters/email-adapter.js';

const recipient = process.argv[2] || 'privateadvisory@emanuelrendas.com';

console.log('====================================================');
console.log('  RAIOC — SMTP DIAGNOSTIC & VERIFICATION TOOL');
console.log('====================================================');
console.log(`• Host:      ${emailAdapter.host}`);
console.log(`• Port:      ${emailAdapter.port}`);
console.log(`• Secure:    ${emailAdapter.secure}`);
console.log(`• From:      ${emailAdapter.from}`);
console.log(`• User:      ${emailAdapter.user ? emailAdapter.user : '[NOT SET / EMPTY]'}`);
console.log(`• Password:  ${emailAdapter.password ? '********' : '[NOT SET / EMPTY]'}`);
console.log(`• Recipient: ${recipient}`);
console.log('----------------------------------------------------');

async function run() {
  try {
    console.log('Initiating test email dispatch...');
    const result = await emailAdapter.dispatch({
      id: `diag_cli_${Date.now()}`,
      recipient,
      payload: {
        subject: 'RAIOC — SMTP Diagnostic & Operational Verification',
        body: `RAIOC Autonomous Operating System — Diagnostic Email\n\nRecipient: ${recipient}\nTransport: Namecheap PrivateEmail (SMTP / Nodemailer)\nHost: ${emailAdapter.host}:${emailAdapter.port} (SSL: ${emailAdapter.secure})\nFrom: ${emailAdapter.from}\nTimestamp: ${new Date().toISOString()}\n\nStatus: VERIFIED_OPERATIONAL`,
      },
    });

    console.log('✅ Dispatch result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('❌ Dispatch failed:', err.message);
  }
}

run();

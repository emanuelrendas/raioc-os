/**
 * Live Verification Script: Executive Brief Viewer at /brief/:id
 * Fetches https://www.emanuelrendas.com/brief/brief_1787673069620_h5vyz
 * Asserts that the response contains "Executive Intelligence Brief" / "EXECUTIVE BRIEF" / "Dr. Tariq Al-Mansoor"
 * and does NOT contain "Run the arithmetic first" (homepage fallback text).
 */

import assert from 'node:assert/strict';

async function verifyLiveBrief() {
  const targetUrl = 'https://www.emanuelrendas.com/brief/brief_1787673069620_h5vyz';
  console.log(`🔍 Testing live URL: ${targetUrl}...`);

  try {
    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'RAIOC-OS-Verification/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    console.log(`HTTP Status: ${res.status}`);
    const html = await res.text();
    console.log(`Received ${html.length} bytes.`);

    const isBriefViewer = 
      html.includes('Executive Intelligence Brief') || 
      html.includes('EXECUTIVE BRIEF') || 
      html.includes('Dr. Tariq Al-Mansoor') ||
      html.includes('Cabinet Resolution No. 65 of 2022');

    const isHomepageFallback = html.includes('Run the arithmetic first');

    console.log(`Contains Brief Content: ${isBriefViewer}`);
    console.log(`Contains Homepage Fallback: ${isHomepageFallback}`);

    assert.strictEqual(res.status, 200, 'Live endpoint must return HTTP 200');
    assert.strictEqual(isHomepageFallback, false, 'Must NOT contain homepage fallback ("Run the arithmetic first")');
    assert.strictEqual(isBriefViewer, true, 'Must contain Executive Brief viewer content');

    console.log('✅ LIVE VERIFICATION PASSED: /brief/:id renders Executive Brief Public Viewer correctly!');
  } catch (err) {
    console.error('❌ Live verification check error:', err.message);
    throw err;
  }
}

verifyLiveBrief();

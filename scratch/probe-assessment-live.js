/**
 * Probes POST /api/assessment with full required payload on https://www.emanuelrendas.com
 */

async function probeAssessment() {
  const payload = {
    name: 'Emanuel Rendas Production Test',
    email: 'test@emanuelrendas.com',
    phone: '+971501234567',
    answers: {
      budget: '10M+',
      timeline: 'immediate',
      ai_maturity: 'in_production',
    },
  };

  try {
    const t0 = Date.now();
    const res = await fetch('https://www.emanuelrendas.com/api/assessment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(`POST /api/assessment response (${Date.now() - t0}ms):`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error probing assessment:', err.message);
  }
}

probeAssessment();

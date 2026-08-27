import { NextResponse } from 'next/server';
import { executeDeterministicOpalCalculation } from '@/src/services/corridor-benchmark-service.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/opal/roi
 * ATLAS & LEX Opal ROI Engine: Calculates Cap Rate, 5-Year & 7-Year IRR, Pro-Forma cash flows,
 * and Law No. 8 of 2007 Escrow compliance to synthesize the Institutional Memorandum.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const calculation = executeDeterministicOpalCalculation(body);
    return NextResponse.json(calculation, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'OPAL_ROI_ENGINE_ERROR',
        message: error.message || 'Error executing Opal ROI mathematical engine',
      },
      { status: 500 }
    );
  }
}

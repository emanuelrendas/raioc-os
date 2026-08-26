import { NextResponse } from 'next/server';
import { argosMarketIntelligence } from '@/src/core/argos-market-intelligence.js';
import { logger } from '@/src/logging/audit-logger.js';
import crypto from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const rawHeaders: Record<string, string> = {};
    request.headers.forEach((val, key) => {
      rawHeaders[key] = val;
    });

    const correlationId = rawHeaders['x-correlation-id'] || `corr_dld_${Date.now()}`;
    const traceparent = rawHeaders['traceparent'] || `00-${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-01`;

    const body = await request.json().catch(() => ({}));
    const rawTransactions = body.transactions || body.data || (body.priceAed || body.price || body.corridor ? [body] : []);

    if (!rawTransactions || rawTransactions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_TRANSACTIONS',
          message: 'Please provide a transaction object or an array of transactions in the request body',
        },
        { status: 400 }
      );
    }

    const batchResult = await argosMarketIntelligence.processBatch(rawTransactions, {
      correlationId,
      traceparent,
    });

    const durationMs = Date.now() - startTime;
    logger.info('DLD_SYNC_API', `Ingested ${batchResult.batchSize} DLD transactions (${batchResult.whaleCount} Whales) in ${durationMs}ms`);

    return NextResponse.json(
      {
        success: true,
        agent: 'ARGOS (Market Intelligence & DLD Ingestion)',
        ...batchResult,
        durationMs,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'x-whale-count': String(batchResult.whaleCount),
          'x-correlation-id': correlationId,
        },
      }
    );
  } catch (error: any) {
    logger.error('DLD_SYNC_API', 'Failed to process DLD transaction sync', { error: error.message });
    return NextResponse.json(
      {
        success: false,
        error: 'DLD_SYNC_ERROR',
        message: error.message || 'Failed to process DLD transaction sync',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const corridor = searchParams.get('corridor');

    if (corridor) {
      const stats = argosMarketIntelligence.getCorridorStats(corridor);
      return NextResponse.json({ success: true, stats, timestamp: new Date().toISOString() });
    }

    const whaleAlerts = argosMarketIntelligence.getWhaleAlerts(20);
    const recentTransactions = argosMarketIntelligence.getRecentTransactions(50);

    return NextResponse.json({
      success: true,
      whaleAlertCount: whaleAlerts.length,
      whaleAlerts,
      recentTransactions,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'DLD_FETCH_ERROR',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

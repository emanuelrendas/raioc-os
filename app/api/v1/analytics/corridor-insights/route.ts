import { NextResponse } from 'next/server';
import { corridorProjectionEngine } from '@/src/api/analytics/corridor-projections.js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const corridor = searchParams.get('corridor') || searchParams.get('community') || 'all';

    const insights = corridorProjectionEngine.getCorridorInsights(corridor);

    return NextResponse.json(insights, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'CORRIDOR_INSIGHTS_ERROR',
        message: error.message || 'Failed to compute corridor analytical projections',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const corridor = body.corridor || body.community || 'all';

    const insights = corridorProjectionEngine.getCorridorInsights(corridor);

    return NextResponse.json(insights, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'CORRIDOR_PROJECTION_ERROR',
        message: error.message || 'Failed to process corridor projection request',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/utils/admin-auth';
import { MetricsService } from '@/lib/metrics-service';
import { POST_CONTEST_STATUS } from '@/lib/constants-status';

export async function POST(request: NextRequest) {
  try {
    const { isAdmin } = await verifyAdminAccess();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const { contestId, batchSize } = await request.json();
    if (!contestId) {
      return NextResponse.json({ error: 'contestId is required' }, { status: 400 });
    }
    const result = await MetricsService.syncContestViewsToCreatorProfiles(contestId);
    return NextResponse.json({ success: true, views_sync: result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}



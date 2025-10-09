import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { MetricsService } from '@/lib/metrics-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contestId } = await request.json();
    if (!contestId) {
      return NextResponse.json({ error: 'contestId is required' }, { status: 400 });
    }

    // Note: Participation tracking is now automatic via submissions table
    // This endpoint is kept for backward compatibility but is essentially a no-op
    // Participation is counted dynamically: COUNT(DISTINCT contest_id) FROM submissions
    await MetricsService.ensureCreatorParticipation({ creatorId: user.id, contestId });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}



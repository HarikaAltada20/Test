import { NextResponse } from 'next/server';
import { processQueuedPayouts } from '@/lib/payout-processor';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await processQueuedPayouts(10);
  if (results.length === 0) return NextResponse.json({ message: 'No queued jobs' });
  return NextResponse.json({ processed: results.length, results });
}



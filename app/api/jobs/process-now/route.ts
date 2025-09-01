import { NextResponse } from 'next/server';
import { verifyAdminAccess } from '@/utils/admin-auth';
import { processQueuedPayouts } from '@/lib/payout-processor';

export async function POST() {
  const { isAdmin } = await verifyAdminAccess();
  if (!isAdmin) return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const results = await processQueuedPayouts(25);
  return NextResponse.json({ processed: results.length, results });
}



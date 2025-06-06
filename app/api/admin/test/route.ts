import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { verifyAdminAccess } from '@/utils/admin-auth';

export async function GET() {
  try {
    // Verify admin access using the utility function
    const { isAdmin, error, user } = await verifyAdminAccess();

    if (!isAdmin) {
      const statusCode = error === 'Authentication required' ? 401 : 
                        error === 'Admin access required' ? 403 : 500;
      return NextResponse.json({ error }, { status: statusCode });
    }

    const supabase = await createClient();

    // Return admin status and basic platform stats
    const [
      { data: contestsCount },
      { data: usersCount },
      { data: submissionsCount }
    ] = await Promise.all([
      supabase.from('contests').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('submissions').select('id', { count: 'exact', head: true })
    ]);

    return NextResponse.json({
      message: 'Admin access verified',
      user: user,
      platform_stats: {
        total_contests: contestsCount || 0,
        total_users: usersCount || 0,
        total_submissions: submissionsCount || 0
      }
    });

  } catch (error) {
    console.error('Admin test endpoint error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
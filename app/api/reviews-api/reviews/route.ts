import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const userTypeParam = searchParams.get('userType');
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const sortByParam = searchParams.get('sortBy') || 'created_at';
    const sortOrderParam = searchParams.get('sortOrder') || 'desc';

    const supabase = await createClient();

    // Default status to approved
    let status = 'approved';
    let userType: 'creator' | 'advertiser' | null = null;

    // If a different status is requested, check if the user is an admin
    if (statusParam && statusParam !== 'approved') {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in.' },
          { status: 401 }
        );
      }

      // Check if the user is an admin
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('user_type')
        .eq('id', user.id)
        .single();

      if (userError || !userData || userData.user_type !== 'admin') {
        // If not an admin, we can either return Forbidden or just force 'approved' status
        // Given the goal is to prevent leakage, let's return Forbidden for clarity
        return NextResponse.json(
          { error: 'Forbidden. Only administrators can view non-approved reviews.' },
          { status: 403 }
        );
      }

      status = statusParam;
    }

    if (userTypeParam === 'creator' || userTypeParam === 'advertiser') {
      userType = userTypeParam;
    }

    const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam || '10', 10) || 10));
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const allowedSortBy = new Set(['created_at', 'rating']);
    const sortBy = allowedSortBy.has(sortByParam) ? sortByParam : 'created_at';
    const sortOrder = sortOrderParam === 'asc' ? 'asc' : 'desc';

    let query = supabase
      .from('user_reviews')
      .select(`
        *,
        users!user_reviews_user_id_fkey (
          user_type,
          full_name,
          username,
          profile_picture_url
        )
      `, { count: 'exact' })
      .eq('status', status);

    if (userType) {
      query = query.eq('user_type', userType);
    }

    query = query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range(from, to);

    const { data: reviews, error, count } = await query;


    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reviews: reviews || [],
      total: count || 0,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

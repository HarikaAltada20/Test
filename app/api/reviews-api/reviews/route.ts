import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const supabase = await createClient();

    let query = supabase
      .from('user_reviews')
      .select(`
        *,
        users!user_reviews_user_id_fkey (
          email,
          user_type,
          full_name,
          username,
          profile_picture_url
        )
      `)
      .eq('status', status || 'approved')
      .order('created_at', { ascending: false });

    const { data: reviews, error } = await query;

    if (error) {
      console.error('Error fetching reviews:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reviews' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reviews: reviews || [],
      total: reviews?.length || 0
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

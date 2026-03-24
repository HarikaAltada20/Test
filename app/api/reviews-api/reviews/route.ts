import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    const supabase = await createClient();

    // Default status to approved
    let status = 'approved';

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
      `)
      .eq('status', status)
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

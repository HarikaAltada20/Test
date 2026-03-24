import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

function toReviewImagePath(value: string): string | null {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
    return raw.replace(/^\/+/, '');
  }

  try {
    const parsed = new URL(raw);
    const marker = '/review-images/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) return null;
    const path = parsed.pathname.slice(markerIndex + marker.length);
    return decodeURIComponent(path).replace(/^\/+/, '');
  } catch {
    return null;
  }
}

const REVIEW_IMAGE_SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function resolveSignedReviewImagesForReviews(
  supabase: any,
  reviews: any[]
): Promise<any[]> {
  if (!reviews || reviews.length === 0) return [];

  const uniquePaths = Array.from(new Set(
    reviews.flatMap((review) =>
      (review.images || [])
        .map((image: string) => toReviewImagePath(image))
        .filter((path: string | null): path is string => Boolean(path))
    )
  ));

  if (uniquePaths.length === 0) return reviews;

  const { data, error } = await supabase.storage
    .from('review-images')
    .createSignedUrls(uniquePaths, REVIEW_IMAGE_SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    console.error('Error creating signed review image URLs:', error);
    return reviews;
  }

  const signedByPath = new Map<string, string>();
  data.forEach((item: { path: string; signedUrl: string | null }) => {
    if (item?.path && item?.signedUrl) {
      signedByPath.set(item.path, item.signedUrl);
    }
  });

  return reviews.map((review) => ({
    ...review,
    images: (review.images || []).map((image: string) => {
      const path = toReviewImagePath(image);
      return path ? signedByPath.get(path) || image : image;
    }),
  }));
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (userError || userData?.user_type !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get query parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10) || 10));
    const status = searchParams.get('status');
    const userType = searchParams.get('userType');
    const rating = searchParams.get('rating');
    const sortByParam = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const allowedSortBy = new Set(['created_at', 'rating', 'status', 'user_type']);
    const sortBy = allowedSortBy.has(sortByParam) ? sortByParam : 'created_at';

    const offset = (page - 1) * limit;

    // Build query
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
      `, { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    if (userType) {
      query = query.eq('user_type', userType);
    }
    if (rating) {
      query = query.eq('rating', parseInt(rating));
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: reviews, error, count } = await query;

    if (error) {
      console.error('Error fetching user reviews:', error);
      return NextResponse.json({ error: "Failed to fetch reviews" }, { status: 500 });
    }

    const reviewsWithSignedImages = await resolveSignedReviewImagesForReviews(
      supabase,
      reviews || []
    );

    return NextResponse.json({
      reviews: reviewsWithSignedImages,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verify user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();

    if (userError || userData?.user_type !== 'admin') {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { reviewId, status } = await request.json();

    if (!reviewId || !status || !['pending', 'approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    const { data: review, error } = await supabase
      .from('user_reviews')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error('Error updating review status:', error);
      return NextResponse.json({ error: "Failed to update review" }, { status: 500 });
    }

    return NextResponse.json({ review });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

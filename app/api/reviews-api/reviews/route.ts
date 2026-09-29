import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function toReviewImagePath(value: string): string | null {
  if (!value || typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;

  // Already stored as object path, e.g. "<user-id>/<filename>"
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

    const reviewsWithSignedImages = await resolveSignedReviewImagesForReviews(
      supabase,
      reviews || []
    );

    return NextResponse.json({
      reviews: reviewsWithSignedImages,
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

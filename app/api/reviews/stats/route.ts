import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Get rating statistics for approved reviews only
    const { data: reviews, error } = await supabase
      .from('user_reviews')
      .select('rating')
      .eq('status', 'approved'); // Only count approved reviews

    if (error) {
      console.error('Error fetching rating statistics:', error);
      return NextResponse.json({ error: "Failed to fetch rating statistics" }, { status: 500 });
    }

    // Calculate statistics
    const totalReviews = reviews?.length || 0;
    let totalRating = 0;
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    reviews?.forEach(review => {
      totalRating += review.rating;
      ratingCounts[review.rating as keyof typeof ratingCounts]++;
    });

    const averageRating = totalReviews > 0 ? totalRating / totalReviews : 0;

    // Calculate percentages for each rating
    const ratingPercentages = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    Object.keys(ratingCounts).forEach(rating => {
      const ratingKey = parseInt(rating) as keyof typeof ratingCounts;
      ratingPercentages[ratingKey] = totalReviews > 0 ? (ratingCounts[ratingKey] / totalReviews) * 100 : 0;
    });

    return NextResponse.json({
      averageRating: parseFloat(averageRating.toFixed(1)),
      totalReviews,
      ratingCounts,
      ratingPercentages
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

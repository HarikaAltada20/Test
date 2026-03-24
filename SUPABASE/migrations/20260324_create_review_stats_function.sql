CREATE OR REPLACE FUNCTION get_user_review_stats(include_all_statuses boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    stats_data record;
    total_reviews bigint;
BEGIN
    SELECT 
        COUNT(*) as total,
        AVG(rating) as average,
        COUNT(*) FILTER (WHERE rating = 1) as count_1,
        COUNT(*) FILTER (WHERE rating = 2) as count_2,
        COUNT(*) FILTER (WHERE rating = 3) as count_3,
        COUNT(*) FILTER (WHERE rating = 4) as count_4,
        COUNT(*) FILTER (WHERE rating = 5) as count_5,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count
    INTO stats_data
    FROM user_reviews
    WHERE (include_all_statuses OR status = 'approved');

    total_reviews := stats_data.total;

    RETURN jsonb_build_object(
        'averageRating', ROUND(COALESCE(stats_data.average, 0)::numeric, 1),
        'totalReviews', total_reviews,
        'ratingCounts', jsonb_build_object(
            '1', stats_data.count_1,
            '2', stats_data.count_2,
            '3', stats_data.count_3,
            '4', stats_data.count_4,
            '5', stats_data.count_5
        ),
        'ratingPercentages', jsonb_build_object(
            '1', CASE WHEN total_reviews > 0 THEN (stats_data.count_1 * 100.0 / total_reviews) ELSE 0 END,
            '2', CASE WHEN total_reviews > 0 THEN (stats_data.count_2 * 100.0 / total_reviews) ELSE 0 END,
            '3', CASE WHEN total_reviews > 0 THEN (stats_data.count_3 * 100.0 / total_reviews) ELSE 0 END,
            '4', CASE WHEN total_reviews > 0 THEN (stats_data.count_4 * 100.0 / total_reviews) ELSE 0 END,
            '5', CASE WHEN total_reviews > 0 THEN (stats_data.count_5 * 100.0 / total_reviews) ELSE 0 END
        ),
        'statusCounts', jsonb_build_object(
            'pending', stats_data.pending_count,
            'approved', stats_data.approved_count,
            'rejected', stats_data.rejected_count
        )
    );
END;
$$;


-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_user_review_stats(boolean) TO anon, authenticated;

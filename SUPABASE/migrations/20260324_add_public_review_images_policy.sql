-- Ensure public approved-review image access policy exists after user_reviews is created.
DROP POLICY IF EXISTS "Public can access review images" ON storage.objects;

CREATE POLICY "Public can access review images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'review-images' AND
    EXISTS (
      SELECT 1
      FROM public.user_reviews ur
      WHERE ur.status = 'approved'
      AND EXISTS (
        SELECT 1
        FROM unnest(ur.images) AS image_url
        WHERE image_url LIKE '%/review-images/' || storage.objects.name
      )
    )
  );

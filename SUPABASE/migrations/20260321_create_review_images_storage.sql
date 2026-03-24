-- Create storage bucket for review images
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'review-images', 
  'review-images', 
  false
) ON CONFLICT (id) DO UPDATE SET public = false;

-- Create storage policies for review-images bucket
-- Users can upload their own review images
DROP POLICY IF EXISTS "Users can upload own review images" ON storage.objects;
CREATE POLICY "Users can upload own review images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'review-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own review images
DROP POLICY IF EXISTS "Users can view own review images" ON storage.objects;
CREATE POLICY "Users can view own review images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'review-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own review images
DROP POLICY IF EXISTS "Users can update own review images" ON storage.objects;
CREATE POLICY "Users can update own review images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'review-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own review images
DROP POLICY IF EXISTS "Users can delete own review images" ON storage.objects;
CREATE POLICY "Users can delete own review images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'review-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public can access review images ONLY if they are part of an approved review
DROP POLICY IF EXISTS "Public can access review images" ON storage.objects;
DO $$
BEGIN
  -- Guard against migration order issues when user_reviews is not yet created.
  IF to_regclass('public.user_reviews') IS NOT NULL THEN
    EXECUTE $policy$
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
        )
    $policy$;
  END IF;
END
$$;

-- Admins can manage all review images
DROP POLICY IF EXISTS "Admins can manage all review images" ON storage.objects;
CREATE POLICY "Admins can manage all review images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'review-images' AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  );



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
CREATE POLICY "Public can access review images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'review-images' AND
    EXISTS (
      SELECT 1 FROM user_reviews
      WHERE status = 'approved'
      AND ARRAY_TO_STRING(images, ',') LIKE '%' || name || '%'
    )
  );

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



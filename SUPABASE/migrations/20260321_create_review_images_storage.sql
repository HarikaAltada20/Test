-- Create storage bucket for review images
INSERT INTO storage.buckets (id, name, public)
VALUES (
  'review-images', 
  'review-images', 
  true
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies for review-images bucket
-- Users can upload their own review images
CREATE POLICY "Users can upload own review images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'review-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own review images
CREATE POLICY "Users can view own review images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'review-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own review images
CREATE POLICY "Users can update own review images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'review-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own review images
CREATE POLICY "Users can delete own review images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'review-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public can access all review images (since they are part of public reviews)
CREATE POLICY "Public can access review images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'review-images'
  );

-- Admins can manage all review images
CREATE POLICY "Admins can manage all review images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'review-images' AND
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  );

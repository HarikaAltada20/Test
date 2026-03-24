-- Add policy to allow public access to approved reviews
-- This will allow anyone (including non-authenticated users) to view approved reviews

CREATE POLICY "Public can view approved reviews" ON user_reviews
  FOR SELECT USING (status = 'approved');

-- Create user_reviews table
CREATE TABLE IF NOT EXISTS user_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_type TEXT NOT NULL CHECK (user_type IN ('advertiser', 'creator')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  experience TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  video_links TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_reviews_user_id ON user_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reviews_user_type ON user_reviews(user_type);
CREATE INDEX IF NOT EXISTS idx_user_reviews_rating ON user_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_user_reviews_status ON user_reviews(status);
CREATE INDEX IF NOT EXISTS idx_user_reviews_created_at ON user_reviews(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE user_reviews ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own reviews
CREATE POLICY "Users can view own reviews" ON user_reviews
  FOR SELECT USING (auth.uid() = (SELECT id FROM public.users WHERE id = user_id));

-- Users can insert their own reviews
CREATE POLICY "Users can insert own reviews" ON user_reviews
  FOR INSERT WITH CHECK (auth.uid() = (SELECT id FROM public.users WHERE id = user_id));

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews" ON user_reviews
  FOR UPDATE USING (auth.uid() = (SELECT id FROM public.users WHERE id = user_id));

-- Admins can view all reviews
CREATE POLICY "Admins can view all reviews" ON user_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  );

-- Admins can update all reviews
CREATE POLICY "Admins can update all reviews" ON user_reviews
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_type = 'admin'
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_reviews_updated_at
  BEFORE UPDATE ON user_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

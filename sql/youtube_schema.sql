-- Create table for storing YouTube account connections
CREATE TABLE creator_youtube_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT,
  channel_title TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE creator_youtube_accounts ENABLE ROW LEVEL SECURITY;

-- Only allow users to see their own YouTube connections
CREATE POLICY "Users can view own YouTube accounts" 
ON creator_youtube_accounts FOR SELECT 
USING (auth.uid() = creator_id);

-- Only allow users to update their own YouTube connections
CREATE POLICY "Users can update own YouTube accounts" 
ON creator_youtube_accounts FOR UPDATE 
USING (auth.uid() = creator_id);

-- Only allow users to delete their own YouTube connections
CREATE POLICY "Users can delete own YouTube accounts" 
ON creator_youtube_accounts FOR DELETE 
USING (auth.uid() = creator_id);

-- Add columns for YouTube video data in submissions table
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS video_id TEXT,
ADD COLUMN IF NOT EXISTS video_title TEXT,
ADD COLUMN IF NOT EXISTS video_thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS last_metrics_update TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS comment_count INTEGER DEFAULT 0; 
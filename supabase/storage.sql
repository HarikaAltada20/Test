-- Update contest-assets bucket configuration to set file size limit to 20MB
UPDATE storage.buckets
SET file_size_limit = 20971520  -- 20MB in bytes
WHERE name = 'contest-assets';

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit)
SELECT 'contest-assets', 'contest-assets', true, 20971520
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE name = 'contest-assets'); 
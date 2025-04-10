-- Storage policies for contest-assets bucket
-- This fixes the 403 Unauthorized error: "new row violates row-level security policy"

-- Enable RLS on the storage.objects table (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'contest-assets');

-- Allow users to update their own files
CREATE POLICY "Allow user updates" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'contest-assets' AND owner = auth.uid());

-- Allow users to delete their own files
CREATE POLICY "Allow user deletes" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'contest-assets' AND owner = auth.uid());

-- Allow public reading of files
CREATE POLICY "Allow public reading" 
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'contest-assets');

-- Allow bucket access policy
CREATE POLICY "Allow bucket access"
ON storage.buckets FOR SELECT
TO public
USING (name = 'contest-assets'); 
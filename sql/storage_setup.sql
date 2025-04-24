-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can read contest assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload contest assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own contest assets" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own contest assets" ON storage.objects;

-- Set up storage policies for contest-assets bucket
-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read contest assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'contest-assets');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload contest assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contest-assets');

-- Allow users to update their own files
CREATE POLICY "Users can update their own contest assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'contest-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'contest-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own contest assets"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contest-assets' AND (storage.foldername(name))[1] = auth.uid()::text); 
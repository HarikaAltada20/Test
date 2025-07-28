-- Apply RLS policy to allow advertisers to update submissions for their own contests
-- Run this script in your Supabase SQL editor

-- Add RLS policy to allow advertisers to update submissions for their own contests
CREATE POLICY "Advertisers can update submissions for their own contests" ON public.submissions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contests 
    WHERE contests.id = submissions.contest_id 
    AND contests.advertiser_id = auth.uid()
  )
);

-- Also allow advertisers to view submissions for their own contests
CREATE POLICY "Advertisers can view submissions for their own contests" ON public.submissions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.contests 
    WHERE contests.id = submissions.contest_id 
    AND contests.advertiser_id = auth.uid()
  )
);

-- Verify the policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'submissions' 
AND policyname LIKE '%advertiser%'; 
-- Add RLS policy to allow advertisers to update submissions for their own contests
-- This policy allows advertisers to update submission status for contests they own

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
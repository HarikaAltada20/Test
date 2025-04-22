-- Drop the view if it exists
DROP VIEW IF EXISTS public.contests_with_status;

-- Create the view
CREATE OR REPLACE VIEW public.contests_with_status AS
SELECT 
    c.*,
    CASE 
        WHEN c.is_draft = true THEN 'draft'
        WHEN c.start_date > CURRENT_TIMESTAMP THEN 'upcoming'
        WHEN c.end_date < CURRENT_TIMESTAMP THEN 'ended'
        ELSE 'active'
    END as status
FROM 
    public.contests c;

-- Grant permissions
GRANT SELECT ON public.contests_with_status TO service_role;
GRANT SELECT ON public.contests_with_status TO authenticated;
GRANT SELECT ON public.contests_with_status TO anon; 
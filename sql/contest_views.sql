-- Drop existing view if it exists
DROP VIEW IF EXISTS contests_with_status;

-- Create a view that calculates contest status based on start_date and end_date
CREATE OR REPLACE VIEW contests_with_status AS
SELECT 
  c.*,
  CASE
    WHEN c.is_draft THEN 'draft'
    WHEN c.start_date IS NULL OR c.end_date IS NULL THEN 'incomplete'
    WHEN c.start_date > NOW() THEN 'upcoming'
    WHEN c.start_date <= NOW() AND c.end_date > NOW() THEN 'live'
    WHEN c.end_date <= NOW() THEN 'completed'
    ELSE 'unknown'
  END AS status
FROM contests c;

-- Grant access to the view
GRANT SELECT ON contests_with_status TO service_role;
GRANT SELECT ON contests_with_status TO authenticated;
GRANT SELECT ON contests_with_status TO anon; 
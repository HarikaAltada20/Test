-- Populate brief_html field for existing contests
-- This migration ensures that existing contests with HTML content in the brief field
-- also have the content in the brief_html field for proper display

UPDATE contests 
SET brief_html = brief 
WHERE brief_html IS NULL 
  AND brief IS NOT NULL 
  AND brief != '';

-- Add a comment explaining the purpose
COMMENT ON COLUMN contests.brief_html IS 'HTML content for display purposes, populated from brief field for existing contests'; 
-- Add rich text fields to contests table
ALTER TABLE "public"."contests" 
ADD COLUMN "brief_html" text,
ADD COLUMN "brief_json" jsonb;

-- Create index on brief_html for better search performance
CREATE INDEX idx_contests_brief_html ON "public"."contests" USING gin(to_tsvector('english', brief_html));

-- Add a comment to explain the new columns
COMMENT ON COLUMN "public"."contests"."brief_html" IS 'Rich text brief content in HTML format for display';
COMMENT ON COLUMN "public"."contests"."brief_json" IS 'Rich text brief content in JSON format for editing'; 
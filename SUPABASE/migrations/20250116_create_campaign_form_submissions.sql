-- Create campaign_form_submissions table
-- This table stores submissions from the "Launch Campaign - Get 50% Off" Google Form
-- Separate from form_submissions which is used for survey forms

CREATE TABLE IF NOT EXISTS public.campaign_form_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    submitted_at timestamp with time zone,
    CONSTRAINT campaign_form_submissions_pkey PRIMARY KEY (id)
);

-- Note: Foreign key constraint is intentionally NOT added
-- This allows tracking submissions from users who may not have accounts yet
-- If you want to enforce email validation, you can add the constraint later:
-- ALTER TABLE ONLY public.campaign_form_submissions
--     ADD CONSTRAINT campaign_form_submissions_email_fkey 
--     FOREIGN KEY (email) REFERENCES public.users(email);

-- Add index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_campaign_form_submissions_email 
    ON public.campaign_form_submissions(email);

-- Add index for faster submitted_at queries
CREATE INDEX IF NOT EXISTS idx_campaign_form_submissions_submitted_at 
    ON public.campaign_form_submissions(submitted_at);

-- Add comments for documentation
COMMENT ON TABLE public.campaign_form_submissions IS 'Stores email submissions from the Launch Campaign Google Form (50% off offer)';
COMMENT ON COLUMN public.campaign_form_submissions.email IS 'Email address of the user who submitted the campaign form';
COMMENT ON COLUMN public.campaign_form_submissions.submitted_at IS 'Timestamp when the form was submitted (set when form is actually submitted)';
COMMENT ON COLUMN public.campaign_form_submissions.created_at IS 'Timestamp when the record was created (when button was clicked)';

-- Enable Row Level Security
ALTER TABLE public.campaign_form_submissions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to insert their own submissions
CREATE POLICY campaign_form_submissions_insert_own 
    ON public.campaign_form_submissions
    FOR INSERT
    WITH CHECK (true); -- Allow anyone to insert (for anonymous users)

-- Create policy to allow users to read their own submissions
CREATE POLICY campaign_form_submissions_select_own 
    ON public.campaign_form_submissions
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.users WHERE email = campaign_form_submissions.email
        )
    );

-- Grant necessary permissions
GRANT INSERT, SELECT ON public.campaign_form_submissions TO authenticated;
GRANT INSERT, SELECT ON public.campaign_form_submissions TO anon;


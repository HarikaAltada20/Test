
CREATE TYPE public.blog_post_status_enum AS ENUM (
    'draft',
    'published'
);


UPDATE public.blog_posts 
SET status = 'draft' 
WHERE status IS NULL OR status NOT IN ('draft', 'published');

-- Change the column type to use the enum
ALTER TABLE public.blog_posts 
ALTER COLUMN status TYPE public.blog_post_status_enum 
USING status::public.blog_post_status_enum;

-- Set default value
ALTER TABLE public.blog_posts 
ALTER COLUMN status SET DEFAULT 'draft'::public.blog_post_status_enum;

-- Add comment to document the enum
COMMENT ON TYPE public.blog_post_status_enum IS 'Status of blog posts: draft or published';


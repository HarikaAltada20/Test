CREATE INDEX IF NOT EXISTS idx_user_reviews_user_id_created_at_desc
ON public.user_reviews (user_id, created_at DESC);

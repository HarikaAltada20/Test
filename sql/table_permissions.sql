-- Grant permissions for subscriptions table
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT SELECT ON public.subscriptions TO anon;

-- Grant permissions for users table
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.users TO anon;

-- Grant permissions for advertiser_profiles table
GRANT SELECT ON public.advertiser_profiles TO authenticated;
GRANT SELECT ON public.advertiser_profiles TO anon;

-- Enable RLS on tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertiser_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view user profiles" ON public.users;
DROP POLICY IF EXISTS "Users can view advertiser profiles" ON public.advertiser_profiles;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for users
CREATE POLICY "Users can view user profiles"
ON public.users FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for advertiser_profiles
CREATE POLICY "Users can view advertiser profiles"
ON public.advertiser_profiles FOR SELECT
TO authenticated
USING (true); 
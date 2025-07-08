-- Fix customers table RLS policies
-- Add missing INSERT policy for authenticated users

-- Add INSERT policy that allows users to create their own customer record
CREATE POLICY "Users can insert own customer record" ON customers
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Grant explicit INSERT permission to authenticated users
GRANT INSERT ON customers TO authenticated; 
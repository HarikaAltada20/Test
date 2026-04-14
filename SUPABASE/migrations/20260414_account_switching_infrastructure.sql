-- Migration: Account Switching Infrastructure
-- Description: Adds tables for linked accounts, session vault, and audit logs.

-- 1. Audit Logs Table
-- Tracks sensitive actions like account linking and switching.
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Session Vault (Encrypted Refresh Tokens)
-- owner_user_id: The account "storing" the saved login.
-- target_user_id: The account that can be switched into.
CREATE TABLE IF NOT EXISTS public.user_sessions_vault (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    encrypted_refresh_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(owner_user_id, target_user_id)
);

-- Enabling Row Level Security (RLS)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions_vault ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Owners can manage their session vault" ON public.user_sessions_vault
    FOR ALL USING (auth.uid() = owner_user_id);

-- Helper function for audit logging
-- Now accepts an optional user_id for calls made via Admin client
CREATE OR REPLACE FUNCTION public.log_action(
    p_action TEXT, 
    p_metadata JSONB DEFAULT '{}',
    p_user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.audit_logs (user_id, action, metadata)
    VALUES (COALESCE(p_user_id, auth.uid()), p_action, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

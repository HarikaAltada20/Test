import { Suspense } from 'react';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { SubscriptionFailedClient } from './SubscriptionFailedClient';

export default async function SubscriptionFailedPage({
    searchParams,
}: {
    searchParams: Promise<{
        error?: string;
        session_id?: string;
        reason?: string;
    }>;
}) {
    const resolvedSearchParams = await searchParams;
    const { error, session_id, reason } = resolvedSearchParams;

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        redirect('/auth/signin');
    }

    // Get user profile for additional context
    const { data: profile } = await supabase
        .from('advertiser_profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    // Get current subscription to show plan options
    const { data: currentSubscription } = await supabase
        .from('advertiser_profiles')
        .select('subscription_info')
        .eq('id', user.id)
        .single();

    return (
        <Suspense fallback={<div>Loading...</div>}>
            <SubscriptionFailedClient
                error={error}
                sessionId={session_id}
                reason={reason}
                userProfile={profile}
                currentSubscription={currentSubscription?.subscription_info}
            />
        </Suspense>
    );
} 
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceRoleClient } from '@supabase/supabase-js';

// Type definitions for better type safety
interface ResourceItem {
  url: string;
  description: string;
  type: 'internal' | 'external';
}

interface ContestData {
  id: string;
  advertiser_id: string;
  moderation_status: string;
  payment_details: any;
  thumbnail_url: string | null;
  resources: ResourceItem[] | null;
}

// Helper function to extract file path from Supabase storage URL
function extractStoragePath(url: string): string | null {
  if (!url || !url.includes('contest-assets/')) {
    return null;
  }
  const path = url.split('contest-assets/')[1];
  return path || null;
}

// This function will handle refunds and logging them.
// We'll need a service role client to bypass RLS for updating balances.
const supabaseService = createServiceRoleClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function issueRefund(userId: string, contestId: string, amount: number) {
  // 1. Add amount back to user's wallet
  const { data: profile, error: profileError } = await supabaseService
    .from('advertiser_profiles')
    .select('available_deposit_balance')
    .eq('id', userId)
    .single();

  if (profileError) throw new Error(`Failed to fetch user profile for refund: ${profileError.message}`);

  const newBalance = (profile.available_deposit_balance || 0) + amount;

  const { error: updateError } = await supabaseService
    .from('advertiser_profiles')
    .update({ available_deposit_balance: newBalance })
    .eq('id', userId);

  if (updateError) throw new Error(`Failed to update user balance for refund: ${updateError.message}`);

  // 2. Log the refund transaction
  const { error: logError } = await supabaseService.from('money_transactions').insert({
    user_id: userId,
    type: 'refund',
    amount: amount,
    status: 'success',
    description: `Refund for deleted contest (ID: ${contestId})`,
    remarks: 'Contest deleted before going live.',
  });

  if (logError) {
    // If logging fails, we should still proceed, but log this critical failure.
    console.error(`CRITICAL: Failed to log refund transaction for user ${userId}, contest ${contestId}, amount ${amount}. Error: ${logError.message}`);
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Determine if the current user is an admin
  let isAdmin = false;
  try {
    const { data: userRow } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', user.id)
      .single();
    isAdmin = userRow?.user_type === 'admin';
  } catch (e) {
    // If this check fails, default to non-admin; do not block deletion later if owner
    isAdmin = false;
  }

  const resolvedParams = await params;
  const contestId = resolvedParams.id;

  try {
    // 1. Fetch contest to check ownership and status
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('id, advertiser_id, moderation_status, payment_details, thumbnail_url, resources')
      .eq('id', contestId)
      .single() as { data: ContestData | null; error: any };

    if (contestError || !contest) {
      return NextResponse.json({ error: 'Contest not found' }, { status: 404 });
    }

    if (!isAdmin && contest.advertiser_id !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // 2. Check if refund is applicable
    // Refund paid contests that haven't gone live yet (draft=no payment, published=already live)
    const isRefundable = ['pending_approval', 'approved', 'rejected'].includes(contest.moderation_status);
    let refundAmount = 0;

    if (isRefundable && contest.payment_details) {
        const paymentDetails = contest.payment_details as any;
        if(paymentDetails.payment_status === 'completed' && paymentDetails.total_amount_paid > 0) {
            refundAmount = paymentDetails.total_amount_paid;
            await issueRefund(user.id, contestId, refundAmount);
        }
    }

    // 3. Clean up storage files (thumbnail and resources)
    // This prevents orphaned files in Supabase storage and saves storage space
    const filesToDelete: string[] = [];
    
    // Delete thumbnail if it exists
    if (contest.thumbnail_url) {
        const thumbnailPath = extractStoragePath(contest.thumbnail_url);
        if (thumbnailPath) {
            filesToDelete.push(thumbnailPath);
        }
    }
    
    // Delete resources (new array structure)
    // Only delete internal resources (uploaded files), not external links
    if (contest.resources && Array.isArray(contest.resources)) {
        contest.resources.forEach((resource: ResourceItem) => {
            if (resource.type === 'internal' && resource.url) {
                const resourcePath = extractStoragePath(resource.url);
                if (resourcePath) {
                    filesToDelete.push(resourcePath);
                }
            }
        });
    }

    if (filesToDelete.length > 0) {
        console.log(`Deleting ${filesToDelete.length} storage files for contest ${contestId}:`, filesToDelete);
        const { error: storageError } = await supabase.storage.from('contest-assets').remove(filesToDelete);
        if (storageError) {
            // Log error but don't block deletion
            console.error(`Failed to delete storage files for contest ${contestId}: ${storageError.message}`);
        } else {
            console.log(`Successfully deleted ${filesToDelete.length} storage files for contest ${contestId}`);
        }
    } else {
        console.log(`No direct file paths extracted from URLs for contest ${contestId}`);
    }

    // 3a. Extra safety: delete any objects under contest resources folder
    try {
        const resourcesFolder = `contest_resources/${contestId}`;
        const { data: resObjects, error: listResErr } = await supabase.storage
          .from('contest-assets')
          .list(resourcesFolder);
        if (listResErr) {
          console.warn(`Could not list resources folder for ${contestId}:`, listResErr.message);
        } else if (resObjects && resObjects.length > 0) {
          const paths = resObjects.map((o: any) => `${resourcesFolder}/${o.name}`);
          const { error: removeResErr } = await supabase.storage.from('contest-assets').remove(paths);
          if (removeResErr) {
            console.error(`Failed to remove contest resources for ${contestId}:`, removeResErr.message);
          } else {
            console.log(`Removed ${paths.length} resource files for contest ${contestId}`);
          }
        }
    } catch (e: any) {
        console.error(`Unexpected error while cleaning contest resources for ${contestId}:`, e?.message || e);
    }

    // 3b. Extra safety: remove any thumbnail files matching the contest-specific pattern
    try {
        const { data: thumbObjects, error: listThumbErr } = await supabase.storage
          .from('contest-assets')
          .list('contest_thumbnails');
        if (listThumbErr) {
          console.warn(`Could not list thumbnails while deleting contest ${contestId}:`, listThumbErr.message);
        } else if (thumbObjects && thumbObjects.length > 0) {
          const matching = thumbObjects.filter((f: any) => typeof f.name === 'string' && f.name.startsWith(`${contestId}_`));
          if (matching.length > 0) {
            const thumbPaths = matching.map((f: any) => `contest_thumbnails/${f.name}`);
            const { error: removeThumbErr } = await supabase.storage.from('contest-assets').remove(thumbPaths);
            if (removeThumbErr) {
              console.error(`Failed to remove contest thumbnail(s) for ${contestId}:`, removeThumbErr.message);
            } else {
              console.log(`Removed ${thumbPaths.length} thumbnail file(s) for contest ${contestId}`);
            }
          }
        }
    } catch (e: any) {
        console.error(`Unexpected error while cleaning thumbnails for ${contestId}:`, e?.message || e);
    }


    // 4. Delete the contest record
    const { error: deleteError } = await supabase
      .from('contests')
      .delete()
      .eq('id', contestId);

    if (deleteError) {
      throw new Error(`Failed to delete contest: ${deleteError.message}`);
    }

    const message = refundAmount > 0
        ? `Contest deleted successfully. ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(refundAmount / 100)} has been refunded to your wallet.`
        : 'Contest deleted successfully.';


    return NextResponse.json({ success: true, message: message });

  } catch (error: any) {
    console.error('Error deleting contest:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
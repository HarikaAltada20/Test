import { createAdminClient } from '@/utils/supabase/admin';

/**
 * User-facing copy when a social account is already connected to another profile
 * in the same account-switcher group.
 */
export async function duplicateSocialAccountLinkedMessage(
  existingOwnerUserId: string,
  platformDisplayName: string,
): Promise<string> {
  const fallback = `This ${platformDisplayName} account is already linked to another Game of Creators account.`;

  try {
    const admin = createAdminClient();

    const { data: authData, error: authErr } =
      await admin.auth.admin.getUserById(existingOwnerUserId);
    const email =
      !authErr && authData?.user?.email
        ? authData.user.email.trim()
        : null;

    const { data: userRow } = await admin
      .from('users')
      .select('username, full_name')
      .eq('id', existingOwnerUserId)
      .maybeSingle();

    const username = userRow?.username?.trim() || null;
    const fullName = userRow?.full_name?.trim() || null;
    const displayHandle = username || fullName;

    if (!displayHandle && !email) {
      return fallback;
    }

    const who =
      displayHandle && email
        ? `${displayHandle}, ${email}`
        : displayHandle || email;

    return `This ${platformDisplayName} account is already linked to another Game of Creators profile (${who}).`;
  } catch (e) {
    console.warn(
      '[duplicateSocialAccountLinkedMessage] Could not load owner details:',
      e,
    );
    return fallback;
  }
}

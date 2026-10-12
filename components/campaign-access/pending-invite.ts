/**
 * Remembers an invite token across sign-in / sign-up (including Google OAuth,
 * whose callback drops `next`). Read once by PendingInviteRedeemer.
 */
const COOKIE_NAME = "goviral_pending_invite";
const MAX_AGE_SECONDS = 24 * 60 * 60;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,128}$/;

export function savePendingInvite(token: string): void {
  if (!TOKEN_PATTERN.test(token)) return;
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export function readPendingInvite(): string | null {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  return TOKEN_PATTERN.test(token) ? token : null;
}

export function clearPendingInvite(): void {
  document.cookie = `${COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

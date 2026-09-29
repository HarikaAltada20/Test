export type SupportThreadUser = {
  email: string;
  username: string | null;
  full_name: string | null;
  profile_picture_url: string | null;
};

export function resolveSupportSenderDisplayName(
  user: SupportThreadUser | null,
): string {
  if (!user) return "User";
  return (
    user.full_name?.trim() ||
    user.username?.trim() ||
    user.email ||
    "User"
  );
}

export function buildSupportMessagePreview(body: string, max = 200): string {
  return body.length > max ? `${body.slice(0, max)}...` : body;
}

/** Legacy rows stored as `Brand · username: preview`. */
export function parseLegacySupportMessageResolved(message: string): {
  roleLabel: string | null;
  displayName: string | null;
  preview: string;
} {
  const match = message.match(/^([^·]+?) · ([^:]+):\s*([\s\S]*)$/);
  if (!match) {
    return { roleLabel: null, displayName: null, preview: message };
  }
  return {
    roleLabel: match[1].trim(),
    displayName: match[2].trim(),
    preview: match[3],
  };
}

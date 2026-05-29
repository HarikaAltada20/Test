/** Role stored on support_messages for platform staff replies */
export const SUPPORT_ADMIN_SENDER_ROLE = "admin" as const;

const CUSTOMER_SENDER_ROLES = new Set(["creator", "advertiser"]);

/**
 * Maps users.user_type to the value stored in support_messages.sender_role
 * for thread-owner messages (not admin).
 */
export function customerSenderRole(
  userType: string | null | undefined,
): "creator" | "advertiser" {
  if (userType === "advertiser") return "advertiser";
  return "creator";
}

export function isSupportAdminMessage(senderRole: string): boolean {
  return senderRole === SUPPORT_ADMIN_SENDER_ROLE;
}

export function isCustomerSupportMessage(senderRole: string): boolean {
  if (senderRole === "user") return true; // legacy rows before migration
  return !isSupportAdminMessage(senderRole);
}

export function formatSenderRoleLabel(senderRole: string): string {
  if (senderRole === SUPPORT_ADMIN_SENDER_ROLE) return "Support";
  if (senderRole === "advertiser") return "Brand";
  if (senderRole === "creator") return "Creator";
  if (senderRole === "user") return "User";
  return senderRole.charAt(0).toUpperCase() + senderRole.slice(1);
}

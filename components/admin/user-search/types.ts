export interface AdminSearchUser {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  user_type: string;
  coins: number | null;
  profile_picture_url?: string | null;
  matched_field?: "id" | "username" | "email" | "name" | null;
  match_rank?: number | null;
}

export function userDisplayName(user: {
  full_name: string | null;
  username: string | null;
}): string {
  return user.full_name || user.username || "No name";
}

export function userInitials(user: {
  full_name: string | null;
  username: string | null;
}): string {
  const name = userDisplayName(user).trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export function userTypeLabel(userType: string): string {
  if (userType === "advertiser") return "Brand";
  if (userType === "creator") return "Creator";
  if (userType === "admin") return "Admin";
  return userType;
}

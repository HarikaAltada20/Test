import type {
  AllowlistMember,
  BrandAllowlist,
  ContestAccessMember,
  InviteExpiryPreset,
  InviteLink,
  InviteRedeemResult,
} from "@/lib/campaign-access";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Request failed (${res.status})`);
  }
  return json as T;
}

function withAdvertiser(url: string, advertiserId?: string | null) {
  return advertiserId ? `${url}?advertiserId=${encodeURIComponent(advertiserId)}` : url;
}

export type AddResult = {
  added: number;
  alreadyOnList: number;
  notFound?: string[];
  invalid?: string[];
};

export const allowlistApi = {
  list: (advertiserId?: string | null) =>
    request<{ allowlists: BrandAllowlist[] }>(withAdvertiser("/api/allowlists", advertiserId)),

  create: (body: { name: string; usernames?: string; advertiserId?: string | null }) =>
    request<{ allowlist: BrandAllowlist; added: number; notFound: string[]; invalid: string[] }>(
      "/api/allowlists",
      { method: "POST", body: JSON.stringify(body) },
    ),

  rename: (id: string, name: string) =>
    request<{ allowlist: BrandAllowlist }>(`/api/allowlists/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),

  remove: (id: string) =>
    request<{ success: true }>(`/api/allowlists/${id}`, { method: "DELETE" }),

  duplicate: (id: string, name?: string) =>
    request<{ allowlist: BrandAllowlist }>(`/api/allowlists/${id}?action=duplicate`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  members: (id: string) =>
    request<{ allowlist: BrandAllowlist; members: AllowlistMember[] }>(
      `/api/allowlists/${id}/members`,
    ),

  addMembers: (id: string, usernames: string) =>
    request<AddResult>(`/api/allowlists/${id}/members`, {
      method: "POST",
      body: JSON.stringify({ usernames }),
    }),

  removeMembers: (id: string, userIds: string[]) =>
    request<{ success: true }>(`/api/allowlists/${id}/members`, {
      method: "DELETE",
      body: JSON.stringify({ userIds }),
    }),
};

export const accessListApi = {
  get: (contestId: string) =>
    request<{
      contest: { id: string; advertiser_id: string | null; access_mode: string; access_list_skips_requirements: boolean };
      members: ContestAccessMember[];
    }>(`/api/contests/${contestId}/access-list`),

  addUsernames: (contestId: string, usernames: string) =>
    request<AddResult>(`/api/contests/${contestId}/access-list`, {
      method: "POST",
      body: JSON.stringify({ usernames }),
    }),

  importList: (contestId: string, allowlistId: string) =>
    request<AddResult>(`/api/contests/${contestId}/access-list`, {
      method: "POST",
      body: JSON.stringify({ allowlistId }),
    }),

  saveAsList: (contestId: string, name: string) =>
    request<{ allowlist: BrandAllowlist }>(`/api/contests/${contestId}/access-list`, {
      method: "POST",
      body: JSON.stringify({ saveAsList: name }),
    }),

  setSkipRequirements: (contestId: string, value: boolean) =>
    request<{ success: true }>(`/api/contests/${contestId}/access-list`, {
      method: "PATCH",
      body: JSON.stringify({ access_list_skips_requirements: value }),
    }),

  remove: (contestId: string, userIds: string[]) =>
    request<{ success: true }>(`/api/contests/${contestId}/access-list`, {
      method: "DELETE",
      body: JSON.stringify({ userIds }),
    }),
};

export type CreateInviteLinkInput = {
  label?: string;
  expiry: InviteExpiryPreset;
  customExpiresDate?: string | null;
  timezoneOffsetMinutes?: number;
  maxUses?: number | null;
};

export type RedeemInviteResponse = {
  result: InviteRedeemResult;
  contestId: string | null;
  isPublished?: boolean;
  message: string;
};

export const inviteLinkApi = {
  list: (contestId: string) =>
    request<{ links: InviteLink[] }>(`/api/contests/${contestId}/invite-links`),

  create: (contestId: string, body: CreateInviteLinkInput) =>
    request<{ link: InviteLink }>(`/api/contests/${contestId}/invite-links`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  revoke: (contestId: string, linkId: string) =>
    request<{ success: true }>(`/api/contests/${contestId}/invite-links/${linkId}`, {
      method: "DELETE",
    }),

  /** Resolves with a result code for expected outcomes (including 401); throws only on server errors. */
  redeem: async (token: string): Promise<RedeemInviteResponse> => {
    const res = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
      method: "POST",
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!json?.result) {
      throw new Error(json?.error || `Request failed (${res.status})`);
    }
    return json as RedeemInviteResponse;
  },
};

export function summarizeAddResult(result: AddResult): string {
  const parts = [`${result.added} added`];
  if (result.alreadyOnList > 0) parts.push(`${result.alreadyOnList} already on the list`);
  if (result.notFound?.length) parts.push(`not found: ${result.notFound.join(", ")}`);
  if (result.invalid?.length) parts.push(`invalid: ${result.invalid.join(", ")}`);
  return parts.join(" · ");
}

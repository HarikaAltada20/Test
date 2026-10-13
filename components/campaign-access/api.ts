import type {
  AllowlistMember,
  ApplicationQuestion,
  ApplicationResult,
  ApplicationStatus,
  BrandAllowlist,
  ContestAccessMember,
  ContestApplication,
  ContestPreview,
  InviteExpiryPreset,
  InviteLink,
  InviteRedeemResult,
} from "@/lib/campaign-access";
import { formatAddResultSummary } from "@/lib/campaign-access";
import type { ApplicantVisibility } from "@/lib/campaign-applicant-profile";

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

  /** Adds only the saved list's members who aren't on the campaign yet. */
  syncList: (contestId: string, allowlistId: string) =>
    request<AddResult>(`/api/contests/${contestId}/access-list`, {
      method: "POST",
      body: JSON.stringify({ syncList: allowlistId }),
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

export type ApplicationListResponse = {
  applications: ContestApplication[];
  total: number;
  page: number;
  limit: number;
  counts: Record<ApplicationStatus, number>;
};

export type ApplyResponse = {
  result: ApplicationResult;
  message?: string;
  error?: string;
  applicationId?: string | null;
  questionId?: string | null;
};

export const applicationsApi = {
  list: (
    contestId: string,
    opts: { status?: ApplicationStatus | "all"; search?: string; page?: number; limit?: number } = {},
  ) => {
    const sp = new URLSearchParams();
    if (opts.status) sp.set("status", opts.status);
    if (opts.search) sp.set("search", opts.search);
    if (opts.page) sp.set("page", String(opts.page));
    if (opts.limit) sp.set("limit", String(opts.limit));
    return request<ApplicationListResponse>(
      `/api/contests/${contestId}/applications?${sp.toString()}`,
    );
  },

  review: (contestId: string, appId: string, decision: "approve" | "reject", reason?: string) =>
    request<{ result: ApplicationResult; message: string }>(
      `/api/contests/${contestId}/applications/${appId}`,
      { method: "PATCH", body: JSON.stringify({ decision, reason }) },
    ),

  bulkReview: (contestId: string, ids: string[], decision: "approve" | "reject", reason?: string) =>
    request<{ updated: number; skipped: number }>(
      `/api/contests/${contestId}/applications/bulk`,
      { method: "POST", body: JSON.stringify({ ids, decision, reason }) },
    ),

  /** Resolves with the result code for expected outcomes; throws only on unexpected errors. */
  apply: async (contestId: string, answers: Record<string, string>): Promise<ApplyResponse> => {
    const res = await fetch(`/api/contests/${contestId}/applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ answers }),
    });
    const json = await res.json().catch(() => ({}));
    if (!json?.result) throw new Error(json?.error || `Request failed (${res.status})`);
    return json as ApplyResponse;
  },

  withdraw: (contestId: string) =>
    request<{ result: ApplicationResult; message: string }>(
      `/api/contests/${contestId}/applications`,
      { method: "DELETE" },
    ),

  preview: (contestId: string) =>
    request<{ preview: ContestPreview }>(`/api/contests/${contestId}/preview`),
};

export const questionsApi = {
  get: (contestId: string) =>
    request<{ questions: ApplicationQuestion[] }>(
      `/api/contests/${contestId}/application-questions`,
    ),

  save: (contestId: string, questions: ApplicationQuestion[]) =>
    request<{ questions: ApplicationQuestion[] }>(
      `/api/contests/${contestId}/application-questions`,
      { method: "PUT", body: JSON.stringify({ questions }) },
    ),
};

/** Short toast line; failed usernames are listed with AddResultDetails instead. */
export function summarizeAddResult(result: AddResult, alreadyLabel?: string): string {
  return formatAddResultSummary(result, alreadyLabel);
}

export const applicantVisibilityApi = {
  get: (contestId: string) =>
    request<{ visibility: ApplicantVisibility; canEdit: boolean }>(
      `/api/contests/${contestId}/applicant-visibility`,
    ),

  /** Admins only. */
  save: (contestId: string, visibility: ApplicantVisibility) =>
    request<{ visibility: ApplicantVisibility; canEdit: boolean }>(
      `/api/contests/${contestId}/applicant-visibility`,
      { method: "PUT", body: JSON.stringify({ visibility }) },
    ),
};

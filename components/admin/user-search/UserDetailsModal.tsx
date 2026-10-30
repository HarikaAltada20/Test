"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";
import { UserTypeBadge } from "./UserTypeBadge";
import { userDisplayName } from "./types";

type Row = Record<string, unknown>;

interface DetailsResponse {
  user: Row;
  profile: Row | null;
  profileType: "creator_profiles" | "advertiser_profiles" | null;
}

interface UserDetailsModalProps {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
}

// Fetched details are kept per user for as long as the page is open, so
// reopening the modal for the same user is instant. "Refresh" refetches.
const detailsCache = new Map<string, DetailsResponse>();

/* ---------- formatting ---------- */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;

function humanize(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return value.length <= 10
    ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })
    : d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Money columns are stored in cents. */
function cents(value: unknown): string {
  const n = Number(value ?? 0);
  return `$${(n / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function count(value: unknown): string {
  return Number(value ?? 0).toLocaleString();
}

function isEmpty(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    v === "" ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)
  );
}

function Value({ value, isDark }: { value: unknown; isDark: boolean }) {
  const faint = isDark ? "text-gray-500" : "text-gray-400";
  if (isEmpty(value)) return <span className={faint}>—</span>;
  if (typeof value === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (typeof value === "number") return <span className="tabular-nums">{value.toLocaleString()}</span>;
  if (typeof value === "string") {
    if (ISO_DATE.test(value)) return <>{formatDate(value)}</>;
    if (/^https?:\/\//i.test(value)) {
      return (
        <a href={value} target="_blank" rel="noreferrer" className="underline underline-offset-2 break-all">
          {value}
        </a>
      );
    }
    return <>{value}</>;
  }
  if (Array.isArray(value) && value.every((v) => typeof v === "string" || typeof v === "number")) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className={cn("rounded-full border px-2 text-xs", isDark ? "border-gray-700" : "border-gray-200")}
          >
            {String(v)}
          </span>
        ))}
      </span>
    );
  }
  return (
    <code className={cn("block whitespace-pre-wrap break-all rounded p-1.5 text-[11px]", isDark ? "bg-[#1b0f44]" : "bg-gray-50")}>
      {JSON.stringify(value, null, 2)}
    </code>
  );
}

function CopyButton({ value, label = "Copy", isDark }: { value: string; label?: string; isDark: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-label={`${label}: ${value}`}
      className={cn(
        "inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium",
        isDark ? "text-gray-400 hover:bg-white/10 hover:text-white" : "text-gray-500 hover:bg-[#f3f3f5] hover:text-[#1a1a1a]"
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

function Group({
  title,
  rows,
  isDark,
}: {
  title: string;
  rows: [string, unknown][];
  isDark: boolean;
}) {
  return (
    <section className={cn("rounded-xl border px-4 py-1", isDark ? "border-gray-800" : "border-gray-200")}>
      <h5 className={cn("mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wider", isDark ? "text-gray-400" : "text-gray-500")}>
        {title}
      </h5>
      <dl>
        {rows.map(([label, value], i) => (
          <div
            key={label}
            className={cn(
              "grid grid-cols-[minmax(110px,40%)_1fr] gap-3 py-2 text-sm",
              i > 0 && (isDark ? "border-t border-gray-800" : "border-t border-gray-100")
            )}
          >
            <dt className={isDark ? "text-gray-400" : "text-gray-500"}>{label}</dt>
            <dd className="min-w-0 break-words">
              <Value value={value} isDark={isDark} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* ---------- field layout ---------- */

const pick = (row: Row | null, keys: [string, string][]): [string, unknown][] =>
  keys.map(([key, label]) => [label, row?.[key]]);

const SOCIALS: [string, string][] = [
  ["youtube_account", "YouTube"],
  ["instagram_account", "Instagram"],
  ["twitter_account", "X (Twitter)"],
  ["tiktok_account", "TikTok"],
];

const HANDLE_KEYS = ["channel_title", "username", "handle", "screen_name", "display_name", "name", "title"];
const FOLLOWER_KEYS = ["subscriber_count", "subscribers", "followers_count", "follower_count", "followers"];
const LINK_KEYS = ["channel_url", "profile_url", "url", "link"];

function firstKey(obj: Row, keys: string[]): unknown {
  for (const k of keys) if (!isEmpty(obj[k])) return obj[k];
  return undefined;
}

// Columns shown in a named section; anything else lands in "Other fields".
const USER_SHOWN = new Set([
  "id", "full_name", "username", "email", "user_type", "is_active", "profile_picture_url",
  "coins", "total_lifetime_coins_earned", "affiliate_earnings", "other_earnings",
  "referral_code", "referred_by", "creators_referred", "advertisers_referred",
  "email_confirmed_at", "created_at", "updated_at", "login_history", "registration_info",
]);
const CREATOR_SHOWN = new Set([
  "id", "bio", "phone_number", "date_of_birth", "gender", "country", "state", "city", "address",
  "languages", "categories", "subcategories", "interests",
  "total_contests_participated", "total_contests_won", "total_submissions_made", "total_submissions_won",
  "total_views", "total_money_won", "withdrawable_balance", "has_seen_guidelines",
  "has_claimed_profile_reward", "profile_reward_claimed_at", "created_at", "updated_at",
  ...SOCIALS.map(([k]) => k),
]);
const BRAND_SHOWN = new Set([
  "id", "company_name", "website_url", "total_contests_run", "total_money_spent",
  "available_deposit_balance", "withdrawable_balance", "subscription_info", "created_at", "updated_at",
]);

function otherFields(row: Row | null, shown: Set<string>): [string, unknown][] {
  if (!row) return [];
  return Object.keys(row)
    .filter((k) => !shown.has(k))
    .sort()
    .map((k) => [humanize(k), row[k]]);
}

type TabKey = "overview" | "profile" | "socials" | "activity" | "account" | "raw";

/* ---------- component ---------- */

export function UserDetailsModal({ userId, open, onOpenChange, isDark }: UserDetailsModalProps) {
  const [details, setDetails] = useState<DetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!open || !userId) return;
    setTab("overview");
    const cached = reloadKey === 0 ? detailsCache.get(userId) : undefined;
    if (cached) {
      setDetails(cached);
      setError(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/admin/users/${encodeURIComponent(userId)}/details`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Could not load this user");
        const next: DetailsResponse = { user: data.user, profile: data.profile, profileType: data.profileType };
        detailsCache.set(userId, next);
        setDetails(next);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setDetails(null);
        setError(err.message || "Could not load this user");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open, userId, reloadKey]);

  const user = details && details.user.id === userId ? details.user : null;
  const profile = user ? details!.profile : null;
  const isCreator = user?.user_type === "creator";
  const isBrand = user?.user_type === "advertiser";

  const muted = isDark ? "text-gray-400" : "text-gray-500";
  const border = isDark ? "border-gray-800" : "border-gray-200";

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "profile", label: isBrand ? "Company" : "Profile" },
    ...(isCreator ? [{ key: "socials" as TabKey, label: "Social accounts" }] : []),
    ...(isCreator || isBrand ? [{ key: "activity" as TabKey, label: isBrand ? "Campaigns & plan" : "Activity" }] : []),
    { key: "account", label: "Account & sign-ins" },
    { key: "raw", label: "Raw data" },
  ];

  const stats: [string, string][] = !user
    ? []
    : isCreator
      ? [
          ["Coins", count(user.coins)],
          ["Lifetime coins", count(user.total_lifetime_coins_earned)],
          ["Withdrawable", cents(profile?.withdrawable_balance)],
          ["Total won", cents(profile?.total_money_won)],
          ["Affiliate", cents(user.affiliate_earnings)],
          ["Other earnings", cents(user.other_earnings)],
        ]
      : isBrand
        ? [
            ["Coins", count(user.coins)],
            ["Deposit balance", cents(profile?.available_deposit_balance)],
            ["Withdrawable", cents(profile?.withdrawable_balance)],
            ["Total spent", cents(profile?.total_money_spent)],
          ]
        : [
            ["Coins", count(user.coins)],
            ["Lifetime coins", count(user.total_lifetime_coins_earned)],
          ];

  const subscription = (profile?.subscription_info ?? null) as Row | null;
  const loginHistory = Array.isArray(user?.login_history) ? (user!.login_history as Row[]) : [];
  const recentLogins = loginHistory.slice(-5).reverse();

  const missingProfile =
    user && (isCreator || isBrand) && !profile ? (
      <p className={cn("mb-4 rounded-lg border p-3 text-sm", isDark ? "border-amber-800 bg-amber-900/20 text-amber-300" : "border-amber-200 bg-amber-50 text-amber-800")}>
        No {isCreator ? "creator" : "brand"} profile found for this user.
      </p>
    ) : null;

  const renderTab = () => {
    if (!user) return null;
    switch (tab) {
      case "overview":
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Group
              title="Identity"
              isDark={isDark}
              rows={[
                ["Full name", user.full_name],
                ["Username", user.username ? `@${user.username}` : null],
                ["Email", user.email],
                ["User type", isBrand ? "Brand" : isCreator ? "Creator" : user.user_type],
                ["Status", user.is_active === false ? "Inactive" : "Active"],
              ]}
            />
            {isCreator ? (
              <Group
                title="Creator snapshot"
                isDark={isDark}
                rows={[
                  ["Location", [profile?.city, profile?.state, profile?.country].filter(Boolean).join(", ") || null],
                  ["Categories", profile?.categories],
                  ["Contests won", profile ? `${count(profile.total_contests_won)} of ${count(profile.total_contests_participated)}` : null],
                  ["Total views", profile ? count(profile.total_views) : null],
                  ["Joined", user.created_at],
                ]}
              />
            ) : isBrand ? (
              <Group
                title="Brand snapshot"
                isDark={isDark}
                rows={[
                  ["Company", profile?.company_name],
                  ["Website", profile?.website_url],
                  ["Campaigns run", profile?.total_contests_run],
                  ["Plan", subscription ? [subscription.plan ?? subscription.plan_name, subscription.status].filter(Boolean).join(" · ") || null : null],
                  ["Joined", user.created_at],
                ]}
              />
            ) : (
              <Group title="Account" isDark={isDark} rows={[["Joined", user.created_at], ["Updated", user.updated_at]]} />
            )}
          </div>
        );
      case "profile":
        if (isBrand) {
          return (
            <div className="grid gap-4 md:grid-cols-2">
              <Group
                title="Company"
                isDark={isDark}
                rows={[["Company name", profile?.company_name], ["Website", profile?.website_url], ["Contact email", user.email]]}
              />
              {otherFields(profile, BRAND_SHOWN).length > 0 && (
                <Group title="Other fields" isDark={isDark} rows={otherFields(profile, BRAND_SHOWN)} />
              )}
            </div>
          );
        }
        if (!isCreator) {
          return <p className={cn("text-sm", muted)}>This account type has no profile table.</p>;
        }
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Group
              title="Personal"
              isDark={isDark}
              rows={pick(profile, [["bio", "Bio"], ["phone_number", "Phone"], ["date_of_birth", "Date of birth"], ["gender", "Gender"]])}
            />
            <Group
              title="Location"
              isDark={isDark}
              rows={pick(profile, [["country", "Country"], ["state", "State"], ["city", "City"], ["address", "Address"]])}
            />
            <Group
              title="Content"
              isDark={isDark}
              rows={pick(profile, [["languages", "Languages"], ["categories", "Categories"], ["subcategories", "Subcategories"], ["interests", "Interests"]])}
            />
            {otherFields(profile, CREATOR_SHOWN).length > 0 && (
              <Group title="Other fields" isDark={isDark} rows={otherFields(profile, CREATOR_SHOWN)} />
            )}
          </div>
        );
      case "socials":
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            {SOCIALS.map(([key, label]) => {
              const acct = profile?.[key] as Row | null | undefined;
              const connected = acct && typeof acct === "object" && !isEmpty(acct);
              const handle = connected ? firstKey(acct, HANDLE_KEYS) : undefined;
              const followers = connected ? firstKey(acct, FOLLOWER_KEYS) : undefined;
              const link = connected ? firstKey(acct, LINK_KEYS) : undefined;
              const scalarRows: [string, unknown][] = connected
                ? Object.entries(acct)
                    .filter(([, v]) => v === null || typeof v !== "object")
                    .filter(([, v]) => v !== "[hidden]")
                    .map(([k, v]) => [humanize(k), v])
                : [];
              return (
                <section key={key} className={cn("rounded-xl border p-4", border, !connected && "opacity-60")}>
                  <div className={cn("text-[11px] font-semibold uppercase tracking-wider", muted)}>{label}</div>
                  <div className="mt-1 font-semibold">
                    {connected ? (handle ? String(handle) : "Connected") : "Not connected"}
                  </div>
                  {followers !== undefined && (
                    <div className={cn("text-sm tabular-nums", muted)}>{Number(followers).toLocaleString()} followers</div>
                  )}
                  {typeof link === "string" && /^https?:\/\//i.test(link) && (
                    <a href={link} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
                      Open profile
                    </a>
                  )}
                  {scalarRows.length > 0 && (
                    <details className="mt-2 text-sm">
                      <summary className={cn("cursor-pointer text-xs", muted)}>All fields</summary>
                      <dl className="mt-1 space-y-1">
                        {scalarRows.map(([k, v]) => (
                          <div key={k} className="grid grid-cols-[minmax(90px,45%)_1fr] gap-2 text-xs">
                            <dt className={muted}>{k}</dt>
                            <dd className="min-w-0 break-all">
                              <Value value={v} isDark={isDark} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </section>
              );
            })}
          </div>
        );
      case "activity":
        if (isBrand) {
          return (
            <div className="grid gap-4 md:grid-cols-2">
              <Group
                title="Campaigns"
                isDark={isDark}
                rows={[
                  ["Campaigns run", profile?.total_contests_run],
                  ["Total spent", profile ? cents(profile.total_money_spent) : null],
                  ["Deposit balance", profile ? cents(profile.available_deposit_balance) : null],
                ]}
              />
              <Group
                title="Subscription"
                isDark={isDark}
                rows={subscription && typeof subscription === "object" ? Object.entries(subscription).map(([k, v]) => [humanize(k), v]) : [["Subscription", null]]}
              />
            </div>
          );
        }
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <Group
              title="Contests"
              isDark={isDark}
              rows={pick(profile, [
                ["total_contests_participated", "Participated"],
                ["total_contests_won", "Won"],
                ["total_submissions_made", "Submissions made"],
                ["total_submissions_won", "Submissions won"],
                ["total_views", "Total views"],
              ])}
            />
            <Group
              title="Onboarding"
              isDark={isDark}
              rows={pick(profile, [
                ["has_seen_guidelines", "Seen guidelines"],
                ["has_claimed_profile_reward", "Profile reward claimed"],
                ["profile_reward_claimed_at", "Claimed on"],
              ])}
            />
          </div>
        );
      case "account":
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Group
                title="Referrals"
                isDark={isDark}
                rows={[
                  ["Referral code", user.referral_code],
                  ["Referred by", user.referred_by],
                  ["Creators referred", user.creators_referred],
                  ["Brands referred", user.advertisers_referred],
                ]}
              />
              <Group
                title="Account"
                isDark={isDark}
                rows={[
                  ["Email confirmed", user.email_confirmed_at],
                  ["Created", user.created_at],
                  ["Updated", user.updated_at],
                  ["Registration info", user.registration_info],
                ]}
              />
              {otherFields(user, USER_SHOWN).length > 0 && (
                <Group title="Other fields" isDark={isDark} rows={otherFields(user, USER_SHOWN)} />
              )}
            </div>
            <section>
              <h5 className={cn("mb-2 text-[11px] font-semibold uppercase tracking-wider", muted)}>
                Recent sign-ins {loginHistory.length > 5 && `(last 5 of ${loginHistory.length})`}
              </h5>
              {recentLogins.length === 0 ? (
                <p className={cn("text-sm", muted)}>No sign-ins recorded.</p>
              ) : (
                <div className="space-y-2">
                  {recentLogins.map((entry, i) => (
                    <div key={i} className={cn("rounded-lg border p-2", border)}>
                      <Value value={entry} isDark={isDark} />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        );
      case "raw": {
        const raw = { users: user, [details!.profileType ?? "profile"]: profile };
        const json = JSON.stringify(raw, null, 2);
        return (
          <div className="space-y-2">
            <p className={cn("flex flex-wrap items-center gap-2 text-sm", muted)}>
              Every column of both rows as stored. Tokens and secrets are hidden.
              <CopyButton value={json} label="Copy JSON" isDark={isDark} />
            </p>
            <pre className={cn("max-h-[50vh] overflow-auto rounded-xl border p-3 font-mono text-xs", border, isDark ? "bg-[#130a33]" : "bg-gray-50")}>
              {json}
            </pre>
          </div>
        );
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} isdark={isDark}>
      <DialogContent
        className={cn(
          "flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:p-0",
          isDark ? "border-gray-800 text-white" : "bg-white text-gray-900"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "space-y-4 px-5 pt-5 sm:px-6",
            isDark ? "bg-gradient-to-b from-[#2a1760]/60 to-transparent" : "bg-gradient-to-b from-[#efe8fb] to-transparent"
          )}
        >
          {user ? (
            <div className="flex flex-wrap items-center gap-4 pr-6">
              <UserAvatar
                user={{
                  id: String(user.id),
                  full_name: (user.full_name as string) ?? null,
                  username: (user.username as string) ?? null,
                  profile_picture_url: (user.profile_picture_url as string) ?? null,
                }}
                size={60}
                className={isDark ? "ring-4 ring-[#06021d]" : "ring-4 ring-white"}
              />
              <div className="min-w-[200px] flex-1">
                <DialogTitle className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  {userDisplayName({ full_name: (user.full_name as string) ?? null, username: (user.username as string) ?? null })}
                  <UserTypeBadge userType={String(user.user_type)} isDark={isDark} />
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      user.is_active === false
                        ? isDark ? "bg-red-900/40 text-red-300" : "bg-red-50 text-red-700"
                        : isDark ? "bg-green-900/40 text-green-300" : "bg-green-50 text-green-700"
                    )}
                  >
                    {user.is_active === false ? "Inactive" : "Active"}
                  </span>
                </DialogTitle>
                <DialogDescription asChild>
                  <div className={cn("mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", muted)}>
                    {user.username ? <span>@{String(user.username)}</span> : null}
                    <span className="inline-flex items-center gap-1 break-all">
                      {String(user.email)}
                      <CopyButton value={String(user.email)} isDark={isDark} />
                    </span>
                    <span className="inline-flex items-center gap-1 break-all font-mono text-xs">
                      {String(user.id)}
                      <CopyButton value={String(user.id)} label="Copy ID" isDark={isDark} />
                    </span>
                    {user.created_at ? <span>Joined {formatDate(String(user.created_at))}</span> : null}
                  </div>
                </DialogDescription>
              </div>
            </div>
          ) : (
            <div className="pr-6">
              <DialogTitle className="text-lg font-semibold">User details</DialogTitle>
              <DialogDescription className={cn("text-sm", muted)}>
                {loading ? "Loading user…" : error ?? ""}
              </DialogDescription>
            </div>
          )}

          {user && (
            <div
              className={cn(
                "grid gap-2.5",
                stats.length === 6
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-6"
                  : stats.length === 4
                    ? "grid-cols-2 sm:grid-cols-4"
                    : "grid-cols-2"
              )}
            >
              {stats.map(([label, value]) => (
                <div key={label} className={cn("rounded-xl border px-3 py-2.5", border, isDark ? "bg-[#06021d]" : "bg-white")}>
                  <div className={cn("truncate text-[10.5px] uppercase tracking-wide", muted)} title={label}>{label}</div>
                  <div className="mt-0.5 truncate text-base font-bold tabular-nums sm:text-lg">{value}</div>
                </div>
              ))}
            </div>
          )}

          {user && (
            <div role="tablist" className={cn("-mx-5 flex gap-1 overflow-x-auto border-b px-4 sm:-mx-6 sm:px-5", border)}>
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                    tab === t.key
                      ? isDark ? "border-[#9466ff] text-white" : "border-[#1a1a1a] text-gray-900"
                      : cn("border-transparent", muted, isDark ? "hover:text-white" : "hover:text-gray-900")
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="min-h-[200px] flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loading && !user ? (
            <div className={cn("flex items-center justify-center gap-2 py-16 text-sm", muted)}>
              <Loader2 className="h-4 w-4 animate-spin" /> Loading user details…
            </div>
          ) : error && !user ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center text-sm">
              <p className={isDark ? "text-red-300" : "text-red-700"}>{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className={cn("rounded-md border px-3 py-1.5", border)}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              {missingProfile}
              {renderTab()}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={cn("flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3 text-xs sm:px-6", border, muted)}>
          <span className="inline-flex items-center gap-2">
            Read-only view
            {user && (
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                disabled={loading}
                className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5", isDark ? "hover:bg-[#1b0f44]" : "hover:bg-gray-100")}
              >
                <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
              </button>
            )}
          </span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              "rounded-md px-4 py-2 text-sm font-semibold text-white",
              isDark ? "bg-[#1a1a1a] hover:bg-black" : "bg-[#1a1a1a] hover:bg-black"
            )}
          >
            Back to manual entry
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

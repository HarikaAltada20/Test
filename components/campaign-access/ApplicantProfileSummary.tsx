"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, EyeOff } from "lucide-react";
import { getPlatformIcon } from "@/lib/platform-icons";
import {
  formatQualityScoreDisplay,
  formatQualitySumDisplay,
  formatTrustScoreDisplay,
} from "@/lib/creator-profile-stats";
import {
  formatFollowers,
  topFollowerCount,
  type ApplicantField,
  type ApplicantProfile,
} from "@/lib/campaign-applicant-profile";

const PLATFORM_NAMES = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  twitter: "X (Twitter)",
} as const;

const sectionTitle =
  "text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";

/** Shown to admins next to details the brand can't see. */
function HiddenFromBrand() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
      <EyeOff className="h-3 w-3" aria-hidden="true" /> Hidden from brand
    </span>
  );
}

/** Connected accounts, scores and basic info about an applicant, for the review drawer. */
export function ApplicantProfileSummary({ profile }: { profile: ApplicantProfile | null | undefined }) {
  const [showMore, setShowMore] = useState(false);

  if (!profile) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No creator profile details are available for this applicant.
      </p>
    );
  }

  const hidden = new Set<ApplicantField>(profile.hiddenFields ?? []);
  // The brand's copy has hidden details removed; skip those sections entirely.
  const shows = (field: ApplicantField) => !(profile.redacted && hidden.has(field));
  const markHidden = (field: ApplicantField) => !profile.redacted && hidden.has(field);

  const allStats: { field: ApplicantField; label: string; value: string; hint?: string }[] = [
    {
      field: "trust",
      label: "Trust score",
      value: profile.trustScore != null ? formatTrustScoreDisplay(profile.trustScore) : "New",
      hint: profile.trustScore == null ? "No submissions yet" : undefined,
    },
    { field: "quality", label: "Avg quality", value: formatQualityScoreDisplay(profile.avgQualityScore) },
    { field: "quality", label: "Best quality", value: formatQualityScoreDisplay(profile.bestQualityScore) },
    { field: "quality", label: "Quality score", value: formatQualitySumDisplay(profile.qualityScoreSum) },
    {
      field: "activity",
      label: "Verified submissions",
      value: `${profile.verifiedSubmissions} of ${profile.totalSubmissions}`,
    },
    { field: "activity", label: "Total views", value: formatFollowers(profile.totalViews) },
  ];
  const stats = allStats.filter((st) => shows(st.field));

  const basics = [
    profile.country ? { label: "Country", value: profile.country } : null,
    profile.languages.length ? { label: "Languages", value: profile.languages.join(", ") } : null,
    profile.categories.length ? { label: "Categories", value: profile.categories.join(", ") } : null,
  ].filter((b): b is { label: string; value: string } => !!b);
  if (profile.campaignsJoined != null && shows("activity")) {
    basics.push({ label: "Campaigns joined", value: String(profile.campaignsJoined) });
  }
  const showBasics = shows("basics") || shows("activity");

  return (
    <div className="space-y-5">
      {shows("accounts") && (
      <section aria-labelledby="applicant-accounts" className="space-y-2">
        <h3 id="applicant-accounts" className={`${sectionTitle} flex flex-wrap items-center gap-2`}>
          Connected accounts
          {markHidden("accounts") && <HiddenFromBrand />}
          {!markHidden("accounts") && markHidden("followers") && (
            <span className="normal-case tracking-normal">
              <HiddenFromBrand />
              <span className="sr-only"> (follower counts)</span>
            </span>
          )}
        </h3>
        {profile.accounts.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No social accounts connected.</p>
        ) : (
          <ul className="space-y-2">
            {profile.accounts.map((a) => (
              <li
                key={a.platform}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-white/10"
              >
                <span className="flex-shrink-0" aria-hidden="true">
                  {getPlatformIcon(a.platform, "md")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">{PLATFORM_NAMES[a.platform]}</p>
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-[#7F39EC] hover:underline dark:text-purple-300"
                    >
                      <span className="truncate">{a.label}</span>
                      <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{a.label}</p>
                  )}
                </div>
                {a.followers != null && (
                  <span className="text-right text-sm font-semibold text-gray-900 dark:text-white">
                    {formatFollowers(a.followers)}
                    <span className="block text-[11px] font-normal text-gray-500 dark:text-gray-400">
                      {a.platform === "youtube" ? "subscribers" : "followers"}
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {stats.length > 0 && (
      <section aria-labelledby="applicant-scores" className="space-y-2">
        <h3 id="applicant-scores" className={sectionTitle}>
          Performance on Game of Creators
        </h3>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-white/5">
              <dt className="flex flex-wrap items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                {s.label}
                {markHidden(s.field) && <EyeOff className="h-3 w-3 text-amber-600" aria-label="Hidden from brand" />}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 dark:text-white">{s.value}</dd>
              {s.hint && <dd className="text-[11px] text-gray-400 dark:text-gray-500">{s.hint}</dd>}
            </div>
          ))}
        </dl>
        {(markHidden("trust") || markHidden("quality") || markHidden("activity")) && (
          <p className="flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
            <EyeOff className="h-3 w-3" aria-hidden="true" /> Marked details are hidden from the brand.
          </p>
        )}
      </section>
      )}

      {showBasics && basics.length > 0 && (
        <section className="space-y-2">
          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1 rounded-sm text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-gray-400 dark:hover:text-gray-200"
          >
            {showMore ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Basic information
          </button>
          {markHidden("basics") && <HiddenFromBrand />}
          {showMore && (
            <dl className="space-y-1.5 text-sm">
              {basics.map((b) => (
                <div key={b.label} className="flex gap-2">
                  <dt className="w-32 flex-shrink-0 text-gray-500 dark:text-gray-400">{b.label}</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{b.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </div>
  );
}

/** Platform icons and the biggest audience, for an applications list row. */
export function ApplicantReach({ profile }: { profile: ApplicantProfile | null | undefined }) {
  if (!profile || profile.accounts.length === 0) return null;
  const top = topFollowerCount(profile);
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {profile.accounts.map((a) => (
          <span key={a.platform}>{getPlatformIcon(a.platform, "sm")}</span>
        ))}
      </span>
      <span className="sr-only">
        Connected: {profile.accounts.map((a) => PLATFORM_NAMES[a.platform]).join(", ")}.
      </span>
      {top != null && <span>{formatFollowers(top)} followers</span>}
      {profile.trustScore != null && <span>· Trust {formatTrustScoreDisplay(profile.trustScore)}</span>}
    </span>
  );
}

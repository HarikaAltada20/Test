"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Eye, Film, ShieldCheck } from "lucide-react";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import { applicationDisplayStatus } from "@/lib/campaign-access";
import { formatFollowers } from "@/lib/campaign-applicant-profile";
import type { CampaignCreatorProfile } from "@/lib/campaign-creator-profile-server";
import { ApplicationStatusBadge } from "./AccessBadge";
import { AnswersList } from "./ApplicationAnswers";
import { ApplicantProfileSummary } from "./ApplicantProfileSummary";
import { CreatorAvatar } from "./CreatorAvatar";
import { RelativeTime } from "./RelativeTime";

type Props = {
  data: CampaignCreatorProfile;
  campaignPath: string;
};

const card = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5";

/**
 * Submission thumbnail over a placeholder icon. Social thumbnails expire, so a
 * failed image is hidden, including one that failed before the page hydrated.
 */
function WorkThumbnail({ src }: { src: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
const sectionTitle = "text-sm font-semibold text-gray-900 dark:text-white";

/** A creator's profile for the brand or admin reviewing them on one campaign. */
export function CreatorProfileView({ data, campaignPath }: Props) {
  const isDark = useDashboardDark();
  const { user, application } = data;
  const name = user.username ? `@${user.username}` : user.full_name || "Creator";

  return (
    <div className={cn("mx-auto max-w-4xl space-y-5 p-4 md:p-6", isDark && "dark")}>
      <Link
        href={`${campaignPath}?tab=applications`}
        className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:text-gray-300 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to {data.campaign.title || "the campaign"}
      </Link>

      <header className={cn(card, "flex flex-col gap-4 sm:flex-row sm:items-center")}>
        <CreatorAvatar
          username={user.username}
          fullName={user.full_name}
          src={user.profile_picture_url}
          className="h-16 w-16"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-white">{name}</h1>
          {user.username && user.full_name && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{user.full_name}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-gray-500 dark:text-gray-400">
            {application ? (
              <>
                <ApplicationStatusBadge
                  status={applicationDisplayStatus({ ...application, on_access_list: data.onAccessList })}
                />
                <RelativeTime value={application.created_at} prefix="Applied" />
              </>
            ) : (
              data.onAccessList && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Has access to this campaign
                </span>
              )
            )}
          </div>
        </div>
      </header>

      {user.bio && (
        <section aria-labelledby="creator-bio" className={card}>
          <h2 id="creator-bio" className={sectionTitle}>
            About
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{user.bio}</p>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <section aria-labelledby="creator-profile" className={cn(card, "lg:col-span-3")}>
          <h2 id="creator-profile" className={cn(sectionTitle, "mb-4")}>
            Profile
          </h2>
          <ApplicantProfileSummary profile={data.profile} />
        </section>

        <section aria-labelledby="creator-answers" className={cn(card, "space-y-3 lg:col-span-2")}>
          <h2 id="creator-answers" className={sectionTitle}>
            Application
          </h2>
          {application ? (
            <>
              <AnswersList answers={application.answers} />
              {application.status === "rejected" && application.rejection_reason && (
                <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-500/10 dark:text-red-200">
                  <span className="font-medium">Rejection reason:</span> {application.rejection_reason}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This creator was added to the campaign directly, without applying.
            </p>
          )}
        </section>
      </div>

      {data.recentWork && (
        <section aria-labelledby="creator-work" className={cn(card, "space-y-3")}>
          <div>
            <h2 id="creator-work" className={sectionTitle}>
              Recent work
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Approved submissions from public campaigns and your own campaigns.
            </p>
          </div>
          {data.recentWork.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No approved submissions to show yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.recentWork.map((w) => (
                <li key={w.id}>
                  <a
                    href={w.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="group block overflow-hidden rounded-xl border border-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:border-white/10"
                  >
                    <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-[#7F39EC]/20 to-[#4A00BE]/30">
                      <Film className="h-8 w-8 text-white/70" aria-hidden="true" />
                      {w.thumbnail_url && <WorkThumbnail src={w.thumbnail_url} />}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-2 text-sm font-medium text-gray-900 group-hover:text-[#7F39EC] dark:text-white dark:group-hover:text-purple-300">
                        {w.title || "View submission"}
                        <ExternalLink className="ml-1 inline h-3 w-3" aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </p>
                      {w.campaign_title && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{w.campaign_title}</p>
                      )}
                      {w.views != null && (
                        <p className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" /> {formatFollowers(w.views)} views
                        </p>
                      )}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

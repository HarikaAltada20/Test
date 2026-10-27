"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Compass,
  Eye,
  Image as ImageIcon,
  Lightbulb,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  Wallet,
  XCircle,
} from "lucide-react";
import { SOCIAL_LINKS } from "@/constants/socialLinks";
import { cn } from "@/lib/utils";

const YOUTUBE_CHANNEL = "https://www.youtube.com/@gameofcreators";

const steps = [
  {
    icon: Compass,
    title: "Browse campaigns",
    body: "Find one that fits your platform and audience. Check its requirements first.",
  },
  {
    icon: Upload,
    title: "Create & submit",
    body: "Post publicly, then submit it from your connected account within 10 days.",
  },
  {
    icon: CheckCircle2,
    title: "Content review",
    body: "The brand reviews it against the brief. Views are tracked while the campaign runs.",
  },
  {
    icon: Wallet,
    title: "Earn money",
    body: "Once payouts are processed, earnings land in your wallet. Withdraw from $5.",
  },
];

const campaignTypes = [
  {
    icon: Trophy,
    title: "Leaderboard",
    body: "The most views when the campaign ends win the prize pool, split by position.",
    example: "Top 3 split $1,000: $500, $300, $200.",
    href: "/dashboard/opportunities",
    link: "View leaderboard campaigns",
  },
  {
    icon: Eye,
    title: "CPM",
    body: "A rate for every 1,000 verified views, between a minimum and a maximum per post.",
    example: "$2 per 1,000 views → 50,000 views earns $100.",
    href: "/dashboard/opportunities",
    link: "View CPM campaigns",
  },
  {
    icon: Target,
    title: "Milestone",
    body: "Fixed rewards for reaching view thresholds, while places last.",
    example: "10K views → $5 · 100K views → $35.",
    href: "/dashboard/opportunities",
    link: "View milestone campaigns",
  },
  {
    icon: Lightbulb,
    title: "Dual rewards",
    body: "A CPM rate plus milestone rewards on top.",
    example: "$1.50 per 1,000 views, plus $20 at 100K.",
    href: "/dashboard/opportunities",
    link: "View dual rewards campaigns",
  },
];

const perks = [
  {
    icon: Wallet,
    title: "Earn money",
    body: "Get paid for content you’d make anyway: by views, milestones or prizes.",
  },
  {
    icon: ImageIcon,
    title: "Build your portfolio",
    body: "Work with real brands and keep everything you make.",
  },
  {
    icon: TrendingUp,
    title: "Grow your audience",
    body: "Campaigns reward reach, so every post can find new people.",
  },
];

export default function CreatorGettingStarted({ isDark }: { isDark: boolean }) {
  const card = cn(
    "rounded-2xl border bg-white",
    isDark
      ? "border-white/10 bg-white/5 text-white"
      : "border-[#ECEDEF] text-[#18181B]",
  );
  const muted = isDark ? "text-white/70" : "text-[#55555F]";
  const iconTile = cn(
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
    isDark ? "bg-[#F97316]/15 text-[#FDBA74]" : "bg-[#FFF3E8] text-[#E08A3A]",
  );

  return (
    <div className="mx-auto w-full max-w-[1170px] space-y-7">
      <header>
        <h1
          className={cn(
            "text-[28px] font-bold tracking-tight sm:text-[30px]",
            isDark ? "text-white" : "text-[#18181B]",
          )}
        >
          How Game of Creators works
        </h1>
        <p className={cn("mt-1.5 text-base", muted)}>
          Everything you need to join your first campaign and get paid.
        </p>
      </header>

      <section
        className={cn(
          "grid items-center gap-8 rounded-2xl border px-6 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:gap-12",
          isDark
            ? "border-[#F97316]/20 bg-[linear-gradient(180deg,rgba(249,115,22,0.1)_0%,transparent_55%)]"
            : "border-[#F6E3D2] bg-[linear-gradient(180deg,#FFF9F4_0%,#FFFFFF_52%)]",
        )}
      >
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[#E08A3A]">
            <Sparkles className="h-3.5 w-3.5" />
            Welcome
          </p>
          <h2
            className={cn(
              "mt-3 max-w-[440px] text-[22px] font-bold leading-snug sm:text-[24px]",
              isDark ? "text-white" : "text-[#18181B]",
            )}
          >
            Brands pay creators for content that performs
          </h2>
          <p
            className={cn("mt-2 max-w-[440px] text-base leading-relaxed", muted)}
          >
            Pick a campaign, post your take on it, and earn by the results. No
            pitching, no negotiating.
          </p>
          <a
            href={YOUTUBE_CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "mt-5 inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-[15px] font-medium",
              isDark
                ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
                : "border-[#E5E7EB] bg-[#F3F4F6] text-[#55555F] hover:bg-[#EAECEF]",
            )}
          >
            <span
              className={cn(
                "flex h-[18px] w-[18px] items-center justify-center rounded-full border",
                isDark ? "border-white/40" : "border-[#C4C4C8]",
              )}
            >
              <Play className="h-2 w-2 fill-current" />
            </span>
            Watch the overview
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <ul className="space-y-6">
          {perks.map((perk) => {
            const Icon = perk.icon;
            return (
              <li key={perk.title} className="flex gap-3">
                <span className={iconTile}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold leading-5">
                    {perk.title}
                  </p>
                  <p className={cn("mt-1 text-[15px] leading-6", muted)}>
                    {perk.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-[19px] font-bold tracking-tight">
          How to participate
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className={cn(card, "px-4 py-4")}>
                <div className="flex items-start justify-between">
                  <Icon
                    className="h-5 w-5 text-[#E08A3A]"
                    strokeWidth={1.75}
                  />
                  <span
                    className={cn(
                      "text-[28px] font-medium leading-none",
                      isDark ? "text-white/20" : "text-[#E6E7EB]",
                    )}
                  >
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-[15px] font-semibold">{step.title}</h3>
                <p className={cn("mt-1.5 text-[15px] leading-6", muted)}>
                  {step.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[19px] font-bold tracking-tight">Campaign types</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {campaignTypes.map((type) => {
            const Icon = type.icon;
            return (
              <article key={type.title} className={cn(card, "px-5 py-5")}>
                <span className={iconTile}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <h3 className="mt-3 text-base font-semibold">{type.title}</h3>
                <p
                  className={cn(
                    "mt-1.5 max-w-[46ch] text-[15px] leading-6",
                    muted,
                  )}
                >
                  {type.body}
                </p>
                <p
                  className={cn(
                    "mt-3 inline-flex rounded-md px-2.5 py-1 text-[13px] leading-5",
                    isDark
                      ? "bg-white/10 text-white/70"
                      : "bg-[#F3F4F6] text-[#55555F]",
                  )}
                >
                  {type.example}
                </p>
                <Link
                  href={type.href}
                  className="mt-3 flex items-center gap-1 text-[15px] font-medium text-[#D97706] hover:text-[#C2611A]"
                >
                  {type.link}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-[19px] font-bold tracking-tight">
          How verification works
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article className={cn(card, "px-5 py-5")}>
            <h3 className="text-[15px] font-semibold">What we review</h3>
            <ul
              className={cn(
                "mt-3 list-disc space-y-1.5 pl-4 text-[15px] leading-6",
                muted,
              )}
            >
              <li>It follows the campaign’s brief and rules</li>
              <li>It’s your own content, from your connected account</li>
              <li>It’s public and was posted within the window</li>
              <li>Views are real: bought or fake views are rejected</li>
            </ul>
          </article>
          <article className={cn(card, "px-5 py-5")}>
            <h3 className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#16A34A]">
              <CheckCircle2 className="h-4 w-4" />
              Approved
            </h3>
            <p className={cn("mt-3 text-[15px] leading-6", muted)}>
              It counts toward the campaign. Views keep being tracked until the
              campaign ends, then payouts are processed.
            </p>
          </article>
          <article className={cn(card, "px-5 py-5")}>
            <h3 className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#DC2626]">
              <XCircle className="h-4 w-4" />
              Rejected
            </h3>
            <p className={cn("mt-3 text-[15px] leading-6", muted)}>
              You’ll see the reason in My submissions. Rejected content stays
              there and doesn’t count.
            </p>
          </article>
        </div>
      </section>

      <section
        className={cn(
          card,
          "flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        )}
      >
        <div>
          <h2 className="text-lg font-bold">Ready to start?</h2>
          <p className={cn("mt-1 text-[15px]", muted)}>
            Find your first campaign, or join the community for updates and
            bonus codes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/opportunities"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#F97316] px-4 text-[15px] font-semibold text-white hover:bg-[#EA6A0C]"
          >
            Browse campaigns
          </Link>
          <a
            href={SOCIAL_LINKS.discord}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-10 items-center justify-center gap-1 rounded-full border bg-white px-3.5 text-[15px] font-medium",
              isDark
                ? "border-white/15 bg-transparent text-white hover:bg-white/10"
                : "border-[#E5E7EB] text-[#55555F] hover:bg-[#F9FAFB]",
            )}
          >
            Discord
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <a
            href={SOCIAL_LINKS.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-10 items-center justify-center gap-1 rounded-full border bg-white px-3.5 text-[15px] font-medium",
              isDark
                ? "border-white/15 bg-transparent text-white hover:bg-white/10"
                : "border-[#E5E7EB] text-[#55555F] hover:bg-[#F9FAFB]",
            )}
          >
            WhatsApp
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
}

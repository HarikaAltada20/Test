"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Award,
  CheckCircle2,
  DollarSign,
  Lightbulb,
  Phone,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Video,
  XCircle,
} from "lucide-react";
import { CALENDLY_FOUNDER_URL } from "@/constants/brandPartnershipForm";
import { cn } from "@/lib/utils";

const BRAND_OVERVIEW_VIDEO = "https://www.youtube.com/watch?v=kV4dXlWR8sY";

const steps = [
  {
    icon: Video,
    title: "Create Campaign",
    body: "Set your brief, budget, and campaign type (Leaderboard or CPM)",
  },
  {
    icon: Users,
    title: "Creators Submit",
    body: "Talented creators create and submit videos based on your brief",
  },
  {
    icon: CheckCircle2,
    title: "Content Review",
    body: "We review submissions to ensure quality and brand safety",
  },
  {
    icon: TrendingUp,
    title: "Get Results",
    body: "Receive viral content and pay creators based on performance",
  },
];

const campaignTypes = [
  {
    icon: Trophy,
    title: "Leaderboard",
    body: "Set a prize pool. Creators compete for views. Top performers win — you own the content.",
    example: "$1,000 pool — 1st gets $500, 2nd $300, 3rd $200",
    href: "/dashboard/contests/create",
    link: "Create Leaderboard Campaign",
  },
  {
    icon: DollarSign,
    title: "CPM",
    body: "Pay creators only for the views they generate. More views = more reach, no wasted budget.",
    example: "$1 per 1K views — 50K views = $50 total payment",
    href: "/dashboard/contests/create",
    link: "Create CPM Campaign",
  },
  {
    icon: Target,
    title: "Milestone",
    body: "Reward creators as they hit specific view milestones. Guaranteed payouts for guaranteed results.",
    example: "$50 at 10K views, $100 at 50K views, $500 at 1M views",
    href: "/dashboard/contests/create",
    link: "Create Milestone Campaign",
  },
  {
    icon: Award,
    title: "Dual rewards",
    body: "Combine CPM payouts and milestone targets in one campaign for balanced growth and outcomes.",
    example: "CPM at $0.20 per 1K views plus a $120 milestone at 50K views",
    href: "/dashboard/contests/create",
    link: "Create Dual Rewards Campaign",
  },
];

const perks = [
  {
    icon: TrendingUp,
    title: "Viral Content",
    body: "Get authentic, engaging videos that resonate with your target audience",
  },
  {
    icon: Users,
    title: "Reach New Audiences",
    body: "Tap into creators' existing audiences and expand your brand reach",
  },
  {
    icon: DollarSign,
    title: "Cost Effective",
    body: "Pay only for performance with flexible budget options",
  },
];

export default function BrandGettingStarted({ isDark }: { isDark: boolean }) {
  const card = cn(
    "rounded-2xl border bg-white",
    isDark
      ? "border-white/10 bg-white/5 text-white"
      : "border-[#ECEDEF] text-[#18181B]",
  );
  const muted = isDark ? "text-white/70" : "text-[#55555F]";
  const iconTile = cn(
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
    isDark ? "bg-[#7C3AED]/20 text-[#C4B5FD]" : "bg-[#F3EEFF] text-[#7C3AED]",
  );
  const accentIcon = "text-[#7C3AED]";
  const accentLink =
    "text-[#7C3AED] hover:text-[#6D28D9] dark:text-[#C4B5FD] dark:hover:text-[#DDD6FE]";

  return (
    <div className="mx-auto w-full max-w-[1170px] space-y-7">
      <header>
        <h1
          className={cn(
            "text-[28px] font-bold tracking-tight sm:text-[30px]",
            isDark ? "text-white" : "text-[#18181B]",
          )}
        >
          Getting Started with Game Of Creators
        </h1>
        <p className={cn("mt-1.5 text-base", muted)}>
          Learn how to create engaging content campaigns
        </p>
      </header>

      <section
        className={cn(
          "grid items-center gap-8 rounded-2xl border px-6 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,0.95fr)] lg:gap-12",
          isDark
            ? "border-[#7C3AED]/25 bg-[linear-gradient(180deg,rgba(124,58,237,0.12)_0%,transparent_55%)]"
            : "border-[#E9D8FF] bg-[linear-gradient(180deg,#F7F2FF_0%,#FFFFFF_52%)]",
        )}
      >
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7C3AED]">
            <Sparkles className="h-3.5 w-3.5" />
            Welcome
          </p>
          <h2
            className={cn(
              "mt-3 max-w-[440px] text-[22px] font-bold leading-snug sm:text-[24px]",
              isDark ? "text-white" : "text-[#18181B]",
            )}
          >
            Welcome to Game Of Creators
          </h2>
          <p
            className={cn("mt-2 max-w-[440px] text-base leading-relaxed", muted)}
          >
            <strong>Game Of Creators</strong> connects brands with talented
            content creators through engaging video campaigns. Launch campaigns,
            get viral content, and reach new audiences. Simple and effective.
          </p>
          <a
            href={BRAND_OVERVIEW_VIDEO}
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
        <h2 className="text-[19px] font-bold tracking-tight">How It Works</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <article key={step.title} className={cn(card, "px-4 py-4")}>
                <div className="flex items-start justify-between">
                  <Icon className={cn("h-5 w-5", accentIcon)} strokeWidth={1.75} />
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
        <h2 className="text-[19px] font-bold tracking-tight">
          Choose Your Campaign Type
        </h2>
        <p className={cn("mt-1 text-sm", muted)}>
          Pick the model that fits your goal — you can always try both.
        </p>
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
                  className={cn(
                    "mt-3 flex items-center gap-1 text-[15px] font-medium",
                    accentLink,
                  )}
                >
                  {type.link}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            );
          })}
        </div>
        {/* <div
          className={cn(
            "mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border px-5 py-4 text-sm sm:flex-row",
            isDark
              ? "border-[#7C3AED]/20 bg-[#7C3AED]/10 text-[#C4B5FD]"
              : "border-[#E9D8FF] bg-[#F9F5FF] text-[#55555F]",
          )}
        >
          <span>Not sure which to pick?</span>
          <a
            href={CALENDLY_FOUNDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#7C3AED] underline underline-offset-2 hover:text-[#6D28D9]"
          >
            Book a free call — we&apos;ll help you decide
          </a>
        </div> */}
      </section>

      <section>
        <h2 className="text-[19px] font-bold tracking-tight">
          Content Quality & Safety
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <article className={cn(card, "px-5 py-5")}>
            <h3 className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
              <Lightbulb className={cn("h-4 w-4", accentIcon)} />
              What we review
            </h3>
            <p className={cn("mt-3 text-[15px] leading-6", muted)}>
              We ensure all content meets high quality standards and brand
              safety guidelines before it goes live in your campaign.
            </p>
          </article>
          <article className={cn(card, "px-5 py-5")}>
            <h3 className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#16A34A]">
              <CheckCircle2 className="h-4 w-4" />
              Approved
            </h3>
            <p className={cn("mt-3 text-[15px] leading-6", muted)}>
              Approved content counts toward your campaign results and can be
              used according to your campaign terms.
            </p>
          </article>
          <article className={cn(card, "px-5 py-5")}>
            <h3 className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#DC2626]">
              <XCircle className="h-4 w-4" />
              Rejected
            </h3>
            <p className={cn("mt-3 text-[15px] leading-6", muted)}>
              Content that doesn&apos;t meet the brief or safety standards is
              rejected and does not count toward results.
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
          <h2 className="text-lg font-bold">Ready to Start?</h2>
          <p className={cn("mt-1 text-[15px]", muted)}>
            Start creating campaigns
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/contests/create"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#7C3AED] px-4 text-[15px] font-semibold text-white hover:bg-[#6D28D9]"
          >
            Create Campaign
          </Link>
          <a
            href={CALENDLY_FOUNDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[15px] font-medium",
              isDark
                ? "border-white/15 bg-transparent text-white hover:bg-white/10"
                : "border-[#E5E7EB] bg-white text-[#55555F] hover:bg-[#F9FAFB]",
            )}
          >
            <Phone className="h-4 w-4" />
            Book a Call with the Founder
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { Briefcase, Eye, Send, Shield, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type AudienceBreakdown = {
  sent: number;
  read: number;
};

export type CampaignSummaryStats = {
  sent: number;
  read: number;
  readPercent: number;
  byType: Record<string, AudienceBreakdown>;
};

type Props = {
  summary: CampaignSummaryStats;
  isDark?: boolean;
};

const cardClass = (isDark?: boolean) =>
  cn(
    "rounded-xl border p-4 flex flex-col gap-3 min-h-[108px] shadow-sm",
    isDark ? "border-white/10 bg-[#170337]" : "border-border/80 bg-white",
  );

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  isDark,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  isDark?: boolean;
}) {
  return (
    <div className={cardClass(isDark)}>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-md font-medium tracking-wide",
            isDark ? "text-gray-300" : "text-gray-700",
          )}
        >
          {label}
        </p>
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            isDark
              ? "bg-[#FFFFFF24] text-purple-200"
              : "bg-[#D8C3FF] text-[#4A00BE]",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p
          className={cn(
            "text-2xl font-bold tabular-nums leading-none",
            isDark ? "text-white" : "text-foreground",
          )}
        >
          {value}
        </p>
        {sublabel && (
          <p
            className={cn(
              "text-xs mt-1.5",
              isDark ? "text-gray-400" : "text-muted-foreground",
            )}
          >
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}

export function CampaignNotificationStats({ summary, isDark }: Props) {
  const { sent, read, byType } = summary;
  const creator = byType.creator;
  const advertiser = byType.advertiser;
  const admin = byType.admin;

  const audienceCards: Array<{
    key: string;
    title: string;
    data: AudienceBreakdown;
    icon: LucideIcon;
  }> = [];

  if (creator?.sent > 0) {
    audienceCards.push({
      key: "creator",
      title: "Creators",
      data: creator,
      icon: Users,
    });
  }
  if (advertiser?.sent > 0) {
    audienceCards.push({
      key: "advertiser",
      title: "Advertisers",
      data: advertiser,
      icon: Briefcase,
    });
  }
  if (admin?.sent > 0) {
    audienceCards.push({
      key: "admin",
      title: "Admin",
      data: admin,
      icon: Shield,
    });
  }

  const totalCols =
    2 + audienceCards.length <= 4 ? 2 + audienceCards.length : 4;

  return (
    <div
      className={cn(
        "grid gap-3",
        totalCols === 2 && "grid-cols-1 sm:grid-cols-2",
        totalCols === 3 && "grid-cols-1 sm:grid-cols-3",
        totalCols >= 4 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
      )}
    >
      <StatCard
        label="Sent"
        value={sent}
        // sublabel={
        //   sent === 1 ? "notification delivered" : "notifications delivered"
        // }
        icon={Send}
        isDark={isDark}
      />
      <StatCard
        label="Read"
        value={read}
        // sublabel={
        //   sent > 0 ? "recipients opened" : "No deliveries yet"
        // }
        icon={Eye}
        isDark={isDark}
      />
      {audienceCards.map(({ key, title, data, icon }) => (
        <StatCard
          key={key}
          label={title}
          value={`${data.read} / ${data.sent}`}
          // sublabel="read"
          icon={icon}
          isDark={isDark}
        />
      ))}
    </div>
  );
}

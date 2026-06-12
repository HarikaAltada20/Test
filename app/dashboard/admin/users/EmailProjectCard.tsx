"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Eye,
  Globe,
  Mail,
  Pencil,
  Settings,
  Users,
} from "lucide-react";

export type EmailProjectCardData = {
  id: string;
  name: string;
  description?: string | null;
  niche?: string | null;
  project_type?: string | null;
  website_url?: string | null;
  target_audience?: string | null;
  brand_voice?: string | null;
  status?: string;
  full_domain?: string | null;
  use_platform_sender?: boolean;
  ses_verification_status: string;
  created_at: string;
  updated_at?: string;
  daily_limit?: number;
  schedule_from_time?: string;
  schedule_to_time?: string;
  schedule_timezone?: string;
  send_interval_seconds?: number;
  stats?: {
    campaignCount: number;
    recipientTotal: number;
    sentTotal: number;
  };
};

type Props = {
  project: EmailProjectCardData;
  isDark?: boolean;
  onView: () => void;
  onEdit: () => void;
  onConfigureEmail: () => void;
  onManageSenders: () => void;
  onScheduleSettings: () => void;
};

export function EmailProjectCard({
  project,
  isDark,
  onView,
  onEdit,
  onConfigureEmail,
  onManageSenders,
  onScheduleSettings,
}: Props) {
  const verified = project.ses_verification_status === "verified";
  const stats = project.stats ?? {
    campaignCount: 0,
    recipientTotal: 0,
    sentTotal: 0,
  };

  return (
    <div
      className={cn(
        "rounded-xl border overflow-hidden flex flex-col lg:flex-row",
        isDark ? "bg-[#170337] border-purple-900/40" : "bg-white border-gray-200",
      )}
    >
      <div className="flex-1 p-5 space-y-3 min-w-0">
        <div className="flex flex-wrap items-start gap-2">
          <h3
            className={cn(
              "text-xl font-bold",
              isDark ? "text-white" : "text-gray-900",
            )}
          >
            {project.name}
          </h3>
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 capitalize">
            {project.status ?? "active"}
          </Badge>
        </div>

        {project.description && (
          <p
            className={cn(
              "text-sm line-clamp-2",
              isDark ? "text-gray-400" : "text-gray-500",
            )}
          >
            {project.description}
          </p>
        )}

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {project.website_url && (
            <a
              href={project.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
            >
              <Globe className="h-4 w-4 shrink-0" />
              {project.website_url}
            </a>
          )}
          {project.target_audience && (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4 shrink-0" />
              {project.target_audience}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-4 pt-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-4 w-4" />
            {stats.sentTotal}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {stats.recipientTotal}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4" />
            {stats.campaignCount}
          </span>
        </div>
      </div>

      <div
        className={cn(
          "lg:w-72 shrink-0 p-5 border-t lg:border-t-0 lg:border-l space-y-3",
          isDark ? "border-purple-900/40 bg-[#1a0540]/50" : "border-gray-100 bg-gray-50/50",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm">Email Config</span>
          {verified ? (
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1">
              <AlertCircle className="h-3 w-3" />
              Not Verified
            </Badge>
          )}
        </div>

        {verified && project.full_domain && (
          <div className="text-sm">
            <span className="text-muted-foreground">Domain</span>
            <p className="font-medium break-all">{project.full_domain}</p>
          </div>
        )}

        {project.use_platform_sender && (
          <p className="text-xs text-muted-foreground">Using platform sender</p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            onClick={onView}
          >
            <Eye className="h-4 w-4 mr-1" />
            View
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>

        {!verified && !project.use_platform_sender ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-orange-400 text-orange-600 hover:bg-orange-50"
            onClick={onConfigureEmail}
          >
            <Settings className="h-4 w-4 mr-1" />
            Configure Email
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-purple-300 text-purple-700"
              onClick={onManageSenders}
            >
              <Mail className="h-4 w-4 mr-1" />
              Manage Senders
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full border-blue-300 text-blue-700"
              onClick={onScheduleSettings}
            >
              <Clock className="h-4 w-4 mr-1" />
              Schedule Settings
            </Button>
          </>
        )}

        <p className="text-xs text-muted-foreground pt-1">
          Created {new Date(project.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

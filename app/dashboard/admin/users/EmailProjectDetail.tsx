"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  Mail,
  Settings,
  Timer,
  UserPlus,
} from "lucide-react";

type ProjectSender = {
  id: string;
  email: string;
  is_default: boolean;
  ses_verified: boolean;
};

export type EmailProjectDetailData = {
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
  dns_records?: unknown;
  created_at: string;
  updated_at: string;
  daily_limit?: number;
  schedule_from_time?: string;
  schedule_to_time?: string;
  schedule_timezone?: string;
  send_interval_seconds?: number;
  senders?: ProjectSender[];
  stats?: {
    campaignCount: number;
    recipientTotal: number;
    sentTotal: number;
  };
};

type EmailCampaign = {
  id: string;
  name: string;
  status: string;
  recipient_count: number;
  created_at: string;
};

type Props = {
  projectId: string;
  isDark?: boolean;
  onBack: () => void;
  onConfigureEmail: () => void;
  onManageSenders: () => void;
  onConfigureScheduling: () => void;
  onCheckStatus: () => void;
  onCampaignClick: (campaignId: string) => void;
};

function formatTzLabel(tz?: string) {
  if (tz === "Asia/Kolkata") return "UTC+330";
  return "UTC";
}

export function EmailProjectDetail({
  projectId,
  isDark,
  onBack,
  onConfigureEmail,
  onManageSenders,
  onConfigureScheduling,
  onCheckStatus,
  onCampaignClick,
}: Props) {
  const [project, setProject] = useState<EmailProjectDetailData | null>(null);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectRes, campaignsRes] = await Promise.all([
        fetch(`/api/admin/email-projects/${projectId}`),
        fetch(`/api/admin/email-campaigns?projectId=${projectId}`),
      ]);
      const projectData = await projectRes.json();
      const campaignsData = await campaignsRes.json();
      if (projectRes.ok) setProject(projectData.project);
      setCampaigns(campaignsData.campaigns ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const createCampaign = async () => {
    if (!newCampaignName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: newCampaignName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCampaigns((prev) => [data.campaign, ...prev]);
        setNewCampaignName("");
        load();
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading || !project) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const verified = project.ses_verification_status === "verified";
  const domain =
    project.full_domain ??
    (project.use_platform_sender ? "Platform sender" : "Not configured");
  const dailyLimit = project.daily_limit ?? 300;
  const sentToday = project.stats?.sentTotal ?? 0;
  const remaining = Math.max(0, dailyLimit - sentToday);
  const usagePercent = dailyLimit > 0 ? (sentToday / dailyLimit) * 100 : 0;

  const cardClass = cn(
    "rounded-xl border shadow-sm",
    isDark ? "bg-[#1a0540] border-purple-900/40" : "bg-white border-gray-200",
  );

  const innerPanelClass = cn(
    "rounded-lg border p-4",
    isDark ? "border-purple-900/40 bg-[#12032e]" : "border-gray-200 bg-white",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {project.description && (
            <p
              className={cn(
                "text-sm max-w-2xl",
                isDark ? "text-gray-300" : "text-gray-600",
              )}
            >
              {project.description}
            </p>
          )}
        </div>
        <Button variant="outline" onClick={onBack}>
          Back to Projects
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Project Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Website</p>
              {project.website_url ? (
                <a
                  href={project.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline break-all"
                >
                  {project.website_url}
                </a>
              ) : (
                <p>—</p>
              )}
            </div>
            <InfoRow
              label="Target Audience"
              value={project.target_audience ?? "—"}
            />
          </CardContent>
        </Card>

        <Card className={cardClass}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Project Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow
              label="Created"
              value={new Date(project.created_at).toLocaleDateString()}
            />
            <InfoRow
              label="Last Updated"
              value={new Date(project.updated_at).toLocaleDateString()}
            />
            <div>
              <p className="text-muted-foreground text-xs mb-1">Status</p>
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 capitalize">
                {project.status ?? "active"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={cardClass}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-base">Email Management</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your email domain, verified emails, and warm-up configurations
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-green-500 text-green-700 hover:bg-green-50"
              onClick={onCheckStatus}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Check Status
            </Button>
            <Button
              size="sm"
              className="bg-purple-600 hover:bg-purple-700"
              onClick={onConfigureEmail}
            >
              Configure Email
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn("flex items-center justify-between", innerPanelClass)}>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email Subdomain</p>
                <p className="font-semibold">{domain}</p>
              </div>
            </div>
            {verified ? (
              <Badge className="bg-green-100 text-green-800 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Verified
              </Badge>
            ) : (
              <Badge className="bg-amber-100 text-amber-800">Not Verified</Badge>
            )}
          </div>

          {project.full_domain && (
            <div>
              <p className="text-sm font-medium">Sending From Subdomain</p>
              <p className="text-sm text-muted-foreground">{project.full_domain}</p>
            </div>
          )}

          <div
            className={cn(
              "rounded-lg p-4 border",
              verified
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p
                  className={cn(
                    "font-semibold text-sm",
                    verified ? "text-green-800" : "text-amber-800",
                  )}
                >
                  AWS SES Subdomain Verification
                </p>
                <p
                  className={cn(
                    "text-sm mt-1",
                    verified ? "text-green-700" : "text-amber-700",
                  )}
                >
                  {verified
                    ? "Subdomain verified with AWS SES – Ready for bulk sending"
                    : "Subdomain not yet verified — add DNS records and check status"}
                </p>
                {verified && (
                  <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    DKIM authentication enabled
                  </p>
                )}
              </div>
              {verified && (
                <Badge className="bg-green-100 text-green-800 shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
          </div>

          {verified && (
            <div className={cn("space-y-3", innerPanelClass)}>
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Sender Email Management
                </p>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={onManageSenders}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Manage Sender Emails
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Your subdomain is verified with AWS SES. Send from any address
                under {project.full_domain} without individual verification.
              </p>
              {(project.senders ?? []).length > 0 && (
                <ul className="text-sm space-y-1">
                  {project.senders!.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      {s.email}
                      {s.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          default
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-base">Email Scheduling Settings</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure when and how many emails to send per day
            </p>
          </div>
          <Button
            size="sm"
            className="bg-purple-600 hover:bg-purple-700 shrink-0"
            onClick={onConfigureScheduling}
          >
            <Settings className="h-4 w-4 mr-1" />
            Configure Scheduling
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ScheduleStat
              icon={<BarChart3 className="h-5 w-5 text-purple-600" />}
              label="Daily Limit"
              value={String(dailyLimit)}
              sub="emails per day"
            />
            <ScheduleStat
              icon={<Timer className="h-5 w-5 text-purple-600" />}
              label="Send Interval"
              value={`${project.send_interval_seconds ?? 60}s`}
              sub="between emails"
            />
            <ScheduleStat
              icon={<Globe className="h-5 w-5 text-purple-600" />}
              label="Timezone"
              value={formatTzLabel(project.schedule_timezone)}
              sub="local timezone"
            />
            <ScheduleStat
              icon={<Calendar className="h-5 w-5 text-purple-600" />}
              label="Schedule"
              value={`${project.schedule_from_time ?? "09:00"} - ${project.schedule_to_time ?? "21:00"}`}
              sub="daily hours"
            />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-blue-900">Today&apos;s Email Usage</span>
              <span className="font-semibold text-blue-800">
                {sentToday} / {dailyLimit}
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
            <p className="text-xs text-blue-600">
              Remaining: {remaining} emails today
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className={cardClass}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label>New campaign</Label>
              <Input
                placeholder="Summer contest blast"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
              />
            </div>
            <Button
              onClick={createCampaign}
              disabled={creating || !newCampaignName.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              + New campaign
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onCampaignClick(c.id)}
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.recipient_count}</TableCell>
                  <TableCell>
                    <Badge className="capitalize">{c.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground"
                  >
                    No campaigns yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function ScheduleStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="text-center space-y-1">
      <div className="flex justify-center">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-purple-700">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

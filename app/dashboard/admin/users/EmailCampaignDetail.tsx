"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Pause, Play } from "lucide-react";
import {
  EmailCampaignDetailSkeleton,
} from "./EmailSkeletons";
import { useToast } from "@/hooks/use-toast";
import {
  CampaignUnderlineTabs,
  type CampaignDetailTab,
} from "./email-campaign-detail/CampaignUnderlineTabs";
import { AnalyticsTab } from "./email-campaign-detail/AnalyticsTab";
import { LeadTab } from "./email-campaign-detail/LeadTab";
import { SequenceProvider } from "./email-campaign-detail/sequence/sequence-context";
import { SequenceTab } from "./email-campaign-detail/sequence/SequenceTab";
import { ScheduleTab } from "./email-campaign-detail/ScheduleTab";
import { OptionTab } from "./email-campaign-detail/OptionTab";
import { getCampaignStartReadiness } from "@/lib/admin-email/campaign-readiness";

type CampaignDetail = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  status: string;
  recipientCount: number;
  sentCount: number;
  remainingCount: number;
  progressPercent: number;
  emailSubject: string | null;
  messageTemplate: string | null;
  fromEmail: string | null;
  startedAt: string | null;
  estimatedCompletionAt: string | null;
  summary: {
    openRate: number;
    openCount: number;
    clickRate: number;
    clickCount: number;
  };
};

type Props = {
  campaignId: string;
  isDark?: boolean;
  onBack: () => void;
};

function TabPanel({
  tab,
  activeTab,
  visited,
  children,
}: {
  tab: CampaignDetailTab;
  activeTab: CampaignDetailTab;
  visited: boolean;
  children: ReactNode;
}) {
  if (!visited) return null;
  return (
    <div className={activeTab === tab ? undefined : "hidden"} aria-hidden={activeTab !== tab}>
      {children}
    </div>
  );
}

export function EmailCampaignDetail({ campaignId, onBack }: Props) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CampaignDetailTab>("analytics");
  const [visitedTabs, setVisitedTabs] = useState<Set<CampaignDetailTab>>(
    () => new Set(["analytics"]),
  );
  const [starting, setStarting] = useState(false);

  const loadDetail = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch(`/api/admin/email-campaigns/${campaignId}`);
      const data = await res.json();
      if (res.ok) {
        setDetail(data);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    setDetail(null);
    setActiveTab("analytics");
    setVisitedTabs(new Set(["analytics"]));
    loadDetail();
  }, [campaignId, loadDetail]);

  useEffect(() => {
    const onFocus = () => loadDetail({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadDetail]);

  const handleTabChange = useCallback((tab: CampaignDetailTab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const pauseCampaign = async () => {
    const res = await fetch(`/api/admin/email-campaigns/${campaignId}/pause`, {
      method: "POST",
    });
    if (res.ok) {
      toast({ title: "Campaign paused" });
      loadDetail({ silent: true });
    }
  };

  const startCampaign = async () => {
    const readiness = getCampaignStartReadiness({
      recipientCount: detail?.recipientCount,
      emailSubject: detail?.emailSubject,
      messageTemplate: detail?.messageTemplate,
      fromEmail: detail?.fromEmail,
    });
    if (!readiness.canStart) {
      toast({
        title: "Campaign not ready",
        description: readiness.disabledReason ?? "Complete setup before starting",
        variant: "destructive",
      });
      return;
    }
    setStarting(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/start`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Campaign started" });
      loadDetail({ silent: true });
    } finally {
      setStarting(false);
    }
  };

  if (loading && !detail) {
    return <EmailCampaignDetailSkeleton />;
  }

  if (!detail) {
    return null;
  }

  const canPause = ["active", "scheduled"].includes(detail.status);
  const canStart = !["active", "scheduled", "completed"].includes(detail.status);
  const startReadiness = getCampaignStartReadiness({
    recipientCount: detail.recipientCount,
    emailSubject: detail.emailSubject,
    messageTemplate: detail.messageTemplate,
    fromEmail: detail.fromEmail,
  });
  const sequenceReadOnly = ["active", "completed", "partial"].includes(
    detail.status,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-gray-900"
        >
          ← All campaigns
        </button>

        <div className="flex gap-2">
          {canStart && (
            <span
              className="inline-flex"
              title={startReadiness.disabledReason ?? undefined}
            >
              <Button
                className="bg-[#662EBD] hover:bg-[#5524a8] disabled:opacity-50"
                onClick={startCampaign}
                disabled={starting || !startReadiness.canStart}
              >
              {starting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start Campaign
              </Button>
            </span>
          )}
          {canPause && (
            <Button
              className="bg-[#662EBD] hover:bg-[#5524a8]"
              onClick={pauseCampaign}
            >
              <Pause className="mr-2 h-4 w-4" />
              Pause Campaign
            </Button>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900">{detail.name}</h2>
        <p className="text-sm text-muted-foreground">{detail.projectName}</p>
      </div>

      <CampaignUnderlineTabs activeTab={activeTab} onTabChange={handleTabChange} />

      <TabPanel tab="analytics" activeTab={activeTab} visited={visitedTabs.has("analytics")}>
        <AnalyticsTab campaignId={campaignId} detail={detail} />
      </TabPanel>

      <TabPanel tab="lead" activeTab={activeTab} visited={visitedTabs.has("lead")}>
        <LeadTab
          campaignId={campaignId}
          campaignName={detail.name}
          onRecipientsChange={() => loadDetail({ silent: true })}
        />
      </TabPanel>

      <TabPanel tab="sequence" activeTab={activeTab} visited={visitedTabs.has("sequence")}>
        <SequenceProvider campaignId={campaignId}>
          <SequenceTab
            campaign={{
              id: campaignId,
              projectId: detail.projectId,
              name: detail.name,
              status: detail.status,
            }}
            readOnly={sequenceReadOnly}
            onSaved={() => loadDetail({ silent: true })}
          />
        </SequenceProvider>
      </TabPanel>

      <TabPanel tab="schedule" activeTab={activeTab} visited={visitedTabs.has("schedule")}>
        <ScheduleTab campaignId={campaignId} projectId={detail.projectId} />
      </TabPanel>

      <TabPanel tab="option" activeTab={activeTab} visited={visitedTabs.has("option")}>
        <OptionTab
          campaignId={campaignId}
          onSaved={() => loadDetail({ silent: true })}
        />
      </TabPanel>
    </div>
  );
}

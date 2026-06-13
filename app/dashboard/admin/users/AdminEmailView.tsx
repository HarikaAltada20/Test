"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { cn } from "@/lib/utils";
import type { EmailCampaignListItem } from "@/lib/admin-email/campaign-list";
import { Loader2, Plus } from "lucide-react";
import { CreateEmailProjectForm } from "./CreateEmailProjectForm";
import { CreateEmailCampaignModal } from "./CreateEmailCampaignModal";
import { EmailProjectConfigWizard } from "./EmailProjectConfigWizard";
import { EmailProjectCard, type EmailProjectCardData } from "./EmailProjectCard";
import { EmailProjectDetail } from "./EmailProjectDetail";
import { EmailSchedulingDialog } from "./EmailSchedulingDialog";
import { SenderEmailManagementDialog } from "./SenderEmailManagementDialog";
import { EmailCampaignDetail } from "./EmailCampaignDetail";
import { EmailCampaignsList } from "./EmailCampaignsList";
import { MAX_PROJECT_DESCRIPTION_LENGTH } from "@/lib/admin-email/project-options";

type ViewMode = "list" | "create" | "project";
type ListTab = "projects" | "campaigns";

type Props = {
  isDark?: boolean;
  highlightCampaignId?: string | null;
  onHighlightConsumed?: () => void;
};

export function AdminEmailView({
  isDark,
  highlightCampaignId,
  onHighlightConsumed,
}: Props) {
  const [projects, setProjects] = useState<EmailProjectCardData[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaignListItem[]>([]);
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [listTab, setListTab] = useState<ListTab>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    highlightCampaignId ?? null,
  );
  const [configProjectId, setConfigProjectId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sendersOpen, setSendersOpen] = useState(false);
  const [sendersProjectId, setSendersProjectId] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleProjectMeta, setScheduleProjectMeta] = useState<{
    name?: string;
    dailyLimit?: number;
    sentToday?: number;
    sendIntervalSeconds?: number;
    scheduleTimezone?: string;
  }>({});

  const [editName, setEditName] = useState("");
  const [editWebsiteUrl, setEditWebsiteUrl] = useState("");
  const [editTargetAudience, setEditTargetAudience] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, campaignsRes] = await Promise.all([
        fetch("/api/admin/email-projects"),
        fetch("/api/admin/email-campaigns"),
      ]);
      const projectsData = await projectsRes.json();
      const campaignsData = await campaignsRes.json();
      setProjects(projectsData.projects ?? []);
      setCampaigns(campaignsData.campaigns ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (highlightCampaignId) {
      setSelectedCampaignId(highlightCampaignId);
      setListTab("campaigns");
      onHighlightConsumed?.();
    }
  }, [highlightCampaignId, onHighlightConsumed]);

  const openEdit = (project: EmailProjectCardData) => {
    setSelectedProjectId(project.id);
    setEditName(project.name);
    setEditWebsiteUrl(project.website_url ?? "");
    setEditTargetAudience(project.target_audience ?? "");
    setEditDescription(project.description ?? "");
    setEditOpen(true);
  };

  const openSchedule = async (projectId: string) => {
    setSelectedProjectId(projectId);
    const res = await fetch(`/api/admin/email-projects/${projectId}`);
    const data = await res.json();
    if (res.ok) {
      const p = data.project;
      setScheduleProjectMeta({
        name: p.name,
        dailyLimit: p.daily_limit ?? 300,
        sentToday: p.stats?.sentTotal ?? 0,
        sendIntervalSeconds: p.send_interval_seconds ?? 60,
        scheduleTimezone: p.schedule_timezone ?? "UTC",
      });
    }
    setScheduleOpen(true);
  };

  const openConfig = (projectId: string) => {
    setConfigProjectId(projectId);
    setConfigOpen(true);
  };

  const checkStatus = async (projectId: string) => {
    await fetch(`/api/admin/email-projects/${projectId}/verify-ses`, {
      method: "POST",
    });
    loadData();
  };

  const openManageSenders = (projectId: string) => {
    setSendersProjectId(projectId);
    setSendersOpen(true);
  };

  const saveEdit = async () => {
    if (!selectedProjectId) return;
    await fetch(`/api/admin/email-projects/${selectedProjectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        websiteUrl: editWebsiteUrl,
        targetAudience: editTargetAudience,
        description: editDescription,
      }),
    });
    setEditOpen(false);
    loadData();
  };

  if (selectedCampaignId) {
    return (
      <Card className={cn("rounded-xl shadow", isDark ? "bg-[#170337]" : "bg-white")}>
        <CardContent className="p-6">
          <EmailCampaignDetail
            campaignId={selectedCampaignId}
            isDark={isDark}
            onBack={() => setSelectedCampaignId(null)}
          />
        </CardContent>
      </Card>
    );
  }

  if (loading && viewMode === "list") {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (viewMode === "create") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-gray-900")}>
            Projects
          </h2>
          <p className="text-sm text-muted-foreground">Manage your marketing projects</p>
        </div>
        <CreateEmailProjectForm
          isDark={isDark}
          onCancel={() => setViewMode("list")}
          onCreated={async () => {
            await loadData();
            setViewMode("list");
          }}
        />
      </div>
    );
  }

  if (viewMode === "project" && selectedProjectId) {
    return (
      <>
        <EmailProjectDetail
          projectId={selectedProjectId}
          isDark={isDark}
          onBack={() => {
            setViewMode("list");
            setSelectedProjectId(null);
          }}
          onConfigureEmail={() => openConfig(selectedProjectId)}
          onManageSenders={() => openManageSenders(selectedProjectId)}
          onConfigureScheduling={() => openSchedule(selectedProjectId)}
          onCheckStatus={() => checkStatus(selectedProjectId)}
        />

        <EmailProjectConfigWizard
          open={configOpen}
          projectId={configProjectId}
          projectName={projects.find((p) => p.id === configProjectId)?.name}
          onOpenChange={setConfigOpen}
          onComplete={loadData}
        />

        <EmailSchedulingDialog
          open={scheduleOpen}
          projectId={selectedProjectId}
          projectName={scheduleProjectMeta.name}
          dailyLimit={scheduleProjectMeta.dailyLimit}
          sentToday={scheduleProjectMeta.sentToday}
          sendIntervalSeconds={scheduleProjectMeta.sendIntervalSeconds}
          scheduleTimezone={scheduleProjectMeta.scheduleTimezone}
          onOpenChange={setScheduleOpen}
          onSaved={loadData}
        />

        <SenderEmailManagementDialog
          open={sendersOpen}
          projectId={sendersProjectId}
          onOpenChange={setSendersOpen}
          onUpdated={loadData}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className={cn("text-2xl font-bold", isDark ? "text-white" : "text-gray-900")}>
              Projects
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your marketing projects and campaigns
            </p>
          </div>
          {listTab === "projects" && (
            <Button
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => setViewMode("create")}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Project
            </Button>
          )}
        </div>

        <EnhancedTabs
          tabs={[
            { id: "projects", label: `Projects (${projects.length})` },
            { id: "campaigns", label: `Campaigns (${campaigns.length})` },
          ]}
          activeTab={listTab}
          onTabChange={(id) => setListTab(id as ListTab)}
          className="w-full max-w-md"
          isDark={isDark}
          light
          fillWidth={false}
        />

        {listTab === "projects" && (
          <div className="space-y-4">
            {projects.map((p) => (
              <EmailProjectCard
                key={p.id}
                project={p}
                isDark={isDark}
                onView={() => {
                  setSelectedProjectId(p.id);
                  setViewMode("project");
                }}
                onEdit={() => openEdit(p)}
                onConfigureEmail={() => openConfig(p.id)}
                onManageSenders={() => openManageSenders(p.id)}
                onScheduleSettings={() => openSchedule(p.id)}
              />
            ))}
            {projects.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                No projects yet. Click Create Project to get started.
              </p>
            )}
          </div>
        )}

        {listTab === "campaigns" && (
          <EmailCampaignsList
            campaigns={campaigns}
            projects={projects}
            isDark={isDark}
            onCampaignClick={setSelectedCampaignId}
            onAddNew={() => setCreateCampaignOpen(true)}
            onRefresh={loadData}
          />
        )}
      </div>

      <EmailProjectConfigWizard
        open={configOpen}
        projectId={configProjectId}
        projectName={projects.find((p) => p.id === configProjectId)?.name ?? selectedProject?.name}
        onOpenChange={setConfigOpen}
        onComplete={loadData}
      />

      <EmailSchedulingDialog
        open={scheduleOpen}
        projectId={selectedProjectId}
        projectName={scheduleProjectMeta.name ?? selectedProject?.name}
        dailyLimit={scheduleProjectMeta.dailyLimit}
        sentToday={scheduleProjectMeta.sentToday}
        sendIntervalSeconds={scheduleProjectMeta.sendIntervalSeconds}
        scheduleTimezone={scheduleProjectMeta.scheduleTimezone}
        onOpenChange={setScheduleOpen}
        onSaved={loadData}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Project Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Website URL</Label>
              <Input
                value={editWebsiteUrl}
                onChange={(e) => setEditWebsiteUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Target Audience</Label>
              <Input
                value={editTargetAudience}
                onChange={(e) => setEditTargetAudience(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>
                Description ({editDescription.length}/{MAX_PROJECT_DESCRIPTION_LENGTH})
              </Label>
              <Textarea
                value={editDescription}
                maxLength={MAX_PROJECT_DESCRIPTION_LENGTH}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateEmailCampaignModal
        open={createCampaignOpen}
        projects={projects}
        onOpenChange={setCreateCampaignOpen}
        onCreated={(campaignId) => {
          loadData();
          setSelectedCampaignId(campaignId);
        }}
      />

      <SenderEmailManagementDialog
        open={sendersOpen}
        projectId={sendersProjectId}
        onOpenChange={setSendersOpen}
        onUpdated={loadData}
      />

    </>
  );
}

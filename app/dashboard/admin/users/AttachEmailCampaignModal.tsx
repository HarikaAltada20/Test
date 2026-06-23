"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";
import type { NotificationSelectionState } from "./SendNotificationModal";

type EmailProject = {
  id: string;
  name: string;
  ses_verification_status: string;
};

type EmailCampaign = {
  id: string;
  name: string;
  status: string;
};

const ATTACHABLE_CAMPAIGN_STATUSES = new Set([
  "draft",
  "configured",
  "scheduled",
  "active",
  "paused",
  "completed",
  "partial",
]);

function campaignOptionLabel(c: EmailCampaign) {
  if (c.status === "draft") return c.name;
  const statusLabel =
    c.status.charAt(0).toUpperCase() + c.status.slice(1).replace(/_/g, " ");
  return `${c.name} (${statusLabel})`;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: NotificationSelectionState | null;
  isDark?: boolean;
  presetCampaignId?: string | null;
  onSuccess: (campaignId: string) => void;
};

const PROJECTS_CACHE_TTL_MS = 60_000;
let cachedProjects: EmailProject[] | null = null;
let projectsCacheAt = 0;

async function loadProjects(): Promise<EmailProject[]> {
  const now = Date.now();
  if (cachedProjects && now - projectsCacheAt < PROJECTS_CACHE_TTL_MS) {
    return cachedProjects;
  }

  const res = await fetch("/api/admin/email-projects?minimal=1");
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to load projects");
  }

  cachedProjects = data.projects ?? [];
  projectsCacheAt = now;
  return cachedProjects;
}

export function AttachEmailCampaignModal({
  open,
  onOpenChange,
  selection,
  isDark = false,
  presetCampaignId = null,
  onSuccess,
}: Props) {
  const [projects, setProjects] = useState<EmailProject[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [projectId, setProjectId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [presetCampaignName, setPresetCampaignName] = useState<string | null>(
    null,
  );
  const [presetProjectName, setPresetProjectName] = useState<string | null>(
    null,
  );
  const prefetchedRef = useRef(false);

  const usingPresetCampaign = Boolean(presetCampaignId);

  const typeCounts = useMemo(() => {
    if (!selection) return { creator: 0, advertiser: 0, admin: 0 };
    return selection.users.reduce(
      (acc, u) => {
        if (u.user_type === "creator") acc.creator += 1;
        else if (u.user_type === "advertiser") acc.advertiser += 1;
        else if (u.user_type === "admin") acc.admin += 1;
        return acc;
      },
      { creator: 0, advertiser: 0, admin: 0 },
    );
  }, [selection]);

  const attachableCampaigns = useMemo(() => {
    const attachable = campaigns.filter((c) =>
      ATTACHABLE_CAMPAIGN_STATUSES.has(c.status),
    );
    return attachable.sort((a, b) => {
      if (a.status === "draft" && b.status !== "draft") return -1;
      if (b.status === "draft" && a.status !== "draft") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [campaigns]);

  useEffect(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    void loadProjects().catch(() => {
      /* warm cache in background */
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);

    if (presetCampaignId) {
      setCampaignId(presetCampaignId);
      setProjectsLoading(false);
      setCampaignsLoading(true);
      setPresetCampaignName(null);
      setPresetProjectName(null);

      fetch(`/api/admin/email-campaigns/${presetCampaignId}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (data.error) {
            setError(data.error);
            return;
          }
          setPresetCampaignName(data.name ?? null);
          setPresetProjectName(data.projectName ?? null);
          if (data.projectId) setProjectId(data.projectId);
        })
        .catch(() => {
          if (!cancelled) setError("Failed to load campaign");
        })
        .finally(() => {
          if (!cancelled) setCampaignsLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }

    setProjectsLoading(true);
    setCampaignId("");
    setCampaigns([]);

    loadProjects()
      .then((list) => {
        if (cancelled) return;
        setProjects(list);
        setProjectId((prev) =>
          prev && list.some((p) => p.id === prev) ? prev : (list[0]?.id ?? ""),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load projects");
      })
      .finally(() => {
        if (!cancelled) setProjectsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, presetCampaignId]);

  useEffect(() => {
    if (!open || !projectId || usingPresetCampaign) {
      if (!usingPresetCampaign) {
        setCampaigns([]);
        setCampaignId("");
      }
      return;
    }

    let cancelled = false;
    setCampaignsLoading(true);
    setCampaignId("");

    fetch(
      `/api/admin/email-campaigns?minimal=1&projectId=${encodeURIComponent(projectId)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        const list: EmailCampaign[] = data.campaigns ?? [];
        setCampaigns(list);
        const attachable = list.filter((c) =>
          ATTACHABLE_CAMPAIGN_STATUSES.has(c.status),
        );
        setCampaignId(attachable[0]?.id ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load campaigns");
      })
      .finally(() => {
        if (!cancelled) setCampaignsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, projectId, usingPresetCampaign]);

  const projectLabel = (p: EmailProject) =>
    p.ses_verification_status === "verified"
      ? `${p.name} (Verified)`
      : p.name;

  const handleSubmit = async () => {
    const targetCampaignId = presetCampaignId ?? campaignId;
    if (!selection || !targetCampaignId) {
      setError("Select a campaign");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${targetCampaignId}/attach-recipients`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientMode: selection.mode,
            userIds: selection.userIds,
            filters: selection.filterSnapshot,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to attach recipients");
        return;
      }
      onSuccess(data.campaignId);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  const parts: string[] = [];
  if (typeCounts.creator) parts.push(`${typeCounts.creator} creators`);
  if (typeCounts.advertiser) parts.push(`${typeCounts.advertiser} brands`);
  if (typeCounts.admin) parts.push(`${typeCounts.admin} admins`);

  const selectSkeleton = (
    <Skeleton className={isDark ? "h-10 w-full bg-white/10" : "h-10 w-full"} />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isDark ? "text-white" : ""}>
        <DialogHeader>
          <DialogTitle>
            {presetCampaignId ? "Add leads to campaign" : "Attach users to campaign"}
          </DialogTitle>
          <DialogDescription>
            {presetCampaignId
              ? "Confirm attaching the selected users to this campaign."
              : "Select a project and campaign. You can add leads to draft or completed campaigns."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm">
            <p className="font-medium">Recipients</p>
            <p className="text-muted-foreground">
              Sending to {selection?.userIds.length ?? 0} users
              {parts.length > 0 ? ` (${parts.join(", ")})` : ""}
            </p>
          </div>

          {presetCampaignId ? (
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p className="font-medium">Campaign</p>
              {campaignsLoading ? (
                selectSkeleton
              ) : (
                <>
                  <p>{presetCampaignName ?? "Selected campaign"}</p>
                  {presetProjectName && (
                    <p className="text-muted-foreground">{presetProjectName}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <>
          <div className="space-y-2">
            <Label>Project *</Label>
            {projectsLoading ? (
              selectSkeleton
            ) : (
              <Select
                value={projectId || undefined}
                onValueChange={(id) => {
                  setProjectId(id);
                  setCampaignId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {projectLabel(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Campaign *</Label>
            {campaignsLoading ? (
              selectSkeleton
            ) : (
              <Select
                value={campaignId || undefined}
                onValueChange={setCampaignId}
                disabled={!projectId || projectsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {attachableCampaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {campaignOptionLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!campaignsLoading &&
              projectId &&
              attachableCampaigns.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No campaigns in this project. Create one on the Email tab
                  first.
                </p>
              )}
          </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !(presetCampaignId ?? campaignId) ||
              !selection ||
              (usingPresetCampaign
                ? campaignsLoading
                : projectsLoading || campaignsLoading)
            }
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {presetCampaignId ? "Add leads →" : "Send →"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

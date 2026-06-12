"use client";

import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: NotificationSelectionState | null;
  isDark?: boolean;
  onSuccess: (campaignId: string) => void;
};

export function AttachEmailCampaignModal({
  open,
  onOpenChange,
  selection,
  isDark = false,
  onSuccess,
}: Props) {
  const [projects, setProjects] = useState<EmailProject[]>([]);
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [projectId, setProjectId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");

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

  const verifiedProjects = useMemo(
    () => projects.filter((p) => p.ses_verification_status === "verified"),
    [projects],
  );

  const draftCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === "draft"),
    [campaigns],
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/admin/email-projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects ?? []);
        const verified = (data.projects ?? []).filter(
          (p: EmailProject) => p.ses_verification_status === "verified",
        );
        if (verified.length > 0) setProjectId(verified[0].id);
      })
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!projectId) {
      setCampaigns([]);
      setCampaignId("");
      return;
    }
    fetch(`/api/admin/email-campaigns?projectId=${projectId}`)
      .then((r) => r.json())
      .then((data) => {
        setCampaigns(data.campaigns ?? []);
        const drafts = (data.campaigns ?? []).filter(
          (c: EmailCampaign) => c.status === "draft",
        );
        setCampaignId(drafts[0]?.id ?? "");
      });
  }, [projectId]);

  const handleCreateCampaign = async () => {
    if (!projectId || !newCampaignName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, name: newCampaignName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create campaign");
        return;
      }
      setCampaigns((prev) => [...prev, data.campaign]);
      setCampaignId(data.campaign.id);
      setShowNewCampaign(false);
      setNewCampaignName("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!selection || !campaignId) {
      setError("Select a campaign");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/attach-recipients`,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={isDark ? "text-white" : ""}>
        <DialogHeader>
          <DialogTitle>Attach users to campaign</DialogTitle>
          <DialogDescription>
            Select a project and draft campaign. Configure template and schedule
            on the campaign detail page.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">Recipients</p>
              <p className="text-muted-foreground">
                Sending to {selection?.userIds.length ?? 0} users
                {parts.length > 0 ? ` (${parts.join(", ")})` : ""}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {verifiedProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Campaign *</Label>
              <div className="flex gap-2">
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select draft campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {draftCampaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCampaign((v) => !v)}
                >
                  + New
                </Button>
              </div>
            </div>

            {showNewCampaign && (
              <div className="flex gap-2">
                <Input
                  placeholder="Campaign name"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={handleCreateCampaign}
                  disabled={submitting}
                >
                  Create
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !campaignId || !selection}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send →
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

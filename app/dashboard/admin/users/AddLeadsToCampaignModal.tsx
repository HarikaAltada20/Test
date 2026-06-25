"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { NotificationSelectionState } from "./SendNotificationModal";
import { Layers, Loader2, Plus, Search, Users } from "lucide-react";

type BundleItem = {
  id: string;
  name: string;
  description: string | null;
  totalLeads: number;
};

type EmailProject = { id: string; name: string };

type ModalTab = "select" | "create";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string | null;
  campaignName?: string;
  selection?: NotificationSelectionState | null;
  onSuccess?: (campaignId: string) => void;
  onBundleCreated?: (bundleId: string) => void;
};

function recipientTypeCounts(selection: NotificationSelectionState | null | undefined) {
  if (!selection) {
    return { total: 0, creator: 0, advertiser: 0, admin: 0, other: 0 };
  }

  const counts = { creator: 0, advertiser: 0, admin: 0, other: 0 };
  for (const user of selection.users) {
    if (user.user_type === "creator") counts.creator += 1;
    else if (user.user_type === "advertiser") counts.advertiser += 1;
    else if (user.user_type === "admin") counts.admin += 1;
    else counts.other += 1;
  }

  return {
    total: selection.userIds.length,
    ...counts,
  };
}

export function AddLeadsToCampaignModal({
  open,
  onOpenChange,
  campaignId: presetCampaignId = null,
  campaignName: presetCampaignName,
  selection = null,
  onSuccess,
  onBundleCreated,
}: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ModalTab>("select");
  const [bundles, setBundles] = useState<BundleItem[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const [bundlesError, setBundlesError] = useState<string | null>(null);
  const [bundleSearch, setBundleSearch] = useState("");
  const [selectedBundleIds, setSelectedBundleIds] = useState<Set<string>>(
    new Set(),
  );
  const [attaching, setAttaching] = useState(false);

  const [bundleName, setBundleName] = useState("");
  const [bundleDescription, setBundleDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [projects, setProjects] = useState<EmailProject[]>([]);
  const [projectId, setProjectId] = useState("");

  const typeCounts = useMemo(() => recipientTypeCounts(selection), [selection]);
  const hasSelection = (selection?.userIds.length ?? 0) > 0;
  const canUseSelectBundles = hasSelection || Boolean(presetCampaignId);

  const loadBundles = useCallback(async () => {
    setBundlesLoading(true);
    setBundlesError(null);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (bundleSearch.trim()) params.set("search", bundleSearch.trim());
      const res = await fetch(`/api/admin/email-lead-bundles?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setBundles([]);
        setBundlesError(data.error || "Failed to load bundles");
        return;
      }
      setBundles(data.bundles ?? []);
    } catch {
      setBundles([]);
      setBundlesError("Failed to load bundles");
    } finally {
      setBundlesLoading(false);
    }
  }, [bundleSearch]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => void loadBundles(), bundleSearch ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [open, loadBundles, bundleSearch]);

  useEffect(() => {
    if (!open) {
      setActiveTab("select");
      setSelectedBundleIds(new Set());
      setBundleSearch("");
      setBundleName("");
      setBundleDescription("");
      setProjectId("");
      setBundlesError(null);
      return;
    }

    if (hasSelection) {
      setActiveTab("create");
    } else if (!presetCampaignId) {
      setActiveTab("create");
    } else {
      setActiveTab("select");
    }
  }, [open, hasSelection, presetCampaignId]);

  useEffect(() => {
    if (!canUseSelectBundles && activeTab === "select") {
      setActiveTab("create");
    }
  }, [canUseSelectBundles, activeTab]);

  useEffect(() => {
    if (!open) return;

    void fetch("/api/admin/email-projects?minimal=1")
      .then((r) => r.json())
      .then((data) => {
        if (data.projects) setProjects(data.projects);
      })
      .catch(() => {
        /* ignore */
      });
  }, [open]);

  const toggleBundle = (id: string) => {
    setSelectedBundleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelectionToBundles = async (bundleIds: string[]) => {
    let totalAdded = 0;
    for (const bundleId of bundleIds) {
      const res = await fetch(`/api/admin/email-lead-bundles/${bundleId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientMode: selection?.mode ?? "selected_user_ids",
          userIds: selection?.userIds ?? [],
          filters: selection?.filterSnapshot,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add leads to bundle");
      }
      totalAdded += data.addedCount ?? 0;
    }
    return totalAdded;
  };

  const handleAttachBundles = async () => {
    if (selectedBundleIds.size === 0) return;

    const bundleIds = Array.from(selectedBundleIds);

    setAttaching(true);
    try {
      if (presetCampaignId) {
        const res = await fetch(
          `/api/admin/email-campaigns/${presetCampaignId}/attach-bundles`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bundleIds }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          toast({
            title: "Could not add bundles",
            description: data.error || "Attach failed",
            variant: "destructive",
          });
          return;
        }
        toast({
          title: "Bundles added",
          description: `Added ${data.attachedCount} lead(s) from ${data.bundleCount} bundle(s) to the campaign.`,
        });
        onOpenChange(false);
        onSuccess?.(presetCampaignId);
        return;
      }

      if (hasSelection) {
        const added = await addSelectionToBundles(bundleIds);
        toast({
          title: "Leads added to bundle",
          description: `Added ${added} lead(s) to ${bundleIds.length} bundle(s).`,
        });
        onOpenChange(false);
        onBundleCreated?.(bundleIds[0]);
        return;
      }

      toast({
        title: "Bundle selected",
        description: "View and manage your bundle in the Leads tab.",
      });
      onOpenChange(false);
      onBundleCreated?.(bundleIds[0]);
    } catch (e) {
      toast({
        title: "Could not add to bundle",
        description: e instanceof Error ? e.message : "Request failed",
        variant: "destructive",
      });
    } finally {
      setAttaching(false);
    }
  };

  const handleCreateBundle = async () => {
    if (!projectId) {
      toast({ title: "Select a project", variant: "destructive" });
      return;
    }
    if (!bundleName.trim()) {
      toast({ title: "Bundle name required", variant: "destructive" });
      return;
    }
    if (!hasSelection) {
      toast({
        title: "No recipients selected",
        description: "Select users in the table before creating a bundle.",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/email-lead-bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: bundleName.trim(),
          description: bundleDescription.trim() || null,
          projectId,
          recipientMode: selection?.mode ?? "selected_user_ids",
          userIds: selection?.userIds ?? [],
          filters: selection?.filterSnapshot,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not create bundle",
          description: data.error || "Create failed",
          variant: "destructive",
        });
        return;
      }

      const added = data.addedUserCount ?? data.bundle?.totalLeads ?? 0;
      toast({
        title: "Bundle created",
        description: `Added ${added} lead(s) to "${data.bundle?.name ?? bundleName}".`,
      });

      onOpenChange(false);
      if (data.bundle?.id) {
        onBundleCreated?.(data.bundle.id);
      }
    } finally {
      setCreating(false);
    }
  };

  const selectedLeadCount = bundles
    .filter((b) => selectedBundleIds.has(b.id))
    .reduce((sum, b) => sum + b.totalLeads, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">Add Leads to Campaign</DialogTitle>
              <DialogDescription className="mt-1">
                Choose how you want to add leads
                {presetCampaignName ? ` to ${presetCampaignName}` : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mx-6 mt-4 rounded-lg bg-[#E8ECF0] p-1 flex gap-1">
          <button
            type="button"
            disabled={!canUseSelectBundles}
            onClick={() => canUseSelectBundles && setActiveTab("select")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all",
              !canUseSelectBundles && "opacity-50 cursor-not-allowed",
              activeTab === "select"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            <Layers className="h-4 w-4" />
            Select Bundles
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md transition-all",
              activeTab === "create"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            <Plus className="h-4 w-4" />
            Create Bundle
          </button>
        </div>

        <div className="px-6 py-4">
          {activeTab === "select" && (
            <div className="space-y-4">
              {!canUseSelectBundles && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Select users in the table first, then choose a bundle to add them
                  to.
                </div>
              )}

              {hasSelection && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-purple-900">
                    Adding {typeCounts.total.toLocaleString()} selected user
                    {typeCounts.total !== 1 ? "s" : ""} to bundle
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {typeCounts.creator > 0 && (
                      <Badge variant="secondary" className="bg-white font-normal">
                        {typeCounts.creator} creator
                        {typeCounts.creator !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {typeCounts.advertiser > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-slate-800 text-white font-normal hover:bg-slate-800"
                      >
                        {typeCounts.advertiser} advertiser
                        {typeCounts.advertiser !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search bundles..."
                  value={bundleSearch}
                  onChange={(e) => setBundleSearch(e.target.value)}
                  className="pl-9 h-11"
                />
              </div>

              {bundlesLoading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading bundles...
                </div>
              ) : bundlesError ? (
                <div className="text-center py-12 text-red-600 text-sm">
                  <p className="font-medium">{bundlesError}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => void loadBundles()}
                  >
                    Retry
                  </Button>
                </div>
              ) : bundles.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No bundles yet.</p>
                  <Button
                    variant="link"
                    className="text-blue-600 mt-2"
                    onClick={() => setActiveTab("create")}
                  >
                    Create your first bundle
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {bundles.map((bundle) => {
                    const selected = selectedBundleIds.has(bundle.id);
                    return (
                      <button
                        key={bundle.id}
                        type="button"
                        onClick={() => toggleBundle(bundle.id)}
                        className={cn(
                          "w-full text-left rounded-xl border p-4 transition-colors",
                          selected
                            ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                            : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "mt-0.5 h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                              selected
                                ? "border-blue-600 bg-blue-600"
                                : "border-gray-300",
                            )}
                          >
                            {selected && (
                              <div className="h-2 w-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm">{bundle.name}</p>
                              <span className="text-sm text-muted-foreground shrink-0">
                                {bundle.totalLeads} leads
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {bundle.description ||
                                "Individual leads for this bundle"}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "create" && (
            <div className="space-y-4">
              {hasSelection ? (
                <div className="rounded-xl border border-purple-200 bg-purple-50/60 px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-purple-900">
                    Selected recipients: {typeCounts.total.toLocaleString()}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {typeCounts.creator > 0 && (
                      <Badge variant="secondary" className="bg-white font-normal">
                        {typeCounts.creator} creator
                        {typeCounts.creator !== 1 ? "s" : ""}
                      </Badge>
                    )}
                    {typeCounts.advertiser > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-slate-800 text-white font-normal hover:bg-slate-800"
                      >
                        {typeCounts.advertiser} advertiser
                        {typeCounts.advertiser !== 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Select users in the table first, then create a bundle with those
                  leads.
                </div>
              )}

              <div className="space-y-1.5">
                <Label>
                  Project <span className="text-red-500">*</span>
                </Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  Bundle Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Enter bundle name..."
                  value={bundleName}
                  onChange={(e) => setBundleName(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  placeholder="Enter bundle description (optional)..."
                  value={bundleDescription}
                  onChange={(e) => setBundleDescription(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-gray-50/50 gap-2 sm:justify-end">
          <Button
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {activeTab === "select" ? (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={
                selectedBundleIds.size === 0 ||
                attaching ||
                !canUseSelectBundles
              }
              onClick={handleAttachBundles}
            >
              {attaching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Layers className="h-4 w-4 mr-2" />
              )}
              Add {selectedBundleIds.size} Bundle
              {selectedBundleIds.size !== 1 ? "s" : ""}
              {hasSelection
                ? ` (${typeCounts.total} users)`
                : selectedLeadCount > 0
                  ? ` (${selectedLeadCount} leads)`
                  : ""}
            </Button>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={
                creating || !bundleName.trim() || !projectId || !hasSelection
              }
              onClick={handleCreateBundle}
            >
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create Bundle
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

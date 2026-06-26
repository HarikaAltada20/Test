"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { buildLeadImportCsvTemplate } from "@/lib/admin-email/lead-bundles";
import type { NotificationSelectionState } from "./SendNotificationModal";
import {
  Download,
  FileUp,
  Layers,
  Loader2,
  Plus,
  Search,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";

type BundleItem = {
  id: string;
  name: string;
  description: string | null;
  totalLeads: number;
};

type EmailProject = { id: string; name: string };

type ModalTab = "select" | "create" | "add" | "import";

export type AddLeadsModalVariant = "bundle" | "campaign";

const VARIANT_TABS: Record<AddLeadsModalVariant, ModalTab[]> = {
  bundle: ["select", "create"],
  campaign: ["select", "add", "import"],
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId?: string | null;
  campaignName?: string;
  selection?: NotificationSelectionState | null;
  variant?: AddLeadsModalVariant;
  defaultTab?: ModalTab;
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
  variant: variantProp,
  defaultTab,
  onSuccess,
  onBundleCreated,
}: Props) {
  const modalVariant: AddLeadsModalVariant =
    variantProp ?? (presetCampaignId ? "campaign" : "bundle");
  const visibleTabs = useMemo(
    () => new Set(VARIANT_TABS[modalVariant]),
    [modalVariant],
  );
  const isBundleVariant = modalVariant === "bundle";
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

  const [createBundleProjectId, setCreateBundleProjectId] = useState("");
  const [createBundleName, setCreateBundleName] = useState("");
  const [createBundleDescription, setCreateBundleDescription] = useState("");
  const [creatingBundle, setCreatingBundle] = useState(false);

  const [addProjectId, setAddProjectId] = useState("");
  const [addBundleName, setAddBundleName] = useState("");
  const [leadFullName, setLeadFullName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadUsername, setLeadUsername] = useState("");
  const [leadUserType, setLeadUserType] = useState("");
  const [addingLead, setAddingLead] = useState(false);

  const [projects, setProjects] = useState<EmailProject[]>([]);
  const [importBundleName, setImportBundleName] = useState("");
  const [importDescription, setImportDescription] = useState("");
  const [importProjectId, setImportProjectId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

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
      setAddProjectId("");
      setAddBundleName("");
      setCreateBundleProjectId("");
      setCreateBundleName("");
      setCreateBundleDescription("");
      setLeadFullName("");
      setLeadEmail("");
      setLeadUsername("");
      setLeadUserType("");
      setImportBundleName("");
      setImportDescription("");
      setImportProjectId("");
      setImportFile(null);
      if (importFileInputRef.current) {
        importFileInputRef.current.value = "";
      }
      setBundlesError(null);
      return;
    }

    if (defaultTab && visibleTabs.has(defaultTab)) {
      setActiveTab(defaultTab);
    } else if (visibleTabs.has("select") && (presetCampaignId || (selection?.userIds.length ?? 0) > 0)) {
      setActiveTab("select");
    } else {
      const firstTab = VARIANT_TABS[modalVariant][0];
      setActiveTab(firstTab);
    }
  }, [open, presetCampaignId, defaultTab, selection?.userIds.length, modalVariant, visibleTabs]);

  useEffect(() => {
    if (!visibleTabs.has(activeTab)) {
      setActiveTab(VARIANT_TABS[modalVariant][0]);
    } else if (activeTab === "select" && !canUseSelectBundles) {
      if (visibleTabs.has("create") && hasSelection) {
        setActiveTab("create");
      } else if (visibleTabs.has("add")) {
        setActiveTab("add");
      }
    } else if (activeTab === "create" && !hasSelection) {
      setActiveTab(visibleTabs.has("select") ? "select" : "add");
    }
  }, [canUseSelectBundles, activeTab, hasSelection, visibleTabs, modalVariant]);

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

  const handleCreateBundleFromUsers = async () => {
    if (!createBundleProjectId) {
      toast({ title: "Project required", variant: "destructive" });
      return;
    }
    if (!createBundleName.trim()) {
      toast({ title: "Bundle name required", variant: "destructive" });
      return;
    }
    if (!hasSelection || !selection) {
      toast({
        title: "No users selected",
        description: "Select users in the table first.",
        variant: "destructive",
      });
      return;
    }

    setCreatingBundle(true);
    try {
      const createRes = await fetch("/api/admin/email-lead-bundles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createBundleName.trim(),
          description: createBundleDescription.trim() || null,
          projectId: createBundleProjectId,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) {
        toast({
          title: "Could not create bundle",
          description: createData.error || "Create failed",
          variant: "destructive",
        });
        return;
      }

      const bundleId = createData.bundle?.id as string | undefined;
      if (!bundleId) {
        toast({
          title: "Could not create bundle",
          description: "Bundle was not returned from the server.",
          variant: "destructive",
        });
        return;
      }

      const membersRes = await fetch(
        `/api/admin/email-lead-bundles/${bundleId}/members`,
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
      const membersData = await membersRes.json();
      if (!membersRes.ok) {
        toast({
          title: "Bundle created, add users failed",
          description: membersData.error || "Could not add users to bundle",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Bundle created",
        description: `Created "${createBundleName.trim()}" with ${membersData.addedCount ?? typeCounts.total} user(s).`,
      });
      onOpenChange(false);
      onBundleCreated?.(bundleId);
    } finally {
      setCreatingBundle(false);
    }
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

  const attachBundleToCampaign = async (bundleId: string) => {
    if (!presetCampaignId) return null;
    const attachRes = await fetch(
      `/api/admin/email-campaigns/${presetCampaignId}/attach-bundles`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleIds: [bundleId] }),
      },
    );
    const attachData = await attachRes.json();
    if (!attachRes.ok) {
      throw new Error(attachData.error || "Failed to add bundle to campaign");
    }
    return attachData as { attachedCount?: number };
  };

  const attachLeadToCampaign = async (lead: {
    email: string;
    fullName: string;
    username?: string | null;
    userType?: string | null;
  }) => {
    if (!presetCampaignId) return null;
    const attachRes = await fetch(
      `/api/admin/email-campaigns/${presetCampaignId}/attach-leads`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead }),
      },
    );
    const attachData = await attachRes.json();
    if (!attachRes.ok) {
      throw new Error(attachData.error || "Failed to add lead to campaign");
    }
    return attachData as { attachedCount?: number; skippedCount?: number };
  };

  const handleAddLead = async () => {
    if (!addProjectId) {
      toast({ title: "Project required", variant: "destructive" });
      return;
    }
    if (!addBundleName.trim()) {
      toast({
        title: "Bundle name required",
        description: "Enter a name for the bundle.",
        variant: "destructive",
      });
      return;
    }
    if (!leadFullName.trim()) {
      toast({ title: "Full name required", variant: "destructive" });
      return;
    }
    if (!leadEmail.trim()) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }

    const leadPayload = {
      email: leadEmail.trim(),
      fullName: leadFullName.trim(),
      username: leadUsername.trim() || null,
      userType: leadUserType || null,
    };

    setAddingLead(true);
    try {
      const bundleName = addBundleName.trim();
      let bundleId: string | undefined;
      let createdNewBundle = false;

      const lookupParams = new URLSearchParams({
        projectId: addProjectId,
        search: bundleName,
        limit: "100",
      });
      const lookupRes = await fetch(`/api/admin/email-lead-bundles?${lookupParams}`);
      const lookupData = await lookupRes.json();
      if (lookupRes.ok) {
        const existing = (lookupData.bundles ?? []).find(
          (bundle: { name: string }) =>
            bundle.name.trim().toLowerCase() === bundleName.toLowerCase(),
        );
        bundleId = existing?.id;
      }

      if (!bundleId) {
        const createRes = await fetch("/api/admin/email-lead-bundles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: bundleName,
            projectId: addProjectId,
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          toast({
            title: "Could not create bundle",
            description: createData.error || "Create failed",
            variant: "destructive",
          });
          return;
        }
        bundleId = createData.bundle?.id as string | undefined;
        createdNewBundle = true;
        if (!bundleId) {
          toast({
            title: "Could not create bundle",
            description: "Bundle was not returned from the server.",
            variant: "destructive",
          });
          return;
        }
      }

      const res = await fetch(`/api/admin/email-lead-bundles/${bundleId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead: leadPayload }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not add lead",
          description: data.error || "Add failed",
          variant: "destructive",
        });
        return;
      }

      if (presetCampaignId) {
        try {
          const attachData = await attachLeadToCampaign(leadPayload);
          toast({
            title: "Lead added to campaign",
            description: createdNewBundle
              ? `Created "${bundleName}" and added the lead to the campaign.`
              : attachData?.attachedCount
                ? "Added lead to bundle and campaign."
                : "Lead is already in this campaign.",
          });
          onOpenChange(false);
          onSuccess?.(presetCampaignId);
          return;
        } catch (e) {
          toast({
            title: "Lead saved, campaign attach failed",
            description: e instanceof Error ? e.message : "Attach failed",
            variant: "destructive",
          });
          onBundleCreated?.(bundleId);
          return;
        }
      }

      toast({
        title: createdNewBundle ? "Bundle created" : "Lead added",
        description: createdNewBundle
          ? `Created "${bundleName}" and added the lead.`
          : data.addedCount > 0
            ? `Added ${data.addedCount} lead(s) to the bundle.`
            : "Lead is already in this bundle.",
      });
      onOpenChange(false);
      onBundleCreated?.(bundleId);
    } finally {
      setAddingLead(false);
    }
  };

  const downloadImportTemplate = () => {
    const csv = buildLeadImportCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lead-import-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBundle = async () => {
    if (!importProjectId) {
      toast({ title: "Select a project", variant: "destructive" });
      return;
    }
    if (!importBundleName.trim()) {
      toast({ title: "Bundle name required", variant: "destructive" });
      return;
    }
    if (!importFile) {
      toast({
        title: "File required",
        description: "Upload a CSV or Excel file with an email column.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    try {
      const form = new FormData();
      form.append("name", importBundleName.trim());
      if (importDescription.trim()) {
        form.append("description", importDescription.trim());
      }
      form.append("projectId", importProjectId);
      form.append("file", importFile);

      const res = await fetch("/api/admin/email-lead-bundles", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Import failed",
          description: data.error || "Could not import bundle",
          variant: "destructive",
        });
        return;
      }

      const bundleId = data.bundle?.id as string | undefined;
      const importedCount = data.import?.matched ?? 0;

      if (presetCampaignId && bundleId) {
        try {
          const attachData = await attachBundleToCampaign(bundleId);
          toast({
            title: "Leads imported to campaign",
            description: `Imported ${importedCount} lead(s) and added ${attachData?.attachedCount ?? importedCount} to the campaign.`,
          });
          onOpenChange(false);
          onSuccess?.(presetCampaignId);
          return;
        } catch (e) {
          toast({
            title: "Bundle imported, campaign attach failed",
            description:
              e instanceof Error
                ? e.message
                : `Imported ${importedCount} lead(s) but could not add them to the campaign.`,
            variant: "destructive",
          });
          if (bundleId) onBundleCreated?.(bundleId);
          return;
        }
      }

      toast({
        title: "Bundle imported",
        description: `Imported ${importedCount} lead(s) into "${data.bundle?.name ?? importBundleName}".`,
      });
      onOpenChange(false);
      if (bundleId) onBundleCreated?.(bundleId);
    } finally {
      setImporting(false);
    }
  };

  const selectedLeadCount = bundles
    .filter((b) => selectedBundleIds.has(b.id))
    .reduce((sum, b) => sum + b.totalLeads, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-2 pt-4 pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg">
                {isBundleVariant ? "Select bundle" : "Add Leads to Campaign"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {isBundleVariant
                  ? "Choose an existing bundle or create a new one with selected users."
                  : `Choose how you want to add leads${presetCampaignName ? ` to ${presetCampaignName}` : ""}`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mx-2 mt-4 rounded-lg bg-[#E8ECF0] p-1 flex gap-1 overflow-x-auto">
          {visibleTabs.has("select") && (
          <button
            type="button"
            disabled={!canUseSelectBundles}
            onClick={() => canUseSelectBundles && setActiveTab("select")}
            className={cn(
              "flex flex-1 min-w-[7.5rem] items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
              !canUseSelectBundles && "opacity-50 cursor-not-allowed",
              activeTab === "select"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            <Layers className="h-4 w-4 shrink-0" />
            Select Bundles
          </button>
          )}
          {visibleTabs.has("create") && (
          <button
            type="button"
            disabled={!hasSelection}
            onClick={() => hasSelection && setActiveTab("create")}
            className={cn(
              "flex flex-1 min-w-[7.5rem] items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
              !hasSelection && "opacity-50 cursor-not-allowed",
              activeTab === "create"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            Create Bundle
          </button>
          )}
          {visibleTabs.has("add") && (
          <button
            type="button"
            onClick={() => setActiveTab("add")}
            className={cn(
              "flex flex-1 min-w-[7.5rem] items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
              activeTab === "add"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            <UserPlus className="h-4 w-4 shrink-0" />
            Add Lead
          </button>
          )}
          {visibleTabs.has("import") && (
          <button
            type="button"
            onClick={() => setActiveTab("import")}
            className={cn(
              "flex flex-1 min-w-[7.5rem] items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md transition-all whitespace-nowrap",
              activeTab === "import"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            <Upload className="h-4 w-4 shrink-0" />
            Import CSV/Excel
          </button>
          )}
        </div>

        <div className="px-2 py-4">
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
                    onClick={() =>
                      setActiveTab(
                        visibleTabs.has("create")
                          ? "create"
                          : visibleTabs.has("add")
                            ? "add"
                            : "select",
                      )
                    }
                  >
                    {visibleTabs.has("create")
                      ? "Create your first bundle"
                      : "Add your first lead"}
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
              {!hasSelection ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Select users in the table first, then create a bundle with those
                  users.
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 space-y-2">
                  <p className="text-sm font-medium text-emerald-900">
                    Creating bundle with {typeCounts.total.toLocaleString()}{" "}
                    selected user{typeCounts.total !== 1 ? "s" : ""}
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

              <div className="space-y-1.5">
                <Label>
                  Project <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={createBundleProjectId || undefined}
                  onValueChange={setCreateBundleProjectId}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select project..." />
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
                  value={createBundleName}
                  onChange={(e) => setCreateBundleName(e.target.value)}
                  placeholder="Enter bundle name..."
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Textarea
                  value={createBundleDescription}
                  onChange={(e) => setCreateBundleDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {activeTab === "add" && (
            <div className="space-y-4">
              {presetCampaignId && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
                  Add a lead to a bundle and include it in this campaign
                  {presetCampaignName ? `: ${presetCampaignName}` : ""}.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>
                    Project <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={addProjectId || undefined}
                    onValueChange={(value) => {
                      setAddProjectId(value);
                      setAddBundleName("");
                    }}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select project..." />
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

                <div className="space-y-1.5 sm:col-span-2">
                  <Label>
                    Bundle Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={addBundleName}
                    onChange={(e) => setAddBundleName(e.target.value)}
                    placeholder="Enter bundle name..."
                    disabled={!addProjectId}
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={leadFullName}
                    onChange={(e) => setLeadFullName(e.target.value)}
                    placeholder="Enter full name..."
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    placeholder="Enter email..."
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Username (optional)</Label>
                  <Input
                    value={leadUsername}
                    onChange={(e) => setLeadUsername(e.target.value)}
                    placeholder="Enter username..."
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>User Type (optional)</Label>
                  <Select
                    value={leadUserType || undefined}
                    onValueChange={setLeadUserType}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Any user type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="creator">Creator</SelectItem>
                      <SelectItem value="advertiser">Advertiser</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "import" && (
            <div className="space-y-4">
              {presetCampaignId ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-4 py-3 text-sm text-blue-900">
                  Import a file to create a bundle and add those leads to this
                  campaign{presetCampaignName ? `: ${presetCampaignName}` : ""}.
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  Import leads from a CSV or Excel file into a new bundle.
                </div>
              )}

              <div className="space-y-1.5">
                <Label>
                  Project <span className="text-red-500">*</span>
                </Label>
                <Select value={importProjectId} onValueChange={setImportProjectId}>
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
                  value={importBundleName}
                  onChange={(e) => setImportBundleName(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  placeholder="Enter bundle description (optional)..."
                  value={importDescription}
                  onChange={(e) => setImportDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>
                    CSV / Excel File <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-blue-600 hover:text-blue-700"
                    onClick={downloadImportTemplate}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Download CSV template
                  </Button>
                </div>
                <input
                  ref={importFileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-24 flex flex-col gap-2"
                  onClick={() => importFileInputRef.current?.click()}
                >
                  <FileUp className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm text-center px-2">
                    {importFile
                      ? importFile.name
                      : "Upload CSV or Excel (email, full name…)"}
                  </span>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Required: <span className="font-medium">email</span>. Optional:{" "}
                  <span className="font-medium">full name</span>,{" "}
                  <span className="font-medium">username</span>,{" "}
                  <span className="font-medium">user type</span>.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-2 py-4 border-t bg-gray-50/50 gap-2 sm:justify-end">
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
          ) : activeTab === "create" ? (
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={
                creatingBundle ||
                !createBundleProjectId ||
                !createBundleName.trim() ||
                !hasSelection
              }
              onClick={() => void handleCreateBundleFromUsers()}
            >
              {creatingBundle ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create bundle
            </Button>
          ) : activeTab === "add" ? (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={
                addingLead ||
                !addProjectId ||
                !addBundleName.trim() ||
                !leadFullName.trim() ||
                !leadEmail.trim()
              }
              onClick={() => void handleAddLead()}
            >
              {addingLead ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {presetCampaignId ? "Add Lead to Campaign" : "Add Lead"}
            </Button>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={
                importing ||
                !importProjectId ||
                !importBundleName.trim() ||
                !importFile
              }
              onClick={() => void handleImportBundle()}
            >
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {presetCampaignId ? "Import & Add to Campaign" : "Import & Create Bundle"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

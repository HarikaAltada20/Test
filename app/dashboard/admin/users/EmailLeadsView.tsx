"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { EnhancedTabs } from "@/components/ui/enhancedTabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { EmailProjectCardData } from "./EmailProjectCard";
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

type BundleRow = {
  id: string;
  projectId: string | null;
  projectName: string | null;
  name: string;
  description: string | null;
  status: string;
  totalLeads: number;
  processedCount: number;
  failedCount: number;
  createdAt: string;
};

type MemberRow = {
  id: string;
  userId: string | null;
  email: string;
  fullName: string | null;
  username: string | null;
  userType: string;
};

type SubTab = "groups" | "leads";

type Props = {
  projects: EmailProjectCardData[];
  isDark?: boolean;
  isActive?: boolean;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function statusBadge(status: string) {
  if (status === "completed") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 font-normal">
        Completed
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-normal">
      Active
    </Badge>
  );
}

export function EmailLeadsView({ projects, isDark, isActive = true }: Props) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<SubTab>("groups");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ groupCount: 0, totalLeadsInGroups: 0 });

  const [createOpen, setCreateOpen] = useState(false);
  const [createProjectId, setCreateProjectId] = useState("");
  const [selectedBundleId, setSelectedBundleId] = useState("");
  const [bundleName, setBundleName] = useState("");
  const [createBundles, setCreateBundles] = useState<BundleRow[]>([]);
  const [createBundlesLoading, setCreateBundlesLoading] = useState(false);
  const [leadFullName, setLeadFullName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadUsername, setLeadUsername] = useState("");
  const [leadUserType, setLeadUserType] = useState("");
  const [creating, setCreating] = useState(false);

  const [viewBundleId, setViewBundleId] = useState<string | null>(null);
  const [viewBundleName, setViewBundleName] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersTotal, setMembersTotal] = useState(0);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, projectFilter, limit]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/email-lead-bundles?stats=1");
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {
      // ignore
    }
  }, []);

  const loadBundles = useCallback(async () => {
    if (!isActive) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      if (projectFilter !== "all") params.set("projectId", projectFilter);

      const res = await fetch(`/api/admin/email-lead-bundles?${params}`);
      const data = await res.json();
      if (res.ok) {
        setBundles(data.bundles ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [isActive, page, limit, debouncedSearch, projectFilter]);

  useEffect(() => {
    void loadBundles();
    void loadStats();
  }, [loadBundles, loadStats]);

  useEffect(() => {
    if (!createOpen || !createProjectId) {
      setCreateBundles([]);
      setSelectedBundleId("");
      return;
    }

    let cancelled = false;
    const loadProjectBundles = async () => {
      setCreateBundlesLoading(true);
      try {
        const params = new URLSearchParams({
          projectId: createProjectId,
          limit: "100",
        });
        const res = await fetch(`/api/admin/email-lead-bundles?${params}`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setCreateBundles(data.bundles ?? []);
        }
      } finally {
        if (!cancelled) setCreateBundlesLoading(false);
      }
    };

    void loadProjectBundles();
    return () => {
      cancelled = true;
    };
  }, [createOpen, createProjectId]);

  const resetCreateForm = () => {
    setCreateProjectId("");
    setSelectedBundleId("");
    setBundleName("");
    setCreateBundles([]);
    setLeadFullName("");
    setLeadEmail("");
    setLeadUsername("");
    setLeadUserType("");
  };

  const openCreateDialog = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const loadMembers = useCallback(async (bundleId: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(
        `/api/admin/email-lead-bundles/${bundleId}?members=1&limit=200`,
      );
      const data = await res.json();
      if (res.ok) {
        setMembers(data.members ?? []);
        setMembersTotal(data.total ?? 0);
      }
    } finally {
      setMembersLoading(false);
    }
  }, []);

  const handleViewLeads = (bundle: BundleRow) => {
    setViewBundleId(bundle.id);
    setViewBundleName(bundle.name);
    setSubTab("leads");
    void loadMembers(bundle.id);
  };

  const handleAddLead = async () => {
    if (!createProjectId) {
      toast({ title: "Project required", variant: "destructive" });
      return;
    }
    if (!selectedBundleId && !bundleName.trim()) {
      toast({
        title: "Bundle name required",
        description: "Select an existing bundle or enter a name for a new one.",
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

    setCreating(true);
    try {
      let bundleId = selectedBundleId;

      if (!bundleId) {
        const createRes = await fetch("/api/admin/email-lead-bundles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: bundleName.trim(),
            projectId: createProjectId,
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
        bundleId = createData.bundle?.id;
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

      const createdNewBundle = !selectedBundleId;
      toast({
        title: createdNewBundle ? "Bundle created" : "Lead added",
        description: createdNewBundle
          ? `Created "${bundleName.trim()}" and added the lead.`
          : data.addedCount > 0
            ? `Added ${data.addedCount} lead(s) to the bundle.`
            : "Lead is already in this bundle.",
      });
      setCreateOpen(false);
      resetCreateForm();
      await loadBundles();
      await loadStats();
      if (viewBundleId === bundleId) {
        void loadMembers(bundleId);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/email-lead-bundles/${deleteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Delete failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Bundle deleted" });
      setDeleteId(null);
      if (viewBundleId === deleteId) {
        setViewBundleId(null);
        setSubTab("groups");
      }
      await loadBundles();
      await loadStats();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h2
          className={cn(
            "text-2xl font-bold",
            isDark ? "text-white" : "text-gray-900",
          )}
        >
          Leads
        </h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-white border-gray-300"
          />
        </div>
        <Button
          className="h-11 bg-[#662EBD] hover:bg-[#5524a8]"
          onClick={openCreateDialog}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add lead
        </Button>
      </div>

      <EnhancedTabs
        tabs={[
          {
            id: "groups",
            label: (
              <span className="inline-flex items-center gap-2">
                <Users className="h-4 w-4" />
                Groups ({stats.groupCount})
              </span>
            ),
          },
          {
            id: "leads",
            label: (
              <span className="inline-flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Leads ({membersTotal} • {stats.totalLeadsInGroups.toLocaleString()}{" "}
                from groups)
              </span>
            ),
          },
        ]}
        activeTab={subTab}
        onTabChange={(id) => {
          setSubTab(id as SubTab);
          if (id === "groups") setViewBundleId(null);
        }}
        className="w-full max-w-3xl overflow-x-auto"
        isDark={isDark}
        light
        fillWidth={false}
      />

      {subTab === "groups" && (
        <>
          <div className="max-w-xs space-y-1.5">
            <Label>Project</Label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-11 bg-white border-gray-300">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="p-4 text-left font-medium">Name</th>
                    <th className="p-4 text-left font-medium">Description</th>
                    <th className="p-4 text-left font-medium">Total Leads</th>
                    <th className="p-4 text-left font-medium">Processed</th>
                    <th className="p-4 text-left font-medium">Failed</th>
                    <th className="p-4 text-left font-medium">Status</th>
                    <th className="p-4 text-left font-medium">Created</th>
                    <th className="p-4 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="p-4">
                            <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {!loading &&
                    bundles.map((bundle) => (
                      <tr
                        key={bundle.id}
                        className="border-b last:border-0 hover:bg-muted/20"
                      >
                        <td className="p-4 font-medium max-w-[200px] truncate">
                          {bundle.name}
                        </td>
                        <td className="p-4 text-muted-foreground max-w-[220px] truncate">
                          {bundle.description || "—"}
                        </td>
                        <td className="p-4">{bundle.totalLeads}</td>
                        <td className="p-4 text-green-600">
                          {bundle.processedCount}
                        </td>
                        <td className="p-4">
                          {bundle.failedCount > 0 ? bundle.failedCount : "—"}
                        </td>
                        <td className="p-4">{statusBadge(bundle.status)}</td>
                        <td className="p-4 text-muted-foreground">
                          {formatDate(bundle.createdAt)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-[#662EBD] hover:underline text-sm font-medium"
                              onClick={() => handleViewLeads(bundle)}
                            >
                              View Leads
                            </button>
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => setDeleteId(bundle.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {!loading && bundles.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-12 text-center text-muted-foreground"
                      >
                        No bundles yet. Import a CSV or create a new group.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {total > 0 && (
              <div className="px-4 py-3 border-t border-gray-100">
                <PaginationControls
                  page={page}
                  limit={limit}
                  total={total}
                  totalPages={totalPages}
                  hasNextPage={page < totalPages}
                  hasPreviousPage={page > 1}
                  onPageChange={setPage}
                  onLimitChange={setLimit}
                  loading={loading}
                  pageSizeOptions={[10, 25, 50, 100]}
                />
              </div>
            )}
          </div>
        </>
      )}

      {subTab === "leads" && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {viewBundleId && (
            <div className="px-4 py-3 border-b bg-gray-50/80 text-sm text-muted-foreground">
              Showing leads from:{" "}
              <span className="font-medium text-gray-900">{viewBundleName}</span>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/80 text-muted-foreground">
                  <th className="p-4 text-left font-medium">Email</th>
                  <th className="p-4 text-left font-medium">Contact</th>
                  <th className="p-4 text-left font-medium">Username</th>
                  <th className="p-4 text-left font-medium">User Type</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <td key={j} className="p-4">
                          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}
                {!membersLoading &&
                  members.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
                      <td className="p-4 font-medium">{m.email}</td>
                      <td className="p-4">{m.fullName || "—"}</td>
                      <td className="p-4">{m.username || "—"}</td>
                      <td className="p-4 capitalize text-muted-foreground">
                        {m.userType || "—"}
                      </td>
                    </tr>
                  ))}
                {!membersLoading && !viewBundleId && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-12 text-center text-muted-foreground"
                    >
                      Select a group and click View Leads to see its members.
                    </td>
                  </tr>
                )}
                {!membersLoading && viewBundleId && members.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-12 text-center text-muted-foreground"
                    >
                      No leads in this bundle yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-2 pt-4 pb-4 border-b shrink-0">
            <DialogTitle>Add Lead to Bundle</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 px-2 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Project <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={createProjectId || undefined}
                  onValueChange={(value) => {
                    setCreateProjectId(value);
                    setSelectedBundleId("");
                    setBundleName("");
                  }}
                >
                  <SelectTrigger className="w-full">
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
                <Label>Bundle (optional)</Label>
                <Select
                  value={selectedBundleId || "__new__"}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setSelectedBundleId("");
                      return;
                    }
                    setSelectedBundleId(value);
                    setBundleName("");
                  }}
                  disabled={!createProjectId || createBundlesLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        !createProjectId
                          ? "Select a project first"
                          : createBundlesLoading
                            ? "Loading bundles..."
                            : "Create new bundle or select existing..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">Create new bundle</SelectItem>
                    {createBundles.map((bundle) => (
                      <SelectItem key={bundle.id} value={bundle.id}>
                        {bundle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!selectedBundleId && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>
                    Bundle Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={bundleName}
                    onChange={(e) => setBundleName(e.target.value)}
                    placeholder="Enter bundle name..."
                    disabled={!createProjectId}
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={leadFullName}
                  onChange={(e) => setLeadFullName(e.target.value)}
                  placeholder="Enter full name..."
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
                />
              </div>

              <div className="space-y-1.5">
                <Label>Username (optional)</Label>
                <Input
                  value={leadUsername}
                  onChange={(e) => setLeadUsername(e.target.value)}
                  placeholder="Enter username..."
                />
              </div>

              <div className="space-y-1.5">
                <Label>User Type (optional)</Label>
                <Select
                  value={leadUserType || undefined}
                  onValueChange={setLeadUserType}
                >
                  <SelectTrigger className="w-full">
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

          <DialogFooter className="px-6 py-4 border-t shrink-0 flex-row justify-end gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#662EBD] hover:bg-[#5524a8]"
              disabled={
                creating ||
                !createProjectId ||
                (!selectedBundleId && !bundleName.trim()) ||
                !leadFullName.trim() ||
                !leadEmail.trim()
              }
              onClick={() => void handleAddLead()}
            >
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bundle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the bundle and its member list. Campaign
              leads already attached are not removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

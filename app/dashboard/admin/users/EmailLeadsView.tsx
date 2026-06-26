"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { buildLeadImportCsvTemplate } from "@/lib/admin-email/lead-bundles";
import {
  FileUp,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Download,
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
  if (status === "archived") {
    return (
      <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 font-normal">
        Archived
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-normal">
      Active
    </Badge>
  );
}

function GroupsColumnHeader({
  label,
  hint,
}: {
  label: string;
  hint: string;
}) {
  return (
    <th
      className="p-4 text-left font-medium"
      title={hint}
    >
      <span className="border-b border-dotted border-muted-foreground/50 cursor-help">
        {label}
      </span>
    </th>
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

  const [importOpen, setImportOpen] = useState(false);
  const [importProjectId, setImportProjectId] = useState("");
  const [importSelectedBundleId, setImportSelectedBundleId] = useState("");
  const [importBundles, setImportBundles] = useState<BundleRow[]>([]);
  const [importBundlesLoading, setImportBundlesLoading] = useState(false);
  const [importBundleName, setImportBundleName] = useState("");
  const [importDescription, setImportDescription] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const [viewBundleId, setViewBundleId] = useState<string | null>(null);
  const [viewBundleName, setViewBundleName] = useState("");
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersTotal, setMembersTotal] = useState(0);
  const [membersPage, setMembersPage] = useState(1);
  const [membersLimit, setMembersLimit] = useState(25);
  const [membersTotalPages, setMembersTotalPages] = useState(1);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedBundleIds, setSelectedBundleIds] = useState<Set<string>>(
    new Set(),
  );
  const [confirmDeleteBundles, setConfirmDeleteBundles] = useState(false);

  const [editingMember, setEditingMember] = useState<MemberRow | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editUserType, setEditUserType] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(
    new Set(),
  );
  const [confirmDeleteMembers, setConfirmDeleteMembers] = useState(false);
  const [selectingAllMembers, setSelectingAllMembers] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
    setSelectedBundleIds(new Set());
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

  useEffect(() => {
    if (!importOpen || !importProjectId) {
      setImportBundles([]);
      setImportSelectedBundleId("");
      return;
    }

    let cancelled = false;
    const loadProjectBundles = async () => {
      setImportBundlesLoading(true);
      try {
        const params = new URLSearchParams({
          projectId: importProjectId,
          limit: "100",
        });
        const res = await fetch(`/api/admin/email-lead-bundles?${params}`);
        const data = await res.json();
        if (!cancelled && res.ok) {
          setImportBundles(data.bundles ?? []);
        }
      } finally {
        if (!cancelled) setImportBundlesLoading(false);
      }
    };

    void loadProjectBundles();
    return () => {
      cancelled = true;
    };
  }, [importOpen, importProjectId]);

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

  const resetImportForm = () => {
    setImportProjectId("");
    setImportSelectedBundleId("");
    setImportBundles([]);
    setImportBundleName("");
    setImportDescription("");
    setImportFile(null);
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
  };

  const openImportDialog = () => {
    resetImportForm();
    setImportOpen(true);
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
      toast({ title: "Project required", variant: "destructive" });
      return;
    }
    if (!importSelectedBundleId && !importBundleName.trim()) {
      toast({
        title: "Bundle required",
        description: "Select an existing bundle or enter a name for a new one.",
        variant: "destructive",
      });
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
      form.append("projectId", importProjectId);
      form.append("file", importFile);
      if (importSelectedBundleId) {
        form.append("bundleId", importSelectedBundleId);
      } else {
        form.append("name", importBundleName.trim());
        if (importDescription.trim()) {
          form.append("description", importDescription.trim());
        }
      }

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

      const importedBundleId = data.bundle?.id as string | undefined;
      const importedBundleName =
        data.bundle?.name ??
        importBundles.find((bundle) => bundle.id === importSelectedBundleId)
          ?.name ??
        importBundleName.trim();

      toast({
        title: importSelectedBundleId ? "Leads imported" : "Bundle imported",
        description: importSelectedBundleId
          ? `Imported ${data.import?.matched ?? 0} lead(s) into "${importedBundleName}".`
          : `Imported ${data.import?.matched ?? 0} lead(s) into "${importedBundleName}".`,
      });
      setImportOpen(false);
      resetImportForm();
      if (importedBundleId) {
        setViewBundleId(importedBundleId);
        setViewBundleName(importedBundleName);
        setMembersPage(1);
      }
      await loadBundles();
      await loadStats();
      if (importedBundleId) {
        await loadMembers(importedBundleId, 1);
      }
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    setSelectedMemberIds(new Set());
    setMembersPage(1);
  }, [viewBundleId]);

  useEffect(() => {
    setMembersPage(1);
  }, [membersLimit]);

  const loadMembers = useCallback(
    async (bundleIdOverride?: string, pageOverride?: number) => {
      const bundleId = bundleIdOverride ?? viewBundleId;
      const page = pageOverride ?? membersPage;
      if (!bundleId) return;

      setMembersLoading(true);
      try {
        const params = new URLSearchParams({
          members: "1",
          page: String(page),
          limit: String(membersLimit),
        });
        const res = await fetch(
          `/api/admin/email-lead-bundles/${bundleId}?${params}`,
        );
        const data = await res.json();
        if (res.ok) {
          setMembers(data.members ?? []);
          setMembersTotal(data.total ?? 0);
          setMembersTotalPages(data.totalPages ?? 1);
        }
      } finally {
        setMembersLoading(false);
      }
    },
    [viewBundleId, membersPage, membersLimit],
  );

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleViewLeads = (bundle: BundleRow) => {
    setViewBundleId(bundle.id);
    setViewBundleName(bundle.name);
    setSubTab("leads");
  };

  const resetLeadsViewState = () => {
    setViewBundleId(null);
    setViewBundleName("");
    setMembers([]);
    setMembersTotal(0);
    setMembersTotalPages(1);
    setMembersPage(1);
    setSelectedMemberIds(new Set());
  };

  const toggleAllBundles = (checked: boolean) => {
    if (checked) setSelectedBundleIds(new Set(bundles.map((bundle) => bundle.id)));
    else setSelectedBundleIds(new Set());
  };

  const toggleAllMembers = async (checked: boolean) => {
    if (!checked) {
      setSelectedMemberIds(new Set());
      return;
    }
    if (!viewBundleId) return;

    setSelectingAllMembers(true);
    try {
      const res = await fetch(
        `/api/admin/email-lead-bundles/${viewBundleId}?memberIds=1`,
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not select all leads",
          description: data.error || "Selection failed",
          variant: "destructive",
        });
        return;
      }
      setSelectedMemberIds(new Set(data.ids ?? []));
    } finally {
      setSelectingAllMembers(false);
    }
  };

  const allMembersSelected =
    membersTotal > 0 && selectedMemberIds.size === membersTotal;
  const someMembersSelected =
    selectedMemberIds.size > 0 && selectedMemberIds.size < membersTotal;

  const handleDeleteSelectedBundles = async () => {
    const bundleIds = Array.from(selectedBundleIds);
    if (!bundleIds.length) return;

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/email-lead-bundles", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Delete failed",
          description: data.error || "Could not delete groups",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Groups deleted",
        description: `Removed ${data.deletedCount ?? bundleIds.length} group(s).`,
      });
      setConfirmDeleteBundles(false);
      setSelectedBundleIds(new Set());
      if (viewBundleId && bundleIds.includes(viewBundleId)) {
        setViewBundleId(null);
        setSubTab("groups");
      }
      await loadBundles();
      await loadStats();
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSelectedMembers = async () => {
    if (!viewBundleId) return;
    const memberIds = Array.from(selectedMemberIds);
    if (!memberIds.length) return;

    setDeletingMember(true);
    try {
      const res = await fetch(
        `/api/admin/email-lead-bundles/${viewBundleId}/members`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberIds }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not delete leads",
          description: data.error || "Delete failed",
          variant: "destructive",
        });
        return;
      }

      setSelectedMemberIds(new Set());
      setConfirmDeleteMembers(false);
      if (members.length === memberIds.length && membersPage > 1) {
        setMembersPage((prev) => prev - 1);
      } else {
        await loadMembers();
      }
      await loadBundles();
      await loadStats();
      toast({
        title: "Leads deleted",
        description: `Removed ${data.deletedCount ?? memberIds.length} lead(s).`,
      });
    } finally {
      setDeletingMember(false);
    }
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

      const addedBundleName = createdNewBundle
        ? bundleName.trim()
        : (createBundles.find((bundle) => bundle.id === bundleId)?.name ??
          bundles.find((bundle) => bundle.id === bundleId)?.name ??
          viewBundleName);

      setViewBundleId(bundleId);
      setViewBundleName(addedBundleName);
      setMembersPage(1);
      await loadBundles();
      await loadStats();
      await loadMembers(bundleId, 1);
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

  const openEditMember = (member: MemberRow) => {
    setEditingMember(member);
    setEditFullName(member.fullName || "");
    setEditEmail(member.email || "");
    setEditUsername(member.username || "");
    setEditUserType(member.userType || "");
  };

  const resetEditMemberForm = () => {
    setEditingMember(null);
    setEditFullName("");
    setEditEmail("");
    setEditUsername("");
    setEditUserType("");
  };

  const handleSaveMember = async () => {
    if (!editingMember || !viewBundleId) return;
    if (!editEmail.trim()) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }

    setSavingMember(true);
    try {
      const res = await fetch(
        `/api/admin/email-lead-bundles/${viewBundleId}/members/${editingMember.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: editEmail.trim(),
            fullName: editFullName.trim() || null,
            username: editUsername.trim() || null,
            userType: editUserType || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not update lead",
          description: data.error || "Update failed",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Lead updated" });
      resetEditMemberForm();
      await loadMembers();
      await loadBundles();
      await loadStats();
    } finally {
      setSavingMember(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteMemberId || !viewBundleId) return;

    setDeletingMember(true);
    try {
      const res = await fetch(
        `/api/admin/email-lead-bundles/${viewBundleId}/members/${deleteMemberId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not delete lead",
          description: data.error || "Delete failed",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Lead deleted" });
      setDeleteMemberId(null);
      setSelectedMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteMemberId);
        return next;
      });
      await loadMembers();
      await loadBundles();
      await loadStats();
    } finally {
      setDeletingMember(false);
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
          variant="outline"
          className="h-11 border-gray-300"
          onClick={openImportDialog}
        >
          <Upload className="h-4 w-4 mr-2" />
          Import CSV/Excel
        </Button>
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
          if (id === "groups") {
            resetLeadsViewState();
            return;
          }
          void loadStats();
          if (viewBundleId) {
            void loadMembers(viewBundleId, membersPage);
          }
        }}
        className="w-full max-w-3xl overflow-x-auto"
        isDark={isDark}
        light
        fillWidth={false}
      />

      {subTab === "groups" && (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
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

            {selectedBundleIds.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {selectedBundleIds.size} selected
                </span>
                <Button
                  variant="destructive"
                  className="h-11"
                  onClick={() => setConfirmDeleteBundles(true)}
                  disabled={deleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50/80 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="p-4 w-10">
                      <Checkbox
                        checked={
                          bundles.length > 0 &&
                          bundles.every((bundle) =>
                            selectedBundleIds.has(bundle.id),
                          )
                        }
                        onCheckedChange={(v) => toggleAllBundles(!!v)}
                      />
                    </th>
                    <th className="p-4 text-left font-medium">Name</th>
                    <th className="p-4 text-left font-medium">Description</th>
                    <th className="p-4 text-left font-medium">Total Leads</th>
                    <GroupsColumnHeader
                      label="Processed"
                      hint="Leads successfully added to this group (CSV import or manual add). Not email sends, opens, or clicks."
                    />
                    <GroupsColumnHeader
                      label="Failed"
                      hint="Rows that could not be imported (invalid email, duplicate, or import error). Shown only when greater than zero."
                    />
                    <GroupsColumnHeader
                      label="Status"
                      hint="Active = normal group. Completed = CSV/Excel import finished. Not campaign delivery status."
                    />
                    <th className="p-4 text-left font-medium">Created</th>
                    <th className="p-4 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading &&
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 9 }).map((_, j) => (
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
                        className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                        onClick={() => handleViewLeads(bundle)}
                      >
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedBundleIds.has(bundle.id)}
                            onCheckedChange={(v) => {
                              setSelectedBundleIds((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(bundle.id);
                                else next.delete(bundle.id);
                                return next;
                              });
                            }}
                          />
                        </td>
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
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
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
                        colSpan={9}
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
        <div className="space-y-3">
          {viewBundleId && selectedMemberIds.size > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {selectedMemberIds.size} selected
              </span>
              <Button
                variant="destructive"
                className="h-11"
                onClick={() => setConfirmDeleteMembers(true)}
                disabled={deletingMember}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}

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
                  <th className="p-4 w-10">
                    <Checkbox
                      checked={
                        allMembersSelected
                          ? true
                          : someMembersSelected
                            ? "indeterminate"
                            : false
                      }
                      disabled={
                        !viewBundleId || membersLoading || selectingAllMembers
                      }
                      onCheckedChange={(v) => void toggleAllMembers(!!v)}
                    />
                  </th>
                  <th className="p-4 text-left font-medium">Email</th>
                  <th className="p-4 text-left font-medium">Contact</th>
                  <th className="p-4 text-left font-medium">Username</th>
                  <th className="p-4 text-left font-medium">User Type</th>
                  <th className="p-4 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {membersLoading &&
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 6 }).map((_, j) => (
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
                      <td className="p-4">
                        <Checkbox
                          checked={selectedMemberIds.has(m.id)}
                          onCheckedChange={(v) => {
                            setSelectedMemberIds((prev) => {
                              const next = new Set(prev);
                              if (v) next.add(m.id);
                              else next.delete(m.id);
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="p-4 font-medium">{m.email}</td>
                      <td className="p-4">{m.fullName || "—"}</td>
                      <td className="p-4">{m.username || "—"}</td>
                      <td className="p-4 capitalize text-muted-foreground">
                        {m.userType || "—"}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-[#662EBD] hover:bg-purple-50"
                            onClick={() => openEditMember(m)}
                            aria-label={`Edit ${m.email}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-md p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setDeleteMemberId(m.id)}
                            aria-label={`Delete ${m.email}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {!membersLoading && !viewBundleId && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-12 text-center text-muted-foreground"
                    >
                      Select a group and click View Leads to see its members.
                    </td>
                  </tr>
                )}
                {!membersLoading && viewBundleId && members.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="p-12 text-center text-muted-foreground"
                    >
                      No leads in this bundle yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {viewBundleId && membersTotal > 0 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <PaginationControls
                page={membersPage}
                limit={membersLimit}
                total={membersTotal}
                totalPages={membersTotalPages}
                hasNextPage={membersPage < membersTotalPages}
                hasPreviousPage={membersPage > 1}
                onPageChange={setMembersPage}
                onLimitChange={setMembersLimit}
                loading={membersLoading}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            </div>
          )}
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
            <DialogTitle>Add New Lead</DialogTitle>
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

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) resetImportForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-2 pt-4 pb-4 border-b shrink-0">
            <DialogTitle>Import CSV / Excel</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 min-h-0 px-2 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>
                  Project <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={importProjectId || undefined}
                  onValueChange={(value) => {
                    setImportProjectId(value);
                    setImportSelectedBundleId("");
                    setImportBundleName("");
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
                  value={importSelectedBundleId || "__new__"}
                  onValueChange={(value) => {
                    if (value === "__new__") {
                      setImportSelectedBundleId("");
                      return;
                    }
                    setImportSelectedBundleId(value);
                    setImportBundleName("");
                  }}
                  disabled={!importProjectId || importBundlesLoading}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        !importProjectId
                          ? "Select a project first"
                          : importBundlesLoading
                            ? "Loading bundles..."
                            : "Create new bundle or select existing..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">Create new bundle</SelectItem>
                    {importBundles.map((bundle) => (
                      <SelectItem key={bundle.id} value={bundle.id}>
                        {bundle.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!importSelectedBundleId && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>
                    Bundle Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={importBundleName}
                    onChange={(e) => setImportBundleName(e.target.value)}
                    placeholder="Enter bundle name..."
                    disabled={!importProjectId}
                  />
                </div>
              )}

              {!importSelectedBundleId && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Description (optional)</Label>
                  <Textarea
                    value={importDescription}
                    onChange={(e) => setImportDescription(e.target.value)}
                    placeholder="Optional description..."
                    rows={2}
                  />
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>
                    CSV / Excel File <span className="text-red-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-[#662EBD] hover:text-[#5524a8]"
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
                  <span className="font-medium">full name</span> (shown as Contact),{" "}
                  <span className="font-medium">username</span>,{" "}
                  <span className="font-medium">user type</span> (creator, advertiser,
                  admin).
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0 flex-row justify-end gap-2 sm:gap-3">
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#662EBD] hover:bg-[#5524a8]"
              disabled={
                importing ||
                !importProjectId ||
                (!importSelectedBundleId && !importBundleName.trim()) ||
                !importFile
              }
              onClick={() => void handleImportBundle()}
            >
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importSelectedBundleId ? "Import" : "Create & Import"}
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

      <AlertDialog
        open={confirmDeleteBundles}
        onOpenChange={setConfirmDeleteBundles}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected groups?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {selectedBundleIds.size} group
              {selectedBundleIds.size === 1 ? "" : "s"} and their member lists.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteSelectedBundles();
              }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!editingMember}
        onOpenChange={(open) => {
          if (!open) resetEditMemberForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Enter full name..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Enter email..."
                disabled={Boolean(editingMember?.userId)}
              />
              {editingMember?.userId && (
                <p className="text-xs text-muted-foreground">
                  Email is linked to a platform user and cannot be changed.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Username (optional)</Label>
              <Input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Enter username..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>User Type (optional)</Label>
              <Select
                value={editUserType || undefined}
                onValueChange={setEditUserType}
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
          <DialogFooter className="gap-2 sm:gap-3">
            <Button variant="outline" onClick={resetEditMemberForm}>
              Cancel
            </Button>
            <Button
              className="bg-[#662EBD] hover:bg-[#5524a8]"
              disabled={savingMember || !editEmail.trim()}
              onClick={() => void handleSaveMember()}
            >
              {savingMember && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteMemberId}
        onOpenChange={(open) => {
          if (!open) setDeleteMemberId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the lead from this bundle. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingMember}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingMember}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteMember();
              }}
            >
              {deletingMember ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmDeleteMembers}
        onOpenChange={setConfirmDeleteMembers}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected leads?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedMemberIds.size} lead
              {selectedMemberIds.size === 1 ? "" : "s"} from this bundle. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingMember}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingMember}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteSelectedMembers();
              }}
            >
              {deletingMember ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

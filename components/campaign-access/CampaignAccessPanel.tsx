"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  FileDown,
  Link2,
  ListPlus,
  Loader2,
  Lock,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToastAction } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  ACCESS_SOURCE_LABELS,
  MAX_ALLOWLIST_NAME_LENGTH,
  accessMemberFilterKey,
  accessMemberSourceLabel,
  accessMembersToCsv,
  formatAddResultSummary,
  parseUsernames,
  sortAccessMembers,
  type BrandAllowlist,
  type ContestAccessMember,
  type ContestAccessSource,
  type RosterSortKey,
} from "@/lib/campaign-access";
import { accessListApi, allowlistApi, type AddResult } from "./api";
import { AddResultDetails } from "./AddResultDetails";
import { CreatorAvatar } from "./CreatorAvatar";
import { EmptyState } from "./EmptyState";
import { InviteLinksSection } from "./InviteLinksSection";
import { RelativeTime } from "./RelativeTime";
import { AccessPanelSkeleton } from "./Skeletons";
import { UsernameChipsInput } from "./UsernameChipsInput";

type Props = {
  contestId: string;
  /** Brand that owns the campaign; required for admins to load that brand's saved lists. */
  advertiserId?: string | null;
};

type AddTab = "usernames" | "list" | "invite";

const ALL = "all";
const ROSTER_PAGE_SIZE = 50;
/** How long a removed creator can be restored before the removal is sent. */
const UNDO_REMOVE_MS = 5000;

const cardClass = "rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-white/10";
const fieldClass = "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";
const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";
const tabTrigger =
  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] data-[state=active]:bg-white data-[state=active]:text-[#4A00BE] data-[state=active]:shadow-sm dark:text-gray-300 dark:hover:text-white dark:data-[state=active]:bg-[#7F39EC] dark:data-[state=active]:text-white";

const SOURCE_CHIP: Record<ContestAccessSource, string> = {
  manual: "bg-purple-50 text-[#4A00BE] dark:bg-[#2B1159] dark:text-purple-200",
  saved_list: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  invite_link: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  application: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  existing_submitter: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
};

type LastResult = { summary: string; notFound?: string[]; invalid?: string[] };

export function CampaignAccessPanel({ contestId, advertiserId }: Props) {
  const isDark = useDashboardDark();
  const [members, setMembers] = useState<ContestAccessMember[]>([]);
  const [lists, setLists] = useState<BrandAllowlist[]>([]);
  const [skipRequirements, setSkipRequirements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [addTab, setAddTab] = useState<AddTab>("usernames");
  const [usernames, setUsernames] = useState<string[]>([]);
  const [importListId, setImportListId] = useState("");
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [createLinkSignal, setCreateLinkSignal] = useState(0);
  const [filter, setFilter] = useState<string>(ALL);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: RosterSortKey; dir: "asc" | "desc" }>({
    key: "added",
    dir: "desc",
  });
  const [shown, setShown] = useState(ROSTER_PAGE_SIZE);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [saveListOpen, setSaveListOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [pendingRemoval, setPendingRemoval] = useState<Set<string>>(new Set());
  const removalTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const rosterRef = useRef<HTMLElement>(null);
  const usernamesInputId = "access-add-usernames";

  useEffect(() => {
    setShown(ROSTER_PAGE_SIZE);
  }, [filter, query]);

  const load = useCallback(async () => {
    try {
      const res = await accessListApi.get(contestId);
      setMembers(res.members);
      setSkipRequirements(!!res.contest.access_list_skips_requirements);
      const listRes = await allowlistApi.list(advertiserId ?? res.contest.advertiser_id);
      setLists(listRes.allowlists);
    } catch (e: any) {
      toast({ title: "Could not load access list", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [contestId, advertiserId]);

  useEffect(() => {
    load();
  }, [load]);

  // Leaving the page sends any removal still waiting for its undo window.
  useEffect(() => {
    const timers = removalTimers.current;
    return () => {
      const ids = Array.from(timers.keys());
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      if (ids.length > 0) accessListApi.remove(contestId, ids).catch(() => {});
    };
  }, [contestId]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    try {
      const message = await fn();
      if (message) toast({ title: message });
      await load();
      return true;
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Keeps the add result on screen (with any failed names) and returns the toast line. */
  const recordResult = (res: AddResult, prefix?: string) => {
    const summary = `${prefix ? `${prefix} · ` : ""}${formatAddResultSummary(res)}`;
    setLastResult({ summary, notFound: res.notFound, invalid: res.invalid });
    return summary;
  };

  const unhide = (userId: string) =>
    setPendingRemoval((s) => {
      const next = new Set(s);
      next.delete(userId);
      return next;
    });

  const commitRemoval = async (m: ContestAccessMember) => {
    removalTimers.current.delete(m.user_id);
    try {
      await accessListApi.remove(contestId, [m.user_id]);
      await load();
    } catch (e: any) {
      toast({
        title: `Could not remove @${m.username ?? "creator"}`,
        description: e.message,
        variant: "destructive",
      });
    } finally {
      unhide(m.user_id);
    }
  };

  const undoRemoval = (m: ContestAccessMember) => {
    const timer = removalTimers.current.get(m.user_id);
    if (!timer) {
      // The toast can outlive the timer while hovered; by then the removal was sent.
      toast({
        title: "Too late to undo",
        description: `Add @${m.username ?? "the creator"} again with Add usernames.`,
      });
      return;
    }
    clearTimeout(timer);
    removalTimers.current.delete(m.user_id);
    unhide(m.user_id);
    toast({ title: `Kept @${m.username ?? "creator"}` });
  };

  const startRemoval = (m: ContestAccessMember) => {
    if (removalTimers.current.has(m.user_id)) return;
    setPendingRemoval((s) => new Set(s).add(m.user_id));
    setChecked((s) => {
      const next = new Set(s);
      next.delete(m.user_id);
      return next;
    });
    removalTimers.current.set(
      m.user_id,
      // A little longer than the toast, so it normally closes before the removal is sent.
      setTimeout(() => commitRemoval(m), UNDO_REMOVE_MS + 500),
    );
    toast({
      title: `Removed @${m.username ?? "creator"}`,
      description: "They lose access to this campaign.",
      duration: UNDO_REMOVE_MS,
      action: (
        <ToastAction altText={`Undo removing @${m.username ?? "creator"}`} onClick={() => undoRemoval(m)}>
          Undo
        </ToastAction>
      ),
    });
  };

  const activeMembers = useMemo(
    () => members.filter((m) => !pendingRemoval.has(m.user_id)),
    [members, pendingRemoval],
  );

  const sourceCounts = useMemo(() => {
    const counts = new Map<ContestAccessSource, number>();
    for (const m of activeMembers) counts.set(m.source, (counts.get(m.source) ?? 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeMembers]);

  const filterOptions = useMemo(() => {
    const opts = new Map<string, { label: string; count: number }>();
    for (const m of activeMembers) {
      const key = accessMemberFilterKey(m);
      const label = key === m.source ? ACCESS_SOURCE_LABELS[m.source] : accessMemberSourceLabel(m);
      opts.set(key, { label, count: (opts.get(key)?.count ?? 0) + 1 });
    }
    return Array.from(opts.entries());
  }, [activeMembers]);

  const visible = useMemo(() => {
    const q = query.trim().replace(/^@/, "").toLowerCase();
    const filtered = activeMembers.filter(
      (m) =>
        (filter === ALL || accessMemberFilterKey(m) === filter) &&
        (!q ||
          (m.username ?? "").toLowerCase().includes(q) ||
          (m.full_name ?? "").toLowerCase().includes(q)),
    );
    return sortAccessMembers(filtered, sort.key, sort.dir);
  }, [activeMembers, filter, query, sort]);

  const usedLists = useMemo(() => {
    const usedIds = new Set(
      members
        .filter((m) => m.source === "saved_list" && m.source_allowlist_id)
        .map((m) => m.source_allowlist_id as string),
    );
    return lists.filter((l) => usedIds.has(l.id));
  }, [members, lists]);

  const page = visible.slice(0, shown);
  const allOnPageChecked = page.length > 0 && page.every((m) => checked.has(m.user_id));
  const parsedUsernames = parseUsernames(usernames);

  const toggleSort = (key: RosterSortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "added" ? "desc" : "asc" },
    );

  const sortHeader = (key: RosterSortKey, label: string, className?: string) => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
        className={cn("px-3 py-2 text-left font-medium", className)}
      >
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-sm hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:hover:text-white"
          onClick={() => toggleSort(key)}
        >
          {label}
          <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden="true" />
        </button>
      </th>
    );
  };

  const exportCsv = () => {
    const csv = accessMembersToCsv(visible);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-access-${contestId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const syncAll = () =>
    run("sync", async () => {
      let added = 0;
      for (const l of usedLists) {
        const res = await accessListApi.syncList(contestId, l.id);
        added += res.added;
      }
      setLastResult(null);
      return added === 0
        ? "Saved lists are already in sync"
        : `Synced ${usedLists.length} list${usedLists.length === 1 ? "" : "s"} · Added ${added} creator${added === 1 ? "" : "s"}`;
    });

  const jumpToAdd = (tab: AddTab) => {
    setAddTab(tab);
    if (tab === "usernames") setTimeout(() => document.getElementById(usernamesInputId)?.focus(), 50);
    if (tab === "invite") setCreateLinkSignal((n) => n + 1);
  };

  const viewJoinedVia = (linkId: string) => {
    setFilter(`invite:${linkId}`);
    setQuery("");
    rosterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <div className={cn(isDark && "dark")}>
        <AccessPanelSkeleton />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", isDark && "dark")}>
      {/* Summary */}
      <div className={cn("space-y-2", cardClass)}>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <Lock className="h-4 w-4" aria-hidden="true" />
          {activeMembers.length} creator{activeMembers.length === 1 ? " has" : "s have"} access
        </h3>
        {sourceCounts.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Creators by source">
            {sourceCounts.map(([source, count]) => (
              <li
                key={source}
                className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", SOURCE_CHIP[source])}
              >
                {ACCESS_SOURCE_LABELS[source]} · {count}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add creators */}
      <section aria-labelledby="add-creators-heading" className={cn("space-y-4", cardClass)}>
        <h3 id="add-creators-heading" className="font-semibold text-gray-900 dark:text-white">
          Add creators
        </h3>
        <TabsPrimitive.Root value={addTab} onValueChange={(v) => setAddTab(v as AddTab)} className="space-y-4">
          <TabsPrimitive.List
            aria-label="How to add creators"
            className="flex max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1 dark:bg-white/5"
          >
            <TabsPrimitive.Trigger value="usernames" className={tabTrigger}>
              <UserPlus className="h-4 w-4" aria-hidden="true" /> Usernames
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger value="list" className={tabTrigger}>
              <ListPlus className="h-4 w-4" aria-hidden="true" /> Saved list
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger value="invite" className={tabTrigger}>
              <Link2 className="h-4 w-4" aria-hidden="true" /> Invite link
            </TabsPrimitive.Trigger>
          </TabsPrimitive.List>

          <TabsPrimitive.Content value="usernames" className="space-y-3 focus-visible:outline-none">
            <Label
              id="access-usernames-label"
              htmlFor={usernamesInputId}
              className="text-sm font-normal text-gray-700 dark:text-gray-300"
            >
              Paste or type usernames, separated by commas, spaces or new lines.
            </Label>
            <UsernameChipsInput
              id={usernamesInputId}
              labelledBy="access-usernames-label"
              value={usernames}
              onChange={setUsernames}
              disabled={busy === "add"}
              allowFile
            />
            <Button
              disabled={parsedUsernames.valid.length === 0 || busy === "add"}
              onClick={() =>
                run("add", async () => {
                  const res = await accessListApi.addUsernames(contestId, parsedUsernames.valid.join(","));
                  setUsernames([]);
                  return recordResult({
                    ...res,
                    invalid: [...(res.invalid ?? []), ...parsedUsernames.invalid],
                  });
                })
              }
            >
              {busy === "add" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {parsedUsernames.valid.length > 0
                ? `Add ${parsedUsernames.valid.length} creator${parsedUsernames.valid.length === 1 ? "" : "s"}`
                : "Add creators"}
            </Button>
          </TabsPrimitive.Content>

          <TabsPrimitive.Content value="list" className="space-y-4 focus-visible:outline-none">
            {lists.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                You don&apos;t have any saved lists yet. Save this roster as a list from the ⋯ menu
                below, or create one on the Saved allowlists page.
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="access-import-list" className="text-sm font-normal text-gray-700 dark:text-gray-300">
                    Import everyone on a saved list
                  </Label>
                  <Select value={importListId} onValueChange={setImportListId}>
                    <SelectTrigger id="access-import-list" isDark={isDark}>
                      <SelectValue placeholder="Choose a list" />
                    </SelectTrigger>
                    <SelectContent isDark={isDark}>
                      {lists.map((l) => (
                        <SelectItem key={l.id} value={l.id} isDark={isDark}>
                          {l.name} ({l.member_count})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  disabled={!importListId || busy === "import"}
                  onClick={() =>
                    run("import", async () => {
                      const res = await accessListApi.importList(contestId, importListId);
                      setImportListId("");
                      return recordResult(res);
                    })
                  }
                >
                  {busy === "import" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Import
                </Button>
              </div>
            )}

            {usedLists.length > 0 && (
              <div className="space-y-2 rounded-lg bg-gray-50 p-3 dark:bg-white/5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sync from saved lists</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Adds creators who joined a list after you imported it. Nobody is removed.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className={outlineDark} disabled={!!busy} onClick={syncAll}>
                    {busy === "sync" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Sync all
                  </Button>
                </div>
                <ul className="flex flex-wrap gap-1">
                  {usedLists.map((l) => (
                    <li key={l.id}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 dark:text-gray-200 dark:hover:bg-white/10"
                        disabled={!!busy}
                        onClick={() =>
                          run(`sync:${l.id}`, async () => {
                            const res = await accessListApi.syncList(contestId, l.id);
                            return res.added === 0
                              ? `"${l.name}" is already in sync`
                              : recordResult(res, `Synced "${l.name}"`);
                          })
                        }
                      >
                        {busy === `sync:${l.id}` ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {l.name} · {l.member_count}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsPrimitive.Content>

          {/* Kept mounted so the create-link dialog can open from the empty state. */}
          <TabsPrimitive.Content
            value="invite"
            forceMount
            hidden={addTab !== "invite"}
            className="focus-visible:outline-none"
          >
            <InviteLinksSection
              contestId={contestId}
              openCreateSignal={createLinkSignal}
              onViewJoined={viewJoinedVia}
              embedded
            />
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>

        {lastResult && (
          <div
            role="status"
            className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-gray-900 dark:text-gray-100">{lastResult.summary}</p>
              <button
                type="button"
                aria-label="Dismiss result"
                className="rounded-sm text-gray-400 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:hover:text-white"
                onClick={() => setLastResult(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <AddResultDetails notFound={lastResult.notFound} invalid={lastResult.invalid} />
          </div>
        )}
      </section>

      {/* Roster */}
      <section ref={rosterRef} aria-labelledby="roster-heading" className="scroll-mt-24 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="roster-heading" className="font-semibold text-gray-900 dark:text-white">
            Creators with access
          </h3>
          {activeMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className={outlineDark} onClick={exportCsv}>
                <FileDown className="mr-1.5 h-4 w-4" /> Export CSV
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className={cn("h-9 w-9", outlineDark)}
                    aria-label="More roster actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className={cn(isDark && "border-white/10 bg-[#07031D] text-white")}
                >
                  <DropdownMenuItem onSelect={() => setSaveListOpen(true)}>
                    <ListPlus className="mr-2 h-4 w-4" /> Save roster as a list
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {activeMembers.length === 0 ? (
          <div className={cardClass}>
            <EmptyState
              icon={Users}
              title="No creators yet"
              description="Creators you add here can see and join this campaign."
              actions={
                <>
                  <Button size="sm" onClick={() => jumpToAdd("usernames")}>
                    <UserPlus className="mr-1.5 h-4 w-4" /> Add usernames
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={outlineDark}
                    disabled={lists.length === 0}
                    title={lists.length === 0 ? "You don't have any saved lists yet" : undefined}
                    onClick={() => jumpToAdd("list")}
                  >
                    <Download className="mr-1.5 h-4 w-4" /> Import list
                  </Button>
                  <Button size="sm" variant="outline" className={outlineDark} onClick={() => jumpToAdd("invite")}>
                    <Link2 className="mr-1.5 h-4 w-4" /> Create invite link
                  </Button>
                </>
              }
            />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative sm:w-64">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  className={cn("h-10 pl-8 pr-9", fieldClass)}
                  placeholder="Search creators"
                  aria-label="Search creators with access"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC] dark:hover:bg-white/10 dark:hover:text-white"
                    onClick={() => setQuery("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div role="group" aria-label="Filter by source" className="flex flex-wrap gap-1.5">
                {[[ALL, { label: "All", count: activeMembers.length }] as const, ...filterOptions].map(
                  ([value, { label, count }]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                      className={cn(
                        "max-w-[16rem] truncate rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]",
                        filter === value
                          ? "border-[#7F39EC] bg-[#7F39EC] text-white"
                          : "border-gray-200 text-gray-700 hover:border-[#7F39EC]/60 dark:border-white/15 dark:text-gray-200",
                      )}
                    >
                      {label} · {count}
                    </button>
                  ),
                )}
              </div>
            </div>

            {checked.size > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-purple-200 bg-purple-50/60 px-3 py-2 text-sm dark:border-[#7F39EC]/40 dark:bg-[#7F39EC]/15 dark:text-gray-100">
                <span className="font-medium">{checked.size} selected</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="dark:hover:bg-white/10"
                  onClick={() => setChecked(new Set())}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn("ml-auto text-red-600 dark:text-red-400", outlineDark)}
                  onClick={() => setConfirmBulkRemove(true)}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" /> Remove {checked.size}
                </Button>
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-white/5 dark:text-gray-400">
                  <tr>
                    <th scope="col" className="w-10 px-3 py-2">
                      <Checkbox
                        aria-label="Select all shown"
                        checked={allOnPageChecked}
                        onCheckedChange={(v) =>
                          setChecked((prev) => {
                            const next = new Set(prev);
                            page.forEach((m) => (v ? next.add(m.user_id) : next.delete(m.user_id)));
                            return next;
                          })
                        }
                      />
                    </th>
                    {sortHeader("creator", "Creator")}
                    {sortHeader("source", "Source", "hidden sm:table-cell")}
                    {sortHeader("added", "Added")}
                    <th scope="col" className="w-12 px-3 py-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                        No creators match.
                      </td>
                    </tr>
                  ) : (
                    page.map((m) => (
                      <tr key={m.user_id} className="hover:bg-gray-50/60 dark:hover:bg-white/5">
                        <td className="px-3 py-2.5">
                          <Checkbox
                            aria-label={`Select @${m.username ?? "creator"}`}
                            checked={checked.has(m.user_id)}
                            onCheckedChange={() =>
                              setChecked((prev) => {
                                const next = new Set(prev);
                                if (next.has(m.user_id)) next.delete(m.user_id);
                                else next.add(m.user_id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-3">
                            <CreatorAvatar username={m.username} fullName={m.full_name} src={m.profile_picture_url} />
                            <div className="min-w-0">
                              <div className="truncate font-medium text-gray-900 dark:text-white">
                                @{m.username ?? "unknown"}
                              </div>
                              {m.full_name && (
                                <div className="truncate text-xs text-gray-500 dark:text-gray-400">{m.full_name}</div>
                              )}
                              <div className="truncate text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                                {accessMemberSourceLabel(m)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 text-gray-600 dark:text-gray-300 sm:table-cell">
                          {accessMemberSourceLabel(m)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-gray-600 dark:text-gray-300">
                          <RelativeTime value={m.added_at} />
                        </td>
                        <td className="px-3 py-2.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="hover:bg-red-50 dark:hover:bg-red-500/10"
                            aria-label={`Remove @${m.username ?? "creator"}`}
                            onClick={() => startRemoval(m)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {visible.length > shown && (
                <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                  <span>
                    Showing {shown} of {visible.length}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className={outlineDark}
                    onClick={() => setShown((n) => n + ROSTER_PAGE_SIZE)}
                  >
                    Show more
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* Settings */}
      <section aria-labelledby="access-settings-heading" className={cn("space-y-3", cardClass)}>
        <h3
          id="access-settings-heading"
          className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" /> Settings
        </h3>
        <label className="flex cursor-pointer items-start gap-3">
          <Switch
            variant="theme-aware"
            theme={isDark ? "dark" : "light"}
            checked={skipRequirements}
            disabled={busy === "skip"}
            onCheckedChange={(v) =>
              run("skip", async () => {
                await accessListApi.setSkipRequirements(contestId, v);
                return v
                  ? "Creators on the access list now skip requirements"
                  : "Creators on the access list must meet requirements";
              })
            }
          />
          <span className="text-sm text-gray-900 dark:text-gray-100">
            <span className="font-medium">Creators on the access list skip requirements</span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              For example, if the campaign needs a trust score of 60, a creator you added with a
              score of 40 can still submit while this is on. When it&apos;s off, they need to meet
              the requirements like everyone else.
            </span>
          </span>
        </label>
      </section>

      <AlertDialog open={confirmBulkRemove} onOpenChange={setConfirmBulkRemove}>
        <AlertDialogContent className={cn(isDark && "dark border-white/10 bg-[#06021D] text-white")}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove {checked.size} creator{checked.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to this campaign right away. You can add them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={outlineDark} disabled={busy === "bulk-remove"}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={busy === "bulk-remove"}
              onClick={async (e) => {
                e.preventDefault();
                const ids = Array.from(checked);
                const ok = await run("bulk-remove", async () => {
                  await accessListApi.remove(contestId, ids);
                  return `Removed ${ids.length} creator${ids.length === 1 ? "" : "s"}`;
                });
                if (ok) {
                  setChecked(new Set());
                  setConfirmBulkRemove(false);
                }
              }}
            >
              {busy === "bulk-remove" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog isdark={isDark} open={saveListOpen} onOpenChange={setSaveListOpen}>
        <DialogContent className={cn("sm:max-w-md", isDark && "dark text-white")}>
          <DialogHeader>
            <DialogTitle>Save roster as a list</DialogTitle>
            <DialogDescription>
              Saves the {activeMembers.length} creators with access as a reusable list for other
              campaigns.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!saveName.trim()) return;
              run("save", async () => {
                const res = await accessListApi.saveAsList(contestId, saveName);
                setSaveName("");
                setSaveListOpen(false);
                return `Saved "${res.allowlist.name}" · ${res.allowlist.member_count} creators`;
              });
            }}
          >
            <Label htmlFor="save-roster-name">List name</Label>
            <Input
              id="save-roster-name"
              autoFocus
              className={fieldClass}
              placeholder="e.g. Summer launch creators"
              maxLength={MAX_ALLOWLIST_NAME_LENGTH}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" className={outlineDark} onClick={() => setSaveListOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!saveName.trim() || busy === "save"}>
                {busy === "save" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save list
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

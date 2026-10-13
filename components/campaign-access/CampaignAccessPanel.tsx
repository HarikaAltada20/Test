"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Link2,
  Loader2,
  Lock,
  RefreshCw,
  Save,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToastAction } from "@/components/ui/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  ACCESS_SOURCE_LABELS,
  type BrandAllowlist,
  type ContestAccessMember,
} from "@/lib/campaign-access";
import { accessListApi, allowlistApi, summarizeAddResult, type AddResult } from "./api";
import { AddResultDetails } from "./AddResultDetails";
import { CreatorAvatar } from "./CreatorAvatar";
import { EmptyState } from "./EmptyState";
import { InviteLinksSection } from "./InviteLinksSection";
import { RelativeTime } from "./RelativeTime";
import { AccessPanelSkeleton } from "./Skeletons";

type Props = {
  contestId: string;
  /** Brand that owns the campaign; required for admins to load that brand's saved lists. */
  advertiserId?: string | null;
};

const ALL = "all";
const ROSTER_PAGE_SIZE = 50;
/** How long a removed creator can be restored before the removal is sent. */
const UNDO_REMOVE_MS = 5000;

const boxClass = "rounded-md border border-gray-200 p-4 dark:border-white/10";
const fieldClass = "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";
const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

export function CampaignAccessPanel({ contestId, advertiserId }: Props) {
  const isDark = useDashboardDark();
  const [members, setMembers] = useState<ContestAccessMember[]>([]);
  const [lists, setLists] = useState<BrandAllowlist[]>([]);
  const [skipRequirements, setSkipRequirements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [usernames, setUsernames] = useState("");
  const [importListId, setImportListId] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [filter, setFilter] = useState<string>(ALL);
  const [shown, setShown] = useState(ROSTER_PAGE_SIZE);
  const [addFailures, setAddFailures] = useState<Pick<AddResult, "notFound" | "invalid"> | null>(
    null,
  );
  const [createLinkSignal, setCreateLinkSignal] = useState(0);
  const [pendingRemoval, setPendingRemoval] = useState<Set<string>>(new Set());
  const removalTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const usernamesRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setShown(ROSTER_PAGE_SIZE);
  }, [filter]);

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
    } catch (e: any) {
      toast({ title: "Something went wrong", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const showAddResult = (res: AddResult) => {
    const failed = (res.notFound?.length ?? 0) + (res.invalid?.length ?? 0) > 0;
    setAddFailures(failed ? { notFound: res.notFound, invalid: res.invalid } : null);
    return summarizeAddResult(res);
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

  const filterOptions = useMemo(() => {
    const opts = new Map<string, string>();
    for (const m of activeMembers) {
      if (m.source === "saved_list" && m.source_allowlist_id) {
        opts.set(`list:${m.source_allowlist_id}`, `From list: ${m.source_allowlist_name ?? "deleted list"}`);
      } else if (m.source === "invite_link" && m.source_invite_link_id) {
        opts.set(`invite:${m.source_invite_link_id}`, `Invite link: ${m.source_invite_link_label ?? "Untitled link"}`);
      } else {
        opts.set(m.source, ACCESS_SOURCE_LABELS[m.source]);
      }
    }
    return Array.from(opts.entries());
  }, [activeMembers]);

  const visible = useMemo(() => {
    if (filter === ALL) return activeMembers;
    if (filter.startsWith("list:")) {
      const id = filter.slice(5);
      return activeMembers.filter((m) => m.source_allowlist_id === id);
    }
    if (filter.startsWith("invite:")) {
      const id = filter.slice(7);
      return activeMembers.filter((m) => m.source_invite_link_id === id);
    }
    return activeMembers.filter(
      (m) =>
        m.source === filter &&
        !(m.source === "saved_list" && m.source_allowlist_id) &&
        !(m.source === "invite_link" && m.source_invite_link_id),
    );
  }, [activeMembers, filter]);

  const usedLists = useMemo(() => {
    const usedIds = new Set(
      members
        .filter((m) => m.source === "saved_list" && m.source_allowlist_id)
        .map((m) => m.source_allowlist_id as string),
    );
    return lists.filter((l) => usedIds.has(l.id));
  }, [members, lists]);

  const sourceLabel = (m: ContestAccessMember) => {
    if (m.source === "saved_list") return `List: ${m.source_allowlist_name ?? "deleted list"}`;
    if (m.source === "invite_link" && m.source_invite_link_id) {
      return `Invite link: ${m.source_invite_link_label ?? "Untitled link"}`;
    }
    return ACCESS_SOURCE_LABELS[m.source];
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
            <Lock className="h-4 w-4" aria-hidden="true" /> Campaign access list
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {activeMembers.length} creator{activeMembers.length === 1 ? "" : "s"} can see this
            campaign.
          </p>
        </div>
        <label className="flex max-w-sm cursor-pointer items-start gap-3 rounded-md border border-gray-200 p-3 dark:border-white/10">
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
              When off, listed creators still need the campaign&apos;s trust and quality minimums to
              submit.
            </span>
          </span>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className={cn("space-y-2", boxClass)}>
          <Label htmlFor="access-add-usernames" className="font-medium text-gray-900 dark:text-gray-100">
            Add usernames
          </Label>
          <Textarea
            id="access-add-usernames"
            ref={usernamesRef}
            rows={2}
            placeholder="creator_one, creator_two"
            className={fieldClass}
            value={usernames}
            onChange={(e) => setUsernames(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!usernames.trim() || busy === "add"}
            onClick={() =>
              run("add", async () => {
                const res = await accessListApi.addUsernames(contestId, usernames);
                setUsernames("");
                return showAddResult(res);
              })
            }
          >
            {busy === "add" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Add
          </Button>
          {addFailures && (
            <AddResultDetails
              notFound={addFailures.notFound}
              invalid={addFailures.invalid}
              onDismiss={() => setAddFailures(null)}
            />
          )}
        </div>

        <div className={cn("space-y-2", boxClass)}>
          <Label htmlFor="access-import-list" className="font-medium text-gray-900 dark:text-gray-100">
            Import a saved list
          </Label>
          <Select
            value={importListId}
            onValueChange={setImportListId}
            open={importOpen}
            onOpenChange={setImportOpen}
          >
            <SelectTrigger id="access-import-list" isDark={isDark}>
              <SelectValue placeholder={lists.length ? "Choose a list" : "No saved lists"} />
            </SelectTrigger>
            <SelectContent isDark={isDark}>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id} isDark={isDark}>
                  {l.name} ({l.member_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className={outlineDark}
            disabled={!importListId || busy === "import"}
            onClick={() =>
              run("import", async () => {
                const res = await accessListApi.importList(contestId, importListId);
                setImportListId("");
                return showAddResult(res);
              })
            }
          >
            {busy === "import" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Import
          </Button>
        </div>
      </div>

      {usedLists.length > 0 && (
        <div className={cn("space-y-2", boxClass)}>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sync from saved lists</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Adds creators who joined a list after you imported it. Nobody is removed.
          </p>
          <div className="flex flex-wrap gap-2">
            {usedLists.map((l) => (
              <Button
                key={l.id}
                size="sm"
                variant="outline"
                className={outlineDark}
                disabled={busy === `sync:${l.id}`}
                onClick={() =>
                  run(`sync:${l.id}`, async () => {
                    const res = await accessListApi.syncList(contestId, l.id);
                    return res.added === 0
                      ? `"${l.name}" is already in sync`
                      : `Synced "${l.name}" · ${showAddResult(res)}`;
                  })
                }
              >
                {busy === `sync:${l.id}` ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {l.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <InviteLinksSection contestId={contestId} openCreateSignal={createLinkSignal} />

      {activeMembers.length > 0 && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-full sm:w-60">
            <Label htmlFor="access-source-filter" className="mb-1 block text-xs text-gray-500 dark:text-gray-400">
              Filter by source
            </Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger id="access-source-filter" isDark={isDark}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent isDark={isDark}>
                <SelectItem value={ALL} isDark={isDark}>
                  All sources
                </SelectItem>
                {filterOptions.map(([value, label]) => (
                  <SelectItem key={value} value={value} isDark={isDark}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full items-end gap-2 sm:w-auto">
            <Input
              className={cn("h-10 flex-1 sm:w-56", fieldClass)}
              placeholder="New list name"
              aria-label="Name for a new saved list"
              maxLength={100}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              className={outlineDark}
              disabled={!saveName.trim() || activeMembers.length === 0 || busy === "save"}
              onClick={() =>
                run("save", async () => {
                  const res = await accessListApi.saveAsList(contestId, saveName);
                  setSaveName("");
                  return `Saved "${res.allowlist.name}" · ${res.allowlist.member_count} creators`;
                })
              }
            >
              <Save className="mr-2 h-4 w-4" /> Save as list
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border border-gray-200 dark:border-white/10">
        {activeMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No creators yet"
            description="Creators you add here can see and join this campaign."
            actions={
              <>
                <Button size="sm" onClick={() => usernamesRef.current?.focus()}>
                  <UserPlus className="mr-1.5 h-4 w-4" /> Add usernames
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={outlineDark}
                  disabled={lists.length === 0}
                  title={lists.length === 0 ? "You don't have any saved lists yet" : undefined}
                  onClick={() => setImportOpen(true)}
                >
                  <Download className="mr-1.5 h-4 w-4" /> Import list
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className={outlineDark}
                  onClick={() => setCreateLinkSignal((n) => n + 1)}
                >
                  <Link2 className="mr-1.5 h-4 w-4" /> Create invite link
                </Button>
              </>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="dark:border-white/10 dark:hover:bg-transparent">
                <TableHead className="dark:text-gray-400">Creator</TableHead>
                <TableHead className="hidden dark:text-gray-400 sm:table-cell">Source</TableHead>
                <TableHead className="dark:text-gray-400">Added</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="dark:border-white/10">
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    No creators from this source.
                  </TableCell>
                </TableRow>
              ) : (
                visible.slice(0, shown).map((m) => (
                  <TableRow key={m.user_id} className="dark:border-white/10 dark:hover:bg-white/5">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CreatorAvatar
                          username={m.username}
                          fullName={m.full_name}
                          src={m.profile_picture_url}
                        />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900 dark:text-white">
                            @{m.username ?? "unknown"}
                          </div>
                          {m.full_name && (
                            <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                              {m.full_name}
                            </div>
                          )}
                          <div className="truncate text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                            {sourceLabel(m)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-sm text-gray-600 dark:text-gray-300 sm:table-cell">
                      {sourceLabel(m)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-300">
                      <RelativeTime value={m.added_at} />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:bg-red-50 dark:hover:bg-red-500/10"
                        aria-label={`Remove @${m.username ?? "creator"}`}
                        onClick={() => startRemoval(m)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
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
    </div>
  );
}

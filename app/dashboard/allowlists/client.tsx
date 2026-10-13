"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  MAX_ALLOWLIST_NAME_LENGTH,
  parseUsernames,
  type AllowlistMember,
  type BrandAllowlist,
} from "@/lib/campaign-access";
import {
  allowlistApi,
  summarizeAddResult,
  type AddResult,
} from "@/components/campaign-access/api";
import { AddResultDetails } from "@/components/campaign-access/AddResultDetails";
import { CreatorAvatar } from "@/components/campaign-access/CreatorAvatar";
import { EmptyState } from "@/components/campaign-access/EmptyState";
import { RelativeTime } from "@/components/campaign-access/RelativeTime";
import { MemberRowsSkeleton } from "@/components/campaign-access/Skeletons";
import { UsernameChipsInput } from "@/components/campaign-access/UsernameChipsInput";
import { Skeleton } from "@/components/ui/skeleton";

const cardClass = "rounded-xl border border-gray-200 dark:border-white/10";
const fieldClass =
  "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";
const outlineDark =
  "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

type Failures = Pick<AddResult, "notFound" | "invalid">;

function failuresOf(res: Failures): Failures | null {
  return (res.notFound?.length ?? 0) + (res.invalid?.length ?? 0) > 0
    ? { notFound: res.notFound, invalid: res.invalid }
    : null;
}

export default function AllowlistsClient() {
  const isDark = useDashboardDark();
  const [lists, setLists] = useState<BrandAllowlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<AllowlistMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");

  const [newName, setNewName] = useState("");
  const [newUsernames, setNewUsernames] = useState<string[]>([]);
  const [addUsernames, setAddUsernames] = useState<string[]>([]);
  const [createFailures, setCreateFailures] = useState<Failures | null>(null);
  const [addFailures, setAddFailures] = useState<Failures | null>(null);
  const [renameTarget, setRenameTarget] = useState<BrandAllowlist | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<BrandAllowlist | null>(null);

  const selected = lists.find((l) => l.id === selectedId) ?? null;

  const loadLists = useCallback(async () => {
    try {
      const res = await allowlistApi.list();
      setLists(res.allowlists);
    } catch (e: any) {
      toast({
        title: "Could not load saved lists",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMembers = useCallback(async (id: string) => {
    setMembersLoading(true);
    try {
      const res = await allowlistApi.members(id);
      setMembers(res.members);
    } catch (e: any) {
      toast({
        title: "Could not load members",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    setAddFailures(null);
    setAddUsernames([]);
    setMemberQuery("");
    if (selectedId) loadMembers(selectedId);
    else setMembers([]);
  }, [selectedId, loadMembers]);

  const visibleMembers = useMemo(() => {
    const q = memberQuery.trim().replace(/^@/, "").toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.username ?? "").toLowerCase().includes(q) ||
        (m.full_name ?? "").toLowerCase().includes(q),
    );
  }, [members, memberQuery]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    try {
      const message = await fn();
      if (message) toast({ title: message });
      return true;
    } catch (e: any) {
      toast({
        title: "Something went wrong",
        description: e.message,
        variant: "destructive",
      });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const newParsed = parseUsernames(newUsernames);
  const addParsed = parseUsernames(addUsernames);

  const handleCreate = () =>
    run("create", async () => {
      const res = await allowlistApi.create({
        name: newName,
        usernames: newParsed.valid.join(",") || undefined,
      });
      setNewName("");
      setNewUsernames([]);
      setCreateFailures(
        failuresOf({ notFound: res.notFound, invalid: [...res.invalid, ...newParsed.invalid] }),
      );
      await loadLists();
      return `Created "${res.allowlist.name}" · ${summarizeAddResult({ ...res, alreadyOnList: 0 })}`;
    });

  const openRename = (list: BrandAllowlist) => {
    setRenameTarget(list);
    setRenameValue(list.name);
  };

  const handleRename = async () => {
    const list = renameTarget;
    const name = renameValue.trim();
    if (!list || !name) return;
    if (name === list.name) {
      setRenameTarget(null);
      return;
    }
    const ok = await run(`rename:${list.id}`, async () => {
      await allowlistApi.rename(list.id, name);
      await loadLists();
      return "List renamed";
    });
    if (ok) setRenameTarget(null);
  };

  const handleDuplicate = (list: BrandAllowlist) =>
    run(`duplicate:${list.id}`, async () => {
      const res = await allowlistApi.duplicate(list.id);
      await loadLists();
      return `Created "${res.allowlist.name}"`;
    });

  const handleDelete = async () => {
    const list = deleteTarget;
    if (!list) return;
    await run(`delete:${list.id}`, async () => {
      await allowlistApi.remove(list.id);
      if (selectedId === list.id) setSelectedId(null);
      await loadLists();
      return "List deleted";
    });
    setDeleteTarget(null);
  };

  const handleAddMembers = () => {
    if (!selected) return;
    run("add", async () => {
      const res = await allowlistApi.addMembers(selected.id, addParsed.valid.join(","));
      setAddUsernames([]);
      setAddFailures(
        failuresOf({ notFound: res.notFound, invalid: [...(res.invalid ?? []), ...addParsed.invalid] }),
      );
      await Promise.all([loadLists(), loadMembers(selected.id)]);
      return summarizeAddResult(res, "already on the list");
    });
  };

  const handleRemoveMember = (member: AllowlistMember) => {
    if (!selected) return;
    run(`remove:${member.user_id}`, async () => {
      await allowlistApi.removeMembers(selected.id, [member.user_id]);
      await Promise.all([loadLists(), loadMembers(selected.id)]);
      return `Removed @${member.username ?? "creator"}`;
    });
  };

  const listMenu = (list: BrandAllowlist) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 dark:text-gray-300 dark:hover:bg-white/10"
          aria-label={`More actions for ${list.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn(isDark && "border-white/10 bg-[#07031D] text-white")}>
        <DropdownMenuItem onSelect={() => openRename(list)}>
          <Pencil className="mr-2 h-4 w-4" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={busy === `duplicate:${list.id}`}
          onSelect={() => handleDuplicate(list)}
        >
          <Copy className="mr-2 h-4 w-4" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => setDeleteTarget(list)}>
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className={cn("mx-auto max-w-6xl space-y-6 p-4 md:p-6", isDark && "dark")}>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Users className="h-6 w-6" aria-hidden="true" /> Saved allowlists
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Reusable creator lists. Importing a list into a private campaign copies its creators;
          later edits here don&apos;t change campaigns that already imported it.
        </p>
      </div>

      <section aria-labelledby="new-list-heading" className={cn("space-y-3 p-4 sm:p-5", cardClass)}>
        <h2 id="new-list-heading" className="font-semibold text-gray-900 dark:text-white">
          New list
        </h2>
        <div className="space-y-1.5">
          <Label htmlFor="new-list-name" className="text-sm text-gray-700 dark:text-gray-300">
            Name
          </Label>
          <Input
            id="new-list-name"
            placeholder="e.g. Top editors"
            className={fieldClass}
            maxLength={MAX_ALLOWLIST_NAME_LENGTH}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label id="new-list-usernames-label" htmlFor="new-list-usernames" className="text-sm text-gray-700 dark:text-gray-300">
            Creators (optional) — type, paste or upload a CSV
          </Label>
          <UsernameChipsInput
            id="new-list-usernames"
            labelledBy="new-list-usernames-label"
            value={newUsernames}
            onChange={setNewUsernames}
            disabled={busy === "create"}
            allowFile
          />
        </div>
        <Button disabled={!newName.trim() || busy === "create"} onClick={handleCreate}>
          {busy === "create" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Create list
        </Button>
        {createFailures && (
          <AddResultDetails
            notFound={createFailures.notFound}
            invalid={createFailures.invalid}
            onDismiss={() => setCreateFailures(null)}
          />
        )}
      </section>

      <section aria-labelledby="your-lists-heading" className="space-y-3">
        <h2 id="your-lists-heading" className="font-semibold text-gray-900 dark:text-white">
          Your lists{!loading && lists.length > 0 ? ` (${lists.length})` : ""}
        </h2>
        {loading ? (
          <div role="status" aria-busy="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <span className="sr-only">Loading saved lists</span>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28 bg-gray-200/80 dark:bg-white/10" />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div className={cardClass}>
            <EmptyState
              icon={Users}
              title="No saved lists yet"
              description="Save groups of creators you work with often, then add them to any private campaign in one click."
              actions={
                <Button size="sm" onClick={() => document.getElementById("new-list-name")?.focus()}>
                  <Plus className="mr-1.5 h-4 w-4" /> Create your first list
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <li key={list.id} className={cn("relative bg-white transition-colors hover:border-[#7F39EC]/60 dark:bg-white/5", cardClass)}>
                <button
                  type="button"
                  className="flex h-full w-full flex-col items-start gap-2 rounded-xl p-4 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]"
                  onClick={() => setSelectedId(list.id)}
                >
                  <span className="truncate font-semibold text-gray-900 dark:text-white">{list.name}</span>
                  <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    {list.member_count} creator{list.member_count === 1 ? "" : "s"}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Updated <RelativeTime value={list.updated_at} />
                  </span>
                </button>
                <div className="absolute right-2 top-2">{listMenu(list)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent
          side="right"
          // Focus the panel, not the first date, so its tooltip doesn't pop open.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn("flex w-full flex-col gap-0 p-0 sm:max-w-lg", isDark && "dark border-white/10 bg-[#06021D] text-white")}
        >
          {selected && (
            <>
              <SheetHeader className="space-y-1 border-b border-gray-200 p-5 pr-12 text-left dark:border-white/10">
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle className="truncate text-gray-900 dark:text-white">{selected.name}</SheetTitle>
                  {listMenu(selected)}
                </div>
                <SheetDescription className="text-gray-500 dark:text-gray-400">
                  {selected.member_count} creator{selected.member_count === 1 ? "" : "s"} · updated{" "}
                  <RelativeTime value={selected.updated_at} />
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-3 border-b border-gray-200 p-5 dark:border-white/10">
                <Label id="add-members-label" htmlFor="add-members" className="text-sm text-gray-700 dark:text-gray-300">
                  Add creators
                </Label>
                <UsernameChipsInput
                  id="add-members"
                  labelledBy="add-members-label"
                  value={addUsernames}
                  onChange={setAddUsernames}
                  disabled={busy === "add"}
                  allowFile
                />
                <Button size="sm" disabled={addParsed.valid.length === 0 || busy === "add"} onClick={handleAddMembers}>
                  {busy === "add" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {addParsed.valid.length > 0
                    ? `Add ${addParsed.valid.length} creator${addParsed.valid.length === 1 ? "" : "s"}`
                    : "Add creators"}
                </Button>
                {addFailures && (
                  <AddResultDetails
                    notFound={addFailures.notFound}
                    invalid={addFailures.invalid}
                    onDismiss={() => setAddFailures(null)}
                  />
                )}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {members.length > 0 && (
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <Input
                      className={cn("h-10 pl-8 pr-9", fieldClass)}
                      placeholder="Search members"
                      aria-label={`Search members of ${selected.name}`}
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                    />
                    {memberQuery && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
                        onClick={() => setMemberQuery("")}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
                {membersLoading ? (
                  <MemberRowsSkeleton />
                ) : members.length === 0 ? (
                  <EmptyState
                    icon={UserPlus}
                    title="No creators on this list yet"
                    description="Add usernames above to build the list."
                  />
                ) : visibleMembers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No members match.</p>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-white/10">
                    {visibleMembers.map((m) => (
                      <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                        <CreatorAvatar
                          username={m.username}
                          fullName={m.full_name}
                          src={m.profile_picture_url}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            @{m.username ?? "unknown"}
                          </div>
                          <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {m.full_name ? `${m.full_name} · ` : ""}added <RelativeTime value={m.added_at} />
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 hover:bg-red-50 dark:hover:bg-red-500/10"
                          aria-label={`Remove @${m.username ?? "creator"}`}
                          disabled={busy === `remove:${m.user_id}`}
                          onClick={() => handleRemoveMember(m)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog isdark={isDark} open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className={cn("sm:max-w-md", isDark && "dark text-white")}>
          <DialogHeader>
            <DialogTitle>Rename list</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
          >
            <Label htmlFor="rename-list">List name</Label>
            <Input
              id="rename-list"
              autoFocus
              className={fieldClass}
              maxLength={MAX_ALLOWLIST_NAME_LENGTH}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </form>
          <DialogFooter>
            <Button variant="outline" className={outlineDark} onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button disabled={!renameValue.trim() || busy?.startsWith("rename:")} onClick={handleRename}>
              {busy?.startsWith("rename:") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className={cn(isDark && "dark border-white/10 bg-[#06021D] text-white")}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The list is deleted for good. Campaigns that imported it keep their creators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={outlineDark} disabled={busy?.startsWith("delete:")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={busy?.startsWith("delete:")}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              {busy?.startsWith("delete:") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete list
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

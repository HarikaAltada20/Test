"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  MAX_ALLOWLIST_NAME_LENGTH,
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
import {
  MemberRowsSkeleton,
  SavedListsSkeleton,
} from "@/components/campaign-access/Skeletons";

const boxClass = "rounded-lg border border-gray-200 dark:border-white/10";
const fieldClass =
  "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";
const outlineDark =
  "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";
const iconButtonDark = "dark:text-gray-300 dark:hover:bg-white/10";

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

  const [newName, setNewName] = useState("");
  const [newUsernames, setNewUsernames] = useState("");
  const [addUsernames, setAddUsernames] = useState("");
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
    if (selectedId) loadMembers(selectedId);
    else setMembers([]);
  }, [selectedId, loadMembers]);

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

  const handleCreate = () =>
    run("create", async () => {
      const res = await allowlistApi.create({
        name: newName,
        usernames: newUsernames || undefined,
      });
      setNewName("");
      setNewUsernames("");
      setCreateFailures(failuresOf(res));
      await loadLists();
      setSelectedId(res.allowlist.id);
      return `Created "${res.allowlist.name}" · ${summarizeAddResult(
        { ...res, alreadyOnList: 0 },
      )}`;
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
      const res = await allowlistApi.addMembers(selected.id, addUsernames);
      setAddUsernames("");
      setAddFailures(failuresOf(res));
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

  return (
    <div className={cn("mx-auto max-w-6xl space-y-6 p-4 md:p-6", isDark && "dark")}>
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <Users className="h-6 w-6" aria-hidden="true" /> Saved allowlists
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Reusable creator lists. Importing a list into a private campaign
          copies its creators; later edits here don&apos;t change campaigns
          that already imported it.
        </p>
      </div>

      <div className={cn("space-y-3 p-4", boxClass)}>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">New list</p>
        <Input
          placeholder="List name"
          aria-label="List name"
          className={fieldClass}
          maxLength={MAX_ALLOWLIST_NAME_LENGTH}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Textarea
          rows={2}
          placeholder="Usernames (optional), separated by commas, spaces or new lines"
          aria-label="Usernames to add to the new list"
          className={fieldClass}
          value={newUsernames}
          onChange={(e) => setNewUsernames(e.target.value)}
        />
        <Button
          size="sm"
          disabled={!newName.trim() || busy === "create"}
          onClick={handleCreate}
        >
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
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className={boxClass}>
          {loading ? (
            <div className="p-3">
              <SavedListsSkeleton />
            </div>
          ) : lists.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No saved lists yet"
              description="Save groups of creators you work with often, then add them to any private campaign in one click."
            />
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-white/10">
              {lists.map((list) => (
                <li
                  key={list.id}
                  className={cn(
                    "flex items-center justify-between gap-2 p-3",
                    selectedId === list.id && "bg-purple-50 dark:bg-[#7F39EC]/15",
                  )}
                >
                  <button
                    type="button"
                    aria-pressed={selectedId === list.id}
                    className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]"
                    onClick={() => setSelectedId(list.id)}
                  >
                    <div className="truncate font-medium text-gray-900 dark:text-white">
                      {list.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {list.member_count} creator
                      {list.member_count === 1 ? "" : "s"} · updated{" "}
                      <RelativeTime value={list.updated_at} />
                    </div>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className={iconButtonDark}
                      aria-label={`Rename ${list.name}`}
                      disabled={busy === `rename:${list.id}`}
                      onClick={() => openRename(list)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={iconButtonDark}
                      aria-label={`Duplicate ${list.name}`}
                      disabled={busy === `duplicate:${list.id}`}
                      onClick={() => handleDuplicate(list)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="dark:hover:bg-red-500/10"
                      aria-label={`Delete ${list.name}`}
                      disabled={busy === `delete:${list.id}`}
                      onClick={() => setDeleteTarget(list)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn("space-y-4 p-4", boxClass)}>
          {!selected ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a list to manage its creators.
            </p>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selected.name}
              </h2>
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Add usernames"
                  aria-label={`Add usernames to ${selected.name}`}
                  className={fieldClass}
                  value={addUsernames}
                  onChange={(e) => setAddUsernames(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!addUsernames.trim() || busy === "add"}
                  onClick={handleAddMembers}
                >
                  {busy === "add" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
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
              <div className="rounded-md border border-gray-200 dark:border-white/10">
                {membersLoading ? (
                  <MemberRowsSkeleton />
                ) : members.length === 0 ? (
                  <EmptyState
                    icon={UserPlus}
                    title="No creators on this list yet"
                    description="Add usernames above to build the list."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="dark:border-white/10 dark:hover:bg-transparent">
                        <TableHead className="dark:text-gray-400">Creator</TableHead>
                        <TableHead className="dark:text-gray-400">Added</TableHead>
                        <TableHead className="w-12">
                          <span className="sr-only">Actions</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow
                          key={m.user_id}
                          className="dark:border-white/10 dark:hover:bg-white/5"
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <CreatorAvatar
                                username={m.username}
                                fullName={m.full_name}
                                src={m.profile_picture_url}
                                size="sm"
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
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 dark:text-gray-300">
                            <RelativeTime value={m.added_at} />
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="dark:hover:bg-red-500/10"
                              aria-label={`Remove @${m.username ?? "creator"}`}
                              disabled={busy === `remove:${m.user_id}`}
                              onClick={() => handleRemoveMember(m)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog
        isdark={isDark}
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
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
            <Button
              variant="outline"
              className={outlineDark}
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim() || busy?.startsWith("rename:")}
              onClick={handleRename}
            >
              {busy?.startsWith("rename:") && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent
          className={cn(isDark && "dark border-white/10 bg-[#06021D] text-white")}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The list is deleted for good. Campaigns that imported it keep
              their creators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={outlineDark}
              disabled={busy?.startsWith("delete:")}
            >
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
              {busy?.startsWith("delete:") && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete list
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

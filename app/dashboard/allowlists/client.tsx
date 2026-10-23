"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  FileUp,
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
  DialogDescription,
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
  parseUsernameCsv,
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
import { MemberAvatarStack } from "@/components/campaign-access/MemberAvatarStack";
import { RelativeTime } from "@/components/campaign-access/RelativeTime";
import { MemberRowsSkeleton } from "@/components/campaign-access/Skeletons";
import { UsernameChipsInput } from "@/components/campaign-access/UsernameChipsInput";
import { Skeleton } from "@/components/ui/skeleton";

const primaryButton =
  "rounded-full bg-gradient-to-b from-[#8b5cf6] to-[#7c3aed] px-5 text-[15px] font-medium text-white shadow-[0_8px_20px_rgba(124,58,237,0.4)] hover:from-[#7c3aed] hover:to-[#6d28d9] disabled:opacity-60";
const outlineButton =
  "rounded-full border-[#d5d5db] bg-white text-[#1a1a1a] hover:bg-[#f6f6f7] dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";
const newListButton =
  "rounded-full bg-[#1a1a1a] px-4 text-[15px] font-medium text-white hover:bg-black dark:bg-white dark:text-[#1a1a1a] dark:hover:bg-white/90";
const modalField =
  "h-12 rounded-xl border border-[#e6e6ea] bg-[#f6f6f7] text-[#1a1a1a] placeholder:text-[#8d8d95] shadow-none focus-visible:border-[#7c3aed] focus-visible:bg-[#f3eefe] focus-visible:ring-0 focus-visible:ring-offset-0 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 dark:focus-visible:border-[#7c3aed] dark:focus-visible:bg-[#7c3aed]/15";
const sheetField =
  "h-11 rounded-xl border-[#d9d9de] bg-white text-[#1a1a1a] placeholder:text-[#8d8d95] focus-visible:ring-[#7c3aed] dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";

type Failures = Pick<AddResult, "notFound" | "invalid">;

function failuresOf(res: Failures): Failures | null {
  return (res.notFound?.length ?? 0) + (res.invalid?.length ?? 0) > 0
    ? { notFound: res.notFound, invalid: res.invalid }
    : null;
}

function previewHandles(list: BrandAllowlist): string {
  const members = list.preview_members ?? [];
  if (members.length === 0) return "";
  const names = members
    .map((m) => `@${m.username ?? "creator"}`)
    .filter(Boolean);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export default function AllowlistsClient() {
  const isDark = useDashboardDark();
  const createFileRef = useRef<HTMLInputElement>(null);
  const [lists, setLists] = useState<BrandAllowlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<AllowlistMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [listQuery, setListQuery] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCreatorsText, setNewCreatorsText] = useState("");
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

  const filteredLists = useMemo(() => {
    const q = listQuery.trim().replace(/^@/, "").toLowerCase();
    if (!q) return lists;
    return lists.filter((list) => {
      if (list.name.toLowerCase().includes(q)) return true;
      return (list.preview_members ?? []).some(
        (m) =>
          (m.username ?? "").toLowerCase().includes(q) ||
          (m.full_name ?? "").toLowerCase().includes(q),
      );
    });
  }, [lists, listQuery]);

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

  const newParsed = parseUsernames(newCreatorsText);
  const addParsed = parseUsernames(addUsernames);
  const creatorCount = newParsed.valid.length + newParsed.invalid.length;

  const resetCreateForm = () => {
    setNewName("");
    setNewCreatorsText("");
    setCreateFailures(null);
  };

  const openCreate = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const handleCreate = () =>
    run("create", async () => {
      const res = await allowlistApi.create({
        name: newName,
        usernames: newParsed.valid.join(",") || undefined,
      });
      setCreateFailures(
        failuresOf({
          notFound: res.notFound,
          invalid: [...res.invalid, ...newParsed.invalid],
        }),
      );
      setNewName("");
      setNewCreatorsText("");
      setCreateOpen(false);
      await loadLists();
      return `Created "${res.allowlist.name}" · ${summarizeAddResult({ ...res, alreadyOnList: 0 })}`;
    });

  const loadCreateCsv = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const names = parseUsernameCsv(text);
    if (names.length === 0) return;
    setNewCreatorsText((prev) => {
      const next = [
        ...prev
          .trim()
          .split(/[\s,;]+/)
          .filter(Boolean),
        ...names,
      ];
      return Array.from(new Set(next.map((n) => n.replace(/^@+/, "")))).join(
        "\n",
      );
    });
    if (createFileRef.current) createFileRef.current.value = "";
  };

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
      const res = await allowlistApi.addMembers(
        selected.id,
        addParsed.valid.join(","),
      );
      setAddUsernames([]);
      setAddFailures(
        failuresOf({
          notFound: res.notFound,
          invalid: [...(res.invalid ?? []), ...addParsed.invalid],
        }),
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

  const ink = isDark ? "text-white" : "text-[#1a1a1a]";
  const muted = isDark ? "text-white/50" : "text-[#8d8d95]";
  const soft = isDark ? "text-white/70" : "text-[#55555E]";
  const cardClass = cn(
    "overflow-hidden rounded-2xl border",
    isDark ? "border-white/10 bg-[#180438]" : "border-[#ececef] bg-white",
  );
  const fieldLabel = cn("text-[15px] font-semibold", ink);

  const listMenu = (list: BrandAllowlist) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "h-8 w-8 rounded-full",
            isDark
              ? "text-white/70 hover:bg-white/10 hover:text-white"
              : "text-[#8d8d95] hover:bg-[#f3f3f5] hover:text-[#1a1a1a]",
          )}
          aria-label={`More actions for ${list.name}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "rounded-xl",
          isDark && "border-white/10 bg-[#180438] text-white",
        )}
      >
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
        <DropdownMenuItem
          className="text-red-600 focus:text-red-700"
          onSelect={() => setDeleteTarget(list)}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className={cn("mx-auto max-w-7xl space-y-6 p-4 md:p-6", isDark && "dark")}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl space-y-1">
          <h1 className={cn("text-[34px] font-bold tracking-tight", ink)}>
            Saved allowlists
          </h1>
          <p className={cn("text-base", soft)}>
            Reusable creator lists for private campaigns. A campaign copies a
            list when you import it, so later edits here won&apos;t change it.
          </p>
        </div>
        {!loading && lists.length > 0 && (
          <Button className={newListButton} onClick={openCreate}>
            <Plus className="h-4 w-4" /> New list
          </Button>
        )}
      </div>

      {loading ? (
        <div
          role="status"
          aria-busy="true"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <span className="sr-only">Loading saved lists</span>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton
              key={i}
              className="h-44 rounded-2xl bg-[#ececef] dark:bg-white/10"
            />
          ))}
        </div>
      ) : lists.length === 0 ? (
        <section className={cn(cardClass, "py-16 sm:py-20")}>
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <h2 className={cn("text-[22px] font-bold tracking-tight", ink)}>
              No saved lists yet
            </h2>
            <p className={cn("mt-2 text-base leading-relaxed", soft)}>
              Save groups of creators you work with often, then add them to any
              private campaign in one click.
            </p>
            <Button className={cn(primaryButton, "mt-6")} onClick={openCreate}>
              Create a list
            </Button>
          </div>
        </section>
      ) : (
        <section aria-labelledby="your-lists-heading" className="space-y-4">
          <h2 id="your-lists-heading" className="sr-only">
            Your lists
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d95]"
                aria-hidden="true"
              />
              <Input
                className={cn(
                  "h-11 rounded-full border-0 bg-[#f3f3f5] pl-10 pr-4 text-[#1a1a1a] placeholder:text-[#8d8d95] focus-visible:ring-2 focus-visible:ring-[#7c3aed]/30 focus-visible:ring-offset-0 dark:bg-white/10 dark:text-white",
                )}
                placeholder="Search lists or creators"
                aria-label="Search lists or creators"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
              />
            </div>
            <p className={cn("shrink-0 text-sm", muted)}>
              {filteredLists.length} list{filteredLists.length === 1 ? "" : "s"}
            </p>
          </div>

          {filteredLists.length === 0 ? (
            <div className={cn(cardClass, "px-6 py-12 text-center")}>
              <p className={cn("text-base font-medium", ink)}>No lists match</p>
              <p className={cn("mt-1 text-sm", muted)}>
                Try a different name or creator username.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredLists.map((list) => {
                const handles = previewHandles(list);
                return (
                  <li
                    key={list.id}
                    className={cn(
                      "group relative transition-all duration-200",
                      cardClass,
                      "hover:border-[#7c3aed]/35 hover:shadow-[0_8px_24px_rgba(26,26,26,0.06)] dark:hover:border-white/25 dark:hover:shadow-none",
                    )}
                  >
                    <button
                      type="button"
                      className="flex h-full w-full flex-col items-start rounded-2xl p-5 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c3aed] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#180438]"
                      onClick={() => setSelectedId(list.id)}
                    >
                      <span
                        className={cn(
                          "line-clamp-2 text-[17px] font-semibold leading-snug",
                          ink,
                        )}
                      >
                        {list.name}
                      </span>

                      <span className={cn("mt-2 text-sm", soft)}>
                        {list.member_count} creator
                        {list.member_count === 1 ? "" : "s"}
                      </span>

                      <span className="mt-3 flex min-h-[28px] w-full items-center gap-2">
                        <MemberAvatarStack
                          members={list.preview_members}
                          total={list.member_count}
                        />
                        {!list.preview_members?.length &&
                          list.member_count === 0 && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 text-sm",
                                muted,
                              )}
                            >
                              <Users className="h-4 w-4" aria-hidden="true" />
                              No creators yet
                            </span>
                          )}
                        {handles && (
                          <span className={cn("truncate text-sm", soft)}>
                            {handles}
                          </span>
                        )}
                      </span>

                      {typeof list.campaign_count === "number" && (
                        <span className={cn("mt-3 text-xs", muted)}>
                          {list.campaign_count === 0
                            ? "Not used in a campaign yet"
                            : `Used in ${list.campaign_count} campaign${list.campaign_count === 1 ? "" : "s"}`}
                        </span>
                      )}

                      <span
                        className={cn(
                          "mt-4 w-full border-t pt-3 text-xs",
                          isDark ? "border-white/10" : "border-[#eeeef1]",
                          muted,
                        )}
                      >
                        Updated <RelativeTime value={list.updated_at} />
                      </span>
                    </button>
                    <div className="absolute right-3 top-3">
                      {listMenu(list)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <Dialog
        isdark={isDark}
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent
          className={cn(
            "gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[520px]",
            isDark ? "dark text-white" : "text-[#1a1a1a]",
          )}
        >
          <DialogHeader
            className={cn(
              "space-y-1 border-b pb-2 pt-2 pr-12 text-left",
              isDark ? "border-white/10" : "border-[#eeeef1]",
            )}
          >
            <DialogTitle
              className={cn("text-[22px] font-bold tracking-tight", ink)}
            >
              New list
            </DialogTitle>
            <DialogDescription className={cn("text-sm", soft)}>
              Name it, then add the creators you work with often.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="new-list-name" className={fieldLabel}>
                Name
              </Label>
              <Input
                id="new-list-name"
                autoFocus
                placeholder="e.g. Top editors"
                className={modalField}
                maxLength={MAX_ALLOWLIST_NAME_LENGTH}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="new-list-creators" className={fieldLabel}>
                  Creators{" "}
                  <span className={cn("font-normal", muted)}>Optional</span>
                </Label>
                <span className={cn("text-sm", muted)}>
                  {creatorCount} creator{creatorCount === 1 ? "" : "s"}
                </span>
              </div>
              <textarea
                id="new-list-creators"
                rows={4}
                placeholder="Type or paste usernames"
                disabled={busy === "create"}
                className={cn(
                  "w-full resize-none rounded-xl border border-[#e6e6ea] bg-[#f6f6f7] px-3 py-3 text-[15px] text-[#1a1a1a] placeholder:text-[#8d8d95] outline-none transition-colors focus:border-[#7c3aed] focus:bg-[#f3eefe] dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500 dark:focus:border-[#7c3aed] dark:focus:bg-[#7c3aed]/15",
                )}
                value={newCreatorsText}
                onChange={(e) => setNewCreatorsText(e.target.value)}
              />
              <p className={cn("text-sm", muted)}>
                Separate usernames with spaces, commas or new lines.
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <input
                  ref={createFileRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(e) => loadCreateCsv(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-full border-[#e6e6ea] bg-[#f3f3f5] text-[#1a1a1a] hover:bg-[#ececef] dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  disabled={busy === "create"}
                  onClick={() => createFileRef.current?.click()}
                >
                  <FileUp className="h-4 w-4" /> Upload CSV
                </Button>
                <span className={cn("text-sm", muted)}>
                  One per row, or a username column.
                </span>
              </div>
            </div>

            {createFailures && (
              <AddResultDetails
                notFound={createFailures.notFound}
                invalid={createFailures.invalid}
                onDismiss={() => setCreateFailures(null)}
              />
            )}
          </div>

          <DialogFooter
            className={cn(
              "flex-row items-center justify-end gap-2 border-t px-6 py-4",
              isDark ? "border-white/10" : "border-[#eeeef1]",
            )}
          >
            <Button
              type="button"
              variant="outline"
              className={outlineButton}
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={primaryButton}
              disabled={!newName.trim() || busy === "create"}
              onClick={handleCreate}
            >
              {busy === "create" && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Create list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent
          side="right"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "flex w-full flex-col gap-0 border-l p-0 sm:max-w-lg",
            isDark
              ? "dark border-white/10 bg-[#180438] text-white"
              : "border-[#ececef] bg-white text-[#1a1a1a]",
          )}
        >
          {selected && (
            <>
              <SheetHeader
                className={cn(
                  "space-y-1 border-b p-5 pr-12 text-left sm:p-6",
                  isDark ? "border-white/10" : "border-[#eeeef1]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <SheetTitle
                    className={cn("truncate text-xl font-semibold", ink)}
                  >
                    {selected.name}
                  </SheetTitle>
                  {listMenu(selected)}
                </div>
                <SheetDescription className={cn("text-sm", muted)}>
                  {selected.member_count} creator
                  {selected.member_count === 1 ? "" : "s"} · updated{" "}
                  <RelativeTime value={selected.updated_at} />
                </SheetDescription>
              </SheetHeader>

              <div
                className={cn(
                  "space-y-3 border-b p-5 sm:p-6",
                  isDark ? "border-white/10" : "border-[#eeeef1]",
                )}
              >
                <Label
                  id="add-members-label"
                  htmlFor="add-members"
                  className={fieldLabel}
                >
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
                <Button
                  size="sm"
                  className={primaryButton}
                  disabled={addParsed.valid.length === 0 || busy === "add"}
                  onClick={handleAddMembers}
                >
                  {busy === "add" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
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

              <div className="flex-1 space-y-3 overflow-y-auto p-5 sm:p-6">
                {members.length > 0 && (
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d95]"
                      aria-hidden="true"
                    />
                    <Input
                      className={cn("pl-9 pr-9", sheetField)}
                      placeholder="Search members"
                      aria-label={`Search members of ${selected.name}`}
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                    />
                    {memberQuery && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        className={cn(
                          "absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full",
                          isDark
                            ? "text-white/50 hover:bg-white/10 hover:text-white"
                            : "text-[#8d8d95] hover:bg-[#f3f3f5] hover:text-[#1a1a1a]",
                        )}
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
                  <div className="flex flex-col items-center px-4 py-10 text-center">
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full",
                        isDark
                          ? "bg-white/10 text-white"
                          : "bg-[#f3f3f5] text-[#1a1a1a]",
                      )}
                    >
                      <UserPlus className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <p className={cn("mt-4 text-[17px] font-semibold", ink)}>
                      No creators on this list yet
                    </p>
                    <p className={cn("mt-1.5 max-w-sm text-sm", muted)}>
                      Add usernames above to build the list.
                    </p>
                  </div>
                ) : visibleMembers.length === 0 ? (
                  <p className={cn("py-6 text-center text-sm", muted)}>
                    No members match.
                  </p>
                ) : (
                  <ul
                    className={cn(
                      "divide-y",
                      isDark ? "divide-white/10" : "divide-[#eeeef1]",
                    )}
                  >
                    {visibleMembers.map((m) => (
                      <li
                        key={m.user_id}
                        className="flex items-center gap-3 py-3"
                      >
                        <CreatorAvatar
                          username={m.username}
                          fullName={m.full_name}
                          src={m.profile_picture_url}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div
                            className={cn("truncate text-sm font-medium", ink)}
                          >
                            @{m.username ?? "unknown"}
                          </div>
                          <div className={cn("truncate text-xs", muted)}>
                            {m.full_name ? `${m.full_name} · ` : ""}added{" "}
                            <RelativeTime value={m.added_at} />
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10"
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

      <Dialog
        isdark={isDark}
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
      >
        <DialogContent
          className={cn(
            "rounded-2xl sm:max-w-md",
            isDark ? "dark text-white" : "text-[#1a1a1a]",
          )}
        >
          <DialogHeader>
            <DialogTitle className={cn("text-[17px] font-semibold", ink)}>
              Rename list
            </DialogTitle>
          </DialogHeader>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleRename();
            }}
          >
            <Label htmlFor="rename-list" className={fieldLabel}>
              List name
            </Label>
            <Input
              id="rename-list"
              autoFocus
              className={modalField}
              maxLength={MAX_ALLOWLIST_NAME_LENGTH}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
            />
          </form>
          <DialogFooter className="flex-row justify-end gap-2">
            <Button
              variant="outline"
              className={outlineButton}
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className={primaryButton}
              disabled={!renameValue.trim() || busy?.startsWith("rename:")}
              onClick={handleRename}
            >
              {busy?.startsWith("rename:") && (
                <Loader2 className="h-4 w-4 animate-spin" />
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
          className={cn(
            "rounded-2xl",
            isDark
              ? "dark border-white/10 bg-[#180438] text-white"
              : "text-[#1a1a1a]",
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription className={soft}>
              The list is deleted for good. Campaigns that imported it keep
              their creators.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={outlineButton}
              disabled={busy?.startsWith("delete:")}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-red-600 hover:bg-red-700"
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

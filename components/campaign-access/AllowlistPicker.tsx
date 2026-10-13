"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BookmarkPlus, Check, ExternalLink, Eye, Loader2, RotateCcw, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import {
  MAX_ALLOWLIST_NAME_LENGTH,
  parseUsernames,
  type AllowlistMember,
  type BrandAllowlist,
} from "@/lib/campaign-access";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import { accessListApi, allowlistApi } from "./api";
import { AddResultDetails } from "./AddResultDetails";
import { CreatorAvatar } from "./CreatorAvatar";
import { MemberAvatarStack } from "./MemberAvatarStack";
import { RelativeTime } from "./RelativeTime";
import { MemberRowsSkeleton, SavedListsSkeleton } from "./Skeletons";
import { UsernameChipsInput } from "./UsernameChipsInput";

const fieldClass = "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";
const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

export type AllowlistSelection = {
  allowlistIds: string[];
  /** Usernames as entered (chips), valid and invalid. */
  usernames: string[];
};

export const EMPTY_ALLOWLIST_SELECTION: AllowlistSelection = {
  allowlistIds: [],
  usernames: [],
};

export function hasAllowlistSelection(sel: AllowlistSelection): boolean {
  return sel.allowlistIds.length > 0 || parseUsernames(sel.usernames).valid.length > 0;
}

/**
 * Thrown when only part of a selection was applied. `retrySelection` holds what
 * still needs doing; list imports are idempotent, so retrying them is safe.
 */
export class AllowlistApplyError extends Error {
  constructor(
    message: string,
    public retrySelection: AllowlistSelection,
  ) {
    super(message);
    this.name = "AllowlistApplyError";
  }
}

/**
 * Copies the selection into a campaign's access list. Call after the campaign
 * row exists. Saved lists are created from the picker beforehand, so this only
 * adds usernames and imports lists. Returns usernames that could not be resolved.
 */
export async function applyAllowlistSelection(
  contestId: string,
  selection: AllowlistSelection,
  _advertiserId?: string | null,
): Promise<{ notFound: string[]; invalid: string[]; added: number }> {
  let added = 0;
  const notFound: string[] = [];
  const invalid: string[] = [];
  let retrySelection = selection;
  const { valid, invalid: badNames } = parseUsernames(selection.usernames);
  invalid.push(...badNames);

  try {
    if (valid.length > 0) {
      const res = await accessListApi.addUsernames(contestId, valid.join("\n"));
      added += res.added;
      notFound.push(...(res.notFound || []));
      invalid.push(...(res.invalid || []));
      retrySelection = { ...selection, usernames: [] };
    }
    for (const id of selection.allowlistIds) {
      const res = await accessListApi.importList(contestId, id);
      added += res.added;
    }
  } catch (err) {
    throw new AllowlistApplyError(
      err instanceof Error ? err.message : "Could not update the access list",
      retrySelection,
    );
  }
  return { notFound, invalid, added };
}

type Props = {
  value: AllowlistSelection;
  onChange: (next: AllowlistSelection) => void;
  /** Required when an admin acts for a brand. */
  advertiserId?: string | null;
  disabled?: boolean;
};

type MembersState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; members: AllowlistMember[] };

/** Keeps Enter inside a field from submitting the campaign form. */
function stopEnter(e: KeyboardEvent<HTMLInputElement>, onEnter?: () => void) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  onEnter?.();
}

export function AllowlistPicker({ value, onChange, advertiserId, disabled }: Props) {
  const isDark = useDashboardDark();
  const [lists, setLists] = useState<BrandAllowlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [listQuery, setListQuery] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailures, setSaveFailures] = useState<{ notFound: string[]; invalid: string[] } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [membersCache, setMembersCache] = useState<Record<string, MembersState>>({});
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    allowlistApi
      .list(advertiserId)
      .then((res) => {
        if (cancelled) return;
        setLists(res.allowlists);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [advertiserId, reloadKey]);

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  // A selected list that isn't loaded yet (e.g. created elsewhere) triggers one reload.
  const hasUnloadedSelection =
    !loading && value.allowlistIds.some((id) => !lists.some((l) => l.id === id));
  useEffect(() => {
    if (hasUnloadedSelection && reloadKey === 0) setReloadKey(1);
  }, [hasUnloadedSelection, reloadKey]);

  const toggleList = (id: string, checked: boolean) => {
    const set = new Set(value.allowlistIds);
    if (checked) set.add(id);
    else set.delete(id);
    onChange({ ...value, allowlistIds: Array.from(set) });
  };

  const loadMembers = (id: string, force = false) => {
    if (!force && membersCache[id]?.status === "ready") return;
    setMembersCache((c) => ({ ...c, [id]: { status: "loading" } }));
    allowlistApi
      .members(id)
      .then((res) => setMembersCache((c) => ({ ...c, [id]: { status: "ready", members: res.members } })))
      .catch((e) =>
        setMembersCache((c) => ({
          ...c,
          [id]: { status: "error", message: e instanceof Error ? e.message : "Could not load members" },
        })),
      );
  };

  const openPreview = (id: string) => {
    setMemberQuery("");
    setPreviewId(id);
    loadMembers(id);
  };

  const { valid, invalid } = parseUsernames(value.usernames);

  const saveList = async () => {
    const name = saveName.trim();
    if (!name || valid.length === 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await allowlistApi.create({ name, usernames: valid.join("\n"), advertiserId });
      const created = res.allowlist;
      setLists((prev) => [created, ...prev.filter((l) => l.id !== created.id)]);
      // The saved names now live in the list; keep only the ones that couldn't be added.
      const leftover = [...invalid, ...res.invalid, ...res.notFound];
      onChange({
        allowlistIds: Array.from(new Set([...value.allowlistIds, created.id])),
        usernames: Array.from(new Set(leftover)),
      });
      setSaveFailures(
        res.notFound.length + res.invalid.length > 0 ? { notFound: res.notFound, invalid: res.invalid } : null,
      );
      setSaveOpen(false);
      setSaveName("");
      setHighlightId(created.id);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 2500);
      toast({
        title: `Saved "${created.name}" (${created.member_count} creator${created.member_count === 1 ? "" : "s"})`,
        description: "It's selected for this campaign.",
      });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save the list");
    } finally {
      setSaving(false);
    }
  };

  const previewList = lists.find((l) => l.id === previewId) ?? null;
  const previewState = previewId ? membersCache[previewId] : undefined;
  const previewSelected = !!previewId && value.allowlistIds.includes(previewId);
  const previewMembers =
    previewState?.status === "ready"
      ? previewState.members.filter((m) => {
          const q = memberQuery.trim().replace(/^@/, "").toLowerCase();
          return (
            !q ||
            (m.username ?? "").toLowerCase().includes(q) ||
            (m.full_name ?? "").toLowerCase().includes(q)
          );
        })
      : [];

  // Summary of who gets access; exact when every selected list's members are cached.
  const selectedLists = lists.filter((l) => value.allowlistIds.includes(l.id));
  const allCached = selectedLists.every((l) => membersCache[l.id]?.status === "ready");
  const listCreatorCount = allCached
    ? new Set(
        selectedLists.flatMap((l) => {
          const s = membersCache[l.id];
          return s?.status === "ready" ? s.members.map((m) => m.user_id) : [];
        }),
      ).size
    : selectedLists.reduce((sum, l) => sum + l.member_count, 0);

  const visibleLists = lists.filter(
    (list) =>
      value.allowlistIds.includes(list.id) ||
      list.name.toLowerCase().includes(listQuery.trim().toLowerCase()),
  );

  return (
    <div className={cn("space-y-5", isDark && "dark")}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Import saved allowlists</p>
          {!advertiserId && (
            <a
              href="/dashboard/allowlists"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#7F39EC] hover:underline dark:text-purple-300"
            >
              Manage saved lists <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </div>
        {loading ? (
          <SavedListsSkeleton rows={2} />
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : lists.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No saved lists yet. Add usernames below and save them as a list for later.
          </p>
        ) : (
          <div className="space-y-2">
            {lists.length > 6 && (
              <Input
                className={cn("h-10", fieldClass)}
                placeholder="Search saved lists"
                aria-label="Search saved lists"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                onKeyDown={(e) => stopEnter(e)}
              />
            )}
            <ul className="grid gap-2 sm:grid-cols-2">
              {visibleLists.map((list) => {
                const checked = value.allowlistIds.includes(list.id);
                const checkboxId = `allowlist-pick-${list.id}`;
                return (
                  <li
                    key={list.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 transition-shadow duration-700",
                      checked
                        ? "border-[#7F39EC]/60 bg-purple-50/50 dark:bg-[#7F39EC]/10"
                        : "border-gray-200 hover:border-purple-300 dark:border-white/10 dark:hover:border-[#7F39EC]/60",
                      highlightId === list.id && "ring-2 ring-[#7F39EC] ring-offset-1 dark:ring-offset-transparent",
                    )}
                  >
                    <Checkbox
                      id={checkboxId}
                      checked={checked}
                      onCheckedChange={(c) => toggleList(list.id, c === true)}
                      disabled={disabled}
                    />
                    <label htmlFor={checkboxId} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                      <span className="flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{list.name}</span>
                      <MemberAvatarStack
                        members={list.preview_members}
                        total={list.member_count}
                        className="hidden sm:inline-flex"
                      />
                      <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Users className="h-3 w-3" aria-hidden="true" />
                        <span className="sr-only">Members:</span>
                        {list.member_count}
                      </span>
                    </label>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 dark:text-gray-300 dark:hover:bg-white/10"
                      aria-label={`Preview ${list.name}`}
                      onClick={() => openPreview(list.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label
          id="allowlist-usernames-label"
          htmlFor="allowlist-usernames"
          className="text-sm font-medium text-gray-900 dark:text-gray-100"
        >
          Add creator usernames
        </Label>
        <UsernameChipsInput
          id="allowlist-usernames"
          labelledBy="allowlist-usernames-label"
          value={value.usernames}
          onChange={(usernames) => onChange({ ...value, usernames })}
          disabled={disabled}
          allowFile
        />
        {valid.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            These creators are added to this campaign only, unless you save them as a list.
          </p>
        )}

        {valid.length > 0 && !saveOpen && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={outlineDark}
            disabled={disabled}
            onClick={() => {
              setSaveOpen(true);
              setSaveError(null);
            }}
          >
            <BookmarkPlus className="mr-1.5 h-4 w-4" /> Save as a list for later
          </Button>
        )}

        {saveOpen && (
          <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/5">
            <Label htmlFor="allowlist-new-name" className="text-sm text-gray-700 dark:text-gray-300">
              List name
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex-1 space-y-1">
                <Input
                  id="allowlist-new-name"
                  autoFocus
                  placeholder="e.g. Top 10 editors"
                  maxLength={MAX_ALLOWLIST_NAME_LENGTH}
                  className={cn(fieldClass, saveError && "border-red-500 dark:border-red-500")}
                  aria-invalid={!!saveError}
                  aria-describedby={saveError ? "allowlist-new-name-error" : undefined}
                  value={saveName}
                  disabled={saving}
                  onChange={(e) => {
                    setSaveName(e.target.value);
                    setSaveError(null);
                  }}
                  onKeyDown={(e) => stopEnter(e, saveList)}
                />
                {saveError && (
                  <p id="allowlist-new-name-error" className="text-xs text-red-600 dark:text-red-400">
                    {saveError}
                  </p>
                )}
              </div>
              <Button
                type="button"
                disabled={!saveName.trim() || valid.length === 0 || saving}
                onClick={saveList}
              >
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-1.5 h-4 w-4" />}
                Create &amp; save list
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="dark:text-gray-300 dark:hover:bg-white/10"
                disabled={saving}
                onClick={() => {
                  setSaveOpen(false);
                  setSaveError(null);
                }}
              >
                Cancel
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Saves the {valid.length} valid username{valid.length === 1 ? "" : "s"} as a list and
              selects it for this campaign.
            </p>
          </div>
        )}

        {saveFailures && (
          <AddResultDetails
            notFound={saveFailures.notFound}
            invalid={saveFailures.invalid}
            onDismiss={() => setSaveFailures(null)}
          />
        )}
      </div>

      {(selectedLists.length > 0 || valid.length > 0) && (
        <p
          role="status"
          className="rounded-md bg-purple-50/60 px-3 py-2 text-sm text-gray-700 dark:bg-[#7F39EC]/10 dark:text-gray-200"
        >
          <span className="font-medium">Access will be given to: </span>
          {[
            selectedLists.length > 0 &&
              `${selectedLists.length} list${selectedLists.length === 1 ? "" : "s"} (${
                allCached || selectedLists.length === 1 ? "" : "up to "
              }${listCreatorCount} creator${listCreatorCount === 1 ? "" : "s"})`,
            valid.length > 0 && `${valid.length} username${valid.length === 1 ? "" : "s"}`,
          ]
            .filter(Boolean)
            .join(" + ")}
        </p>
      )}

      <Sheet open={!!previewList} onOpenChange={(o) => !o && setPreviewId(null)}>
        <SheetContent
          side="right"
          // Focus the panel, not the first date, so its tooltip doesn't pop open.
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn("flex w-full flex-col gap-0 p-0 sm:max-w-md", isDark && "dark border-white/10 bg-[#06021D] text-white")}
        >
          {previewList && (
            <>
              <SheetHeader className="space-y-1 border-b border-gray-200 p-5 pr-12 text-left dark:border-white/10">
                <SheetTitle className="truncate text-gray-900 dark:text-white">{previewList.name}</SheetTitle>
                <SheetDescription className="text-gray-500 dark:text-gray-400">
                  {previewList.member_count} creator{previewList.member_count === 1 ? "" : "s"} · updated{" "}
                  <RelativeTime value={previewList.updated_at} />
                </SheetDescription>
              </SheetHeader>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {previewState?.status === "ready" && previewState.members.length > 10 && (
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <Input
                      className={cn("h-10 pl-8 pr-9", fieldClass)}
                      placeholder="Search members"
                      aria-label={`Search members of ${previewList.name}`}
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                      onKeyDown={(e) => stopEnter(e)}
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
                {!previewState || previewState.status === "loading" ? (
                  <MemberRowsSkeleton />
                ) : previewState.status === "error" ? (
                  <div className="space-y-3 py-6 text-center">
                    <p className="text-sm text-red-600 dark:text-red-400">{previewState.message}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className={outlineDark}
                      onClick={() => loadMembers(previewList.id, true)}
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" /> Retry
                    </Button>
                  </div>
                ) : previewState.members.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">This list is empty.</p>
                ) : previewMembers.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">No members match.</p>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-white/10">
                    {previewMembers.map((m) => (
                      <li key={m.user_id} className="flex items-center gap-3 py-2.5">
                        <CreatorAvatar username={m.username} fullName={m.full_name} src={m.profile_picture_url} size="sm" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                            @{m.username ?? "unknown"}
                          </div>
                          {m.full_name && (
                            <div className="truncate text-xs text-gray-500 dark:text-gray-400">{m.full_name}</div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 p-5 dark:border-white/10">
                {!advertiserId ? (
                  <a
                    href="/dashboard/allowlists"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-[#7F39EC] hover:underline dark:text-purple-300"
                  >
                    Edit in Manage lists <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  variant={previewSelected ? "outline" : "default"}
                  className={cn(previewSelected ? outlineDark : "bg-[#7F39EC] hover:bg-[#7F39EC]/90")}
                  aria-pressed={previewSelected}
                  disabled={disabled}
                  onClick={() => toggleList(previewList.id, !previewSelected)}
                >
                  {previewSelected ? (
                    <>
                      <Check className="mr-1.5 h-4 w-4" /> Selected
                    </>
                  ) : (
                    "Select this list"
                  )}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

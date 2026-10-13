"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseUsernames, type BrandAllowlist } from "@/lib/campaign-access";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import { accessListApi, allowlistApi } from "./api";
import { SavedListsSkeleton } from "./Skeletons";

const fieldClass = "dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500";

export type AllowlistSelection = {
  allowlistIds: string[];
  usernames: string;
  /** When set with usernames, they are also saved as a reusable list. */
  newListName: string;
};

export const EMPTY_ALLOWLIST_SELECTION: AllowlistSelection = {
  allowlistIds: [],
  usernames: "",
  newListName: "",
};

export function hasAllowlistSelection(sel: AllowlistSelection): boolean {
  return sel.allowlistIds.length > 0 || parseUsernames(sel.usernames).valid.length > 0;
}

/**
 * Thrown when only part of a selection was applied. `retrySelection` is safe to
 * pass back to applyAllowlistSelection: a list that was already created is
 * referenced by id instead of being created again (which would 409).
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
 * row exists. Returns usernames that could not be resolved.
 * Imports are idempotent, so retrying with the same selection is safe.
 */
export async function applyAllowlistSelection(
  contestId: string,
  selection: AllowlistSelection,
  advertiserId?: string | null,
): Promise<{ notFound: string[]; invalid: string[]; added: number }> {
  let added = 0;
  const notFound: string[] = [];
  const invalid: string[] = [];
  const listIds = [...selection.allowlistIds];
  let retrySelection = selection;

  const hasUsernames = parseUsernames(selection.usernames).valid.length > 0;
  const newName = selection.newListName.trim();

  try {
    if (hasUsernames && newName) {
      const created = await allowlistApi.create({
        name: newName,
        usernames: selection.usernames,
        advertiserId,
      });
      notFound.push(...created.notFound);
      invalid.push(...created.invalid);
      listIds.push(created.allowlist.id);
      retrySelection = { allowlistIds: [...listIds], usernames: "", newListName: "" };
    } else if (hasUsernames) {
      const res = await accessListApi.addUsernames(contestId, selection.usernames);
      added += res.added;
      notFound.push(...(res.notFound || []));
      invalid.push(...(res.invalid || []));
      retrySelection = { ...selection, usernames: "", newListName: "" };
    }

    for (const id of listIds) {
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

export function AllowlistPicker({ value, onChange, advertiserId, disabled }: Props) {
  const isDark = useDashboardDark();
  const [lists, setLists] = useState<BrandAllowlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [listQuery, setListQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    allowlistApi
      .list(advertiserId)
      .then((res) => !cancelled && setLists(res.allowlists))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [advertiserId, reloadKey]);

  // A list created during a failed save is selected by id but not loaded yet.
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

  const { valid, invalid } = parseUsernames(value.usernames);

  return (
    <div className={cn("space-y-5", isDark && "dark")}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Import saved allowlists</p>
          {!advertiserId && (
            <Link
              href="/dashboard/allowlists"
              className="text-xs text-[#7F39EC] hover:underline dark:text-purple-300"
            >
              Manage saved lists
            </Link>
          )}
        </div>
        {loading ? (
          <SavedListsSkeleton rows={2} />
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : lists.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No saved lists yet. Add usernames below and name the list to save it.</p>
        ) : (
          <div className="space-y-2">
          {lists.length > 6 && (
            <Input
              className={cn("h-10", fieldClass)}
              placeholder="Search saved lists"
              aria-label="Search saved lists"
              value={listQuery}
              onChange={(e) => setListQuery(e.target.value)}
            />
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {lists
              .filter(
                (list) =>
                  value.allowlistIds.includes(list.id) ||
                  list.name.toLowerCase().includes(listQuery.trim().toLowerCase()),
              )
              .map((list) => (
              <label
                key={list.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 px-3 py-2 hover:border-purple-300 dark:border-white/10 dark:hover:border-[#7F39EC]/60"
              >
                <Checkbox
                  checked={value.allowlistIds.includes(list.id)}
                  onCheckedChange={(c) => toggleList(list.id, c === true)}
                  disabled={disabled}
                />
                <span className="flex-1 truncate text-sm text-gray-900 dark:text-gray-100">{list.name}</span>
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only">Members:</span>
                  {list.member_count}
                </span>
              </label>
            ))}
          </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="allowlist-usernames" className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Add creator usernames
        </Label>
        <Textarea
          id="allowlist-usernames"
          rows={3}
          placeholder="creator_one, creator_two or one per line"
          className={fieldClass}
          aria-describedby="allowlist-usernames-count"
          value={value.usernames}
          onChange={(e) => onChange({ ...value, usernames: e.target.value })}
          disabled={disabled}
        />
        <p id="allowlist-usernames-count" className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
          {valid.length} username{valid.length === 1 ? "" : "s"}
          {invalid.length > 0 && (
            <span className="text-red-600 dark:text-red-400"> · invalid: {invalid.join(", ")}</span>
          )}
        </p>
      </div>

      {valid.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="allowlist-new-name" className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Save these usernames as a list (optional)
          </Label>
          <Input
            id="allowlist-new-name"
            placeholder="e.g. Top 10 editors"
            className={fieldClass}
            maxLength={100}
            value={value.newListName}
            onChange={(e) => onChange({ ...value, newListName: e.target.value })}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

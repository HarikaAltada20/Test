"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseUsernames, type BrandAllowlist } from "@/lib/campaign-access";
import { accessListApi, allowlistApi } from "./api";

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
 * Copies the selection into a campaign's access list. Call after the campaign
 * row exists. Returns usernames that could not be resolved.
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

  const hasUsernames = parseUsernames(selection.usernames).valid.length > 0;
  const newName = selection.newListName.trim();

  if (hasUsernames && newName) {
    const created = await allowlistApi.create({
      name: newName,
      usernames: selection.usernames,
      advertiserId,
    });
    notFound.push(...created.notFound);
    invalid.push(...created.invalid);
    listIds.push(created.allowlist.id);
  } else if (hasUsernames) {
    const res = await accessListApi.addUsernames(contestId, selection.usernames);
    added += res.added;
    notFound.push(...(res.notFound || []));
    invalid.push(...(res.invalid || []));
  }

  for (const id of listIds) {
    const res = await accessListApi.importList(contestId, id);
    added += res.added;
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
  const [lists, setLists] = useState<BrandAllowlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, [advertiserId]);

  const toggleList = (id: string, checked: boolean) => {
    const set = new Set(value.allowlistIds);
    if (checked) set.add(id);
    else set.delete(id);
    onChange({ ...value, allowlistIds: Array.from(set) });
  };

  const { valid, invalid } = parseUsernames(value.usernames);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Import saved allowlists</Label>
          {!advertiserId && (
            <Link href="/dashboard/allowlists" className="text-xs text-[#7F39EC] hover:underline">
              Manage saved lists
            </Link>
          )}
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading lists…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : lists.length === 0 ? (
          <p className="text-sm text-gray-500">No saved lists yet. Add usernames below and name the list to save it.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {lists.map((list) => (
              <label
                key={list.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-gray-200 px-3 py-2 hover:border-purple-300"
              >
                <Checkbox
                  checked={value.allowlistIds.includes(list.id)}
                  onCheckedChange={(c) => toggleList(list.id, c === true)}
                  disabled={disabled}
                />
                <span className="flex-1 truncate text-sm">{list.name}</span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="h-3 w-3" />
                  {list.member_count}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="allowlist-usernames" className="text-sm font-medium">
          Add creator usernames
        </Label>
        <Textarea
          id="allowlist-usernames"
          rows={3}
          placeholder="creator_one, creator_two or one per line"
          value={value.usernames}
          onChange={(e) => onChange({ ...value, usernames: e.target.value })}
          disabled={disabled}
        />
        <p className="text-xs text-gray-500">
          {valid.length} username{valid.length === 1 ? "" : "s"}
          {invalid.length > 0 && (
            <span className="text-red-600"> · invalid: {invalid.join(", ")}</span>
          )}
        </p>
      </div>

      {valid.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="allowlist-new-name" className="text-sm font-medium">
            Save these usernames as a list (optional)
          </Label>
          <Input
            id="allowlist-new-name"
            placeholder="e.g. Top 10 editors"
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

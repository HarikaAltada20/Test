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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  MAX_ALLOWLIST_NAME_LENGTH,
  type AllowlistMember,
  type BrandAllowlist,
} from "@/lib/campaign-access";
import {
  allowlistApi,
  summarizeAddResult,
} from "@/components/campaign-access/api";

export default function AllowlistsClient() {
  const [lists, setLists] = useState<BrandAllowlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<AllowlistMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [newName, setNewName] = useState("");
  const [newUsernames, setNewUsernames] = useState("");
  const [addUsernames, setAddUsernames] = useState("");

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
    if (selectedId) loadMembers(selectedId);
    else setMembers([]);
  }, [selectedId, loadMembers]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    try {
      const message = await fn();
      if (message) toast({ title: message });
    } catch (e: any) {
      toast({
        title: "Something went wrong",
        description: e.message,
        variant: "destructive",
      });
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
      await loadLists();
      setSelectedId(res.allowlist.id);
      const extra = [
        res.notFound.length ? `not found: ${res.notFound.join(", ")}` : "",
        res.invalid.length ? `invalid: ${res.invalid.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      return `Created "${res.allowlist.name}" with ${res.added} creators${extra ? ` · ${extra}` : ""}`;
    });

  const handleRename = (list: BrandAllowlist) => {
    const name = window.prompt("Rename list", list.name);
    if (!name || name.trim() === list.name) return;
    run(`rename:${list.id}`, async () => {
      await allowlistApi.rename(list.id, name);
      await loadLists();
      return "List renamed";
    });
  };

  const handleDuplicate = (list: BrandAllowlist) =>
    run(`duplicate:${list.id}`, async () => {
      const res = await allowlistApi.duplicate(list.id);
      await loadLists();
      return `Created "${res.allowlist.name}"`;
    });

  const handleDelete = (list: BrandAllowlist) => {
    if (
      !window.confirm(
        `Delete "${list.name}"? Campaigns that imported it keep their creators.`,
      )
    )
      return;
    run(`delete:${list.id}`, async () => {
      await allowlistApi.remove(list.id);
      if (selectedId === list.id) setSelectedId(null);
      await loadLists();
      return "List deleted";
    });
  };

  const handleAddMembers = () => {
    if (!selected) return;
    run("add", async () => {
      const res = await allowlistApi.addMembers(selected.id, addUsernames);
      setAddUsernames("");
      await Promise.all([loadLists(), loadMembers(selected.id)]);
      return summarizeAddResult(res);
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
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users className="h-6 w-6" /> Saved allowlists
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Reusable creator lists. Importing a list into a private campaign
          copies its creators; later edits here don&apos;t change campaigns
          that already imported it.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 p-4">
        <Label className="font-medium">New list</Label>
        <Input
          placeholder="List name"
          maxLength={MAX_ALLOWLIST_NAME_LENGTH}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Textarea
          rows={2}
          placeholder="Usernames (optional), separated by commas, spaces or new lines"
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
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="rounded-lg border border-gray-200">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading lists…
            </div>
          ) : lists.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">
              No saved lists yet. Create one above.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {lists.map((list) => (
                <li
                  key={list.id}
                  className={cn(
                    "flex items-center justify-between gap-2 p-3",
                    selectedId === list.id && "bg-purple-50",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedId(list.id)}
                  >
                    <div className="truncate font-medium">{list.name}</div>
                    <div className="text-xs text-gray-500">
                      {list.member_count} creator
                      {list.member_count === 1 ? "" : "s"}
                    </div>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Rename ${list.name}`}
                      disabled={busy === `rename:${list.id}`}
                      onClick={() => handleRename(list)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Duplicate ${list.name}`}
                      disabled={busy === `duplicate:${list.id}`}
                      onClick={() => handleDuplicate(list)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Delete ${list.name}`}
                      disabled={busy === `delete:${list.id}`}
                      onClick={() => handleDelete(list)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          {!selected ? (
            <p className="text-sm text-gray-500">
              Select a list to manage its creators.
            </p>
          ) : (
            <>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <div className="space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Add usernames"
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
              </div>
              <div className="rounded-md border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Creator</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {membersLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-sm text-gray-500"
                        >
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        </TableCell>
                      </TableRow>
                    ) : members.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-sm text-gray-500"
                        >
                          No creators on this list yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((m) => (
                        <TableRow key={m.user_id}>
                          <TableCell>
                            <div className="font-medium">
                              @{m.username ?? "unknown"}
                            </div>
                            {m.full_name && (
                              <div className="text-xs text-gray-500">
                                {m.full_name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(m.added_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Remove ${m.username ?? "creator"}`}
                              disabled={busy === `remove:${m.user_id}`}
                              onClick={() => handleRemoveMember(m)}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

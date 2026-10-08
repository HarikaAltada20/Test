"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Lock, Trash2, UserPlus, Download, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ACCESS_SOURCE_LABELS,
  type BrandAllowlist,
  type ContestAccessMember,
} from "@/lib/campaign-access";
import { accessListApi, allowlistApi, summarizeAddResult } from "./api";

type Props = {
  contestId: string;
  /** Brand that owns the campaign; required for admins to load that brand's saved lists. */
  advertiserId?: string | null;
};

const ALL = "all";

export function CampaignAccessPanel({ contestId, advertiserId }: Props) {
  const [members, setMembers] = useState<ContestAccessMember[]>([]);
  const [lists, setLists] = useState<BrandAllowlist[]>([]);
  const [skipRequirements, setSkipRequirements] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [usernames, setUsernames] = useState("");
  const [importListId, setImportListId] = useState("");
  const [saveName, setSaveName] = useState("");
  const [filter, setFilter] = useState<string>(ALL);

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

  const filterOptions = useMemo(() => {
    const opts = new Map<string, string>();
    for (const m of members) {
      if (m.source === "saved_list" && m.source_allowlist_id) {
        opts.set(`list:${m.source_allowlist_id}`, `From list: ${m.source_allowlist_name ?? "deleted list"}`);
      } else {
        opts.set(m.source, ACCESS_SOURCE_LABELS[m.source]);
      }
    }
    return Array.from(opts.entries());
  }, [members]);

  const visible = useMemo(() => {
    if (filter === ALL) return members;
    if (filter.startsWith("list:")) {
      const id = filter.slice(5);
      return members.filter((m) => m.source_allowlist_id === id);
    }
    return members.filter((m) => m.source === filter && !(m.source === "saved_list" && m.source_allowlist_id));
  }, [members, filter]);

  const sourceLabel = (m: ContestAccessMember) =>
    m.source === "saved_list"
      ? `List: ${m.source_allowlist_name ?? "deleted list"}`
      : ACCESS_SOURCE_LABELS[m.source];

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading access list…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Lock className="h-4 w-4" /> Campaign access list
          </h3>
          <p className="text-sm text-gray-500">
            {members.length} creator{members.length === 1 ? "" : "s"} can see this private campaign.
          </p>
        </div>
        <label className="flex max-w-sm items-start gap-3 rounded-md border border-gray-200 p-3">
          <Switch
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
          <span className="text-sm">
            <span className="font-medium">Creators on the access list skip requirements</span>
            <span className="block text-xs text-gray-500">
              When off, listed creators still need the campaign's trust and quality minimums to submit.
            </span>
          </span>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 rounded-md border border-gray-200 p-4">
          <Label htmlFor="access-add-usernames" className="font-medium">Add usernames</Label>
          <Textarea
            id="access-add-usernames"
            rows={2}
            placeholder="creator_one, creator_two"
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
                return summarizeAddResult(res);
              })
            }
          >
            {busy === "add" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            Add
          </Button>
        </div>

        <div className="space-y-2 rounded-md border border-gray-200 p-4">
          <Label className="font-medium">Import a saved list</Label>
          <Select value={importListId} onValueChange={setImportListId}>
            <SelectTrigger>
              <SelectValue placeholder={lists.length ? "Choose a list" : "No saved lists"} />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} ({l.member_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            disabled={!importListId || busy === "import"}
            onClick={() =>
              run("import", async () => {
                const res = await accessListApi.importList(contestId, importListId);
                setImportListId("");
                return summarizeAddResult(res);
              })
            }
          >
            {busy === "import" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Import
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-60">
          <Label className="mb-1 block text-xs text-gray-500">Filter by source</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All sources</SelectItem>
              {filterOptions.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Input
            className="w-56"
            placeholder="New list name"
            maxLength={100}
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!saveName.trim() || members.length === 0 || busy === "save"}
            onClick={() =>
              run("save", async () => {
                const res = await accessListApi.saveAsList(contestId, saveName);
                setSaveName("");
                return `Saved "${res.allowlist.name}" with ${res.allowlist.member_count} creators`;
              })
            }
          >
            <Save className="mr-2 h-4 w-4" /> Save as list
          </Button>
        </div>
      </div>

      <div className="rounded-md border border-gray-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creator</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-gray-500">
                  No creators yet. Add usernames or import a saved list.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell>
                    <div className="font-medium">@{m.username ?? "unknown"}</div>
                    {m.full_name && <div className="text-xs text-gray-500">{m.full_name}</div>}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{sourceLabel(m)}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {new Date(m.added_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${m.username ?? "creator"}`}
                      disabled={busy === `remove:${m.user_id}`}
                      onClick={() =>
                        run(`remove:${m.user_id}`, async () => {
                          await accessListApi.remove(contestId, [m.user_id]);
                          return `Removed @${m.username ?? "creator"}`;
                        })
                      }
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
    </div>
  );
}

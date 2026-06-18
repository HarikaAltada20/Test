"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
import { ChevronLeft, ChevronRight, Filter, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 50;

type RecipientRow = {
  index: number;
  userId: string;
  email: string;
  fullName: string;
  username: string;
  userType: string;
  status: string;
  fromEmail: string | null;
  openedAt: string | null;
  clickedAt: string | null;
};

const SENT_STATUSES = new Set(["sent", "delivered", "opened", "clicked"]);

const LEAD_STATUS_BADGE_CLASS: Record<string, string> = {
  Sent: "bg-green-100 text-green-800 hover:bg-green-100",
  Opened: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  Clicked: "bg-purple-100 text-purple-800 hover:bg-purple-100",
  Pending: "bg-gray-100 text-gray-700 hover:bg-gray-100",
  Bounced: "bg-red-100 text-red-800 hover:bg-red-100",
  Failed: "bg-red-100 text-red-800 hover:bg-red-100",
};

function leadStatusBadges(r: RecipientRow): string[] {
  const badges: string[] = [];

  if (SENT_STATUSES.has(r.status)) badges.push("Sent");
  if (r.openedAt || r.status === "opened" || r.status === "clicked") {
    badges.push("Opened");
  }
  if (r.clickedAt || r.status === "clicked") badges.push("Clicked");

  if (badges.length === 0) {
    if (r.status === "pending" || r.status === "in_sequence") {
      badges.push("Pending");
    } else if (r.status === "bounced") {
      badges.push("Bounced");
    } else if (r.status === "failed") {
      badges.push("Failed");
    } else if (r.status) {
      badges.push(
        r.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      );
    }
  }

  return badges;
}

function LeadStatusBadges({ recipient }: { recipient: RecipientRow }) {
  const badges = leadStatusBadges(recipient);
  if (badges.length === 0) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((label) => (
        <Badge
          key={label}
          className={cn(
            "font-normal capitalize",
            LEAD_STATUS_BADGE_CLASS[label] ?? "bg-gray-100 text-gray-700",
          )}
        >
          {label}
        </Badge>
      ))}
    </div>
  );
}

type Props = {
  campaignId: string;
  onRecipientsChange?: () => void;
};

export function LeadTab({ campaignId, onRecipientsChange }: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [recipients, setRecipients] = useState<RecipientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [campaignId, statusFilter, debouncedSearch]);

  const loadRecipients = () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: String(PAGE_SIZE),
    });
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

    return fetch(`/api/admin/email-campaigns/${campaignId}/recipients?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setRecipients(d.recipients ?? []);
        setTotal(d.total ?? d.recipients?.length ?? 0);
        setTotalPages(d.totalPages ?? 1);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRecipients();
  }, [campaignId, statusFilter, debouncedSearch, page]);

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(recipients.map((r) => r.userId)));
    else setSelected(new Set());
  };

  const handleDeleteSelected = async () => {
    const userIds = Array.from(selected);
    if (!userIds.length) return;

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/email-campaigns/${campaignId}/recipients`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userIds }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        toast({
          title: "Could not remove leads",
          description: data.error || "Delete failed",
          variant: "destructive",
        });
        return;
      }

      const removedIds = new Set(userIds);
      setRecipients((prev) => prev.filter((r) => !removedIds.has(r.userId)));
      setTotal((prev) => Math.max(0, prev - (data.deletedCount ?? userIds.length)));
      setSelected(new Set());
      setConfirmDelete(false);

      await loadRecipients();
      onRecipientsChange?.();

      const remaining = data.recipientCount ?? 0;
      toast({
        title: "Leads removed",
        description: `Removed ${data.deletedCount ?? userIds.length} lead(s). ${remaining} remaining.`,
      });
    } finally {
      setDeleting(false);
    }
  };

  const contactLabel = (r: RecipientRow) =>
    r.fullName || r.username || "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails, contacts, companies..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-white border-gray-300"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-11 bg-white border-gray-300">
            <Filter className="h-4 w-4 mr-2 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Filter: All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
            <SelectItem value="clicked">Clicked</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>

        {/* <Button variant="outline" className="h-11 border-gray-300">
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Manage Table
        </Button> */}

        {selected.size > 0 && (
          <>
            <span className="text-sm text-muted-foreground">
              {selected.size} selected
            </span>
            <Button
              variant="destructive"
              className="h-11"
              onClick={() => setConfirmDelete(true)}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </>
        )}

        <Button
          className="h-11 bg-[#662EBD] hover:bg-[#5524a8]"
          onClick={() =>
            toast({
              title: "Add leads",
              description:
                "Select users on the Table tab and use Send email to attach recipients to this campaign.",
            })
          }
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Leads
        </Button>
      </div>

      <Card className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {!loading && total > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <span>
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, total)} of {total} leads
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50/80 text-muted-foreground">
                <th className="p-4 w-10">
                  <Checkbox
                    checked={
                      recipients.length > 0 &&
                      recipients.every((r) => selected.has(r.userId))
                    }
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                </th>
                <th className="p-4 text-left font-medium w-12">#</th>
                <th className="p-4 text-left font-medium">Email</th>
                <th className="p-4 text-left font-medium">Status</th>
                <th className="p-4 text-left font-medium">From Email</th>
                <th className="p-4 text-left font-medium">Contact</th>
                <th className="p-4 text-left font-medium">User Type</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="p-4">
                          <div className="h-4 w-20 rounded-md bg-muted animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              )}
              {!loading &&
                recipients.map((r) => (
                  <tr key={r.userId} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-4">
                      <Checkbox
                        checked={selected.has(r.userId)}
                        onCheckedChange={(v) => {
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (v) next.add(r.userId);
                            else next.delete(r.userId);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="p-4 text-muted-foreground">{r.index}</td>
                    <td className="p-4 font-medium">{r.email || "—"}</td>
                    <td className="p-4">
                      <LeadStatusBadges recipient={r} />
                    </td>
                    <td className="p-4">
                      {r.fromEmail ? (
                        <a
                          href={`mailto:${r.fromEmail}`}
                          className="text-blue-600 hover:underline"
                        >
                          {r.fromEmail}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">{contactLabel(r)}</td>
                    <td className="p-4 capitalize text-muted-foreground">{r.userType || "—"}</td>
                  </tr>
                ))}
              {!loading && recipients.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground">
                    No leads attached yet. Use Add Leads or send from the Users table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove selected leads?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selected.size} lead
              {selected.size === 1 ? "" : "s"} from this campaign. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteSelected();
              }}
            >
              {deleting ? "Removing..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Inbox,
  Link2,
  Loader2,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useDashboardDark } from "@/hooks/use-dashboard-dark";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  MAX_REJECTION_REASON_LENGTH,
  applicationDisplayStatus,
  clampPage,
  type ApplicationStatus,
  type ContestApplication,
} from "@/lib/campaign-access";
import { applicationsApi, type ApplicationListResponse } from "./api";
import { ApplicationStatusBadge } from "./AccessBadge";
import { CreatorAvatar } from "./CreatorAvatar";
import { EmptyState } from "./EmptyState";
import { RelativeTime } from "./RelativeTime";
import { ApplicationRowsSkeleton } from "./Skeletons";

type Props = { contestId: string };

const PAGE_SIZE = 50;

function AnswerValue({ kind, answer }: { kind: string; answer: string }) {
  if (kind === "url") {
    return (
      <a
        href={answer}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="break-all text-[#7F39EC] underline dark:text-purple-300"
      >
        {answer}
      </a>
    );
  }
  if (kind === "yes_no") return <span>{answer === "yes" ? "Yes" : "No"}</span>;
  return <span className="whitespace-pre-wrap break-words">{answer}</span>;
}

export function ApplicationsPanel({ contestId }: Props) {
  const isDark = useDashboardDark();
  const [status, setStatus] = useState<ApplicationStatus>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApplicationListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rejectIds, setRejectIds] = useState<string[] | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    let movingPage = false;
    setLoading(true);
    try {
      const res = await applicationsApi.list(contestId, {
        status,
        search: search || undefined,
        page,
        limit: PAGE_SIZE,
      });
      if (requestId !== latestRequest.current) return;
      // Reviews can shrink the results so this page no longer exists; the page change reloads.
      const validPage = clampPage(page, res.total, PAGE_SIZE);
      if (validPage !== page) {
        movingPage = true;
        setPage(validPage);
        return;
      }
      setData(res);
      setSelected(new Set());
    } catch (e: unknown) {
      if (requestId !== latestRequest.current) return;
      toast({
        title: "Could not load applications",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      if (requestId === latestRequest.current && !movingPage) setLoading(false);
    }
  }, [contestId, status, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const review = async (ids: string[], decision: "approve" | "reject", reason?: string) => {
    const key = `${decision}:${ids.join(",")}`;
    setBusy(key);
    try {
      if (ids.length === 1) {
        const res = await applicationsApi.review(contestId, ids[0], decision, reason);
        toast({ title: res.message });
      } else {
        const res = await applicationsApi.bulkReview(contestId, ids, decision, reason);
        toast({
          title: `${res.updated} application${res.updated === 1 ? "" : "s"} ${
            decision === "approve" ? "approved" : "rejected"
          }`,
          description: res.skipped ? `${res.skipped} skipped` : undefined,
        });
      }
      setRejectIds(null);
      setRejectReason("");
      await load();
    } catch (e: unknown) {
      toast({
        title: "Something went wrong",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const copyCampaignLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/dashboard/opportunities/${contestId}`,
      );
      toast({ title: "Campaign link copied" });
    } catch {
      toast({ title: "Couldn't copy the link", variant: "destructive" });
    }
  };

  const applications = data?.applications ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasAnyApplications = Object.values(data?.counts ?? {}).some((n) => n > 0);
  const needsReapprove = (a: ContestApplication) => a.status === "approved" && !a.on_access_list;
  const canApprove = (a: ContestApplication) =>
    a.status === "pending" || a.status === "rejected" || needsReapprove(a);
  const canReject = (a: ContestApplication) => a.status === "pending";
  const selectable = applications.filter((a) => canApprove(a) || canReject(a));
  const allSelected = selectable.length > 0 && selectable.every((a) => selected.has(a.id));
  const selectedApps = applications.filter((a) => selected.has(a.id));

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const outlineDark = "dark:border-white/15 dark:bg-transparent dark:text-gray-200 dark:hover:bg-white/10";

  return (
    <div className={cn("space-y-5", isDark && "dark")}>
      <div>
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <ClipboardList className="h-4 w-4" aria-hidden="true" /> Applications
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Approving a creator adds them to this campaign&apos;s access list so they can see the
          full campaign and submit.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {APPLICATION_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              size="sm"
              variant={status === s ? "default" : "outline"}
              aria-pressed={status === s}
              className={cn(
                status === s ? "bg-[#7F39EC] hover:bg-[#7F39EC]/90" : outlineDark,
              )}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {APPLICATION_STATUS_LABELS[s]} ({data?.counts?.[s] ?? 0})
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <Input
            className="h-10 pl-8 dark:border-white/15 dark:bg-white/5 dark:text-white dark:placeholder:text-gray-500"
            placeholder="Search username"
            aria-label="Search applications by username"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
      </div>

      {selectedApps.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-purple-200 bg-purple-50/60 p-3 text-sm dark:border-[#7F39EC]/40 dark:bg-[#7F39EC]/15 dark:text-gray-100">
          <span className="font-medium">{selectedApps.length} selected</span>
          <Button
            size="sm"
            disabled={!!busy || !selectedApps.some(canApprove)}
            onClick={() => review(selectedApps.filter(canApprove).map((a) => a.id), "approve")}
          >
            <Check className="mr-1 h-4 w-4" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={outlineDark}
            disabled={!!busy || !selectedApps.some(canReject)}
            onClick={() => setRejectIds(selectedApps.filter(canReject).map((a) => a.id))}
          >
            <X className="mr-1 h-4 w-4" /> Reject
          </Button>
        </div>
      )}

      <div className="divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-white/10 dark:border-white/10">
        <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <Checkbox
            aria-label="Select all"
            checked={allSelected}
            disabled={selectable.length === 0}
            onCheckedChange={(v) =>
              setSelected(v ? new Set(selectable.map((a) => a.id)) : new Set())
            }
          />
          <span className="flex-1">Creator</span>
          <span className="hidden w-28 sm:block">Applied</span>
          <span className="hidden w-28 sm:block">Status</span>
          <span className="w-auto text-right sm:w-44">Actions</span>
        </div>

        {loading ? (
          <ApplicationRowsSkeleton />
        ) : applications.length === 0 ? (
          search ? (
            <EmptyState
              icon={SearchX}
              title="No applications match that username"
              actions={
                <Button size="sm" variant="outline" className={outlineDark} onClick={() => setSearchInput("")}>
                  Clear search
                </Button>
              }
            />
          ) : !hasAnyApplications ? (
            <EmptyState
              icon={Inbox}
              title="No applications yet"
              description="Share the campaign link so creators can find it and apply."
              actions={
                <Button size="sm" onClick={copyCampaignLink}>
                  <Link2 className="mr-1.5 h-4 w-4" /> Copy campaign link
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title={`No ${APPLICATION_STATUS_LABELS[status].toLowerCase()} applications`}
            />
          )
        ) : (
          applications.map((a) => {
            const isOpen = expanded.has(a.id);
            const panelId = `application-${a.id}-answers`;
            return (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Checkbox
                    aria-label={`Select ${a.username ?? "creator"}`}
                    checked={selected.has(a.id)}
                    disabled={!canApprove(a) && !canReject(a)}
                    onCheckedChange={() => setSelected((s) => toggle(s, a.id))}
                  />
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F39EC]"
                    onClick={() => setExpanded((s) => toggle(s, a.id))}
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                    )}
                    <CreatorAvatar
                      username={a.username}
                      fullName={a.full_name}
                      src={a.profile_picture_url}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-gray-900 dark:text-white">
                        @{a.username ?? "unknown"}
                      </span>
                      {a.full_name && (
                        <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                          {a.full_name}
                        </span>
                      )}
                      <span className="mt-1 flex items-center gap-2 sm:hidden">
                        <ApplicationStatusBadge status={applicationDisplayStatus(a)} />
                      </span>
                    </span>
                  </button>
                  <span className="hidden w-28 text-sm text-gray-600 dark:text-gray-300 sm:block">
                    <RelativeTime value={a.created_at} />
                  </span>
                  <span className="hidden w-28 sm:block">
                    <ApplicationStatusBadge status={applicationDisplayStatus(a)} />
                  </span>
                  <span className="flex shrink-0 flex-col justify-end gap-2 sm:w-44 sm:flex-row">
                    {canApprove(a) && (
                      <Button
                        size="sm"
                        disabled={!!busy}
                        onClick={() => review([a.id], "approve")}
                      >
                        {busy === `approve:${a.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : needsReapprove(a) ? (
                          "Re-approve"
                        ) : (
                          "Approve"
                        )}
                      </Button>
                    )}
                    {canReject(a) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={outlineDark}
                        disabled={!!busy}
                        onClick={() => setRejectIds([a.id])}
                      >
                        Reject
                      </Button>
                    )}
                  </span>
                </div>

                {isOpen && (
                  <div
                    id={panelId}
                    className="mt-3 space-y-3 rounded-md bg-gray-50 p-3 text-sm sm:pl-12 dark:bg-white/5"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400 sm:hidden">
                      <RelativeTime value={a.created_at} prefix="Applied" />
                    </p>
                    {a.answers.length === 0 ? (
                      <p className="text-gray-500 dark:text-gray-400">
                        No answers (this campaign had no questions).
                      </p>
                    ) : (
                      a.answers.map((ans) => (
                        <div key={ans.question_id}>
                          <p className="font-medium text-gray-800 dark:text-gray-100">{ans.prompt}</p>
                          <div className="text-gray-700 dark:text-gray-300">
                            <AnswerValue kind={ans.kind} answer={ans.answer} />
                          </div>
                        </div>
                      ))
                    )}
                    {a.status === "rejected" && a.rejection_reason && (
                      <p className="text-gray-600 dark:text-gray-300">
                        <span className="font-medium">Rejection reason:</span>{" "}
                        {a.rejection_reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            size="sm"
            variant="outline"
            className={outlineDark}
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-gray-600 dark:text-gray-300">
            Page {page} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="outline"
            className={outlineDark}
            disabled={page >= pageCount || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <Dialog
        isdark={isDark}
        open={rejectIds !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectIds(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent className={cn(isDark && "dark text-white")}>
          <DialogHeader>
            <DialogTitle>
              Reject {rejectIds && rejectIds.length > 1 ? `${rejectIds.length} applications` : "application"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Reason (optional, shown to the creator)</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              maxLength={MAX_REJECTION_REASON_LENGTH}
              className="dark:border-white/15 dark:bg-white/5 dark:text-white"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className={outlineDark} onClick={() => setRejectIds(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!busy}
              onClick={() => rejectIds && review(rejectIds, "reject", rejectReason)}
            >
              {busy?.startsWith("reject:") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useCallback,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ContestOption = {
  id: string;
  title: string;
  start_date: string | null;
};

export default function AffiliateLandingPage() {
  const router = useRouter();
  const [contestId, setContestId] = useState("");
  const [contestSearch, setContestSearch] = useState("");
  const [contests, setContests] = useState<ContestOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedContest, setSelectedContest] = useState<ContestOption | null>(
    null
  );
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRate, setBulkRate] = useState<number>(10);
  const [earnersLoading, setEarnersLoading] = useState(false);
  const [contestLoading, setContestLoading] = useState(false);

  const filtered = useMemo(() => rows, [rows]);
  const selectedRows = filtered.filter((r) => selected[r.submission_id]);
  const previewTotal = selectedRows.reduce(
    (acc, r) => acc + r.default_commission_cents * (bulkRate / 10),
    0
  );

  // Get theme from parent layout instead of managing independent state
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      // Check data-mode attribute from parent layout
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const dataMode = modeElement.getAttribute("data-mode");
        return dataMode === "dark";
      }
      // Fallback to data-theme attribute
      const themeElement = document.documentElement;
      const dataTheme = themeElement.getAttribute("data-theme");
      return dataTheme === "dark";
    }
    return false; // Default to light mode
  });

  // Debounced search for contests
  const searchContests = useCallback(async (query: string) => {
    if (!query || query.trim().length === 0) {
      setContests([]);
      return;
    }

    try {
      setSearching(true);
      const res = await fetch(
        `/api/admin/affiliate/contests/search?q=${encodeURIComponent(query)}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to search");
      setContests(json.contests || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to search contests");
      setContests([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchContests(contestSearch);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [contestSearch, searchContests]);

  const handleContestSelect = (contest: ContestOption) => {
    setSelectedContest(contest);
    setContestId(contest.id);
    setContestSearch(contest.title);
    setOpen(false);
  };

  // Watch for theme changes from parent layout
  useEffect(() => {
    const checkTheme = () => {
      const modeElement = document.querySelector("[data-mode]");
      if (modeElement) {
        const currentMode = modeElement.getAttribute("data-mode");
        const newIsDark = currentMode === "dark";
        if (newIsDark !== isDark) {
          setIsDark(newIsDark);
        }
      }
    };

    checkTheme();

    // Watch for changes in the data attribute
    const observer = new MutationObserver(checkTheme);
    const targetNode = document.querySelector("[data-mode]");
    if (targetNode) {
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ["data-mode"],
      });
    }

    return () => observer.disconnect();
  }, [isDark]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".relative")) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const fetchContest = async () => {
    if (!contestId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/affiliate/${contestId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setRows(
        (json.items || []).map((i: any) => ({
          submission_id: i.submission_id,
          contest_id: i.contest_id,
          winner_username: i.winner_username,
          referrer_username: i.referrer_username,
          winning_amount_cents: i.winning_amount_cents,
          default_commission_cents: i.default_commission_cents,
          status: i.status,
        }))
      );
      setSelected({});
    } catch (e: any) {
      toast.error(e?.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked)
      for (const r of filtered)
        if (r.status === "pending") next[r.submission_id] = true;
    setSelected(next);
  };

  const creditSelected = async () => {
    if (selectedRows.length === 0) return;
    try {
      setLoading(true);
      // Pull full rows to retrieve user ids for credit
      const resList = await fetch(`/api/admin/affiliate/${contestId}`);
      const jsonList = await resList.json();
      if (!resList.ok) throw new Error(jsonList.error || "Failed to load list");
      const byId: Record<string, any> = {};
      for (const i of jsonList.items || []) byId[i.submission_id] = i;
      const items = selectedRows.map((r) => ({
        submission_id: r.submission_id,
        contest_id: r.contest_id,
        winner_user_id: byId[r.submission_id].winner_user_id,
        referrer_user_id: byId[r.submission_id].referrer_user_id,
        winning_amount_cents: r.winning_amount_cents,
      }));
      const res = await fetch(`/api/admin/affiliate/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, default_rate_percent: bulkRate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to credit");
      toast.success("Credited");
      await fetchContest();
      setBulkOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to credit");
    } finally {
      setLoading(false);
    }
  };

  const handleViewEarners = () => {
    setEarnersLoading(true);
    router.push(`/dashboard/admin/affiliate/earners`);
  };

  const handleOpenContest = () => {
    if (!contestId) return;
    setContestLoading(true);
    router.push(`/dashboard/admin/affiliate/${contestId}`);
  };

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <Card
        className={cn(
          "shadow-md hover:shadow-lg transition-shadow duration-200 w-full",
          isDark ? "bg-[#170337]" : "bg-white border-gray-200"
        )}
      >
        <CardHeader>
          <CardTitle>Affiliate Commissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="flex-1 min-w-0 relative w-full">
              <Input
                placeholder="Search contest by ID or title..."
                value={selectedContest ? selectedContest.title : contestSearch}
                onChange={(e) => {
                  setContestSearch(e.target.value);
                  if (e.target.value) {
                    setOpen(true);
                  } else {
                    setSelectedContest(null);
                    setContestId("");
                    setOpen(false);
                  }
                }}
                onFocus={() => {
                  if (contestSearch) setOpen(true);
                }}
                className={cn(
                  "w-full",
                  isDark
                    ? "bg-[#170337] border border-gray-600 text-white"
                    : "bg-white text-black"
                )}
              />
              {open && contestSearch && (
                <div
                  className={cn(
                    "absolute z-50 w-full mt-1 border rounded-md shadow-md max-h-[300px] overflow-y-auto",
                    isDark
                      ? "bg-[#170337] border-gray-700"
                      : "bg-popover border-gray-200"
                  )}
                >
                  <Command shouldFilter={false}>
                    <CommandList
                      className={cn(isDark ? "bg-[#020817]" : "bg-white")}
                    >
                      <CommandEmpty>
                        {searching ? "Searching..." : "No contests found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {contests.map((contest) => (
                          <CommandItem
                            key={contest.id}
                            value={`${contest.id} ${contest.title}`}
                            onSelect={() => handleContestSelect(contest)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4 shrink-0",
                                selectedContest?.id === contest.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium truncate">
                                  {contest.title}
                                </span>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  ({contest.id})
                                </span>
                              </div>
                              {contest.start_date && (
                                <span className="text-xs text-muted-foreground">
                                  Start Date:{" "}
                                  {new Date(
                                    contest.start_date
                                  ).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:shrink-0 w-full sm:w-auto">
              <Button
                onClick={handleOpenContest}
                disabled={!contestId || contestLoading}
                className="w-full sm:w-auto"
              >
                {contestLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <span className="hidden sm:inline">Open Contest</span>
                <span className="sm:hidden">Open</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleViewEarners}
                disabled={earnersLoading}
                className="w-full sm:w-auto"
              >
                {earnersLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                <span className="hidden sm:inline">View Earners</span>
                <span className="sm:hidden">Earners</span>
              </Button>
              <Button
                onClick={fetchContest}
                disabled={!contestId || loading}
                className="w-full sm:w-auto"
              >
                {loading ? "Loading..." : "Load"}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Search and select a contest to view pending/credited affiliate rows.
            You can credit in bulk with custom %.
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card
          className={cn(
            "shadow-md hover:shadow-lg transition-shadow duration-200 w-full",
            isDark ? "bg-[#170337]" : "bg-white border-gray-200"
          )}
        >
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                <DialogTrigger asChild>
                  <Button
                    disabled={selectedRows.length === 0 || loading}
                    className="w-full sm:w-auto"
                  >
                    Credit Selected
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] max-w-md sm:w-full">
                  <DialogHeader>
                    <DialogTitle>Bulk Credit</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-sm whitespace-nowrap">
                        Commission %
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={bulkRate}
                        onChange={(e) =>
                          setBulkRate(Number(e.target.value || 0))
                        }
                        className="w-full sm:w-auto"
                      />
                    </div>
                    <div className="text-sm text-muted-foreground break-words">
                      Selected: {selectedRows.length} • Preview total: $
                      {(previewTotal / 100).toFixed(2)}
                    </div>
                  </div>
                  <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                      onClick={creditSelected}
                      disabled={loading}
                      className="w-full sm:w-auto"
                    >
                      Confirm Credit
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <div className="min-w-full inline-block align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 sm:w-auto">
                        <Checkbox
                          checked={
                            filtered.length > 0 &&
                            selectedRows.length ===
                              filtered.filter((r) => r.status === "pending")
                                .length
                          }
                          onCheckedChange={(v: any) => toggleAll(Boolean(v))}
                        />
                      </TableHead>
                      <TableHead className="min-w-[80px]">Contest</TableHead>
                      <TableHead className="min-w-[100px]">Winner</TableHead>
                      <TableHead className="min-w-[100px]">Referrer</TableHead>
                      <TableHead className="min-w-[90px]">Winnings</TableHead>
                      <TableHead className="min-w-[120px]">
                        Commission (10%)
                      </TableHead>
                      <TableHead className="min-w-[80px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.submission_id}>
                        <TableCell className="w-12 sm:w-auto">
                          {r.status === "pending" ? (
                            <Checkbox
                              checked={!!selected[r.submission_id]}
                              onCheckedChange={(v: any) =>
                                setSelected((prev) => ({
                                  ...prev,
                                  [r.submission_id]: Boolean(v),
                                }))
                              }
                            />
                          ) : null}
                        </TableCell>
                        <TableCell className="font-mono text-xs sm:text-sm">
                          <span className="hidden sm:inline">
                            {r.contest_id.slice(0, 8)}…
                          </span>
                          <span className="sm:hidden">
                            {r.contest_id.slice(0, 6)}…
                          </span>
                        </TableCell>
                        <TableCell className="truncate max-w-[120px] sm:max-w-none">
                          @{r.winner_username || "-"}
                        </TableCell>
                        <TableCell className="truncate max-w-[120px] sm:max-w-none">
                          @{r.referrer_username || "-"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          ${(r.winning_amount_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          ${(r.default_commission_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <span className="inline-block px-2 py-1 text-xs rounded-full bg-muted">
                            {r.status}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

"use client";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/ui/pagination-controls";

type Earner = {
  user_id: string;
  username?: string | null;
  full_name?: string | null;
  user_type: string;
  withdrawable_balance_cents: number;
  lifetime_affiliate_cents: number;
  last_affiliate_credit_at?: string | null;
};

export default function AffiliateEarnersPage() {
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

  const [rows, setRows] = useState<Earner[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) =>
        (r.username || "").toLowerCase().includes(term) ||
        (r.full_name || "").toLowerCase().includes(term)
    );
  }, [rows, q]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const paginated = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/affiliate/earners`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch");
      setRows(json.items || []);
    } catch (e) {
      // ignore inline
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Reset to first page when search changes
  useEffect(() => {
    setPage(1);
  }, [q]);

  // Keep current page in range when result size shrinks
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(filtered.length / limit));
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [filtered.length, limit, page]);

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

  const exportCsv = () => {
    const header = [
      "user_id",
      "username",
      "full_name",
      "user_type",
      "withdrawable_balance_cents",
      "lifetime_affiliate_cents",
      "last_affiliate_credit_at",
    ];
    const lines = [header.join(",")].concat(
      filtered.map((r) =>
        [
          r.user_id,
          r.username || "",
          r.full_name || "",
          r.user_type,
          String(r.withdrawable_balance_cents),
          String(r.lifetime_affiliate_cents),
          r.last_affiliate_credit_at || "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      )
    );
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affiliate-earners.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card
        className={cn(
          "shadow-md hover:shadow-lg transition-shadow duration-200",
          isDark ? "bg-[#170337]" : "bg-white border-gray-200"
        )}
      >
        <CardHeader>
          <CardTitle>Affiliate Earners</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Search by username/name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className={cn(
                isDark
                  ? "bg-[#170337] border border-gray-600 text-white"
                  : "bg-white text-black"
              )}
            />
            <Button onClick={load} disabled={loading}>
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "shadow-md hover:shadow-lg transition-shadow duration-200",
          isDark ? "bg-[#170337]" : "bg-white border-gray-200"
        )}
      >
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Withdrawable</TableHead>
                  <TableHead>Lifetime Affiliate</TableHead>
                  <TableHead>Last Credit</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground py-8"
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-5 w-5 text-muted-foreground"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        <span>Loading affiliate earners...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-sm text-muted-foreground"
                    >
                      No earners found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell>
                        @{r.username || r.user_id.slice(0, 6)}
                      </TableCell>
                      <TableCell>{r.user_type}</TableCell>
                      <TableCell>
                        ${(r.withdrawable_balance_cents / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        ${(r.lifetime_affiliate_cents / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {r.last_affiliate_credit_at
                          ? new Date(
                              r.last_affiliate_credit_at
                            ).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            href={`/dashboard/admin/affiliate/transactions/${r.user_id}`}
                          >
                            View transactions
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4">
            <PaginationControls
              page={page}
              limit={limit}
              total={total}
              totalPages={totalPages}
              hasNextPage={page < totalPages}
              hasPreviousPage={page > 1}
              onPageChange={setPage}
              onLimitChange={setLimit}
              loading={loading}
              isDark={isDark}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
